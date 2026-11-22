import type { ModuleContext } from "@backstage/module-kit";

import { createModuleContext } from "./context";
import { cronMatches } from "./cron";
import type { RegisteredJob } from "./registry-core";

/**
 * Runner des jobs déclarés par les modules.
 *
 * Il ne connaît aucun nom de job : toutes les 60 s, il parcourt la liste reçue
 * du registre, sélectionne ceux dont l'expression cron correspond à l'instant,
 * et exécute leur handler avec le contexte du module propriétaire.
 *
 * Garanties : un job déjà en cours n'est pas relancé (pas de chevauchement), une
 * erreur est journalisée sans empêcher les autres jobs du même tick, et `stop()`
 * arrête la cadence sans tuer un job en vol (il se termine, puis se retire).
 */

export type JobLogLevel = "warn" | "error";

export interface JobRunnerOptions {
  readonly jobs: readonly RegisteredJob[];
  /** Cadence de sélection. Défaut : 60 s. */
  readonly intervalMs?: number;
  /** Horloge injectable pour les tests. Défaut : `new Date()`. */
  readonly now?: () => Date;
  /** Contexte injectable ; par défaut celui du noyau pour le module propriétaire. */
  readonly context?: (moduleId: string) => ModuleContext;
  /** Journal injectable ; par défaut console, préfixé `[jobs]`. */
  readonly log?: (level: JobLogLevel, message: string, error?: unknown) => void;
}

export interface JobRunner {
  /** Exécute les jobs dus à cet instant et attend leur fin. */
  tick(at?: Date): Promise<void>;
  /** Démarre immédiatement puis à chaque intervalle. */
  start(): void;
  stop(): void;
  /** Ce job est-il en cours d'exécution ? */
  isRunning(jobId: string): boolean;
}

export function createJobRunner(options: JobRunnerOptions): JobRunner {
  const intervalMs = options.intervalMs ?? 60_000;
  const now = options.now ?? (() => new Date());
  const context = options.context ?? createModuleContext;
  const log =
    options.log ??
    ((level, message, error) => {
      if (level === "error") console.error(message, error);
      else console.warn(message, error ?? "");
    });

  const running = new Set<string>();
  let timer: ReturnType<typeof setInterval> | null = null;

  async function runJob(entry: RegisteredJob): Promise<void> {
    const { id } = entry.job;
    if (running.has(id)) {
      log("warn", `[jobs] "${id}" est deja en cours, tick ignore`);
      return;
    }

    running.add(id);
    try {
      await entry.job.handler(context(entry.moduleId));
    } catch (error) {
      // Un job en echec ne doit jamais empecher les autres de tourner.
      log("error", `[jobs] echec du job "${id}" (module ${entry.moduleId})`, error);
    } finally {
      running.delete(id);
    }
  }

  async function tick(at: Date = now()): Promise<void> {
    const due = options.jobs.filter((entry) => {
      try {
        return cronMatches(entry.job.cron, at);
      } catch (error) {
        log(
          "error",
          `[jobs] expression cron invalide pour "${entry.job.id}" (module ${entry.moduleId})`,
          error
        );
        return false;
      }
    });

    await Promise.all(due.map(runJob));
  }

  return {
    tick,
    start() {
      if (timer) return;
      // Comme l'ancien scheduler : un tick immediat au demarrage, puis la cadence.
      void tick();
      timer = setInterval(() => void tick(), intervalMs);
    },
    stop() {
      if (!timer) return;
      clearInterval(timer);
      timer = null;
    },
    isRunning: (jobId) => running.has(jobId),
  };
}
