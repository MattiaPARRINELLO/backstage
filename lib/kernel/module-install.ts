import {
  existsSync,
  mkdirSync,
  readdirSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";

import { KERNEL_API } from "@backstage/module-kit";

import { addToComposition } from "./module-composition";
import {
  configPath,
  lockPath,
  readComposition,
  readConfig,
  readLock,
  restoreFiles,
  serializeConfig,
  snapshotFiles,
  temporaryPath,
  writeLock,
} from "./module-files";
import type { ModulesLock } from "./module-files";
import {
  assertModuleManifest,
  cloneAtRef,
  parseModuleSource,
  readManifest,
  type InstalledModule,
} from "./module-source";

/**
 * CLI des modules externes (ADR 0001, decision K ; phase 8 de #84).
 *
 * Une version de module est toujours un commit, jamais une branche : `ref` sert
 * au clone, `commit` est fige dans `modules.lock.json`. Une installation ecrit
 * exactement quatre choses, dans cet ordre : le dossier du module,
 * `modules.config.json`, `modules/index.ts`, puis `modules.lock.json`. Le lock
 * est la derniere ecriture : tant qu'il n'existe pas, le noyau n'importe pas le
 * module. Un instantane des trois fichiers est pris avant la premiere ecriture
 * et restaure si une etape echoue, et aucun dossier temporaire ne survit.
 */

export * from "./module-composition";
export * from "./module-files";
export * from "./module-lifecycle";
export * from "./module-source";

export interface InstallOptions {
  readonly root: string;
  readonly source: string;
  readonly kernelApi?: number;
}

/**
 * Installe un module : clone, verification, copie, puis ecriture des trois
 * fichiers de configuration dans l'ordre config, composition, lock.
 * Toute erreur restaure les fichiers et retire le dossier installe.
 */
export async function installModule(options: InstallOptions): Promise<InstalledModule> {
  const { root, source } = options;
  const kernelApi = options.kernelApi ?? KERNEL_API;
  const { repo, ref } = parseModuleSource(source);

  const modulesDir = join(root, "modules");
  mkdirSync(modulesDir, { recursive: true });
  const tempDir = temporaryPath(modulesDir, "install");
  const composition = readComposition(modulesDir);
  const lock = readLock(root);

  try {
    const commit = cloneAtRef(repo, ref, tempDir);
    const manifest = await readManifest(tempDir);
    assertModuleManifest(manifest, kernelApi);
    const id = manifest.id;

    const destination = join(modulesDir, id);
    if (existsSync(destination)) {
      throw new Error(
        `Le module "${id}" est deja present dans modules/${id}. Utilise module:update, ou module:remove avant de le reinstaller.`
      );
    }
    const existing = lock.modules[id];
    if (existing) {
      throw new Error(
        `Conflit d'identifiant : "${id}" est deja installe depuis ${existing.repo}#${existing.ref}. Retire-le avant d'installer un autre depot sous le meme identifiant.`
      );
    }

    // Tout ce qui peut echouer est calcule avant la premiere ecriture.
    const config = readConfig(root);
    const nextConfig = serializeConfig({
      ...config,
      modules: { ...(config.modules ?? {}), [id]: { enabled: true } },
    });
    const nextComposition = addToComposition(composition.source, id);
    const nextLock: ModulesLock = {
      modules: {
        ...lock.modules,
        [id]: { repo, ref, commit, installedAt: new Date().toISOString() },
      },
    };

    rmSync(join(tempDir, ".git"), { recursive: true, force: true });
    renameSync(tempDir, destination);

    const snapshots = snapshotFiles([configPath(root), composition.path, lockPath(root)]);
    try {
      writeFileSync(configPath(root), nextConfig, "utf8");
      writeFileSync(composition.path, nextComposition, "utf8");
      // Le lock en dernier : s'il existe, le noyau importe deja le module.
      writeLock(root, nextLock);
    } catch (error) {
      restoreFiles(snapshots);
      rmSync(destination, { recursive: true, force: true });
      throw error;
    }

    return {
      id,
      label: manifest.label,
      apiVersion: manifest.apiVersion,
      commit,
      repo,
      ref,
      capabilities: manifest.capabilities ?? {},
    };
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
}

export interface ModuleDoctorIssue {
  readonly id: string;
  readonly problem: string;
}

/** Verifie que chaque entree du lock correspond a un module utilisable. */
export async function doctorModules(
  root: string,
  kernelApi: number = KERNEL_API
): Promise<ModuleDoctorIssue[]> {
  const lock = readLock(root);
  const config = readConfig(root);
  const issues: ModuleDoctorIssue[] = [];

  for (const [id, entry] of Object.entries(lock.modules)) {
    const dir = join(root, "modules", id);
    if (!existsSync(dir)) {
      issues.push({ id, problem: `module absent de modules/${id} (lock: ${entry.commit}).` });
      continue;
    }
    if (config.modules?.[id]?.enabled !== true) {
      issues.push({ id, problem: "installe mais desactive dans modules.config.json." });
    }
    try {
      const manifest = await readManifest(dir);
      assertModuleManifest(manifest, kernelApi);
    } catch (error) {
      issues.push({
        id,
        problem: error instanceof Error ? error.message : String(error),
      });
    }
  }

  const modulesDir = join(root, "modules");
  if (existsSync(modulesDir)) {
    for (const name of readdirSync(modulesDir)) {
      if (!name.startsWith(".install-")) continue;
      issues.push({
        id: name,
        problem: `dossier temporaire d'une operation interrompue : supprime modules/${name}.`,
      });
    }
  }

  return issues;
}
