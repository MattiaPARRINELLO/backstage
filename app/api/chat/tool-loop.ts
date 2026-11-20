import {
  streamChatCompletion,
  chatCompletion,
  type UnifiedMessage,
  type StreamEvent,
} from "@/lib/ai-providers";
import { tools, toolPolicy, confirmationMessage } from "@/lib/chat-tools";
import { describeToolAction } from "@/lib/kernel/describe-tool-action";
import type { PendingActionReason, ToolRunResult } from "@/lib/chat-tools";
import { renderToolText } from "@/lib/tool-result";
import { serverLog } from "@/lib/logger";
import { renderToolResultMessage, runToolCall, type PendingToolCall } from "./tool-run";

/**
 * Un passage du modele, jusqu'aux appels d'outils qu'il demande.
 *
 * Responsabilite unique : consommer le flux du provider, collecter les appels
 * d'outils, les executer ou les mettre en attente, puis emettre la carte de
 * confirmation groupee. Le module ne connait ni le flux HTTP, ni la boucle de
 * tours, ni la persistance : il diffuse via `send` et modifie `messages`.
 */

export interface ToolLoopDeps {
  /** Historique envoye au provider, prolonge par le tour. */
  readonly messages: UnifiedMessage[];
  /** Diffusion d'un evenement SSE (met aussi a jour l'instantane serveur). */
  readonly send: (event: StreamEvent) => void;
  readonly sessionId: string;
  /** Modele principal, utilise pour le resume du lot a confirmer. */
  readonly modelName: string;
  /** Contamination du tour, mise a jour quand un outil lit du contenu tiers. */
  readonly provenance: { tainted: boolean };
}

export interface ModelPassResult {
  /** Faux quand le tour est termine : aucune action d'outil a rejouer. */
  readonly shouldContinue: boolean;
  /** Contenu final du passage, present uniquement quand un `done` a clos le tour. */
  readonly finalDone?: string;
  /** Erreur emise par le provider, quand le passage s'arrete dessus. */
  readonly error?: StreamEvent;
}

// Resume redige par l'IA des actions a confirmer d'un lot. Une seule carte de
// confirmation est affichee pour le lot entier ; ce resume en donne la
// synthese. En cas d'echec du passage modele, on retombe sur une suite de
// descriptions lisibles (jamais sur une carte vide).
async function summarizeConfirmBatch(
  model: string,
  actions: { name: string; arguments: string }[],
  describe: (name: string, args: Record<string, unknown>) => string,
  sessionId: string
): Promise<string> {
  const lines = actions.map((a) => {
    let args: Record<string, unknown> = {};
    try { args = JSON.parse(a.arguments); } catch {}
    return `- ${describe(a.name, args)}`;
  });
  const fallback = lines.join("\n");
  try {
    const result = await chatCompletion(
      model,
      [
        { role: "system", content: "Tu resumes en une ou deux phrases concises le lot d'actions ci-dessous que tu t'appretes a soumettre a la confirmation de l'utilisateur. Phrase fluide, factuelle, sans enumeration lourde, sans markdown ni preambule. Commence directement par le resume." },
        { role: "user", content: `Actions a confirmer :\n${fallback}` },
      ],
      [],
      undefined,
      sessionId
    );
    const summary = result.content?.trim();
    return summary && summary.length > 2 ? summary : fallback;
  } catch (err) {
    void serverLog("chat", "warn", "Confirm batch summary failed, using fallback", err, true);
    return fallback;
  }
}

export async function runModelPass(
  model: string,
  signal: AbortSignal,
  deps: ToolLoopDeps
): Promise<ModelPassResult> {
  const { messages, send, sessionId, modelName, provenance } = deps;
  const generator = streamChatCompletion(model, messages, tools, signal, sessionId);
  const toolCallsToExecute: { toolCallId: string; name: string; arguments: string }[] = [];
  let assistantContent = "";

  for await (const event of generator) {
    if (event.type === "tool_start") {
      toolCallsToExecute.push({
        toolCallId: event.toolCallId,
        name: event.name,
        arguments: event.arguments,
      });
      send(event);
      continue;
    }

    if (event.type === "done") {
      if (toolCallsToExecute.length === 0) {
        return { shouldContinue: false, finalDone: event.content };
      }
      continue;
    }

    if (event.type === "error") {
      return { shouldContinue: false, error: event };
    }

    if (event.type === "delta") {
      assistantContent += event.content;
    }

    send(event);
  }

  if (toolCallsToExecute.length === 0) {
    return { shouldContinue: false };
  }

  messages.push({
    role: "assistant",
    content: assistantContent || null,
    tool_calls: toolCallsToExecute.map((tc) => ({
      id: tc.toolCallId,
      type: "function",
      function: { name: tc.name, arguments: tc.arguments },
    })),
  });

  // Les actions a effet externe d'un meme tour sont regroupees en UNE seule
  // carte de confirmation (avec un resume redige par le modele), au lieu d'une
  // carte par outil. Chaque action reste executee individuellement via
  // POST /api/chat/confirm-batch quand l'utilisateur valide le lot.
  const pendingConfirms: PendingToolCall[] = [];

  const pushToolResult = (
    tc: { toolCallId: string; name: string },
    run: ToolRunResult
  ) => {
    send({ type: "tool_result", name: tc.name, result: run.text, status: run.status });
    messages.push({
      role: "tool",
      tool_call_id: tc.toolCallId,
      // Resultat d'outil delimite : le contenu (pages, emails, recherche) est
      // externe et NON FIABLE : le modele ne doit pas suivre ses instructions
      // (cf. bloc CONTENU NON FIABLE du system prompt).
      content: renderToolResultMessage(tc.name, run),
    });
  };

  // Le lot courant est contamine des qu'un de ses appels lit du contenu tiers
  // (cas du PoC : lire un email et modifier un rappel dans le meme lot). La
  // contamination s'accumule sur le tour : une lecture faite a une iteration
  // precedente gate aussi les ecritures suivantes.
  provenance.tainted = provenance.tainted ||
    toolCallsToExecute.some((tc) => toolPolicy(tc.name).untrusted);

  for (const tc of toolCallsToExecute) {
    const outcome = await runToolCall(tc, provenance.tainted);
    if (outcome.kind === "pending") {
      // Action a effet externe : deja enregistree cote serveur, mise de cote
      // pour etre proposee en lot. L'execution reelle passera par
      // POST /api/chat/confirm-batch.
      pendingConfirms.push(outcome);
      continue;
    }
    pushToolResult(tc, outcome.result);
  }

  if (pendingConfirms.length > 0) {
    // Resume du lot redige par le modele + evenement unique de lot.
    const summary = await summarizeConfirmBatch(modelName, pendingConfirms, describeToolAction, sessionId);
    // Une seule raison par carte : si une action du lot est liee a du contenu
    // tiers, la carte l'annonce (la plus prudente l'emporte).
    const reason: PendingActionReason = pendingConfirms.some(
      (tc) => tc.reason === "provenance"
    )
      ? "provenance"
      : "policy";
    send({
      type: "group_confirm",
      id: `group-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
      summary,
      reason,
      tools: pendingConfirms.map((tc) => ({
        toolCallId: tc.toolCallId,
        name: tc.name,
        arguments: tc.arguments,
      })),
    });
    // Le modele recoit un resultat de blocage par action et pourra expliquer
    // que ces actions attendent sa confirmation.
    for (const tc of pendingConfirms) {
      const text = confirmationMessage(tc.name);
      pushToolResult(tc, {
        status: "blocked",
        text,
        rendered: renderToolText("blocked", text),
      });
    }
  }

  return { shouldContinue: true };
}
