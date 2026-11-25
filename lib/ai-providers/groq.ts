import OpenAI from "openai";

import { getConfig } from "@/lib/config";

/**
 * Extraction JSON courte via Groq.
 *
 * Groq sert les taches « en direct » nombreuses et bon marche (scan des
 * accreditations) sans mobiliser le modele de conversation. Le fournisseur est
 * choisi ici, dans le noyau : un module ne connait ni Groq ni ses cles, il
 * demande une extraction structuree (`ctx.ai.json`).
 *
 * Plusieurs cles peuvent etre fournies (`GROQ_API_KEYS`, separees par des
 * virgules) : chaque compte a son propre quota, la rotation passe a la cle
 * suivante quand l'une renvoie 429 (quota) ou 401/403 (cle refusee).
 */
const TIMEOUT_MS = 20_000;
const MAX_ATTEMPTS = 3;
const RETRYABLE_STATUS = new Set([401, 403, 429]);

type GroqParams = OpenAI.Chat.ChatCompletionCreateParamsNonStreaming & {
  reasoning_effort?: "low" | "medium" | "high";
};

/** Decoupe une liste de cles, deduit les doublons et ignore les vides. */
export function parseGroqKeys(raw: string | undefined): string[] {
  if (!raw) return [];
  return [
    ...new Set(
      raw
        .split(/[\s,;]+/)
        .map((key) => key.trim())
        .filter(Boolean)
    ),
  ];
}

export function configuredGroqKeys(): string[] {
  const config = getConfig();
  return [
    ...new Set([
      ...parseGroqKeys(config.GROQ_API_KEYS),
      ...parseGroqKeys(config.GROQ_API_KEY),
    ]),
  ];
}

export function isGroqConfigured(): boolean {
  return configuredGroqKeys().length > 0;
}

/** Delais par defaut entre deux extractions, selon le nombre de comptes. */
const SINGLE_KEY_JSON_DELAY_MS = 6000;
const POOLED_KEY_JSON_DELAY_MS = 1500;

/**
 * Attente entre deux extractions JSON.
 *
 * Chaque compte Groq a son propre quota de tokens par minute : empiler les
 * comptes permet d'enchainer plus vite. Le plafond d'une cle unique (gpt-oss-20b)
 * impose ~6 s entre deux lots ; avec deux comptes, 1,5 s suffit, et un 429
 * eventuel est de toute facon rattrape via `retry-after`.
 */
export function jsonDelayForKeys(keyCount: number, override?: string): number {
  if (override !== undefined) {
    const value = Number(override);
    if (Number.isFinite(value) && value >= 0) return value;
  }
  if (keyCount === 0) return 0;
  return keyCount >= 2 ? POOLED_KEY_JSON_DELAY_MS : SINGLE_KEY_JSON_DELAY_MS;
}

/** Delai a respecter maintenant, selon la configuration courante. */
export function groqJsonDelayMs(): number {
  const config = getConfig();
  return jsonDelayForKeys(
    configuredGroqKeys().length,
    config.GROQ_SCAN_DELAY_MS
  );
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function statusOf(error: unknown): number | undefined {
  return typeof error === "object" && error !== null && "status" in error
    ? (error as { status?: number }).status
    : undefined;
}

/**
 * Un echec `json_validate_failed` de Groq signifie que le mode JSON strict a
 * rejete une generation vide. On retente alors sans `response_format` : le
 * module sait lire un JSON entoure de texte, et le second essai passe.
 */
function isJsonRetryable(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /json_validate_failed|Failed to validate JSON|reponse vide/i.test(message);
}

async function callWithKey(
  apiKey: string,
  system: string,
  prompt: string
): Promise<string> {
  const config = getConfig();
  const client = new OpenAI({
    baseURL: config.GROQ_BASE_URL,
    apiKey,
    timeout: TIMEOUT_MS,
    maxRetries: 0,
  });

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const strictJson = attempt === 0;
    try {
      const params: GroqParams = {
        model: config.GROQ_MODEL,
        temperature: 0,
        max_completion_tokens: 900,
        reasoning_effort: "low",
        messages: [
          { role: "system", content: system },
          {
            role: "user",
            content: strictJson
              ? prompt
              : `${prompt}\n\nReponds uniquement un objet JSON valide, sans texte autour.`,
          },
        ],
        ...(strictJson ? { response_format: { type: "json_object" } } : {}),
      };
      const response = await client.chat.completions.create(params);
      const content = (response.choices[0]?.message?.content ?? "").trim();
      if (content) return content;
      throw new Error("reponse vide");
    } catch (error) {
      const last = attempt === MAX_ATTEMPTS - 1;
      if (last || !isJsonRetryable(error)) throw error;
      await sleep(400);
    }
  }

  throw new Error("Groq n'a rendu aucune reponse exploitable.");
}

/** Plafond d'attente : un scan ne doit pas rester bloque une minute par 429. */
const MAX_RETRY_WAIT_MS = 20_000;

/**
 * Delai demande par Groq dans `retry-after`, en millisecondes.
 *
 * Le quota Groq est par minute : repartir apres 4 s fixes relance le 429.
 * On suit l'en-tete quand il est present, borne pour rester exploitable.
 */
export function retryAfterMs(error: unknown): number | null {
  const headers = (error as { headers?: unknown } | null)?.headers;
  const raw =
    headers instanceof Headers
      ? headers.get("retry-after")
      : typeof headers === "object" && headers !== null
        ? (headers as Record<string, string | undefined>)["retry-after"]
        : undefined;
  if (!raw) return null;
  const seconds = Number(raw);
  if (!Number.isFinite(seconds) || seconds < 0) return null;
  return Math.min(seconds * 1000, MAX_RETRY_WAIT_MS);
}

export async function groqJson(system: string, prompt: string): Promise<string> {
  const keys = configuredGroqKeys();
  if (keys.length === 0) {
    throw new Error("GROQ_API_KEY absent : renseigner la cle Groq dans .env.local.");
  }

  let lastError: unknown = null;
  // Trois tours : un 429 sur une cle unique est souvent passager (reset a la
  // minute). Avec plusieurs cles, le premier tour suffit.
  for (let round = 0; round < 3; round++) {
    for (const key of keys) {
      try {
        return await callWithKey(key, system, prompt);
      } catch (error) {
        lastError = error;
        // Quota ou cle refusee : le compte suivant a son propre quota.
        const status = statusOf(error);
        if (status !== undefined && RETRYABLE_STATUS.has(status)) continue;
        throw error;
      }
    }
    if (statusOf(lastError) !== 429 || round === 2) break;
    await sleep(retryAfterMs(lastError) ?? 4000);
  }

  throw lastError instanceof Error
    ? lastError
    : new Error("Toutes les cles Groq sont epuisees ou refusees.");
}
