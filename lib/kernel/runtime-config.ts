import { existsSync, statSync } from "node:fs";

import buildConfig from "@/modules.config.json";

import { configPath, readConfig, type ModulesConfigFile } from "./module-files";

/**
 * Configuration des modules lue a l'execution (issue #270).
 *
 * `modules.config.json` etait auparavant importe statiquement : la bascule
 * ecrite par l'interface ne pouvait donc rien changer avant un rebuild. Le
 * fichier importe reste la **reference de build** : il sert de repli quand le
 * fichier n'existe pas a la racine d'execution (sortie standalone de Next, qui
 * n'embarque pas la config du depot). Dans ce cas `source` vaut `"build"` et
 * l'interface le dit, plutot que d'afficher une config vide.
 *
 * Le cache memoire est indexe sur le chemin et sur `mtime`/taille du fichier :
 * une modification faite en CLI est vue au tour suivant, et
 * `invalidateRuntimeConfig()` force la relecture apres une action.
 */

export interface RuntimeModulesConfig {
  readonly config: ModulesConfigFile;
  readonly source: "file" | "build";
  /** Change des que le fichier lu change : sert de cle de cache au registre. */
  readonly version: string;
}

interface CacheEntry {
  readonly key: string;
  readonly value: RuntimeModulesConfig;
}

let cache: CacheEntry | null = null;

function fileStamp(path: string): string | null {
  if (!existsSync(path)) return null;
  try {
    const stat = statSync(path);
    return `${stat.mtimeMs}:${stat.size}`;
  } catch {
    return null;
  }
}

export function readRuntimeConfig(root: string): RuntimeModulesConfig {
  const path = configPath(root);
  const stamp = fileStamp(path);
  const key = `${path}\u0000${stamp ?? "build"}`;

  if (cache !== null && cache.key === key) return cache.value;

  const value: RuntimeModulesConfig =
    stamp === null
      ? { config: buildConfig as ModulesConfigFile, source: "build", version: key }
      : { config: readConfig(root), source: "file", version: key };

  cache = { key, value };
  return value;
}

export function invalidateRuntimeConfig(): void {
  cache = null;
}
