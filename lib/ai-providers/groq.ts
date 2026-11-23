import OpenAI from "openai";

import { getConfig } from "@/lib/config";

/**
 * Extraction JSON courte via Groq.
 *
 * Groq sert les taches « en direct » nombreuses et bon marche (scan des
 * accreditations) sans mobiliser le modele de conversation. Le fournisseur est
 * choisi ici, dans le noyau : un module ne connait ni Groq ni sa cle, il demande
 * une extraction structuree (`ctx.ai.json`).
 */
const TIMEOUT_MS = 20_000;
const MAX_ATTEMPTS = 3;

type GroqParams = OpenAI.Chat.ChatCompletionCreateParamsNonStreaming & {
  reasoning_effort?: "low" | "medium" | "high";
};

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
 * rejete une generation vide (souvent une limite de tokens atteinte par le
 * raisonnement). On retente alors sans `response_format` : le module sait lire
 * un JSON entoure de texte, et le second essai passe.
 */
function isRetryable(error: unknown): boolean {
  const status = statusOf(error);
  if (status === 429) return true;
  const message = error instanceof Error ? error.message : String(error);
  return /json_validate_failed|Failed to validate JSON|reponse vide/i.test(message);
}

export function isGroqConfigured(): boolean {
  return Boolean(getConfig().GROQ_API_KEY);
}

export async function groqJson(system: string, prompt: string): Promise<string> {
  const config = getConfig();
  if (!config.GROQ_API_KEY) {
    throw new Error("GROQ_API_KEY absent : renseigner la cle Groq dans .env.local.");
  }

  const client = new OpenAI({
    baseURL: config.GROQ_BASE_URL,
    apiKey: config.GROQ_API_KEY,
    timeout: TIMEOUT_MS,
    maxRetries: 1,
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
      if (last || !isRetryable(error)) throw error;
      await sleep(statusOf(error) === 429 ? 4000 * (attempt + 1) : 400);
    }
  }

  throw new Error("Groq n'a rendu aucune reponse exploitable.");
}
