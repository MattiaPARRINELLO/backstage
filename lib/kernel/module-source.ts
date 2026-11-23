import { execFileSync } from "node:child_process";
import { existsSync, rmSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

import { type ModuleManifestShape } from "@backstage/module-kit";

/**
 * Source d'un module externe : parsing de `url#ref`, validation du manifeste et
 * clone a une ref epinglee. Aucune ecriture dans le depot hote ici.
 *
 * La validation du manifeste vit dans le kit (`assertModuleManifest`) : c'est
 * la meme regle que celle qu'un auteur peut executer chez lui avec
 * `@backstage/module-kit/testing`.
 */

export { assertModuleManifest, type ModuleManifestShape } from "@backstage/module-kit";

export interface ModuleSource {
  readonly repo: string;
  readonly ref: string;
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

/** Clone a une ref epinglee : tag ou commit. Le commit reel est fige plus tard. */
export function cloneAtRef(repo: string, ref: string, destination: string): string {
  try {
    execFileSync(
      "git",
      ["clone", "--quiet", "--depth", "1", "--branch", ref, repo, destination],
      { stdio: ["ignore", "pipe", "pipe"] }
    );
  } catch {
    // `--branch` ne connait pas les commits : seconde chance en clone complet.
    rmSync(destination, { recursive: true, force: true });
    try {
      execFileSync("git", ["clone", "--quiet", repo, destination], {
        stdio: ["ignore", "pipe", "pipe"],
      });
      execFileSync("git", ["-C", destination, "checkout", "--quiet", ref], {
        stdio: ["ignore", "pipe", "pipe"],
      });
    } catch (error) {
      throw new Error(
        `Impossible de cloner ${repo} a la ref "${ref}" : ${describeGitError(error)}`
      );
    }
  }
  return execFileSync("git", ["-C", destination, "rev-parse", "HEAD"], {
    encoding: "utf8",
  }).trim();
}

function describeGitError(error: unknown): string {
  if (error && typeof error === "object" && "stderr" in error) {
    const stderr = (error as { stderr?: Buffer | string }).stderr;
    const text = Buffer.isBuffer(stderr) ? stderr.toString("utf8") : stderr;
    if (typeof text === "string" && text.trim()) {
      return text.trim().split("\n").at(-1) ?? text.trim();
    }
  }
  return error instanceof Error ? error.message : String(error);
}

export async function readManifest(dir: string): Promise<ModuleManifestShape> {
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
