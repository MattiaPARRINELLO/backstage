"use client";

// Gestionnaire de génération côté client, volontairement HORS React.
//
// Le `fetch` SSE vit dans ce module et non dans `ChatView` : changer de page
// démonte le composant, mais la requête continue, les évènements sont
// conservés, et revenir sur la conversation rejoue l'état exact. Fermer
// l'onglet coupe la requête, mais le serveur poursuit la génération et la
// persiste (`GET /api/chat/stream` permet de s'y réattacher).
//
// Sur mobile, mettre l'app en arrière-plan suffit à faire tomber la connexion
// SSE (le navigateur suspend le socket). Ce n'est pas une erreur : le serveur
// continue, on se réattache donc automatiquement au retour au premier plan au
// lieu d'afficher un « Failed to fetch » brut.

import { api, type ChatStreamEvent } from "@/lib/api-client";
import type { Message } from "@/components/chat/types";

export type LiveRunStatus = "running" | "done" | "aborted" | "error";

// Évènements purement locaux (jamais reçus du réseau) : signalent qu'il faut
// recharger la conversation depuis l'historique serveur, ou abandonner.
export type LiveRunEvent =
  | ChatStreamEvent
  | { type: "reload" }
  | { type: "failed"; message: string };

export interface LiveRun {
  sessionId: string;
  userMessage: Message | null;
  events: LiveRunEvent[];
  status: LiveRunStatus;
  startedAt: number;
  // Longueur du texte reçu : sert à savoir si une reprise a réellement
  // progressé (sinon on espace les tentatives au lieu de boucler).
  contentLength: number;
}

type Listener = () => void;

const runs = new Map<string, LiveRun>();
const listeners = new Map<string, Set<Listener>>();
const controllers = new Map<string, AbortController>();

// Une réponse très longue produit beaucoup de deltas : on borne la mémoire.
const MAX_BUFFERED_EVENTS = 20_000;

// Rétention serveur d'une génération terminée (`lib/chat-runs.ts`) : au-delà,
// une génération introuvable a été purgée et la réponse est dans l'historique.
const RUN_RETENTION_MS = 10 * 60_000;

const RECONNECT_BASE_DELAY_MS = 1_000;
const RECONNECT_MAX_DELAY_MS = 10_000;
const MAX_RECONNECT_ATTEMPTS = 8;

const NETWORK_FAILURE_MESSAGE =
  "Connexion interrompue. La réponse en cours sera disponible dans l'historique.";
const SEND_FAILURE_MESSAGE =
  "Impossible de joindre le serveur. Vérifie ta connexion puis renvoie ton message.";

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

// Erreur réseau (socket coupé, app en arrière-plan, Wi-Fi perdu), par
// opposition à une erreur applicative renvoyée par le serveur.
export function isNetworkError(err: unknown): boolean {
  if (typeof err !== "object" || err === null) return false;
  const candidate = err as { name?: string; message?: string };
  if (candidate.name === "TypeError") return true;
  return /fetch|network|load failed|networkerror/i.test(candidate.message ?? "");
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function inBackground(): boolean {
  return typeof document !== "undefined" && document.visibilityState === "hidden";
}

function offline(): boolean {
  return typeof navigator !== "undefined" && navigator.onLine === false;
}

// Attend le retour au premier plan ET le réseau, sans timer (un onglet en
// arrière-plan voit ses timers fortement ralentis, voire gelés).
function waitForForeground(): Promise<void> {
  if (!inBackground() && !offline()) return Promise.resolve();
  return new Promise((resolve) => {
    const check = () => {
      if (inBackground() || offline()) return;
      document.removeEventListener("visibilitychange", check);
      window.removeEventListener("online", check);
      resolve();
    };
    document.addEventListener("visibilitychange", check);
    window.addEventListener("online", check);
  });
}

function pushEvent(run: LiveRun, event: LiveRunEvent) {
  run.events.push(event);
  if (run.events.length > MAX_BUFFERED_EVENTS) {
    run.events.splice(0, run.events.length - MAX_BUFFERED_EVENTS);
  }
  if (event.type === "done") run.status = "done";
  if (event.type === "reload") run.status = "done";
  if (event.type === "error" || event.type === "failed") run.status = "error";
  if (event.type === "delta") run.contentLength += event.content.length;
  if (event.type === "snapshot") run.contentLength = event.content.length;
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

// Se réattache au run serveur, en boucle, en attendant le retour au premier
// plan entre deux tentatives. Le serveur poursuit la génération : il suffit de
// retrouver le flux pour afficher le reste de la réponse.
async function reconnectLiveRun(
  run: LiveRun,
  controller: AbortController
): Promise<void> {
  let attempt = 0;

  while (!controller.signal.aborted && run.status === "running") {
    await waitForForeground();
    if (controller.signal.aborted || run.status !== "running") return;

    if (attempt > 0) {
      const delay = Math.min(
        RECONNECT_BASE_DELAY_MS * 2 ** (attempt - 1),
        RECONNECT_MAX_DELAY_MS
      );
      await sleep(delay);
      if (controller.signal.aborted || run.status !== "running") return;
    }

    const before = run.contentLength;
    try {
      const found = await api.chat.resume(
        run.sessionId,
        (event) => pushEvent(run, event),
        controller.signal
      );

      if (found) {
        // On a bien récupéré un flux (instantané + suite). S'il s'est refermé
        // sans `done`, on retente ; le compteur ne recule que si du texte a
        // progressé, pour ne pas boucler à vide.
        if (run.status !== "running") return;
        attempt = run.contentLength > before ? 0 : attempt + 1;
      } else {
        // Aucun run côté serveur. Deux cas : la requête initiale n'est jamais
        // arrivée (échec d'envoi) ou la génération a été purgée après coup
        // (la réponse est alors dans l'historique).
        if (Date.now() - run.startedAt < RUN_RETENTION_MS) {
          pushEvent(run, { type: "failed", message: SEND_FAILURE_MESSAGE });
        } else {
          pushEvent(run, { type: "reload" });
        }
        return;
      }
    } catch (err) {
      if (controller.signal.aborted) return;
      if (!isNetworkError(err)) {
        pushEvent(run, {
          type: "failed",
          message: err instanceof Error ? err.message : "Erreur réseau",
        });
        return;
      }
      attempt += 1;
    }

    if (attempt > MAX_RECONNECT_ATTEMPTS) {
      pushEvent(run, { type: "failed", message: NETWORK_FAILURE_MESSAGE });
      return;
    }
  }
}

export function startLiveRun(input: {
  sessionId: string;
  userMessage: Message;
  messages: { role: "user" | "assistant"; content: string }[];
  actionContext?: string;
}): void {
  const { sessionId, userMessage, messages, actionContext } = input;

  controllers.get(sessionId)?.abort();
  const run: LiveRun = {
    sessionId,
    userMessage,
    events: [],
    status: "running",
    startedAt: Date.now(),
    contentLength: 0,
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
        sessionId,
        actionContext
      );
      // Flux fermé sans évènement final : coupure réseau. On ne laisse ni la
      // vue bloquée en « en train d'écrire » ni un faux message d'erreur.
      if (run.status === "running") await reconnectLiveRun(run, controller);
    } catch (err) {
      if (controller.signal.aborted || (err as Error)?.name === "AbortError") {
        run.status = "aborted";
        notify(sessionId);
      } else if (isNetworkError(err)) {
        // Coupure réseau (app en arrière-plan, réseau mobile…) : la génération
        // continue côté serveur, on se réattache.
        await reconnectLiveRun(run, controller);
      } else {
        pushEvent(run, {
          type: "failed",
          message: err instanceof Error ? err.message : "Erreur réseau",
        });
      }
    } finally {
      if (run.status === "running" && controller.signal.aborted) {
        run.status = "aborted";
      }
      if (controllers.get(sessionId) === controller) {
        controllers.delete(sessionId);
      }
      notify(sessionId);
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
    startedAt: Date.now(),
    contentLength: 0,
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
