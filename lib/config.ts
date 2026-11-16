/**
 * Lecteur unique de la configuration d'environnement.
 *
 * C'est le **seul** module autorise a lire `process.env` (regle ESLint
 * `no-restricted-properties`, voir `eslint.config.mjs`). Toute la configuration
 * est decrite une fois, dans un schema Zod, validee au chargement et exposee
 * typée : on peut donc repondre a « quelles variables sont requises ? » en
 * lisant un fichier, pas vingt et un.
 *
 * Trois categories, parce qu'elles n'ont pas le meme comportement :
 *   - requises pour demarrer : `AUTH_SECRET`, et `WEBAUTHN_*` hors bypass dev ;
 *   - requises seulement si une fonctionnalite est utilisee : cle IA, Google,
 *     Microsoft, meteo, CESAR, GitHub, cron... ;
 *   - optionnelles avec defaut : `AI_PROVIDER`, `NEXT_PUBLIC_SITE_URL`,
 *     `VAPID_SUBJECT`, `CESAR_BASE`.
 *
 * Module volontairement sans `fs` ni `node:*` : il est chargeable en edge
 * (`lib/session-edge.ts`), sinon le proxy casse au demarrage.
 */

import { z } from "zod";

/** Une variable vide (`""`) vaut `undefined` : jamais de chaine vide ni de defaut silencieux. */
const optional = z.preprocess(
  (value) => (typeof value === "string" ? value.trim() || undefined : value),
  z.string().min(1).optional()
);

const optionalInt = z.preprocess(
  (value) => (typeof value === "string" && value.trim() !== "" ? Number(value) : value),
  z.number().int().positive().default(3000)
);

const flag = (defaultValue: boolean) =>
  z.preprocess((value) => {
    if (typeof value !== "string") return value;
    const trimmed = value.trim().toLowerCase();
    if (trimmed === "") return undefined;
    if (["1", "true", "yes", "on"].includes(trimmed)) return true;
    if (["0", "false", "no", "off"].includes(trimmed)) return false;
    return value;
  }, z.boolean().default(defaultValue));

const withDefault = (defaultValue: string) =>
  z.preprocess(
    (value) => (typeof value === "string" ? value.trim() || undefined : value),
    z.string().default(defaultValue)
  );

const configSchema = z.object({
  // ---- Runtime ---------------------------------------------------------
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),

  // ---- Authentification : requise pour demarrer ------------------------
  AUTH_SECRET: optional,
  WEBAUTHN_RP_ID: optional,
  WEBAUTHN_ORIGIN: optional,
  SETUP_TOKEN: optional,
  DEV_AUTH_BYPASS: flag(false),

  // ---- Provider IA : requis sauf en mode mock --------------------------
  AI_PROVIDER: withDefault("openai"),
  NEXT_PUBLIC_API_URL: optional,
  IA_API_KEY: optional,

  // ---- Site ------------------------------------------------------------
  NEXT_PUBLIC_SITE_URL: withDefault("https://backstage.mprnl.fr"),

  // ---- Google (Calendar + Gmail) --------------------------------------
  GOOGLE_CLIENT_ID: optional,
  GOOGLE_CLIENT_SECRET: optional,
  GOOGLE_REDIRECT_URI: optional,
  GOOGLE_TESTING_EXPIRY: flag(false),

  // ---- Microsoft (To Do) ----------------------------------------------
  MICROSOFT_CLIENT_ID: optional,
  MICROSOFT_CLIENT_SECRET: optional,
  MICROSOFT_REDIRECT_URI: optional,

  // ---- Integrations optionnelles --------------------------------------
  OPENWEATHERMAP_API_KEY: optional,
  BRAVE_SEARCH_API_KEY: optional,
  CESAR_USERNAME: optional,
  CESAR_PASSWORD: optional,
  CESAR_BASE: withDefault("https://cesar.emineo-education.fr"),
  GITHUB_TOKEN: optional,
  GITHUB_REPO: optional,
  ANDROID_CERT_SHA256: optional,

  // ---- Notifications push ---------------------------------------------
  NEXT_PUBLIC_VAPID_PUBLIC_KEY: optional,
  VAPID_PRIVATE_KEY: optional,
  VAPID_SUBJECT: withDefault("mailto:backstage@localhost"),

  // ---- Crons -----------------------------------------------------------
  CRON_SECRET: optional,
  CRON_BASE_URL: optional,

  // ---- Serveur (lu par l'installeur et Next, expose pour les scripts) --
  PORT: optionalInt,
});

export type Config = z.infer<typeof configSchema>;

/** Source brute : `process.env`, ou un objet de test. */
export type ConfigSource = Record<string, string | undefined>;

export interface ConfigStartupReport {
  /** Bloquants : sans eux, aucune authentification n'est possible. */
  fatal: string[];
  /** Avertissements : l'app demarre, une fonctionnalite est degradee. */
  warnings: string[];
}

/**
 * Valide et normalise la configuration. Ne leve jamais : les erreurs sont
 * rendues explicites par `getConfigProblems` / `getStartupReport`, pour que le
 * message affiche soit actionnable au lieu d'une stack `ZodError`.
 */
export function parseConfig(source: ConfigSource = process.env): Config {
  const parsed = configSchema.safeParse(source);
  if (parsed.success) return parsed.data;

  // Valeurs invalides (ex. NODE_ENV inconnu) : on garde les champs valides et
  // on retombe sur les defauts, les problemes etant signales au demarrage.
  const fallback = configSchema.parse({});
  const merged: Record<string, unknown> = { ...source };
  for (const issue of parsed.error.issues) {
    const key = issue.path[0];
    if (typeof key === "string") delete merged[key];
  }
  const retried = configSchema.safeParse(merged);
  return retried.success ? retried.data : fallback;
}

/**
 * Configuration courante. Pas de cache : un objet memoise garderait des valeurs
 * perimees quand un test ou un script modifie `process.env` (le cout d'un
 * parsing Zod de 28 champs est negligeable devant une requete HTTP).
 */
export function getConfig(source: ConfigSource = process.env): Config {
  return parseConfig(source);
}

/** `true` quand le provider factice repond a la place d'un vrai modele. */
export function isMockProvider(config: Config = getConfig()): boolean {
  return config.AI_PROVIDER === "mock";
}

function isMockAiConfigured(config: Config): boolean {
  return isMockProvider(config);
}

/**
 * Problemes de configuration, du plus grave au plus benin.
 * Ne contient jamais la valeur d'un secret, seulement son nom et la consequence.
 */
export function getConfigProblems(source: ConfigSource = process.env): string[] {
  return [...getStartupReport(source).fatal, ...getStartupReport(source).warnings];
}

/**
 * Distingue ce qui empeche de demarrer de ce qui degrade une fonctionnalite.
 *
 * Regle du projet : on garde toujours la possibilite d'atteindre `/login`
 * quand seule la configuration IA manque ; on echoue immediatement si
 * l'authentification elle-meme est impossible.
 */
export function getStartupReport(source: ConfigSource = process.env): ConfigStartupReport {
  const config = parseConfig(source);
  const fatal: string[] = [];
  const warnings: string[] = [];
  const production = config.NODE_ENV === "production";

  if (!config.AUTH_SECRET) {
    fatal.push(
      "AUTH_SECRET est absent : lancer `bun run setup` (ou renseigner une chaine aleatoire longue) puis redemarrer. Sans lui, aucune session ne peut etre signee : ni passkey, ni OAuth, ni /login."
    );
  }

  const origin = config.WEBAUTHN_ORIGIN;
  const rpId = config.WEBAUTHN_RP_ID;

  // Hors production, `lib/auth.ts` derive l'origine et le RP ID de la requete :
  // l'authentification reste possible sans configuration explicite. En
  // production, une origine fausse casse toutes les passkeys, donc on refuse.
  if (production) {
    if (!origin) {
      fatal.push(
        "WEBAUTHN_ORIGIN est absent : renseigner l'origine publique de l'application (par exemple http://localhost:3000 en local, https://votre-domaine en production) puis redemarrer. Sans elle, les passkeys ne peuvent pas etre enregistrees."
      );
    } else if (!origin.startsWith("http")) {
      fatal.push(
        `WEBAUTHN_ORIGIN commence par "${origin.split(":")[0]}:" : il doit commencer par http:// ou https:// (l'origine complete du navigateur) pour que WebAuthn accepte les passkeys.`
      );
    } else if (!rpId) {
      fatal.push(
        "WEBAUTHN_RP_ID est absent : renseigner le domaine de l'application (par exemple localhost ou votre-domaine) puis redemarrer. Sans lui, l'origine WEBAUTHN_ORIGIN ne peut pas etre validee."
      );
    } else if (!origin.includes(rpId)) {
      fatal.push(
        "WEBAUTHN_ORIGIN ne contient pas WEBAUTHN_RP_ID : les deux doivent designer le meme domaine (par exemple WEBAUTHN_RP_ID=backstage.example.com et WEBAUTHN_ORIGIN=https://backstage.example.com), sinon les passkeys sont refusees par le navigateur."
      );
    }
  }

  if (!isMockAiConfigured(config)) {
    if (!config.NEXT_PUBLIC_API_URL) {
      warnings.push(
        "NEXT_PUBLIC_API_URL est absent : renseigner l'URL du provider IA (endpoint compatible OpenAI) dans .env.local, puis redemarrer. Sans elle, le chat echoue au premier message."
      );
    }
    if (!config.IA_API_KEY) {
      warnings.push(
        "IA_API_KEY est absent : renseigner la cle du provider IA dans .env.local, puis redemarrer. Sans elle, le chat echoue au premier message. Pour developper sans cle, utiliser AI_PROVIDER=mock."
      );
    }
  }

  if (production && !config.SETUP_TOKEN) {
    warnings.push(
      "SETUP_TOKEN est absent en production : le premier enregistrement de passkey sera refuse avec HTTP 503 (garde-fou volontaire). Generer un token avec `bun run setup`, l'utiliser une fois, puis le retirer."
    );
  }

  return { fatal, warnings };
}

/**
 * Verifie la configuration au demarrage. Leve une erreur lisible (sans stack
 * Zod) si l'authentification est impossible ; sinon renvoie les avertissements.
 */
export function assertStartupConfig(source: ConfigSource = process.env): string[] {
  const { fatal, warnings } = getStartupReport(source);
  if (fatal.length > 0) {
    throw new Error(
      `[config] Demarrage impossible (${fatal.length} probleme(s)) :\n` +
        fatal.map((problem) => `  - ${problem}`).join("\n")
    );
  }
  return warnings;
}

/** Clés du schéma : sert au test de coherence avec `.env.example`. */
export function configKeys(): string[] {
  return Object.keys(configSchema.shape);
}
