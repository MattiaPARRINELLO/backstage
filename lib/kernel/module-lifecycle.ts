import { existsSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { KERNEL_API } from "@backstage/module-kit";

import { addToComposition, removeFromComposition } from "./module-composition";
import {
  assertModuleId,
  configPath,
  lockPath,
  moduleDirectory,
  readComposition,
  readConfig,
  readLock,
  restoreFiles,
  serializeConfig,
  snapshotFiles,
  temporaryPath,
  writeLock,
} from "./module-files";
import type { ModuleLockEntry, ModulesLock } from "./module-files";
import {
  assertModuleManifest,
  cloneAtRef,
  readManifest,
  type InstalledModule,
} from "./module-source";

/**
 * Mise a jour et retrait d'un module installe (phase 8 de #84).
 *
 * Les deux operations reutilisent le clone et la validation de l'installation,
 * puis ecrivent dans le meme ordre : contenu, composition, lock en dernier. Un
 * instantane des fichiers est restaure si une etape echoue.
 */

export interface UpdateOptions {
  readonly root: string;
  readonly id: string;
  /** Nouvelle ref ; sans elle, la ref du lock est reinstallee. */
  readonly ref?: string;
  readonly kernelApi?: number;
}

/**
 * Met a jour un module installe : meme depot, ref du lock par defaut, identifiant
 * inchange et etat active/desactive conserve (la config n'est pas touchee).
 */
export async function updateModule(options: UpdateOptions): Promise<InstalledModule> {
  const { root, id } = options;
  const kernelApi = options.kernelApi ?? KERNEL_API;
  const lock = readLock(root);
  const entry = lock.modules[id];
  if (!entry) throw new Error(`Module "${id}" inconnu du lock : rien a mettre a jour.`);

  const requested = options.ref?.trim();
  const ref = requested && requested.length > 0 ? requested : entry.ref;

  const modulesDir = join(root, "modules");
  const destination = moduleDirectory(root, id);
  if (!existsSync(destination)) {
    throw new Error(
      `Dossier modules/${id} absent : reinstalle le module avec module:add ${entry.repo}#${ref}.`
    );
  }

  const composition = readComposition(modulesDir);
  const tempDir = temporaryPath(modulesDir, "install");
  const backupDir = temporaryPath(modulesDir, "backup");

  try {
    const commit = cloneAtRef(entry.repo, ref, tempDir);
    const manifest = await readManifest(tempDir);
    assertModuleManifest(manifest, kernelApi);
    if (manifest.id !== id) {
      throw new Error(
        `Le manifeste de ${entry.repo}#${ref} declare "${manifest.id}" au lieu de "${id}" : mise a jour refusee.`
      );
    }

    const nextComposition = addToComposition(composition.source, id);
    const nextLock: ModulesLock = {
      modules: {
        ...lock.modules,
        [id]: { repo: entry.repo, ref, commit, installedAt: new Date().toISOString() },
      },
    };

    rmSync(join(tempDir, ".git"), { recursive: true, force: true });
    renameSync(destination, backupDir);
    renameSync(tempDir, destination);

    const snapshots = snapshotFiles([composition.path, lockPath(root)]);
    try {
      writeFileSync(composition.path, nextComposition, "utf8");
      writeLock(root, nextLock);
    } catch (error) {
      restoreFiles(snapshots);
      rmSync(destination, { recursive: true, force: true });
      renameSync(backupDir, destination);
      throw error;
    }
    rmSync(backupDir, { recursive: true, force: true });

    return {
      id,
      label: manifest.label,
      apiVersion: manifest.apiVersion,
      commit,
      repo: entry.repo,
      ref,
      capabilities: manifest.capabilities ?? {},
    };
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
}

export interface RemoveResult {
  readonly id: string;
  readonly removedDirectory: boolean;
}

/**
 * Retire un module : dossier mis de cote, config, composition, puis lock en
 * dernier. Un dossier deja absent ne fait pas echouer le retrait.
 */
export function removeModule(root: string, id: string): RemoveResult {
  assertModuleId(id);
  const lock = readLock(root);
  if (!lock.modules[id]) {
    throw new Error(`Module "${id}" inconnu du lock : rien a retirer.`);
  }

  const modulesDir = join(root, "modules");
  const composition = readComposition(modulesDir);
  const config = readConfig(root);

  const remainingModules: Record<string, ModuleLockEntry> = {};
  for (const [key, value] of Object.entries(lock.modules)) {
    if (key !== id) remainingModules[key] = value;
  }
  const remainingConfig: Record<string, { enabled?: boolean }> = {};
  for (const [key, value] of Object.entries(config.modules ?? {})) {
    if (key !== id) remainingConfig[key] = value;
  }

  const destination = moduleDirectory(root, id);
  const backupDir = temporaryPath(modulesDir, "remove");
  const hadDirectory = existsSync(destination);
  if (hadDirectory) renameSync(destination, backupDir);

  const snapshots = snapshotFiles([configPath(root), composition.path, lockPath(root)]);
  try {
    writeFileSync(
      configPath(root),
      serializeConfig({ ...config, modules: remainingConfig }),
      "utf8"
    );
    writeFileSync(composition.path, removeFromComposition(composition.source, id), "utf8");
    writeLock(root, { modules: remainingModules });
  } catch (error) {
    restoreFiles(snapshots);
    if (hadDirectory) renameSync(backupDir, destination);
    throw error;
  }
  if (hadDirectory) rmSync(backupDir, { recursive: true, force: true });

  return { id, removedDirectory: hadDirectory };
}
