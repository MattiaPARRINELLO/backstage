/**
 * Contexte passé par le noyau à tout ce qu'un module exécute : un outil, un
 * bloc de prompt, une action, un job.
 *
 * Volontairement minimal : un module ne reçoit ni requête, ni session, ni accès
 * au disque brut. Tout ce qui sort de ce contexte doit être fourni par le noyau
 * explicitement, sinon un module se remet à connaître l'application entière.
 */
export type LogLevel = "info" | "warn" | "error";

/**
 * Complétion IA fournie par le noyau.
 *
 * Un module ne connaît ni le fournisseur, ni la clé, ni le modèle : il décrit
 * une consigne et un contenu, le noyau choisit le modèle et applique sa
 * politique de coût. Un module qui veut résumer un texte n'a donc pas besoin
 * d'importer l'application entière.
 */
export interface ModuleAi {
  /** Rend le texte du modèle, tronqué à `maxChars` (défaut : 2 000). */
  readonly complete: (input: {
    readonly system?: string;
    readonly prompt: string;
    readonly maxChars?: number;
  }) => Promise<string>;
}

/**
 * Accès réseau contrôlé par le noyau.
 *
 * Le noyau garde la protection anti-SSRF : un module demande une URL, il ne
 * choisit pas la politique de résolution ni les redirections autorisées.
 */
export interface ModuleNet {
  /** L'URL est-elle publique et en http(s) ? */
  readonly isSafeUrl: (url: string) => Promise<boolean>;
  /**
   * Corps texte d'une URL publique, plafonné à `timeoutMs`, ou `null` si le
   * noyau refuse l'URL ou si la requête échoue. Ne lève jamais.
   */
  readonly fetchText: (url: string, timeoutMs?: number) => Promise<string | null>;
}

export interface ModuleContext {
  /** Identifiant du module appelant, pour préfixer les logs. */
  readonly moduleId: string;
  /** Logs préfixés `[<module-id>]`, écrits par le logger du noyau. */
  readonly log: (level: LogLevel, message: string, error?: unknown) => void;
  /** Publie un événement du bus du noyau. Livraison au mieux, en mémoire. */
  readonly emit: (event: string, payload?: unknown) => void;
  /** Utilisateur de la session, fourni par le noyau aux actions. */
  readonly userId?: string;
  /**
   * Journal d'activité de l'application (fil « Activité »), fourni par le
   * noyau. Le module choisit sa formulation : le noyau ne connaît pas ses
   * libellés métier.
   */
  readonly activity?: (
    type: string,
    message: string,
    detail?: string
  ) => void | Promise<void>;
  /**
   * Complétion IA. Fournie par le noyau réel ; absente dans un contexte de
   * test ou un hôte qui ne propose pas d'IA, ce qu'un module doit tolérer.
   */
  readonly ai?: ModuleAi;
  /** Accès réseau contrôlé, même règle d'optionalité que `ai`. */
  readonly net?: ModuleNet;
}
