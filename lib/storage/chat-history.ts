import type { ChatHistory, ChatSession } from "../types";
import type { ChatRunStep, ChatRunTool } from "../chat-run-types";
import type { ToolStatus } from "../tool-result";
import { mutateJson, readJsonSafe } from "../storage-core";

type ChatSessionMessage = ChatSession["messages"][number];

function fallbackTitle(content: string): string {
  const cleaned = content.replace(/\s+/g, " ").trim();
  if (!cleaned) return "Nouvelle conversation";
  return cleaned.length <= 50
    ? cleaned
    : cleaned.slice(0, 50).replace(/\s\S*$/, "") + "…";
}

const defaultChatHistory: ChatHistory = {
  sessions: [],
};

export async function getChatHistory(): Promise<ChatHistory> {
  return readJsonSafe<ChatHistory>("chat-history.json", defaultChatHistory);
}

export async function saveChatSession(session: ChatSession): Promise<void> {
  session.updatedAt = new Date().toISOString();
  await mutateJson<ChatHistory>("chat-history.json", defaultChatHistory, (data) => {
    const idx = data.sessions.findIndex((s) => s.id === session.id);
    if (idx >= 0) {
      data.sessions[idx] = session;
    } else {
      data.sessions.push(session);
    }
  });
}

// Écriture serveur d'un tour terminé, indépendante du client : c'est ce qui
// garantit que la réponse n'est pas perdue quand l'onglet a été fermé ou que
// le client a navigué pendant la génération.
//
// On relit la session existante et on AJOUTE le message assistant pour
// préserver les identifiants et horodatages déjà enregistrés. Si le client a
// déjà écrit la même réponse, on ne crée pas de doublon.
export async function appendAssistantTurn(input: {
  sessionId: string;
  userContent?: string;
  assistantContent: string;
  toolCalls?: ChatRunTool[];
  steps?: ChatRunStep[];
  activityMs?: number;
}): Promise<void> {
  const { sessionId, userContent, assistantContent, toolCalls, steps, activityMs } = input;
  const now = new Date().toISOString();

  await mutateJson<ChatHistory>("chat-history.json", defaultChatHistory, (data) => {
    const idx = data.sessions.findIndex((s) => s.id === sessionId);
    const existing = idx >= 0 ? data.sessions[idx] : null;
    const messages: ChatSessionMessage[] = existing ? [...existing.messages] : [];

    if (userContent) {
      const lastUser = [...messages].reverse().find((m) => m.role === "user");
      if (!lastUser || lastUser.content !== userContent) {
        messages.push({
          id: `user-${Date.now().toString(36)}`,
          role: "user",
          content: userContent,
          timestamp: now,
        });
      }
    }

    const last = messages[messages.length - 1];
    const alreadySaved =
      last &&
      last.role === "assistant" &&
      last.content === assistantContent;
    if (!alreadySaved && (assistantContent.trim() || toolCalls?.length)) {
      messages.push({
        id: `assistant-${Date.now().toString(36)}`,
        role: "assistant",
        content: assistantContent,
        timestamp: now,
        ...(activityMs ? { activityMs } : {}),
        ...(steps?.length ? { steps } : {}),
        toolCalls: toolCalls?.map((tc) => ({
          id: tc.id,
          name: tc.name,
          arguments: tc.arguments,
          result: tc.result,
          status: tc.status,
          duration: tc.duration,
          resultCount: tc.resultCount,
        })),
      });
    }

    const firstUser = [...messages].find((m) => m.role === "user");
    const session: ChatSession = {
      id: sessionId,
      title: existing?.title || fallbackTitle(firstUser?.content ?? ""),
      messages,
      createdAt: existing?.createdAt || now,
      updatedAt: now,
      ...(existing?.context ? { context: existing.context } : {}),
    };

    if (idx >= 0) {
      data.sessions[idx] = session;
    } else {
      data.sessions.push(session);
    }
  });
}

/**
 * Reporte le résultat réel d'une action confirmée sur le tour persisté.
 *
 * Sans cette écriture, l'historique garde le `[BLOQUE]` produit avant la
 * confirmation : au rechargement ou au changement de page, le récapitulatif
 * `<executed_actions>` rejoue un blocage alors que l'action a abouti (issue
 * #141). La donnée serveur est la source de vérité ; le client met à jour sa
 * copie locale, le serveur met à jour l'historique.
 */
export async function applyConfirmedToolResults(
  sessionId: string,
  updates: { toolCallId: string; status: ToolStatus; result: string }[]
): Promise<void> {
  if (!sessionId || updates.length === 0) return;
  const byId = new Map(updates.map((u) => [u.toolCallId, u]));
  const status = (s: ToolStatus): "success" | "error" =>
    s === "error" || s === "blocked" ? "error" : "success";

  await mutateJson<ChatHistory>("chat-history.json", defaultChatHistory, (data) => {
    const session = data.sessions.find((s) => s.id === sessionId);
    if (!session) return null;
    let changed = false;
    session.messages = session.messages.map((message) => {
      let messageChanged = false;
      const toolCalls = message.toolCalls?.map((tc) => {
        const update = byId.get(tc.id);
        if (!update) return tc;
        changed = true;
        messageChanged = true;
        return { ...tc, result: update.result, status: status(update.status) };
      });
      const steps = message.steps?.map((step) => {
        if (step.kind !== "tool") return step;
        const update = byId.get(step.id);
        if (!update) return step;
        changed = true;
        messageChanged = true;
        return { ...step, result: update.result, status: status(update.status) };
      });
      return messageChanged ? { ...message, toolCalls, steps } : message;
    });
    return changed ? undefined : null;
  });
}

export async function deleteChatSession(id: string): Promise<boolean> {
  let deleted = false;
  await mutateJson<ChatHistory>("chat-history.json", defaultChatHistory, (data) => {
    const before = data.sessions.length;
    data.sessions = data.sessions.filter((s) => s.id !== id);
    deleted = data.sessions.length !== before;
    return deleted ? undefined : null;
  });
  return deleted;
}
