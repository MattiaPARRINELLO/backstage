import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import {
  addToComposition,
  removeFromComposition,
  assertModuleManifest,
  doctorModules,
  parseModuleSource,
} from "@/lib/kernel/module-install";

const roots: string[] = [];

function tempDir(prefix: string): string {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  roots.push(dir);
  return dir;
}

function git(cwd: string, ...args: string[]): string {
  return execFileSync("git", args, { cwd, encoding: "utf8" });
}

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe("source d'un module externe", () => {
  it("separe le depot de la ref au dernier diese", () => {
    expect(
      parseModuleSource("https://github.com/org/module.git#v1.0.0")
    ).toEqual({ repo: "https://github.com/org/module.git", ref: "v1.0.0" });
  });

  it("refuse une source sans ref", () => {
    expect(() => parseModuleSource("https://github.com/org/module.git")).toThrow(
      /Attendu : <url-git>#<ref>/
    );
  });
});

describe("validation du manifeste", () => {
  const base = {
    id: "demo",
    apiVersion: 1,
    label: "Demo",
    selectionDescription: "Une phrase.",
    description: "Description longue.",
  };

  it("accepte un manifeste compatible", () => {
    expect(() => assertModuleManifest(base, 1)).not.toThrow();
  });

  it("refuse une apiVersion superieure au noyau, avec un message actionnable", () => {
    expect(() => assertModuleManifest({ ...base, apiVersion: 2 }, 1)).toThrow(
      /exige l'API de module 2, ce noyau en est a la version 1/
    );
  });

  it("refuse un identifiant hors kebab-case", () => {
    expect(() => assertModuleManifest({ ...base, id: "Demo Module" }, 1)).toThrow(
      /Identifiant de module invalide/
    );
  });
});

describe("racine de composition", () => {
  it("ajoute l'import et l'entree, une seule fois", () => {
    const source = [
      'import type { ModuleDefinition } from "@backstage/module-kit";',
      'import reminders from "./reminders/module";',
      "",
      "export const modules: readonly ModuleDefinition[] = [reminders];",
      "",
    ].join("\n");

    const next = addToComposition(source, "watch-later");
    expect(next).toContain('import watchLater from "./watch-later/module";');
    expect(next).toContain("[reminders, watchLater];");
    expect(addToComposition(next, "watch-later")).toBe(next);
  });

  it("gere un tableau vide", () => {
    const next = addToComposition(
      "export const modules: readonly ModuleDefinition[] = [];",
      "demo"
    );
    expect(next).toContain("[demo];");
  });

  it("preserve le format multi-lignes a la suppression", () => {
    const source = [
      'import type { ModuleDefinition } from "@backstage/module-kit";',
      'import a from "./a/module";',
      'import demo from "./demo/module";',
      'import b from "./b/module";',
      "",
      "export const modules: readonly ModuleDefinition[] = [",
      "  a,",
      "  demo,",
      "  b,",
      "];",
      "",
    ].join("\n");

    const next = removeFromComposition(source, "demo");
    expect(next).toContain("  a,");
    expect(next).toContain("  b,");
    expect(next).not.toContain("demo");
    // Le format reste multi-lignes (pas d'aplatissage).
    expect(next).toContain("[\n  a,\n  b,\n];");
  });
});

describe("installation depuis un depot git local", () => {
  it("clone, fige le commit, active et ajoute a la composition", () => {
    const moduleRepo = tempDir("backstage-module-src-");
    writeFileSync(
      join(moduleRepo, "module.ts"),
      `export default {
  id: "demo",
  apiVersion: 1,
  version: "1.0.0",
  label: "Demo",
  selectionDescription: "Module de test.",
  description: "Module de test pour l'installation.",
  capabilities: { network: ["example.com"] },
};
`,
      "utf8"
    );
    git(moduleRepo, "init", "-q");
    git(moduleRepo, "config", "user.email", "test@example.com");
    git(moduleRepo, "config", "user.name", "Test");
    git(moduleRepo, "add", ".");
    git(moduleRepo, "commit", "-qm", "module");
    git(moduleRepo, "tag", "v1.0.0");

    const root = tempDir("backstage-install-root-");
    mkdirSync(join(root, "modules"), { recursive: true });
    writeFileSync(
      join(root, "modules/index.ts"),
      'import type { ModuleDefinition } from "@backstage/module-kit";\n\nexport const modules: readonly ModuleDefinition[] = [];\n',
      "utf8"
    );
    writeFileSync(
      join(root, "modules.config.json"),
      '{\n  "kernelApi": 1,\n  "modules": {}\n}\n',
      "utf8"
    );
    writeFileSync(join(root, "modules.lock.json"), '{\n  "modules": {}\n}\n', "utf8");

    git(root, "init", "-q");
    git(root, "config", "user.email", "test@example.com");
    git(root, "config", "user.name", "Test");
    git(root, "add", ".");
    git(root, "commit", "-qm", "base");

    const script = join(process.cwd(), "scripts/module-install.ts");
    const output = execFileSync("bun", [script, "add", `${moduleRepo}#v1.0.0`], {
      cwd: root,
      encoding: "utf8",
    });

    expect(output).toContain('Module "demo" installe.');
    expect(output).toContain("example.com");

    const commit = git(moduleRepo, "rev-parse", "v1.0.0^{commit}").trim();
    const lock = JSON.parse(readFileSync(join(root, "modules.lock.json"), "utf8"));
    expect(lock.modules.demo).toMatchObject({
      repo: moduleRepo,
      ref: "v1.0.0",
      commit,
    });
    expect(typeof lock.modules.demo.installedAt).toBe("string");

    const config = JSON.parse(readFileSync(join(root, "modules.config.json"), "utf8"));
    expect(config.modules.demo).toEqual({ enabled: true });

    const composition = readFileSync(join(root, "modules/index.ts"), "utf8");
    expect(composition).toContain('import demo from "./demo/module";');
    expect(composition).toContain("modules: readonly ModuleDefinition[] = [demo];");

    expect(existsSync(join(root, "modules/demo/module.ts"))).toBe(true);
    expect(existsSync(join(root, "modules/demo/.git"))).toBe(false);

    // Aucun artefact temporaire : seuls les fichiers de l'installation bougent.
    const status = git(root, "status", "--porcelain")
      .split("\n")
      .filter(Boolean);
    expect(status.some((line) => line.includes(".install-"))).toBe(false);
    for (const line of status) {
      expect(line).toMatch(
        /^(\?\? modules\/demo\/| M modules\.(config|lock)\.json| M modules\/index\.ts)$/
      );
    }

    const doctor = execFileSync("bun", [script, "doctor"], {
      cwd: root,
      encoding: "utf8",
    });
    expect(doctor).toContain("aucun probleme detecte");
  });
});

describe("doctor : dossiers .install-* et vivacite du pid (#268)", () => {
  it("signale une installation en cours quand le pid est vivant", async () => {
    const root = tempDir("backstage-doctor-alive-");
    mkdirSync(join(root, "modules/.install-install-999-1-abcd"), { recursive: true });

    const issues = await doctorModules(root, undefined, () => true);

    expect(issues).toHaveLength(1);
    expect(issues[0]?.id).toBe(".install-install-999-1-abcd");
    expect(issues[0]?.problem).toContain("installation en cours (pid 999)");
    expect(issues[0]?.problem).not.toContain("temporaire");
  });

  it("signale une interruption quand le pid n'existe plus", async () => {
    const root = tempDir("backstage-doctor-orphan-");
    mkdirSync(join(root, "modules/.install-install-999-1-abcd"), { recursive: true });

    const issues = await doctorModules(root, undefined, () => false);

    expect(issues).toHaveLength(1);
    expect(issues[0]?.problem).toContain("temporaire");
    expect(issues[0]?.problem).not.toContain("installation en cours");
  });
});
