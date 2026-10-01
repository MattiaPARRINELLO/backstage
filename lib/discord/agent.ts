import { tools } from "@/lib/chat-tools";
import type { UnifiedMessage, UnifiedTool } from "@/lib/ai-providers";

/**
 * Outils exposés au bot Discord. Liste en dur, appliquée côté serveur : le
 * routeur ne voit que ces schémas, et l'exécution est refusée pour tout autre
 * nom — un petit modèle hallucine facilement un nom d'outil plausible.
 */
export const READ_ONLY_TOOLS = [
  "get_schedule",
  "list_reminders",
  "get_weather",
  "lookup_concerts",
  "search_calendar_events",
  "fetch_and_search_emails",
  "list_photo_shoots",
] as const;

export type ReadOnlyTool = (typeof READ_ONLY_TOOLS)[number];

export interface ToolChoice {
  tool: ReadOnlyTool;
  args: Record<string, unknown>;
}

export const MAX_MESSAGE_LENGTH = 500;

export function readOnlyCatalog(): UnifiedTool[] {
  const allowed: readonly string[] = READ_ONLY_TOOLS;
  return tools.filter((t) => allowed.includes(t.name));
}

const SYSTEM_PROMPT = `Tu routes les demandes de l'utilisateur vers UN outil de BACKSTAGE, son assistant personnel.
Reponds UNIQUEMENT par un objet JSON, sans texte avant ni apres : {"tool":"<nom>","args":{...}}
- "args" doit respecter exactement le schema de l'outil (seules les cles declarees).
- Si aucun outil ne convient (discussion, salutation, demande unknowable), reponds {"tool":"none","args":{}}.
Outils disponibles :
{catalog}`;

function catalogForPrompt(): string {
  return readOnlyCatalog()
    .map((t) => `- ${t.name}: ${t.description}\n  schema: ${JSON.stringify(t.parameters)}`)
    .join("\n");
}

export function buildRouterMessages(message: string): UnifiedMessage[] {
  return [
    { role: "system", content: SYSTEM_PROMPT.replace("{catalog}", catalogForPrompt()) },
    { role: "user", content: message.slice(0, MAX_MESSAGE_LENGTH) },
  ];
}

/** Premier objet JSON équilibré du texte (accolades dans les chaînes ignorées). */
export function extractJsonObject(raw: string): string | null {
  const text = raw.replace(/```json?/gi, "").replace(/```/g, "");
  const start = text.indexOf("{");
  if (start === -1) return null;

  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < text.length; i++) {
    const char = text[i];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (char === "\\") {
      escaped = true;
      continue;
    }
    if (char === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;
    if (char === "{") depth += 1;
    else if (char === "}") {
      depth -= 1;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }
  return null;
}

/** Parse une réponse de modèle en choix d'outil validé, ou null. */
export function parseToolChoice(raw: string): ToolChoice | null {
  const json = extractJsonObject(raw);
  if (!json) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== "object") return null;

  const { tool, args } = parsed as { tool?: unknown; args?: unknown };
  if (typeof tool !== "string") return null;
  if (!(READ_ONLY_TOOLS as readonly string[]).includes(tool)) return null;

  const cleanArgs =
    args && typeof args === "object" && !Array.isArray(args)
      ? (args as Record<string, unknown>)
      : {};
  return { tool: tool as ReadOnlyTool, args: cleanArgs };
}

/** Nettoie une réponse d'outil des marqueurs internes avant envoi dans le DM. */
export function formatReply(text: string): string {
  return text.replace(/^ACTION_BLOCKED:/, "").trim().slice(0, 1800);
}