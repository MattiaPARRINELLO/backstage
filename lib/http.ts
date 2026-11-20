/**
 * Port HTTP sortant (issue #89) : timeout, retry borne, validation Zod et
 * journalisation au meme endroit. Aucun client n'appelle `fetch` directement.
 *
 * Les erreurs sortent en `AppError("external_unavailable")`. `request` reste
 * bas niveau et ne leve pas sur un statut non-2xx (CESAR lit un 302 avec
 * `redirect: "manual"`) ; `json` et `text` sont les formes sures.
 */
import type { z } from "zod";

import { AppError } from "@/lib/errors";
import { writeLogLine, type LogLevel } from "@/lib/log-line";

/** Timeout par tentative, volontairement court : un tiers lent ne bloque pas un tour. */
export const HTTP_TIMEOUT_MS = 10_000;

/** Deux tentatives au maximum (un retry) sur une erreur transitoire. */
export const HTTP_RETRIES = 1;

export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export type HttpMethod = "GET" | "HEAD" | "POST" | "PUT" | "PATCH" | "DELETE";

export interface HttpOptions {
  /** Libelle du service, present dans chaque ligne de log. Obligatoire. */
  readonly label: string;
  /** Methode HTTP ; `RequestInit.method` est une chaine libre, on la laisse telle quelle. */
  readonly method?: string;
  readonly headers?: HeadersInit;
  readonly body?: BodyInit | null;
  readonly redirect?: RequestRedirect;
  readonly timeoutMs?: number;
  /** Nombre de nouvelles tentatives apres la premiere. */
  readonly retries?: number;
}

// Surcharge de test, volontairement sans `AsyncLocalStorage` : le port est
// importable par un composant client (via `lib/app-config.ts`) et un module
// Node casserait le bundle navigateur. Les tests s'executent en serie.
let fetchOverride: FetchLike | null = null;

/**
 * Execute `fn` avec un `fetch` de substitution. Reserve aux tests, via
 * `lib/http-double.ts` : aucun test ne doit remplacer `globalThis.fetch`.
 */
export async function withHttpFetch<T>(
  fetchImpl: FetchLike,
  fn: () => Promise<T>
): Promise<T> {
  const previous = fetchOverride;
  fetchOverride = fetchImpl;
  try {
    return await fn();
  } finally {
    fetchOverride = previous;
  }
}

function resolveFetch(): FetchLike {
  if (fetchOverride) return fetchOverride;
  return (input, init) => globalThis.fetch(input, init);
}

function defaultRetries(method: string): number {
  // Un GET est idempotent, un POST ne l'est pas : rejouer un envoi ou un echange
  // de code OAuth consommerait l'entree deux fois.
  return method === "GET" || method === "HEAD" ? HTTP_RETRIES : 0;
}

function isTransientStatus(status: number): boolean {
  return status >= 500 && status <= 599;
}

function logHttp(
  level: LogLevel,
  label: string,
  message: string,
  durationMs?: number,
  errorName?: string
): void {
  writeLogLine({
    time: new Date().toISOString(),
    level,
    module: "http",
    msg: `${label} ${message}`,
    ...(durationMs !== undefined ? { durationMs } : {}),
    external: true,
    ...(errorName ? { err: { name: errorName, message: "echec reseau" } } : {}),
  });
}

function externalUnavailable(label: string, cause: unknown): AppError {
  return new AppError("external_unavailable", `Le service ${label} est indisponible.`, { cause });
}

function buildInit(options: HttpOptions, method: string): RequestInit {
  const init: RequestInit = {
    method,
    redirect: options.redirect ?? "follow",
    signal: AbortSignal.timeout(options.timeoutMs ?? HTTP_TIMEOUT_MS),
  };
  if (options.headers !== undefined) init.headers = options.headers;
  if (options.body !== undefined) init.body = options.body;
  return init;
}

/**
 * Requete bas niveau : retry sur erreur reseau, timeout ou 5xx, puis retourne
 * la reponse finale sans lever sur un statut non-2xx.
 */
export async function request(url: string, options: HttpOptions): Promise<Response> {
  const method = options.method ?? "GET";
  const retries = Math.max(0, options.retries ?? defaultRetries(method));
  const attempts = retries + 1;
  let lastError: unknown;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const startedAt = Date.now();
    try {
      const response = await resolveFetch()(url, buildInit(options, method));
      const durationMs = Date.now() - startedAt;

      if (isTransientStatus(response.status) && attempt < attempts) {
        await response.body?.cancel();
        logHttp("warn", options.label, `${response.status}, nouvelle tentative`, durationMs);
        continue;
      }

      logHttp(
        response.ok ? "info" : "warn",
        options.label,
        String(response.status),
        durationMs
      );
      return response;
    } catch (error) {
      lastError = error;
      const durationMs = Date.now() - startedAt;
      if (attempt < attempts) {
        logHttp("warn", options.label, "echec, nouvelle tentative", durationMs);
        continue;
      }
      logHttp(
        "error",
        options.label,
        "echec apres tentatives",
        durationMs,
        error instanceof Error ? error.name : "UnknownError"
      );
    }
  }

  throw externalUnavailable(options.label, lastError);
}

/** Corps texte d'une reponse 2xx. Un statut non-2xx devient `external_unavailable`. */
export async function text(url: string, options: HttpOptions): Promise<string> {
  const response = await request(url, options);
  if (!response.ok) {
    throw externalUnavailable(options.label, new Error(`HTTP ${response.status}`));
  }
  return response.text();
}

/**
 * Corps JSON valide par `schema`. Une forme inattendue devient une
 * `external_unavailable` : l'appelant ne recoit jamais un `undefined` qui
 * exploserait plus loin.
 */
export async function json<T>(
  url: string,
  schema: z.ZodType<T>,
  options: HttpOptions
): Promise<T> {
  const response = await request(url, options);
  if (!response.ok) {
    throw externalUnavailable(options.label, new Error(`HTTP ${response.status}`));
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch (error) {
    console.error(`[http] ${options.label} reponse JSON illisible`);
    throw externalUnavailable(options.label, error);
  }

  const parsed = schema.safeParse(payload);
  if (!parsed.success) {
    const paths = parsed.error.issues.map((issue) => issue.path.join(".")).join(", ");
    console.error(`[http] ${options.label} reponse invalide (${paths})`);
    throw externalUnavailable(options.label, parsed.error);
  }

  return parsed.data;
}
