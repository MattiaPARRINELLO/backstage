import { z } from "zod";

import { getConfig as getAppConfig } from "@/lib/app-config";
import { getConfig as getEnvConfig } from "@/lib/config";
import { request } from "@/lib/http";

/**
 * Lecture du catalogue de modules (`mprnl/BS-modules`), issue #271.
 *
 * Le catalogue est une donnee **externe** : il ne fait jamais autorite. Chaque
 * entree est validee separement, une entree invalide est ignoree et journalisee
 * sans interrompre la lecture. Aucune ecriture ici : installer un module reste
 * le travail de `module-install.ts`.
 *
 * La lecture est paresseuse (declenchee par la page, jamais au demarrage),
 * bornee par un timeout court, et retombe sur le cache memoire precedent en cas
 * d'echec. Une liste vide n'est jamais renvoyee comme un succes : elle
 * ressemblerait a « aucun module », alors que c'est le catalogue qui est en
 * cause.
 */

/** Delai maximal d'une lecture : un catalogue lent ne bloque pas la page. */
export const CATALOG_TIMEOUT_MS = 5_000;

/** Duree du cache memoire : assez court pour suivre le depot, sans marteler GitHub. */
export const CATALOG_CACHE_TTL_MS = 5 * 60_000;

/**
 * Forme d'une entree du catalogue. `repo` et `ref` sont nuls pour un module
 * integre qui n'est pas distribue ; `path` est nul pour un module externe.
 */
export const moduleCatalogEntrySchema = z
  .object({
    id: z.string().trim().min(1),
    source: z.enum(["bundled", "external"]),
    path: z.string().trim().min(1).nullable(),
    repo: z.string().trim().min(1).nullable(),
    ref: z.string().trim().min(1).nullable(),
    distributable: z.boolean(),
    description: z.string().trim().min(1),
    kit: z.string().trim().min(1),
    env: z.array(z.string().trim().min(1)),
    visibility: z.enum(["public", "private"]).nullable(),
  })
  .superRefine((entry, context) => {
    if (entry.source === "bundled" && entry.path === null) {
      context.addIssue({
        code: "custom",
        path: ["path"],
        message: "un module integre doit declarer son chemin",
      });
    }
    if (entry.source === "external" && (entry.repo === null || entry.ref === null)) {
      context.addIssue({
        code: "custom",
        path: ["repo"],
        message: "un module externe doit declarer son depot et sa ref",
      });
    }
    if (entry.distributable && (entry.repo === null || entry.ref === null)) {
      context.addIssue({
        code: "custom",
        path: ["distributable"],
        message: "un module distribuable doit declarer son depot et sa ref",
      });
    }
  });

/** Entree validee, enrichie de ce que l'application doit savoir avant d'installer. */
export interface ModuleCatalogEntry {
  readonly id: string;
  readonly source: "bundled" | "external";
  readonly path: string | null;
  readonly repo: string | null;
  readonly ref: string | null;
  readonly distributable: boolean;
  readonly description: string;
  readonly kit: string;
  readonly env: readonly string[];
  readonly visibility: "public" | "private" | null;
  /** `true` quand le depot est prive et qu'aucun `GITHUB_TOKEN` n'est configure. */
  readonly requiresToken: boolean;
}

interface CatalogSuccess {
  readonly ok: true;
  readonly entries: readonly ModuleCatalogEntry[];
  /** Nombre d'entrees ecartees parce qu'invalides. */
  readonly ignored: number;
  readonly fetchedAt: string;
  /** `true` quand la reponse vient du cache memoire, pas du reseau. */
  readonly fromCache: boolean;
}

interface CatalogFailure {
  readonly ok: false;
  /** Message utilisable tel quel par l'interface. */
  readonly error: string;
  /** Cache precedent, eventuellement vide. Jamais confondu avec un catalogue vide. */
  readonly entries: readonly ModuleCatalogEntry[];
  readonly fetchedAt: string | null;
  readonly fromCache: boolean;
}

export type ModuleCatalog = CatalogSuccess | CatalogFailure;

export interface ReadCatalogOptions {
  /** Source du catalogue ; par defaut `AppConfig.modules.catalogUrl`. */
  readonly url?: string;
  /** Jeton GitHub ; `null` force la lecture anonyme. */
  readonly token?: string | null;
  /** Force une relecture reseau, sans consulter le cache. */
  readonly force?: boolean;
  readonly cacheTtlMs?: number;
}

interface CacheEntry {
  readonly url: string;
  readonly entries: readonly ModuleCatalogEntry[];
  readonly ignored: number;
  readonly fetchedAt: string;
  readonly fetchedAtMs: number;
}

let cache: CacheEntry | null = null;

async function resolveOptions(options: ReadCatalogOptions): Promise<{
  url: string;
  token: string | null;
  cacheTtlMs: number;
}> {
  const url = options.url ?? (await getAppConfig()).modules.catalogUrl;
  const token = options.token === undefined ? getEnvConfig().GITHUB_TOKEN ?? null : options.token;
  return { url, token, cacheTtlMs: options.cacheTtlMs ?? CATALOG_CACHE_TTL_MS };
}

function toEntry(raw: z.infer<typeof moduleCatalogEntrySchema>, hasToken: boolean): ModuleCatalogEntry {
  return {
    ...raw,
    requiresToken: raw.visibility === "private" && !hasToken,
  };
}

/**
 * Lit et valide le catalogue. Ne leve jamais sur une panne reseau : renvoie une
 * erreur explicite, accompagnee du cache precedent s'il existe.
 */
export async function readCatalog(options: ReadCatalogOptions = {}): Promise<ModuleCatalog> {
  const { url, token, cacheTtlMs } = await resolveOptions(options);
  const fresh = cache !== null && cache.url === url && Date.now() - cache.fetchedAtMs < cacheTtlMs;

  if (cache !== null && fresh && !options.force) {
    return {
      ok: true,
      entries: cache.entries,
      ignored: cache.ignored,
      fetchedAt: cache.fetchedAt,
      fromCache: true,
    };
  }

  try {
    const download = await downloadCatalog(url, token);
    cache = { url, fetchedAtMs: Date.now(), ...download };
    return { ok: true, ...download, fromCache: false };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`[module-catalog] lecture impossible : ${message}`);
    const previous = cache !== null && cache.url === url ? cache : null;
    return {
      ok: false,
      error: `Catalogue des modules injoignable : ${message}`,
      entries: previous?.entries ?? [],
      fetchedAt: previous?.fetchedAt ?? null,
      fromCache: previous !== null,
    };
  }
}

/** Relecture forcee, pour l'invalidation : ignore le cache memoire. */
export function fetchCatalog(
  options: Omit<ReadCatalogOptions, "force"> = {}
): Promise<ModuleCatalog> {
  return readCatalog({ ...options, force: true });
}

interface Download {
  readonly entries: readonly ModuleCatalogEntry[];
  readonly ignored: number;
  readonly fetchedAt: string;
}

async function downloadCatalog(url: string, token: string | null): Promise<Download> {
  const headers: Record<string, string> = { accept: "application/json" };
  if (token !== null) headers.authorization = `Bearer ${token}`;

  const response = await request(url, {
    label: "catalogue-modules",
    headers,
    timeoutMs: CATALOG_TIMEOUT_MS,
    // Un catalogue n'est pas critique : une seule tentative, pas de double attente.
    retries: 0,
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new Error("reponse JSON illisible");
  }
  if (!Array.isArray(payload)) throw new Error("le catalogue doit etre un tableau");

  const entries: ModuleCatalogEntry[] = [];
  let ignored = 0;
  payload.forEach((raw, index) => {
    const parsed = moduleCatalogEntrySchema.safeParse(raw);
    if (!parsed.success) {
      ignored += 1;
      const fields = parsed.error.issues.map((issue) => issue.path.join(".") || "entree").join(", ");
      console.warn(`[module-catalog] entree ${index} ignoree (${fields})`);
      return;
    }
    entries.push(toEntry(parsed.data, token !== null));
  });

  if (entries.length === 0) {
    throw new Error(
      ignored > 0
        ? `aucune entree valide (${ignored} entree(s) invalide(s))`
        : "catalogue vide"
    );
  }

  return { entries, ignored, fetchedAt: new Date().toISOString() };
}
