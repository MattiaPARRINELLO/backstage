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
  /**
   * Rend une reponse JSON brute pour une tache courte (extraction, classement).
   * Le noyau choisit le fournisseur adapte, sans mobiliser le modele de
   * conversation. Absent chez un hote qui ne l'implemente pas : le module doit
   * alors retomber sur `complete` ou degrader proprement.
   */
  readonly json?: (input: {
    readonly system: string;
    readonly prompt: string;
    readonly maxChars?: number;
  }) => Promise<string>;
  /**
   * Attente conseillee entre deux appels `json` consecutifs.
   *
   * Un module qui enchaine beaucoup d'extractions (scan par lots) doit la
   * respecter pour ne pas saturer le quota du fournisseur. Le noyau la calcule
   * d'apres le nombre de comptes configures ; absente ou nulle, enchainer.
   */
  readonly jsonDelayMs?: number;
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

/**
 * Message d'un fil de messagerie, tel que fourni par l'hôte.
 *
 * `fromMe` distingue un message envoyé par l'utilisateur d'un message reçu : un
 * module qui cherche le correspondant ne doit jamais prendre l'utilisateur pour
 * lui. Ces types appartiennent au contrat pour qu'un module distribué n'importe
 * pas ceux du noyau.
 */
export interface GmailMessage {
  readonly id: string;
  readonly threadId: string;
  readonly from: string;
  readonly to?: string;
  readonly subject: string;
  readonly date: string;
  readonly snippet: string;
  readonly body: string;
  readonly unread: boolean;
  readonly messageId?: string;
  /** Vrai pour un message envoyé par l'utilisateur (label Gmail SENT). */
  readonly fromMe?: boolean;
}

/** Fil complet : ses messages, du plus récent au plus ancien. */
export interface GmailThread {
  readonly id: string;
  readonly messages: readonly GmailMessage[];
}

/**
 * Accès à la boîte mail, fourni par le noyau.
 *
 * Même règle d'optionalité que `ai` et `net` : un hôte qui n'a pas de mail ne
 * fournit pas `mail`, et le module doit le dire honnêtement plutôt que
 * d'inventer une boîte vide.
 */
export interface ModuleMail {
  /** Fils correspondant à une recherche de l'hôte, du plus récent au plus ancien. */
  readonly listThreads: (
    query?: string,
    maxThreads?: number
  ) => Promise<GmailThread[]>;
  /** Fil complet par identifiant, ou `null` s'il n'existe pas. */
  readonly getThread: (threadId: string) => Promise<GmailThread | null>;
  /** Message par identifiant, ou `null` s'il n'existe pas. */
  readonly getMessage: (messageId: string) => Promise<GmailMessage | null>;
}

/** Notification poussée par l'hôte vers les appareils de l'utilisateur. */
export interface ModuleNotifyInput {
  readonly title: string;
  readonly body: string;
  /** Chemin ouvert au clic, par exemple `/m/mon-module`. */
  readonly url?: string;
  /** Identifiant de regroupement côté plateforme. */
  readonly tag?: string;
  /** Charge libre transmise au client. */
  readonly data?: Record<string, unknown>;
}

/**
 * Envoie une notification. Rend `true` si au moins un appareil l'a reçue.
 *
 * Absente chez un hôte sans canal de notification : un module doit alors
 * dégrader proprement, pas prétendre avoir prévenu.
 */
export type ModuleNotify = (input: ModuleNotifyInput) => Promise<boolean>;

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
  /** Envoi de notifications, même règle d'optionalité que `ai`. */
  readonly notify?: ModuleNotify;
  /** Accès mail, même règle d'optionalité que `ai`. */
  readonly mail?: ModuleMail;
}
