import { mkdirSync, mkdtempSync, rmSync, writeFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { hasStandaloneServer, prepareStandaloneAssets } from "@/scripts/standalone-assets";

const created: string[] = [];

function fakeBuild(): string {
  const root = mkdtempSync(path.join(tmpdir(), "backstage-standalone-"));
  created.push(root);
  mkdirSync(path.join(root, ".next", "standalone"), { recursive: true });
  mkdirSync(path.join(root, ".next", "static", "chunks"), { recursive: true });
  writeFileSync(path.join(root, ".next", "standalone", "server.js"), "// serveur");
  writeFileSync(path.join(root, ".next", "static", "chunks", "app.js"), "// app");
  mkdirSync(path.join(root, "public", "icons"), { recursive: true });
  writeFileSync(path.join(root, "public", "icons", "icon.png"), "png");
  return root;
}

afterEach(() => {
  for (const root of created.splice(0)) {
    rmSync(root, { recursive: true, force: true });
  }
});

describe("hasStandaloneServer", () => {
  it("detecte le build standalone", () => {
    const root = fakeBuild();
    expect(hasStandaloneServer(root)).toBe(true);
    expect(hasStandaloneServer(path.join(root, "vide"))).toBe(false);
  });
});

describe("prepareStandaloneAssets", () => {
  it("copie les assets statiques et public dans le standalone", () => {
    const root = fakeBuild();
    const result = prepareStandaloneAssets(root);

    expect(result.copied).toEqual([".next/static", "public"]);
    expect(result.skipped).toEqual(["assets"]);
    expect(
      existsSync(path.join(root, ".next", "standalone", ".next", "static", "chunks", "app.js"))
    ).toBe(true);
    expect(
      existsSync(path.join(root, ".next", "standalone", "public", "icons", "icon.png"))
    ).toBe(true);
  });

  it("ne fait rien quand le build est deja complet", () => {
    const root = fakeBuild();
    prepareStandaloneAssets(root);
    const second = prepareStandaloneAssets(root);
    expect(second.copied).toEqual([".next/static", "public"]);
  });
});
