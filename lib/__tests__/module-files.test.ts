import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { serializeConfig } from "@/lib/kernel/module-files";

/**
 * `modules.config.json` est committe dans une forme compacte, une entree par
 * ligne. Le serialiseur doit la reproduire a l'octet pres, sinon un
 * `module:remove` laisse le fichier modifie et `git status` n'est plus propre.
 */
describe("serializeConfig", () => {
  it("reproduit modules.config.json a l'octet pres", () => {
    const file = path.join(process.cwd(), "modules.config.json");
    const committed = readFileSync(file, "utf8");
    const parsed = JSON.parse(committed) as Parameters<typeof serializeConfig>[0];

    expect(serializeConfig(parsed)).toBe(committed);
  });

  it("est idempotent sur une entree ajoutee puis retiree", () => {
    const withModule = serializeConfig({
      kernelApi: 1,
      modules: { alpha: { enabled: true }, beta: { enabled: false } },
    });

    expect(withModule).toContain('    "alpha": { "enabled": true },');
    expect(withModule).toContain('    "beta": { "enabled": false }');
    expect(serializeConfig(JSON.parse(withModule) as Parameters<typeof serializeConfig>[0])).toBe(
      withModule
    );
  });

  it("ecrit un objet modules vide sur une ligne", () => {
    expect(serializeConfig({ kernelApi: 1, modules: {} })).toBe(
      '{\n  "kernelApi": 1,\n  "modules": {}\n}\n'
    );
  });

  it("preserve les cles inconnues d'une entree de module", () => {
    const input = {
      kernelApi: 1,
      modules: { alpha: { enabled: true, pinnedVersion: "v1.2.3" } },
    } as Parameters<typeof serializeConfig>[0];
    const out = serializeConfig(input);
    expect(out).toContain('"pinnedVersion": "v1.2.3"');
    expect(serializeConfig(JSON.parse(out) as Parameters<typeof serializeConfig>[0])).toBe(out);
  });
});
