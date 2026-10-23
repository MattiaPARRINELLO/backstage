"use client";

// Gestionnaire de génération côté client, volontairement HORS React.
//
// Le `fetch` SSE vit dans ce module et non dans `ChatView` : changer de page
// démonte le composant, mais la requête continue, les évènements sont
// conservés, et revenir sur la conversation rejoue l'état exact. Fermer
// l'onglet coupe la requête, mais le serveur poursuit la génération et la
// persiste (`GET /api/chat/stream` permet de s'y réattacher).

import { api, type ChatStreamEvent } from "@/lib/api-client";
import type { Message } from "@/components/chat/types";

export type LiveRunStatus = "running" | "done" | "aborted" | "error";

export interface LiveRun {
  sessionId: string;
  userMessage: Message | null;
  events: ChatStreamEvent[];
  status: LiveRunStatus;
}

type Listener = () => void;

const runs = new Map<string, LiveRun>();
const listeners = new Map<string, Set<Listener>>();
const controllers = new Map<string, AbortController>();

// Une réponse très longue produit beaucoup de deltas : on borne la mémoire.
const MAX_BUFFERED_EVENTS = 20_000;

function notify(sessionId: string) {
  const set = listeners.get(sessionId);
  if (!set) return;
  for (const listener of [...set]) {
    try {
      listener();
    } catch {
      // Un abonné fautif ne doit pas casser le flux.
    }
  }
}

export function getLiveRun(sessionId: string): LiveRun | undefined {
  return runs.get(sessionId);
}

export function subscribeLiveRun(
  sessionId: string,
  listener: Listener
): () => void {
  let set = listeners.get(sessionId);
  if (!set) {
    set = new Set();
    listeners.set(sessionId, set);
  }
  set.add(listener);
  return () => {
    set?.delete(listener);
    if (set && set.size === 0) listeners.delete(sessionId);
  };
}

function pushEvent(run: LiveRun, event: ChatStreamEvent) {
  run.events.push(event);
  if (run.events.length > MAX_BUFFERED_EVENTS) {
    run.events.splice(0, run.events.length - MAX_BUFFERED_EVENTS);
  }
  if (event.type === "done") run.status = "done";
  if (event.type === "error") run.status = "error";
  notify(run.sessionId);
}

// Oublie une génération déjà consommée par la vue (l'historique sert de
// source de vérité ensuite).
export function clearLiveRun(sessionId: string) {
  const run = runs.get(sessionId);
  if (run && run.status === "running") return;
  runs.delete(sessionId);
  controllers.delete(sessionId);
}

function pruneRuns() {
  if (runs.size <= 10) return;
  const finished = [...runs.entries()].filter(([, r]) => r.status !== "running");
  for (const [id] of finished.slice(0, runs.size - 10)) runs.delete(id);
}

export function startLiveRun(input: {
  sessionId: string;
  userMessage: Message;
  messages: { role: "user" | "assistant"; content: string }[];
}): void {
  const { sessionId, userMessage, messages } = input;

  controllers.get(sessionId)?.abort();
  const run: LiveRun = {
    sessionId,
    userMessage,
    events: [],
    status: "running",
  };
  runs.set(sessionId, run);
  pruneRuns();

  const controller = new AbortController();
  controllers.set(sessionId, controller);
  notify(sessionId);

  void (async () => {
    try {
      await api.chat.stream(
        messages,
        (event) => pushEvent(run, event),
        controller.signal,
        sessionId
      );
      // Flux fermé sans évènement final (coupure réseau) : on ne laisse pas
      // la vue bloquée en « en train d'écrire ».
      if (run.status === "running") {
        run.status = "error";
        run.events.push({
          type: "error",
          message: "La connexion a été interrompue.",
        });
        notify(sessionId);
      }
    } catch (err) {
      if ((err as Error)?.name === "AbortError") {
        run.status = "aborted";
      } else {
        run.status = "error";
        run.events.push({
          type: "error",
          message: err instanceof Error ? err.message : "Erreur réseau",
        });
      }
      notify(sessionId);
    } finally {
      if (controllers.get(sessionId) === controller) {
        controllers.delete(sessionId);
      }
    }
  })();
}

export function abortLiveRun(sessionId: string): void {
  const run = runs.get(sessionId);
  if (run && run.status !== "running") return;
  void api.chat.stop(sessionId);
  controllers.get(sessionId)?.abort();
  controllers.delete(sessionId);
  if (run) {
    run.status = "aborted";
    notify(sessionId);
  }
}

// Tente de se réattacher à une génération encore active côté serveur.
export async function resumeLiveRun(sessionId: string): Promise<boolean> {
  const existing = runs.get(sessionId);
  if (existing?.status === "running") return true;

  const run: LiveRun = {
    sessionId,
    userMessage: existing?.userMessage ?? null,
    events: [],
    status: "running",
  };
  const controller = new AbortController();
  controllers.set(sessionId, controller);
  runs.set(sessionId, run);

  try {
    const found = await api.chat.resume(
      sessionId,
      (event) => pushEvent(run, event),
      controller.signal
    );
    if (!found) {
      runs.delete(sessionId);
      controllers.delete(sessionId);
      return false;
    }
    if (run.status === "running") run.status = "done";
    notify(sessionId);
    return true;
  } catch (err) {
    runs.delete(sessionId);
    controllers.delete(sessionId);
    if ((err as Error)?.name !== "AbortError") {
      // Échec silencieux : la conversation reste lisible dans l'historique.
      console.warn("[chat] reprise du flux impossible", err);
    }
    return false;
  }
}
