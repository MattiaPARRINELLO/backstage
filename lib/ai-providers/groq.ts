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

export async function groqJson(system: string, prompt: string): Promise<string> {
  const keys = configuredGroqKeys();
  if (keys.length === 0) {
    throw new Error("GROQ_API_KEY absent : renseigner la cle Groq dans .env.local.");
  }

  let lastError: unknown = null;
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

  throw lastError instanceof Error
    ? lastError
    : new Error("Toutes les cles Groq sont epuisees ou refusees.");
}
