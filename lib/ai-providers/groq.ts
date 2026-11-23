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

  const response = await client.chat.completions.create({
    model: config.GROQ_MODEL,
    temperature: 0,
    max_tokens: 400,
    // Groq exige le mot « json » dans les messages pour ce mode.
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: system },
      { role: "user", content: prompt },
    ],
  });

  return (response.choices[0]?.message?.content ?? "").trim();
}
