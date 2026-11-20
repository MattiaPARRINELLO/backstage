import { appendAssistantTurn } from "@/lib/storage";
import { finishRun, type ChatRun } from "@/lib/chat-runs";
import type { UnifiedMessage, StreamEvent } from "@/lib/ai-providers";
import type { ChatRequestMessage } from "@/lib/types";
import { parseToolText, isFailedStatus, TOOL_HONESTY_RULE } from "@/lib/tool-result";
import { serverLog } from "@/lib/logger";
import { runMemoryExtraction } from "./memory-extraction";
import { runModelPass } from "./tool-loop";

/**
 * Boucle de generation d'un tour de chat.
 *
 * Responsabilite unique : enchainer les passages du modele (avec repli sur le
 * modele alternatif), cloturer le tour, ecrire la reponse dans l'historique et
 * lancer l'extraction memoire. Le module ne connait ni la requete HTTP, ni le
 * flux SSE : il diffuse via `send` et agit sur le run fourni.
 */

// Consigne injectee apres un resultat d'outil en echec ou bloque : force le
// modele a rendre compte fidelement au lieu d'annoncer une action non faite.
const RESULT_HONESTY_RULE = TOOL_HONESTY_RULE;

// Le dernier resultat d'outil est-il un echec ou un blocage ? Si oui, la
// reponse finale du modele risque d'annoncer une action non realisee. Le
// marqueur `[ERREUR]` / `[BLOQUE]` fait foi, pas la formulation du texte.
function lastToolResultIsProblematic(messages: UnifiedMessage[]): boolean {
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (m.role !== "tool") continue;
    const inner = (m.content ?? "")
      .replace(/^<tool_result[^>]*>\s*/, "")
      .replace(/<\/tool_result>\s*$/, "")
      .trim();
    return isFailedStatus(parseToolText(inner).status);
  }
  return false;
}

export interface GenerationDeps {
  /** Historique envoye au provider, prolonge par le tour. */
  readonly messages: UnifiedMessage[];
  /** Messages de conversation de la requete, pour l'extraction memoire. */
  readonly bodyMessages: ChatRequestMessage[];
  /** Contamination du tour, mise a jour par les passages du modele. */
  readonly provenance: { tainted: boolean };
  readonly sessionId: string;
  readonly modelName: string;
  readonly altModel: string;
  readonly lastUserContent: string;
  readonly run: ChatRun;
  readonly send: (event: StreamEvent) => void;
  readonly closeStream: () => void;
}

export async function runGeneration(deps: GenerationDeps): Promise<void> {
  const {
    messages,
    bodyMessages,
    provenance,
    sessionId,
    modelName,
    altModel,
    lastUserContent,
    run,
    send,
    closeStream,
  } = deps;

  const maxIterations = 20;

  // Evenement de fermeture dicte par le dernier passage du modele.
  // Envoye AVANT l'ecriture disque et l'extraction memoire : le tour est
  // termine pour le client, qui peut lire la reponse sans attendre.
  let pendingDone = "";
  let pendingError: StreamEvent | null = null;
  let lastAssistantContent = "";

  // Ecriture de la reponse dans l'historique. Tolerance aux erreurs : un
  // echec de persistance ne doit pas transformer une generation reussie en
  // erreur affichee a l'utilisateur.
  async function persistTurn(content: string): Promise<void> {
    if (!content.trim() && run.tools.length === 0) return;
    try {
      await appendAssistantTurn({
        sessionId,
        userContent: lastUserContent,
        assistantContent: content,
        toolCalls: run.tools,
        steps: run.steps,
        activityMs: Date.now() - run.startedAt,
      });
    } catch (err) {
      void serverLog("chat", "error", "Persist turn failed", err, true);
    }
  }

  // Clot un tour : reponse finale, ecriture serveur, puis extraction memoire.
  // L'ecriture est faite AVANT l'extraction et sans dependre du client : c'est
  // ce qui rend la reponse recuperable si l'onglet a ete ferme en cours de
  // generation.
  async function finishTurn(): Promise<void> {
    if (pendingError) send(pendingError);
    send({ type: "done", content: pendingDone });

    const finalContent = run.content || pendingDone || lastAssistantContent;
    await persistTurn(finalContent);
    finishRun(run, finalContent);
    // L'extraction memoire reste ATTENDUE et inconditionnelle : c'est ce qui
    // garantit que les faits sont ecrits avant la fin de la requete. Le flux
    // HTTP reste ouvert jusque-la pour le toast « faits memorises ».
    await runMemoryExtraction(modelName, bodyMessages, sessionId, send, lastAssistantContent);
    closeStream();
  }

  try {
    let useFallback = false;
    for (let i = 0; i < maxIterations; i++) {
      const currentModel = useFallback ? altModel : modelName;

      try {
        const pass = await runModelPass(currentModel, run.controller.signal, {
          messages,
          send,
          sessionId,
          modelName,
          provenance,
        });
        if (pass.error) pendingError = pass.error;
        if (pass.finalDone !== undefined) pendingDone = pass.finalDone;
        if (!pass.shouldContinue) {
          await finishTurn();
          return;
        }
        const lastAssistantMsg = [...messages].reverse().find((m) => m.role === "assistant");
        if (lastAssistantMsg && typeof lastAssistantMsg.content === "string") {
          lastAssistantContent = lastAssistantMsg.content;
        }
        // Garde-fou : si le dernier resultat d'outil est un echec ou un
        // blocage, rappeler au modele avant sa reponse finale de ne pas
        // annoncer une action non realisee.
        if (lastToolResultIsProblematic(messages)) {
          messages.push({ role: "system", content: RESULT_HONESTY_RULE });
        }
      } catch (err) {
        // Arret explicite (bouton Stop, nouvelle requete) : plus de fallback
        // inutile.
        if (run.aborted) throw err;
        void serverLog("chat", "error", `runModel(${currentModel}) failed`, err);
        // Pas de fallback reel si le modele de secours est identique au
        // principal : remonter l'erreur d'origine plutot qu'un faux « a echoue
        // apres fallback » sans seconde chance veritable.
        if (useFallback || currentModel === altModel) throw err;
        useFallback = true;
        continue;
      }
      useFallback = false;
    }

    await finishTurn();
  } catch (error) {
    // Arret explicite : on conserve la reponse partielle deja streamee.
    if (run.aborted) {
      await persistTurn(run.content);
      finishRun(run, run.content);
      closeStream();
      return;
    }
    void serverLog("chat", "error", "Chat stream error", error);
    const message = error instanceof Error ? error.message : "Erreur inconnue";
    send({ type: "error", message });
    send({ type: "done", content: "" });
    finishRun(run, run.content);
    closeStream();
  }
}
