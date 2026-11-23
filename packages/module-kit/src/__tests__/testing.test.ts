import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";
import { z } from "zod";

import { defineModule, defineTool, toolOk, assertModuleManifest } from "@backstage/module-kit";
import { jsonStore } from "@backstage/module-kit/json-store";
import {
  assertToolEmpty,
  assertToolError,
  assertToolOk,
  assertToolStatus,
  createTestContext,
  expectValidModule,
  runTool,
  withTempDataDir,
} from "@backstage/module-kit/testing";

const echoTool = defineTool({
  name: "echo",
  description: "Rend le texte recu.",
  params: z.object({ text: z.string().min(1) }),
  sideEffect: "none",
  run: async (args) => toolOk(`echo: ${args.text}`),
});

const throwingTool = defineTool({
  name: "throwing",
  description: "Leve une erreur, pour verifier le pont.",
  params: z.object({ text: z.string() }),
  sideEffect: "none",
  run: async () => {
    throw new Error("panne volontaire");
  },
});

function minimalModule(overrides: Record<string, unknown> = {}) {
  return {
    id: "demo",
    apiVersion: 1,
    version: "1.0.0",
    label: "Demo",
    selectionDescription: "Montre le contrat.",
    description: "Module minimal de test.",
    ...overrides,
  };
}

describe("createTestContext", () => {
  it("capture les logs, les evenements et le fil d'activite", () => {
    const ctx = createTestContext({ moduleId: "demo", userId: "u1" });

    ctx.log("warn", "attention", new Error("boum"));
    ctx.emit("demo.created", { id: "1" });
    ctx.activity?.("demo_created", "Demo cree", "id 1");

    expect(ctx.moduleId).toBe("demo");
    expect(ctx.userId).toBe("u1");
    expect(ctx.logs).toEqual([
      { level: "warn", message: "attention", error: expect.any(Error) },
    ]);
    expect(ctx.events).toEqual([{ event: "demo.created", payload: { id: "1" } }]);
    expect(ctx.activityEntries).toEqual([
      { type: "demo_created", message: "Demo cree", detail: "id 1" },
    ]);
  });

  it("omet les capacites optionnelles non fournies", () => {
    const ctx = createTestContext();
    expect(ctx.ai).toBeUndefined();
    expect(ctx.net).toBeUndefined();
    expect(ctx.userId).toBeUndefined();
  });
});

describe("runTool", () => {
  it("execute l'outil avec des arguments valides", async () => {
    const ctx = createTestContext({ moduleId: "demo" });
    const result = await runTool(echoTool, { text: "bonjour" }, ctx);
    expect(result).toEqual({ status: "ok", text: "echo: bonjour" });
  });

  it("rend une erreur, sans lever, sur des arguments hors schema", async () => {
    const ctx = createTestContext({ moduleId: "demo" });
    const result = await runTool(echoTool, { text: "" }, ctx);
    assertToolError(result, /Erreur :/);
  });

  it("rend une erreur quand l'outil leve", async () => {
    const ctx = createTestContext({ moduleId: "demo" });
    const result = await runTool(throwingTool, { text: "x" }, ctx);
    assertToolError(result, /Erreur : panne volontaire/);
  });
});

describe("assertions de statut", () => {
  it("rend le resultat quand le statut correspond", () => {
    const result = toolOk("fini");
    expect(assertToolStatus(result, "ok")).toBe(result);
    expect(assertToolOk(result)).toBe(result);
    expect(assertToolError({ status: "error", text: "echec" }, /echec/)).toEqual({
      status: "error",
      text: "echec",
    });
    expect(assertToolEmpty({ status: "empty", text: "rien" }).status).toBe("empty");
  });

  it("leve un message lisible quand le statut differe", () => {
    expect(() => assertToolOk({ status: "error", text: "boum" })).toThrow(
      /Statut "error" au lieu de "ok" : boum/
    );
    expect(() =>
      assertToolError({ status: "error", text: "autre chose" }, /attendu/)
    ).toThrow(/Texte d'erreur inattendu/);
  });
});

describe("expectValidModule", () => {
  it("accepte un module conforme", () => {
    const definition = expectValidModule(defineModule(minimalModule()));
    expect(definition.id).toBe("demo");
  });

  it("refuse un manifeste invalide", () => {
    expect(() =>
      expectValidModule(defineModule(minimalModule({ id: "Demo" })))
    ).toThrow(/Identifiant de module invalide/);
  });

  it("applique les regles de manifeste du noyau a un objet brut", () => {
    expect(() => assertModuleManifest(minimalModule())).not.toThrow();
    expect(() =>
      assertModuleManifest(minimalModule({ label: "  " }))
    ).toThrow(/label est obligatoire/);
    expect(() =>
      assertModuleManifest(minimalModule({ selectionDescription: "" }))
    ).toThrow(/selectionDescription est obligatoire/);
    expect(() => assertModuleManifest({ id: "demo" })).toThrow(
      /apiVersion entiere positive/
    );
  });

  it("refuse une apiVersion superieure au noyau simule", () => {
    expect(() =>
      expectValidModule(defineModule(minimalModule({ apiVersion: 2 })), {
        kernelApi: 1,
      })
    ).toThrow(/API de module 2/);
  });

  it("rejoue les regles d'auteur de defineModule", () => {
    expect(() =>
      expectValidModule(
        defineModule(minimalModule({ version: "1.0" }))
      )
    ).toThrow(/semver/);
  });
});

describe("withTempDataDir", () => {
  const schema = z.object({ items: z.array(z.string()) });
  const store = jsonStore({
    moduleId: "demo",
    file: "demo.json",
    schema,
    fallback: { items: [] },
  });

  it("ecrit dans un dossier temporaire, puis le retire", async () => {
    let seenDir = "";
    await withTempDataDir(async (dir) => {
      seenDir = dir;
      await store.write({ items: ["a"] });
      const raw = JSON.parse(
        readFileSync(path.join(dir, "demo", "demo.json"), "utf8")
      );
      expect(raw).toEqual({ items: ["a"] });
      expect(await store.read()).toEqual({ items: ["a"] });
    });

    expect(seenDir).not.toBe("");
    expect(existsSync(seenDir)).toBe(false);
  });

  it("rend le repertoire precedent apres le bloc", async () => {
    let outerDir = "";
    await withTempDataDir(async (outer) => {
      outerDir = outer;
      await withTempDataDir(async (inner) => {
        await store.write({ items: ["interieur"] });
        expect(await store.read()).toEqual({ items: ["interieur"] });
        expect(inner).not.toBe(outer);
      });
      await store.write({ items: ["exterieur"] });
      expect(await store.read()).toEqual({ items: ["exterieur"] });
      expect(existsSync(path.join(outer, "demo", "demo.json"))).toBe(true);
    });
    expect(existsSync(outerDir)).toBe(false);
  });
});
