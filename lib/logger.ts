import { headers } from "next/headers";

import { getConfig } from "@/lib/config";

const REQUEST_ID_HEADER = "x-request-id";

export type LogLevel = "info" | "warn" | "error";

export interface LogEntry {
  readonly time: string;
  readonly level: LogLevel;
  readonly module: string;
  readonly reqId: string;
  readonly msg: string;
  readonly durationMs?: number;
  readonly external?: boolean;
  readonly err?: { readonly name: string; readonly message: string };
}

// Identifiant de corrélation : posé par le middleware (edge) dans les headers
// de requête, relu ici côté node. Hors contexte de requête (scheduler, cron
// interne), retourne "bg" (background) pour distinguer les logs de fond.
export async function getRequestId(): Promise<string> {
  try {
    const h = await headers();
    return h.get(REQUEST_ID_HEADER) ?? "bg";
  } catch {
    return "bg";
  }
}

/**
 * Remplace les secrets de configuration par `[redacte]` dans un texte destine
 * au log. Un secret plus court que 8 caracteres n'est pas traite : le remplacer
 * masquerait des mots courants sans proteger une vraie cle.
 */
export function redactSecrets(text: string): string {
  const config = getConfig();
  const secrets = [
    config.AUTH_SECRET,
    config.SETUP_TOKEN,
    config.IA_API_KEY,
    config.GOOGLE_CLIENT_SECRET,
    config.MICROSOFT_CLIENT_SECRET,
    config.OPENWEATHERMAP_API_KEY,
    config.BRAVE_SEARCH_API_KEY,
    config.CESAR_PASSWORD,
    config.GITHUB_TOKEN,
    config.VAPID_PRIVATE_KEY,
    config.CRON_SECRET,
  ];

  let redacted = text;
  for (const secret of secrets) {
    if (secret && secret.length >= 8) {
      redacted = redacted.split(secret).join("[redacte]");
    }
  }
  return redacted;
}

function serializeError(error: unknown): { name: string; message: string } {
  if (error instanceof Error) {
    return { name: error.name, message: redactSecrets(error.message) };
  }
  return { name: "UnknownError", message: redactSecrets(String(error)) };
}

/**
 * Journal serveur structure : une ligne JSON par evenement, avec module,
 * identifiant de requete, duree et marqueur externe quand applicables. Aucune
 * stack ni valeur de configuration sensible n'est ecrite.
 */
export async function serverLog(
  module: string,
  level: LogLevel,
  message: string,
  err?: unknown,
  external = false,
  durationMs?: number
): Promise<void> {
  const entry: LogEntry = {
    time: new Date().toISOString(),
    level,
    module,
    reqId: await getRequestId(),
    msg: redactSecrets(message),
    ...(durationMs !== undefined ? { durationMs } : {}),
    ...(external ? { external: true } : {}),
    ...(err !== undefined ? { err: serializeError(err) } : {}),
  };

  const line = JSON.stringify(entry);
  if (level === "error") {
    console.error(line);
  } else if (level === "warn") {
    console.warn(line);
  } else {
    console.info(line);
  }
}

export interface TimedOptions {
  readonly module?: string;
  readonly level?: LogLevel;
  readonly external?: boolean;
}

/**
 * Mesure une operation et journalise sa duree. En cas d'erreur, la ligne part
 * en `error` avec la duree puis l'erreur est propagee telle quelle.
 */
export async function timed<T>(
  label: string,
  fn: () => Promise<T>,
  options: TimedOptions = {}
): Promise<T> {
  const startedAt = Date.now();
  const moduleName = options.module ?? "timing";

  try {
    const value = await fn();
    await serverLog(
      moduleName,
      options.level ?? "info",
      label,
      undefined,
      options.external ?? false,
      Date.now() - startedAt
    );
    return value;
  } catch (error) {
    await serverLog(
      moduleName,
      "error",
      label,
      error,
      options.external ?? false,
      Date.now() - startedAt
    );
    throw error;
  }
}
