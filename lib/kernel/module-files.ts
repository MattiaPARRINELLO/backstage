import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { KERNEL_API } from "@backstage/module-kit";

/**
 * Etat sur disque des modules externes : lock, configuration et ecritures
 * transactionnelles. Ce fichier ne clone ni n'installe rien : il ne connait
 * que `modules.lock.json`, `modules.config.json` et `modules/index.ts`.
 */

export interface ModuleLockEntry {
  readonly repo: string;
  readonly ref: string;
  readonly commit: string;
  readonly installedAt: string;
}

export interface ModulesLock {
  readonly modules: Record<string, ModuleLockEntry>;
}

export interface ModulesConfigFile {
  kernelApi?: number;
  modules?: Record<string, { enabled?: boolean }>;
}

export function readLock(root: string): ModulesLock {
  const path = join(root, "modules.lock.json");
  if (!existsSync(path)) return { modules: {} };
  const parsed = JSON.parse(readFileSync(path, "utf8")) as Partial<ModulesLock>;
  return { modules: parsed.modules ?? {} };
}

export function writeLock(root: string, lock: ModulesLock): void {
  writeFileSync(
    join(root, "modules.lock.json"),
    `${JSON.stringify(lock, null, 2)}\n`,
    "utf8"
  );
}

export function readConfig(root: string): ModulesConfigFile {
  const path = configPath(root);
  if (!existsSync(path)) return { kernelApi: KERNEL_API, modules: {} };
  return JSON.parse(readFileSync(path, "utf8")) as ModulesConfigFile;
}

export function serializeConfig(config: ModulesConfigFile): string {
  return `${JSON.stringify(config, null, 2)}\n`;
}

export function configPath(root: string): string {
  return join(root, "modules.config.json");
}

export function lockPath(root: string): string {
  return join(root, "modules.lock.json");
}

export interface FileSnapshot {
  readonly path: string;
  readonly content: string | null;
}

/** Instantane des fichiers qui vont etre reecrits, pour un rollback a l'octet. */
export function snapshotFiles(paths: readonly string[]): FileSnapshot[] {
  return paths.map((path) => ({
    path,
    content: existsSync(path) ? readFileSync(path, "utf8") : null,
  }));
}

export function restoreFiles(snapshots: readonly FileSnapshot[]): void {
  for (const snapshot of snapshots) {
    try {
      if (snapshot.content === null) rmSync(snapshot.path, { force: true });
      else writeFileSync(snapshot.path, snapshot.content, "utf8");
    } catch (error) {
      console.error(`[module-install] rollback impossible pour ${snapshot.path}`, error);
    }
  }
}

/**
 * Chemin temporaire unique, toujours prefixe `.install-` pour que `doctor`
 * signale un dossier laisse par une operation interrompue.
 */
export function temporaryPath(
  modulesDir: string,
  kind: "install" | "backup" | "remove"
): string {
  const suffix = Math.random().toString(36).slice(2, 8);
  return join(modulesDir, `.install-${kind}-${process.pid}-${Date.now()}-${suffix}`);
}

export function readComposition(modulesDir: string): { path: string; source: string } {
  const path = join(modulesDir, "index.ts");
  if (!existsSync(path)) {
    throw new Error("Racine de composition introuvable : modules/index.ts.");
  }
  return { path, source: readFileSync(path, "utf8") };
}

/** Active ou desactive un module : `modules.config.json` est le seul fichier touche. */
export function enableModule(root: string, id: string): void {
  setModuleEnabled(root, id, true);
}

export function disableModule(root: string, id: string): void {
  setModuleEnabled(root, id, false);
}

function setModuleEnabled(root: string, id: string, enabled: boolean): void {
  const config = readConfig(root);
  if (enabled) {
    const known =
      existsSync(join(root, "modules", id)) ||
      config.modules?.[id] !== undefined ||
      readLock(root).modules[id] !== undefined;
    if (!known) throw new Error(`Module "${id}" inconnu : rien a activer.`);
  } else if (config.modules?.[id]?.enabled !== true) {
    throw new Error(`Le module "${id}" est deja desactive.`);
  }
  config.modules = { ...(config.modules ?? {}), [id]: { enabled } };
  writeFileSync(configPath(root), serializeConfig(config), "utf8");
}
