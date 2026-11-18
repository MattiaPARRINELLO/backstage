import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

import { KERNEL_API } from "@backstage/module-kit";

/**
 * Installation d'un module depuis un depot git externe (ADR 0001, decision K).
 *
 * Une version de module est toujours un commit, jamais une branche : `ref` sert
 * au clone, `commit` est fige dans `modules.lock.json`. L'installation ecrit
 * exactement quatre choses : le dossier du module, `modules.config.json`,
 * `modules.lock.json` et la racine de composition. Aucun artefact temporaire
 * ne survit, et le clone perd son `.git`.
 */

export interface ModuleSource {
  readonly repo: string;
  readonly ref: string;
}

export interface ModuleLockEntry {
  readonly repo: string;
  readonly ref: string;
  readonly commit: string;
  readonly installedAt: string;
}

export interface ModulesLock {
  readonly modules: Record<string, ModuleLockEntry>;
}

export interface InstalledModule {
  readonly id: string;
  readonly label: string;
  readonly apiVersion: number;
  readonly commit: string;
  readonly repo: string;
  readonly ref: string;
  readonly capabilities: unknown;
}

interface ModuleManifestShape {
  readonly id?: unknown;
  readonly apiVersion?: unknown;
  readonly label?: unknown;
  readonly selectionDescription?: unknown;
  readonly description?: unknown;
  readonly capabilities?: unknown;
}

const MODULE_ID_PATTERN = /^[a-z][a-z0-9-]*$/;

/** `url#ref` : la ref est obligatoire, pour ne jamais installer « la branche ». */
export function parseModuleSource(input: string): ModuleSource {
  const separator = input.lastIndexOf("#");
  if (separator <= 0 || separator === input.length - 1) {
    throw new Error(
      `Source invalide : "${input}". Attendu : <url-git>#<ref> (tag ou commit), par exemple https://github.com/org/module.git#v1.0.0.`
    );
  }
  const repo = input.slice(0, separator).trim();
  const ref = input.slice(separator + 1).trim();
  if (!repo || !ref) {
    throw new Error("Source invalide : le depot et la ref sont obligatoires.");
  }
  return { repo, ref };
}

/** Verifie les champs dont depend le noyau, avec un message actionnable. */
export function assertModuleManifest(
  manifest: ModuleManifestShape,
  kernelApi: number = KERNEL_API
): asserts manifest is ModuleManifestShape & {
  id: string;
  apiVersion: number;
  label: string;
  selectionDescription: string;
  description: string;
} {
  if (!manifest || typeof manifest !== "object") {
    throw new Error("Manifeste invalide : le module doit exporter un objet par defaut.");
  }
  if (typeof manifest.id !== "string" || !MODULE_ID_PATTERN.test(manifest.id)) {
    throw new Error(
      `Identifiant de module invalide : "${String(manifest.id)}". Attendu : kebab-case (ex: reminders).`
    );
  }
  if (
    typeof manifest.apiVersion !== "number" ||
    !Number.isInteger(manifest.apiVersion) ||
    manifest.apiVersion < 1
  ) {
    throw new Error(`Module "${manifest.id}" : apiVersion entiere positive requise.`);
  }
  if (manifest.apiVersion > kernelApi) {
    throw new Error(
      `Module "${manifest.id}" exige l'API de module ${manifest.apiVersion}, ce noyau en est a la version ${kernelApi}. ` +
        `Mets a jour le noyau, ou installe une version anterieure de ce module.`
    );
  }
  for (const field of ["label", "selectionDescription", "description"] as const) {
    if (typeof manifest[field] !== "string" || !manifest[field].trim()) {
      throw new Error(`Module "${manifest.id}" : ${field} est obligatoire.`);
    }
  }
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

export function enableModule(root: string, id: string): void {
  const path = join(root, "modules.config.json");
  const config = existsSync(path)
    ? (JSON.parse(readFileSync(path, "utf8")) as {
        kernelApi?: number;
        modules?: Record<string, { enabled?: boolean }>;
      })
    : { kernelApi: KERNEL_API, modules: {} };
  config.modules = { ...(config.modules ?? {}), [id]: { enabled: true } };
  writeFileSync(path, `${JSON.stringify(config, null, 2)}\n`, "utf8");
}

function identifierFor(id: string): string {
  return id.replace(/-([a-z0-9])/g, (_, letter: string) => letter.toUpperCase());
}

/** Ajoute l'import et l'entree du module dans la racine de composition. */
export function addToComposition(source: string, id: string): string {
  if (source.includes(`"./${id}/module"`)) return source;

  const ident = identifierFor(id);
  const importLine = `import ${ident} from "./${id}/module";`;

  const importLines = [...source.matchAll(/^import .*;$/gm)];
  const lastImport = importLines.at(-1);
  let next = source;
  if (lastImport?.index !== undefined) {
    const insertAt = lastImport.index + lastImport[0].length;
    next = `${source.slice(0, insertAt)}\n${importLine}${source.slice(insertAt)}`;
  } else {
    next = `${importLine}\n${source}`;
  }

  const arrayPattern =
    /(export const modules: readonly ModuleDefinition\[\] = \[)([\s\S]*?)(\];)/;
  if (!arrayPattern.test(next)) {
    throw new Error("Racine de composition invalide : tableau `modules` introuvable.");
  }
  return next.replace(arrayPattern, (_match, start: string, entries: string, end: string) => {
    const trimmed = entries.trim();
    const separator = trimmed.length > 0 ? ", " : "";
    return `${start}${trimmed}${separator}${ident}${end}`;
  });
}

async function readManifest(dir: string): Promise<ModuleManifestShape> {
  const entry = join(dir, "module.ts");
  if (!existsSync(entry)) {
    throw new Error("Le depot ne contient pas de module.ts a sa racine.");
  }
  const imported = (await import(pathToFileURL(entry).href)) as {
    default?: ModuleManifestShape;
    module?: ModuleManifestShape;
  };
  return imported.default ?? imported.module ?? (imported as ModuleManifestShape);
}

export interface InstallOptions {
  readonly root: string;
  readonly source: string;
  readonly kernelApi?: number;
}

/**
 * Installe un module : clone, verification, copie, puis ecriture des trois
 * fichiers de configuration. En cas d'erreur, aucun dossier ne reste.
 */
export async function installModule(options: InstallOptions): Promise<InstalledModule> {
  const { root, source } = options;
  const kernelApi = options.kernelApi ?? KERNEL_API;
  const { repo, ref } = parseModuleSource(source);

  const modulesDir = join(root, "modules");
  mkdirSync(modulesDir, { recursive: true });
  const tempDir = join(modulesDir, `.install-${process.pid}-${Date.now()}`);

  try {
    execFileSync(
      "git",
      ["clone", "--quiet", "--depth", "1", "--branch", ref, repo, tempDir],
      { stdio: ["ignore", "pipe", "pipe"] }
    );

    const commit = execFileSync("git", ["-C", tempDir, "rev-parse", "HEAD"], {
      encoding: "utf8",
    }).trim();

    const manifest = await readManifest(tempDir);
    assertModuleManifest(manifest, kernelApi);
    const id = manifest.id;

    const destination = join(modulesDir, id);
    if (existsSync(destination)) {
      throw new Error(
        `Le module "${id}" est deja present dans modules/${id}. Desactive-le ou retire-le avant de le reinstaller.`
      );
    }

    rmSync(join(tempDir, ".git"), { recursive: true, force: true });
    renameSync(tempDir, destination);

    enableModule(root, id);
    const lock = readLock(root);
    writeLock(root, {
      modules: {
        ...lock.modules,
        [id]: { repo, ref, commit, installedAt: new Date().toISOString() },
      },
    });

    const compositionPath = join(root, "modules", "index.ts");
    if (!existsSync(compositionPath)) {
      throw new Error("Racine de composition introuvable : modules/index.ts.");
    }
    writeFileSync(
      compositionPath,
      addToComposition(readFileSync(compositionPath, "utf8"), id),
      "utf8"
    );

    return {
      id,
      label: manifest.label,
      apiVersion: manifest.apiVersion,
      commit,
      repo,
      ref,
      capabilities: manifest.capabilities ?? {},
    };
  } catch (error) {
    rmSync(tempDir, { recursive: true, force: true });
    throw error;
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
  const configPath = join(root, "modules.config.json");
  const config = existsSync(configPath)
    ? (JSON.parse(readFileSync(configPath, "utf8")) as {
        modules?: Record<string, { enabled?: boolean }>;
      })
    : {};
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

  return issues;
}
