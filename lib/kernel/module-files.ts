import { existsSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve, sep } from "node:path";

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

/**
 * Serialise `modules.config.json` dans la forme committée : une entrée par
 * ligne. `JSON.stringify(..., null, 2)` produisait un fichier different a
 * chaque passage, donc `git status` restait sale apres un `module:remove`.
 */
export function serializeConfig(config: ModulesConfigFile): string {
  const kernelApi = config.kernelApi ?? KERNEL_API;
  const entries = Object.entries(config.modules ?? {});
  if (entries.length === 0) {
    return `{\n  "kernelApi": ${kernelApi},\n  "modules": {}\n}\n`;
  }
  const modules = entries
    .map(([id, value]) => {
      const v = (value ?? {}) as Record<string, unknown>;
      const keys = Object.keys(v);
      const ordered = keys.includes("enabled")
        ? ["enabled", ...keys.filter((k) => k !== "enabled")]
        : ["enabled", ...keys];
      const fields = ordered
        .map((k) => {
          const val = k === "enabled" ? (v[k] ?? false) : v[k];
          return `"${k}": ${JSON.stringify(val)}`;
        })
        .join(", ");
      return `    ${JSON.stringify(id)}: { ${fields} }`;
    })
    .join(",\n");
  return `{\n  "kernelApi": ${kernelApi},\n  "modules": {\n${modules}\n  }\n}\n`;
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

/**
 * Identifiant de module sur : kebab-case uniquement. Il sert de nom de dossier
 * et de cle de configuration, donc il ne doit jamais pouvoir designer un chemin
 * ni un nom reserve (`__proto__`, `constructor`).
 */
const MODULE_ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function assertModuleId(id: string): string {
  if (!MODULE_ID_PATTERN.test(id)) {
    throw new Error(
      `Identifiant de module invalide : "${id}". Attendu : kebab-case (lettres minuscules, chiffres, tirets).`
    );
  }
  return id;
}

/** Dossier d'un module, confine a `modules/` : aucune remontee de chemin. */
export function moduleDirectory(root: string, id: string): string {
  const safe = assertModuleId(id);
  const base = resolve(root, "modules");
  const directory = resolve(base, safe);
  if (!directory.startsWith(`${base}${sep}`)) {
    throw new Error(`Identifiant de module invalide : "${id}".`);
  }
  return directory;
}

/** Active ou desactive un module : `modules.config.json` est le seul fichier touche. */
export function enableModule(root: string, id: string): void {
  setModuleEnabled(root, id, true);
}

export function disableModule(root: string, id: string): void {
  setModuleEnabled(root, id, false);
}

function moduleNames(root: string): Set<string> {
  const modulesDir = join(root, "modules");
  const directories = existsSync(modulesDir) ? readdirSync(modulesDir) : [];
  return new Set([
    ...Object.keys(readConfig(root).modules ?? {}),
    ...Object.keys(readLock(root).modules),
    ...directories,
  ]);
}

function setModuleEnabled(root: string, id: string, enabled: boolean): void {
  const moduleId = assertModuleId(id);
  const config = readConfig(root);
  if (enabled) {
    if (!moduleNames(root).has(moduleId)) {
      throw new Error(`Module "${moduleId}" inconnu : rien a activer.`);
    }
  } else if (config.modules?.[moduleId]?.enabled !== true) {
    throw new Error(`Le module "${moduleId}" est deja desactive.`);
  }

  const modules = new Map(Object.entries(config.modules ?? {}));
  modules.set(moduleId, { enabled });
  config.modules = Object.fromEntries(modules);
  writeFileSync(configPath(root), serializeConfig(config), "utf8");
}
