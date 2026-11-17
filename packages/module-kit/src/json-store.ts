import path from "node:path";
import type { z } from "zod";

import { mutateJson, readOrCreate, writeJsonAtomic } from "./storage-core";

export type JsonStoreLogger = (
  level: "warn" | "error",
  message: string,
  error?: unknown
) => void;

export interface JsonStoreOptions<Schema extends z.ZodType> {
  /** Identifiant du module propriétaire. Namespace le fichier dans `data/`. */
  readonly moduleId: string;
  /** Nom du fichier, extension comprise (`reminders.json`). */
  readonly file: string;
  /** Schéma de validation, appliqué en lecture et en écriture. */
  readonly schema: Schema;
  /** Valeur par défaut, clonée à chaque lecture : jamais un état partagé. */
  readonly fallback: z.infer<Schema>;
  /**
   * Chemin historique à la racine de `data/`, lu et écrit tel quel.
   * Permet de migrer un domaine sans déplacer ni réécrire ses données.
   */
  readonly legacyPath?: string;
  readonly log?: JsonStoreLogger;
}

export interface JsonStore<T> {
  /** Chemin relatif dans `data/`, utile pour les logs et les sauvegardes. */
  readonly path: string;
  read(): Promise<T>;
  write(data: T): Promise<void>;
  /**
   * Cycle lecture, mutation, écriture sous un seul verrou. Le mutateur reçoit
   * une copie : s'il retourne `null`, rien n'est écrit. Une valeur produite
   * hors schéma lève, au lieu d'écrire des données invalides.
   */
  mutate(mutator: (data: T) => T | null | void): Promise<T | null>;
}

/**
 * Chemin de stockage d'un module, relatif à `data/`.
 *
 * Refuse tout ce qui sortirait du répertoire de données : un module ne doit pas
 * pouvoir écrire ailleurs par un chemin construit.
 */
export function resolveStorePath(
  moduleId: string,
  file: string,
  legacyPath?: string
): string {
  const source = legacyPath ?? `${moduleId}/${file}`;
  if (path.posix.isAbsolute(source) || path.posix.isAbsolute(file)) {
    throw new Error(
      `Chemin de stockage interdit pour le module "${moduleId}" : "${source}" sort de data/.`
    );
  }
  const candidate = source.replace(/^data\//, "");
  // Refus avant normalisation : `reminders/../secrets.json` sortirait du
  // namespace du module tout en restant dans `data/`, ce qui n'est pas le
  // contrat (un module ne lit que ses propres fichiers).
  if (candidate.split("/").includes("..")) {
    throw new Error(
      `Chemin de stockage interdit pour le module "${moduleId}" : "${source}" sort de data/.`
    );
  }
  const normalized = path.posix.normalize(candidate);

  if (!normalized || normalized === ".") {
    throw new Error(`Chemin de stockage vide pour le module "${moduleId}".`);
  }
  if (normalized.startsWith("..") || path.posix.isAbsolute(normalized)) {
    throw new Error(
      `Chemin de stockage interdit pour le module "${moduleId}" : "${candidate}" sort de data/.`
    );
  }
  if (!normalized.endsWith(".json")) {
    throw new Error(
      `Chemin de stockage invalide pour le module "${moduleId}" : "${candidate}" doit finir par .json.`
    );
  }
  return normalized;
}

function describeIssues(error: z.ZodError): string {
  return error.issues
    .map((issue) => `${issue.path.join(".") || "(racine)"} : ${issue.message}`)
    .join("; ");
}

/**
 * Store JSON d'un module : namespacement, validation Zod et écriture atomique.
 *
 * Le fichier vit dans `data/<module-id>/`, ou dans `legacyPath` tant qu'il est
 * déclaré. Les données existantes ne sont ni déplacées ni réécrites à la
 * première lecture : `legacyPath` continue de désigner le fichier historique.
 */
export function jsonStore<Schema extends z.ZodType>(
  options: JsonStoreOptions<Schema>
): JsonStore<z.infer<Schema>> {
  type T = z.infer<Schema>;

  const storePath = resolveStorePath(
    options.moduleId,
    options.file,
    options.legacyPath
  );
  const log: JsonStoreLogger =
    options.log ??
    ((level, message, error) => {
      const line = `[${options.moduleId}] ${message}`;
      if (level === "error") console.error(line, error);
      else console.warn(line, error);
    });

  return {
    path: storePath,

    async read() {
      const raw = await readOrCreate<T>(storePath, options.fallback);
      const parsed = options.schema.safeParse(raw);
      if (parsed.success) return parsed.data;
      // Données invalides : on le dit et on rend le défaut en mémoire. Le
      // fichier n'est PAS réécrit, pour ne jamais détruire ce qu'on n'a pas su
      // lire ; le prochain `mutate` repartira d'une base propre.
      log(
        "error",
        `donnees invalides dans ${storePath}, defaut rendu en memoire : ${describeIssues(parsed.error)}`,
        parsed.error
      );
      return structuredClone(options.fallback);
    },

    async write(data) {
      const parsed = options.schema.safeParse(data);
      if (!parsed.success) {
        throw new Error(
          `Donnees invalides pour ${storePath} : ${describeIssues(parsed.error)}`
        );
      }
      await writeJsonAtomic(storePath, parsed.data);
    },

    async mutate(mutator) {
      let invalid: z.ZodError | null = null;
      const result = await mutateJson<T>(storePath, options.fallback, (raw) => {
        const current = options.schema.safeParse(raw);
        const base = current.success
          ? current.data
          : structuredClone(options.fallback);
        const draft = structuredClone(base);
        const next = mutator(draft);
        if (next === null) return null;
        const candidate = options.schema.safeParse(next ?? draft);
        if (!candidate.success) {
          invalid = candidate.error;
          return null;
        }
        return candidate.data;
      });

      if (invalid) {
        const error: z.ZodError = invalid;
        throw new Error(
          `Mutation refusee pour ${storePath} : ${describeIssues(error)}`
        );
      }
      return result;
    },
  };
}
