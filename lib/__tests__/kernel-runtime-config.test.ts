import { mkdtempSync, rmSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { invalidateRuntimeConfig, readRuntimeConfig } from "@/lib/kernel/runtime-config";
import { serializeConfig } from "@/lib/kernel/module-files";

/**
 * Decision A de l'issue #270 : le registre lit la config a l'execution.
 * Verifie le repli sur la config du build (sortie standalone) et la detection
 * d'une modification faite hors de l'action (CLI `module:enable`).
 */

const roots: string[] = [];

function temporaryRoot(): string {
  const root = mkdtempSync(join(tmpdir(), "runtime-config-"));
  roots.push(root);
  return root;
}

function write(root: string, modules: Record<string, { enabled: boolean }>, mtime: number): void {
  const path = join(root, "modules.config.json");
  writeFileSync(path, serializeConfig({ kernelApi: 1, modules }), "utf8");
  utimesSync(path, new Date(mtime), new Date(mtime));
}

afterEach(() => {
  invalidateRuntimeConfig();
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe("readRuntimeConfig", () => {
  it("se replie sur la config du build sans fichier a la racine", () => {
    const runtime = readRuntimeConfig(temporaryRoot());
    expect(runtime.source).toBe("build");
    expect(runtime.config.modules?.reminders?.enabled).toBe(true);
  });

  it("lit le fichier quand il existe", () => {
    const root = temporaryRoot();
    write(root, { alpha: { enabled: false } }, 1_000);

    const runtime = readRuntimeConfig(root);
    expect(runtime.source).toBe("file");
    expect(runtime.config.modules).toEqual({ alpha: { enabled: false } });
  });

  it("change de version quand le fichier change hors de l'action", () => {
    const root = temporaryRoot();
    write(root, { alpha: { enabled: true } }, 1_000);
    const first = readRuntimeConfig(root);

    write(root, { alpha: { enabled: false } }, 2_000);
    const second = readRuntimeConfig(root);

    expect(second.version).not.toBe(first.version);
    expect(second.config.modules?.alpha?.enabled).toBe(false);
  });

  it("relit le fichier apres invalidation", () => {
    const root = temporaryRoot();
    write(root, { alpha: { enabled: true } }, 1_000);
    readRuntimeConfig(root);

    write(root, { alpha: { enabled: false } }, 2_000);
    invalidateRuntimeConfig();
    const second = readRuntimeConfig(root);

    expect(second.config.modules?.alpha?.enabled).toBe(false);
  });
});
