// Registre en mémoire des générations de chat en cours (process unique,
// cohérent avec le reste de l'app : scheduler et rate-limit sont aussi
// en mémoire).
//
// Rôle : la génération survit à la déconnexion du client. Quand l'onglet se
// ferme, le flux HTTP est annulé mais plus la requête IA : la boucle continue,
// écrit la réponse dans l'historique et le tour aboutit. Un client qui revient
// se réattache via `GET /api/chat/stream` et reçoit un instantané + la suite
// en direct.

import type { StreamEvent } from "./ai-providers/types";
import type {
  ChatRunSnapshotEvent,
  ChatRunStep,
  ChatRunTool,
  ChatTransportEvent,
} from "./chat-run-types";

type Listener = (event: ChatTransportEvent) => void;

// Longueur maximale d'une pensée conservée (instantané + historique) : le
// reasoning peut être très bavard, on borne la mémoire et le fichier JSON.
export const MAX_THOUGHT_CHARS = 4_000;

export interface ChatRun {
  sessionId: string;
  startedAt: number;
  controller: AbortController;
  listeners: Set<Listener>;
  content: string;
  tools: ChatRunTool[];
  activeTools: ChatRunTool[];
  steps: ChatRunStep[];
  // Début de chaque appel d'outil en cours, pour une durée mesurée par outil et
  // non cumulée depuis le début du tour.
  toolStartedAt: Map<string, number>;
  groups: ChatRunSnapshotEvent["groups"];
  error: string | null;
  finished: boolean;
  doneContent: string;
  aborted: boolean;
  cleanupTimer?: ReturnType<typeof setTimeout>;
}

const runs = new Map<string, ChatRun>();

// Durée de rétention d'une génération terminée : laisse le temps à un client
// qui revient juste après la fin de récupérer l'instantané final.
const FINISHED_TTL_MS = 10 * 60_000;

// Garde-fou mémoire : on ne conserve jamais un nombre illimité de runs.
const MAX_RUNS = 20;

function pruneOldRuns() {
  if (runs.size <= MAX_RUNS) return;
  const sorted = [...runs.values()].sort((a, b) => a.startedAt - b.startedAt);
  for (const run of sorted.slice(0, runs.size - MAX_RUNS)) {
    if (!run.finished) continue;
    runs.delete(run.sessionId);
  }
}

function disposeLater(run: ChatRun) {
  if (run.cleanupTimer) clearTimeout(run.cleanupTimer);
  run.cleanupTimer = setTimeout(() => {
    if (runs.get(run.sessionId) === run) runs.delete(run.sessionId);
  }, FINISHED_TTL_MS);
  run.cleanupTimer.unref?.();
}

function dispatch(run: ChatRun, event: ChatTransportEvent) {
  for (const listener of [...run.listeners]) {
    try {
      listener(event);
    } catch {
      // Un abonné fautif ne doit pas interrompre la génération.
    }
  }
}

export function createRun(sessionId: string): ChatRun {
  // Une nouvelle requête sur la même conversation remplace la précédente.
  abortRun(sessionId);
  const run: ChatRun = {
    sessionId,
    startedAt: Date.now(),
    controller: new AbortController(),
    listeners: new Set(),
    content: "",
    tools: [],
    activeTools: [],
    steps: [],
    toolStartedAt: new Map(),
    groups: [],
    error: null,
    finished: false,
    doneContent: "",
    aborted: false,
  };
  runs.set(sessionId, run);
  pruneOldRuns();
  return run;
}

export function getRun(sessionId: string): ChatRun | undefined {
  return runs.get(sessionId);
}

export function abortRun(sessionId: string): void {
  const run = runs.get(sessionId);
  if (!run || run.finished) return;
  run.aborted = true;
  run.controller.abort();
}

// Met à jour l'instantané puis diffuse l'évènement aux abonnés.
export function publish(run: ChatRun, event: StreamEvent): void {
  switch (event.type) {
    case "reasoning": {
      // Les providers qui exposent leur réflexion (thinking Anthropic,
      // reasoning_content OpenAI) alimentent une étape « pensée » continue :
      // on cumule tant que la dernière étape est une pensée, sinon on en ouvre
      // une nouvelle après un appel d'outil.
      const last = run.steps[run.steps.length - 1];
      if (last?.kind === "thought") {
        if (last.text.length < MAX_THOUGHT_CHARS) {
          last.text = (last.text + event.content).slice(0, MAX_THOUGHT_CHARS);
        }
      } else {
        run.steps.push({
          kind: "thought",
          text: event.content.slice(0, MAX_THOUGHT_CHARS),
        });
      }
      break;
    }
    case "delta":
      run.content += event.content;
      break;
    case "tool_start": {
      run.toolStartedAt.set(event.toolCallId, Date.now());
      const tool: ChatRunTool = {
        id: event.toolCallId,
        name: event.name,
        arguments: event.arguments,
        status: "running",
      };
      run.activeTools.push(tool);
      run.steps.push({ kind: "tool", ...tool });
      break;
    }
    case "tool_result": {
      const idx = run.activeTools.findIndex((t) => t.name === event.name);
      if (idx >= 0) {
        const [tool] = run.activeTools.splice(idx, 1);
        const startedAt = run.toolStartedAt.get(tool.id);
        run.toolStartedAt.delete(tool.id);
        const resultCount = event.result
          ? event.result.split("\n").filter(Boolean).length || 1
          : 1;
        const status =
          event.status === "error" || event.status === "blocked"
            ? "error"
            : "success";
        run.tools.push({ ...tool, result: event.result, status, resultCount });
        // Même mise à jour dans le fil ordonné, pour la reprise en cours de tour.
        for (let i = run.steps.length - 1; i >= 0; i--) {
          const step = run.steps[i];
          if (step.kind === "tool" && step.id === tool.id) {
            step.result = event.result;
            step.status = status;
            step.resultCount = resultCount;
            step.duration = startedAt
              ? (Date.now() - startedAt) / 1000
              : undefined;
            break;
          }
        }
      }
      break;
    }
    case "group_confirm":
      run.groups.push(event);
      break;
    case "error":
      run.error = event.message;
      break;
    case "done":
      // Le tour est terminé dès cet instant, même si l'écriture disque et
      // l'extraction mémoire continuent ensuite : un client qui se réattache
      // pendant ce laps de temps ne doit pas rester bloqué sur un instantané
      // « en cours ».
      run.finished = true;
      run.doneContent = event.content || run.content;
      run.activeTools = [];
      disposeLater(run);
      break;
    default:
      break;
  }
  dispatch(run, event);
}

export function snapshotOf(run: ChatRun): ChatRunSnapshotEvent {
  return {
    type: "snapshot",
    sessionId: run.sessionId,
    content: run.content,
    tools: run.tools,
    activeTools: run.activeTools,
    steps: run.steps,
    groups: run.groups,
    error: run.error,
    finished: run.finished,
    doneContent: run.finished ? run.doneContent : undefined,
  };
}

// `replay` : envoie immédiatement l'instantané courant, puis, si la génération
// est déjà terminée, l'évènement `done` final.
export function subscribe(
  run: ChatRun,
  listener: Listener,
  replay = true
): () => void {
  run.listeners.add(listener);
  if (replay) {
    listener(snapshotOf(run));
    if (run.finished) listener({ type: "done", content: run.doneContent });
  }
  return () => {
    run.listeners.delete(listener);
  };
}

export function listenerCount(run: ChatRun): number {
  return run.listeners.size;
}

export function finishRun(run: ChatRun, doneContent?: string): void {
  if (!run.finished) {
    run.finished = true;
    run.activeTools = [];
  }
  if (doneContent !== undefined) run.doneContent = doneContent;
  // Dernier instantané pour un éventuel réabonnement tardif.
  disposeLater(run);
}

// Nombre de générations actives pour diagnostic/tests.
export function activeRunCount(): number {
  let count = 0;
  for (const run of runs.values()) if (!run.finished) count++;
  return count;
}
