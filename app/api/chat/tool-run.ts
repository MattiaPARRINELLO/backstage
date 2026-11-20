import {
  registerPendingAction,
  runTool,
  toolPolicy,
  type PendingActionReason,
  type ToolRunResult,
} from "@/lib/chat-tools";
import { renderToolText } from "@/lib/tool-result";

/**
 * Execution d'un appel d'outil du chat, et formatage de son resultat.
 *
 * Une seule responsabilite : transformer un appel demande par le modele en
 * effet observable. Selon la politique de l'outil et la provenance du tour,
 * l'appel est execute ou mis en attente de confirmation (et enregistre cote
 * serveur). Le module ne connait ni le SSE, ni l'historique de conversation,
 * ni les cartes groupees : l'appelant decide de ce qu'il diffuse.
 */

/** Appel d'outil tel que le provider l'a emis. */
export interface ToolCallRequest {
  readonly toolCallId: string;
  readonly name: string;
  readonly arguments: string;
}

/** Appel bloque, en attente de confirmation utilisateur. */
export interface PendingToolCall {
  readonly kind: "pending";
  readonly toolCallId: string;
  readonly name: string;
  readonly arguments: string;
  readonly args: Record<string, unknown>;
  readonly reason: PendingActionReason;
}

/** Appel execute (succes, resultat vide ou echec) et son resultat. */
export interface ExecutedToolCall {
  readonly kind: "executed";
  readonly toolCallId: string;
  readonly name: string;
  readonly result: ToolRunResult;
}

export type ToolCallOutcome = PendingToolCall | ExecutedToolCall;

/**
 * Execute un appel d'outil, ou l'enregistre en attente de confirmation.
 *
 * `tainted` : le tour a deja lu du contenu tiers non fiable. Une ecriture est
 * alors bloquee comme si la politique l'exigeait (raison `provenance`).
 */
export async function runToolCall(
  toolCall: ToolCallRequest,
  tainted: boolean
): Promise<ToolCallOutcome> {
  try {
    const args = parseToolArguments(toolCall.arguments);
    const policy = toolPolicy(toolCall.name);
    const blockedByProvenance = !policy.requiresConfirmation && tainted && policy.write;
    if (policy.requiresConfirmation || blockedByProvenance) {
      const reason: PendingActionReason = policy.requiresConfirmation ? "policy" : "provenance";
      // Enregistre avant de proposer : /api/chat/confirm[-batch] refuse toute
      // action absente du registre, substituee ou rejouee.
      registerPendingAction(toolCall.name, args, reason);
      return {
        kind: "pending",
        toolCallId: toolCall.toolCallId,
        name: toolCall.name,
        arguments: toolCall.arguments,
        args,
        reason,
      };
    }
    return {
      kind: "executed",
      toolCallId: toolCall.toolCallId,
      name: toolCall.name,
      result: await runTool(toolCall.name, args),
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      kind: "executed",
      toolCallId: toolCall.toolCallId,
      name: toolCall.name,
      result: {
        status: "error",
        text: `Erreur: ${message}`,
        rendered: renderToolText("error", `Erreur: ${message}`),
      },
    };
  }
}

/**
 * Contenu d'un message `tool`. Le resultat est delimite : le contenu externe
 * reste NON FIABLE pour le modele, et le statut en tete dit sans ambiguite si
 * l'action a abouti.
 */
export function renderToolResultMessage(name: string, run: ToolRunResult): string {
  return `<tool_result name="${name}" status="${run.status}">\n${run.rendered}\n</tool_result>`;
}

// Validation stricte : des arguments invalides ne doivent jamais devenir un
// appel silencieux avec `{}` ni une carte de confirmation cassee.
function parseToolArguments(argumentsRaw: string): Record<string, unknown> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(argumentsRaw);
  } catch {
    throw new Error("arguments d'outil invalides (JSON)");
  }
  if (!isRecord(parsed)) {
    throw new Error("arguments d'outil invalides (JSON)");
  }
  return parsed;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
