import { spawnSync } from "node:child_process";
import { cpSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

/**
 * Les règles de frontières de `.dependency-cruiser.cjs` doivent mordre
 * réellement (ADR 0001, décision D-19). Chaque cas monte une arborescence
 * minimale dans un dossier temporaire, y copie la **vraie** configuration,
 * puis lance `depcruise` dessus : supprimer ou affaiblir une règle casse ce
 * test, alors qu'aujourd'hui rien ne le remarque sur le dépôt réel.
 *
 * La configuration lue est celle du dépôt, jamais une copie figée dans le
 * test, sinon la preuve porterait sur une règle qui n'existe plus.
 */

const root = process.cwd();
const depcruise = path.join(root, "node_modules", ".bin", "depcruise");

const created: string[] = [];

afterEach(() => {
  for (const dir of created.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

/** Écrit une arborescence de fichiers dans un dossier temporaire. */
function fixture(files: Record<string, string>): string {
  const dir = mkdtempSync(path.join(tmpdir(), "boundaries-"));
  created.push(dir);

  cpSync(path.join(root, ".dependency-cruiser.cjs"), path.join(dir, ".dependency-cruiser.cjs"));
  // `tsConfig.fileName` de la configuration désigne un fichier relatif au
  // dossier cruisé : sans ce tsconfig, depcruise s'arrête sur TS5083.
  writeFileSync(
    path.join(dir, "tsconfig.json"),
    JSON.stringify({
      compilerOptions: { moduleResolution: "bundler", target: "ES2022", module: "ESNext" },
    })
  );

  for (const [name, content] of Object.entries(files)) {
    mkdirSync(path.dirname(path.join(dir, name)), { recursive: true });
    writeFileSync(path.join(dir, name), content);
  }

  return dir;
}

function cruise(dir: string, targets: string[]): { status: number | null; output: string } {
  const result = spawnSync(depcruise, targets, { cwd: dir, encoding: "utf8" });

  return { status: result.status, output: `${result.stdout}${result.stderr}` };
}

describe("modules-isoles", () => {
  it("refuse un import entre deux modules", () => {
    const dir = fixture({
      "modules/a/index.ts": 'import "../b/index";\nexport const a = 1;\n',
      "modules/b/index.ts": "export const b = 1;\n",
    });

    const { status, output } = cruise(dir, ["modules"]);

    expect(output).toContain("modules-isoles");
    expect(status).toBe(1);
  });

  it("accepte un module qui reste chez lui", () => {
    const dir = fixture({
      "modules/a/index.ts": 'import "./tool";\nexport const a = 1;\n',
      "modules/a/tool.ts": "export const tool = 1;\n",
      "modules/b/index.ts": "export const b = 1;\n",
    });

    const { output } = cruise(dir, ["modules"]);

    expect(output).not.toContain("modules-isoles");
  });
});

describe("app-limite-aux-manifestes", () => {
  it("refuse un fichier interne de module importé depuis app", () => {
    const dir = fixture({
      "app/page.ts": 'import "../modules/a/actions";\nexport const page = 1;\n',
      "modules/a/index.ts": "export const a = 1;\n",
      "modules/a/actions.ts": "export const action = 1;\n",
    });

    const { status, output } = cruise(dir, ["app", "modules"]);

    expect(output).toContain("app-limite-aux-manifestes");
    expect(status).toBe(1);
  });

  it("accepte le manifeste public d'un module depuis app", () => {
    const dir = fixture({
      "app/page.ts": 'import "../modules/a";\nexport const page = 1;\n',
      "modules/a/index.ts": "export const a = 1;\n",
      "modules/a/actions.ts": "export const action = 1;\n",
    });

    const { output } = cruise(dir, ["app", "modules"]);

    expect(output).not.toContain("app-limite-aux-manifestes");
  });
});

describe("kit-sans-noyau", () => {
  it("refuse un import du noyau depuis le kit", () => {
    const dir = fixture({
      "packages/module-kit/src/index.ts": 'import "../../../lib/config";\nexport const kit = 1;\n',
      "lib/config.ts": "export const config = 1;\n",
    });

    const { status, output } = cruise(dir, ["packages", "lib"]);

    expect(output).toContain("kit-sans-noyau");
    expect(status).toBe(1);
  });

  it("accepte un kit qui ne dépend que de lui-même", () => {
    const dir = fixture({
      "packages/module-kit/src/index.ts": 'import "./module";\nexport const kit = 1;\n',
      "packages/module-kit/src/module.ts": "export const module = 1;\n",
      "lib/config.ts": "export const config = 1;\n",
    });

    const { output } = cruise(dir, ["packages", "lib"]);

    expect(output).not.toContain("kit-sans-noyau");
  });
});
