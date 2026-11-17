/**
 * Contexte passé par le noyau à tout ce qu'un module exécute : un outil, un
 * bloc de prompt, une action, un job.
 *
 * Volontairement minimal : un module ne reçoit ni requête, ni session, ni accès
 * au disque brut. Tout ce qui sort de ce contexte doit être fourni par le noyau
 * explicitement, sinon un module se remet à connaître l'application entière.
 */
export type LogLevel = "info" | "warn" | "error";

export interface ModuleContext {
  /** Identifiant du module appelant, pour préfixer les logs. */
  readonly moduleId: string;
  /** Logs préfixés `[<module-id>]`, écrits par le logger du noyau. */
  readonly log: (level: LogLevel, message: string, error?: unknown) => void;
  /** Publie un événement du bus du noyau. Livraison au mieux, en mémoire. */
  readonly emit: (event: string, payload?: unknown) => void;
}
