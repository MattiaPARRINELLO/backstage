import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import OpenAI from "openai";
import { checkRateLimit } from "@/lib/rate-limit";
import { getClientConfig } from "@/lib/ai-providers/config";
import { getRequestId, serverLog } from "@/lib/logger";
import { recordDemoCall as appendDemoCall } from "@/lib/storage";
import {
  DEMO_SYSTEM_PROMPT,
  buildDemoContext,
  selectSources,
} from "@/lib/landing/demo-context";
import type { DemoCallOutcome } from "@/lib/types";

// ============================================================
// MINI-DÉMO PUBLIQUE — endpoint strictement limité.
// - DeepSeek appelé UNIQUEMENT côté serveur (clé jamais exposée)
// - contexte 100 % fictif, aucune donnée utilisateur réelle
// - aucun outil, aucune donnée de l'application privée
// - journal d'audit local protégé, rate limiting par IP, timeout court, entrée bornée
// ============================================================

const bodySchema = z.object({
  message: z.string().trim().min(1, "Message requis").max(400, "Message trop long"),
  lang: z.enum(["fr", "en"]).optional(),
});

function demoMessage(lang: "fr" | "en", fr: string, en: string): string {
  return lang === "en" ? en : fr;
}

// Modele le plus leger du provider. Attention : un identifiant mort fait
// repondre 400 "Model is unavailable" au provider, ce qui rend la demo
// muette en production (constate avec `deepseek-v4-flash`).
const DEMO_MODEL = "deepseek-v4.1-flash";
const DEMO_MAX_TOKENS = 350;
const DEMO_TIMEOUT_MS = 20_000;
const RATE_LIMIT = 8; // demandes / minute / IP
const GLOBAL_RATE_LIMIT = 60; // garde-fou provider, toutes IP confondues
const MAX_CONTEXT_CHARS = 2_000;
const LOG_INPUT_MAX_CHARS = 400;
const LOG_RESPONSE_MAX_CHARS = 10_000;

function clientIp(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for");
  const realIp = request.headers.get("x-real-ip");
  return forwarded?.split(",")[0]?.trim() || realIp?.trim() || "inconnu";
}

async function persistDemoCall(
  request: NextRequest,
  ip: string,
  startedAt: number,
  status: number,
  outcome: DemoCallOutcome,
  input: string | null,
  response: string | null,
  sources: { kind: string; title: string }[],
  error: string | null
): Promise<void> {
  const entry = {
    requestId: await getRequestId(),
    ip: ip.slice(0, 64),
    forwardedFor: (request.headers.get("x-forwarded-for") ?? "").slice(0, 512),
    realIp: (request.headers.get("x-real-ip") ?? "").slice(0, 64),
    userAgent: (request.headers.get("user-agent") ?? "inconnu").slice(0, 256),
    referer: (request.headers.get("referer") ?? "inconnu").slice(0, 512),
    model: DEMO_MODEL,
    input: input?.slice(0, LOG_INPUT_MAX_CHARS) ?? null,
    response: response?.slice(0, LOG_RESPONSE_MAX_CHARS) ?? null,
    error: error?.slice(0, 500) ?? null,
    sources: sources.map(({ kind, title }) => ({ kind, title })),
    status,
    outcome,
    durationMs: Date.now() - startedAt,
  };

  try {
    await appendDemoCall(entry);
  } catch (err) {
    void serverLog("demo", "error", "Échec de la journalisation d'un appel", err);
  }
}

export async function POST(request: NextRequest) {
  const startedAt = Date.now();
  const ip = clientIp(request);

  let rawBody = "";
  try {
    rawBody = await request.text();
  } catch {
    await persistDemoCall(
      request,
      ip,
      startedAt,
      400,
      "invalid_json",
      null,
      null,
      [],
      "Corps de requête illisible"
    );
    return NextResponse.json({ error: "Requête invalide" }, { status: 400 });
  }

  let earlyLang: "fr" | "en" = "fr";
  try {
    const early = JSON.parse(rawBody) as { lang?: unknown };
    if (early?.lang === "en") earlyLang = "en";
  } catch {
    // Corps illisible : la validation ci-dessous s'en charge.
  }

  if (
    !checkRateLimit(`demo:${ip}`, RATE_LIMIT) ||
    !checkRateLimit("demo:global", GLOBAL_RATE_LIMIT)
  ) {
    await persistDemoCall(
      request,
      ip,
      startedAt,
      429,
      "rate_limited",
      rawBody || null,
      null,
      [],
      "Quota de requêtes dépassé"
    );
    return NextResponse.json(
      { error: demoMessage(earlyLang, "Trop de demandes. Réessayez dans un instant.", "Too many requests. Try again in a moment.") },
      { status: 429 }
    );
  }

  let body: unknown;
  try {
    body = JSON.parse(rawBody) as unknown;
  } catch {
    await persistDemoCall(
      request,
      ip,
      startedAt,
      400,
      "invalid_json",
      rawBody || null,
      null,
      [],
      "Requête JSON invalide"
    );
    return NextResponse.json({ error: "Requête invalide" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? "Requête invalide";
    await persistDemoCall(request, ip, startedAt, 400, "invalid_input", rawBody, null, [], message);
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const message = parsed.data.message;
  const lang = parsed.data.lang ?? "fr";
  const sources = selectSources(message);

  let client: OpenAI;
  try {
    client = new OpenAI(getClientConfig());
  } catch {
    await persistDemoCall(
      request,
      ip,
      startedAt,
      503,
      "configuration_error",
      message,
      null,
      sources.map(({ kind, title }) => ({ kind, title })),
      "Configuration IA absente"
    );
    return NextResponse.json(
      { error: demoMessage(lang, "Démonstration indisponible", "Demo unavailable") },
      { status: 503 }
    );
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), DEMO_TIMEOUT_MS);

  try {
    const completion = await client.chat.completions.create(
      {
        model: DEMO_MODEL,
        messages: [
          { role: "system", content: DEMO_SYSTEM_PROMPT },
          { role: "system", content: buildDemoContext().slice(0, MAX_CONTEXT_CHARS) },
          ...(lang === "en"
            ? [
                {
                  role: "system" as const,
                  content: "Answer in English, in the same concise tone.",
                },
              ]
            : []),
          { role: "user", content: message },
        ],
        temperature: 0.4,
        max_tokens: DEMO_MAX_TOKENS,
      },
      { signal: controller.signal, timeout: DEMO_TIMEOUT_MS }
    );

    const reply = completion.choices[0]?.message?.content?.trim() ?? "";
    if (!reply) {
      await persistDemoCall(
        request,
        ip,
        startedAt,
        502,
        "empty_response",
        message,
        null,
        sources.map(({ kind, title }) => ({ kind, title })),
        "Réponse vide du modèle"
      );
      return NextResponse.json(
        { error: demoMessage(lang, "Réponse vide du modèle. Réessayez.", "Empty model response. Try again.") },
        { status: 502 }
      );
    }

    await persistDemoCall(request, ip, startedAt, 200, "success", message, reply, sources.map(({ kind, title }) => ({ kind, title })), null);
    return NextResponse.json({ reply, sources });
  } catch (err) {
    const aborted = err instanceof Error && err.name === "AbortError";
    const errorMessage = aborted
      ? demoMessage(lang, "La démonstration a mis trop de temps à répondre. Réessayez.", "The demo took too long to answer. Try again.")
      : demoMessage(lang, "La démonstration est momentanément indisponible. Réessayez.", "The demo is temporarily unavailable. Try again.");
    await persistDemoCall(
      request,
      ip,
      startedAt,
      aborted ? 504 : 502,
      aborted ? "timeout" : "provider_error",
      message,
      null,
      sources.map(({ kind, title }) => ({ kind, title })),
      errorMessage
    );
    void serverLog("demo", "error", aborted ? "Délai provider dépassé" : "Erreur provider", err, true);
    return NextResponse.json({ error: errorMessage }, { status: aborted ? 504 : 502 });
  } finally {
    clearTimeout(timeout);
  }
}
