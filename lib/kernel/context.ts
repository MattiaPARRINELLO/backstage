import type { ModuleContext } from "@backstage/module-kit";

import { logActivity } from "@/lib/storage";

import { emit } from "./events";

/**
 * Contexte fourni par le noyau à tout ce qu'un module exécute.
 *
 * Le module reçoit des moyens d'agir (log, événement, journal d'activité) mais
 * aucun accès direct à la requête, à la session ou au disque : ces accès
 * restent dans le noyau, qui décide de ce qu'il expose.
 */
export function createModuleContext(
  moduleId: string,
  options: { userId?: string } = {}
): ModuleContext {
  return {
    moduleId,
    // `exactOptionalPropertyTypes` distingue « absent » de « undefined » : on
    // n'ajoute la cle que lorsqu'un utilisateur existe vraiment.
    ...(options.userId ? { userId: options.userId } : {}),
    log: (level, message, error) => {
      const line = `[${moduleId}] ${message}`;
      if (level === "error") console.error(line, error);
      else if (level === "warn") console.warn(line, error);
      else console.log(line, error ?? "");
    },
    emit,
    activity: async (type, message, detail?: string) => {
      // Le module nomme son activité librement ; le noyau la range dans le
      // journal d'activité existant, qui a sa propre liste de types.
      await logActivity(
        type as Parameters<typeof logActivity>[0],
        message,
        detail
      );
    },
  };
}
