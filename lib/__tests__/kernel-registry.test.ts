import { describe, expect, it, vi } from "vitest";
import { z } from "zod";

import { createRegistry, RegistryError } from "@/lib/kernel/registry-core";
import {
  defineAction,
  defineModule,
  defineTool,
  type ModuleDefinition,
} from "@backstage/module-kit";

function action(name: string) {
  return defineAction({
    name,
    input: z.object({}),
    run: async () => "ok",
  });
}

function tool(name: string, sideEffect: "read" | "write" | "external", trust?: "untrusted") {
  return defineTool({
    name,
    description: `Outil ${name}.`,
    params: z.object({}),
    sideEffect,
    ...(trust ? { trust } : {}),
    run: async () => ({ status: "ok" as const, text: "ok" }),
  });
}

function module(id: string, overrides: Partial<ModuleDefinition> = {}): ModuleDefinition {
  return defineModule({
    id,
    apiVersion: 1,
    version: "1.0.0",
    label: id,
    selectionDescription: `Gerer ${id}.`,
    description: `Module ${id}.`,
    ...overrides,
  });
}

describe("createRegistry", () => {
  it("trie les modules par identifiant, quel que soit l'ordre d'entree", () => {
    const registry = createRegistry([module("zeta"), module("alpha")]);
    expect(registry.modules.map((m) => m.id)).toEqual(["alpha", "zeta"]);
  });

  it("qualifie les outils du nom de leur module", () => {
    const registry = createRegistry([
      module("reminders", { tools: [tool("add", "write"), tool("list", "read")] }),
      module("calendar", { tools: [tool("create", "external")] }),
    ]);
    expect(registry.tools.map((t) => t.name)).toEqual([
      "calendar.create",
      "reminders.add",
      "reminders.list",
    ]);
  });

  it("derive la politique de chaque outil sans liste a maintenir", () => {
    const registry = createRegistry([
      module("reminders", {
        tools: [tool("add", "write"), tool("search", "read", "untrusted"), tool("send", "external")],
      }),
    ]);

    const add = registry.requireTool("reminders.add");
    expect(add.requiresConfirmation).toBe(false);
    expect(add.confirmable).toBe(true);
    expect(add.untrusted).toBe(false);

    expect(registry.requireTool("reminders.search").untrusted).toBe(true);
    expect(registry.requireTool("reminders.send").requiresConfirmation).toBe(true);
  });

  it("accepte un outil dont le module decrete la confirmation", () => {
    const registry = createRegistry([
      module("reminders", {
        tools: [
          defineTool({
            name: "memory",
            description: "Ecrire un fait.",
            params: z.object({}),
            sideEffect: "write",
            requiresConfirmation: true,
            run: async () => ({ status: "ok" as const, text: "ok" }),
          }),
        ],
      }),
    ]);
    expect(registry.requireTool("reminders.memory").requiresConfirmation).toBe(true);
  });

  it("indexe les blocs de prompt par priorite decroissante", () => {
    const registry = createRegistry([
      module("b", { prompt: [{ id: "x", priority: 10, render: () => "b" }] }),
      module("a", { prompt: [{ id: "y", priority: 90, render: () => "a" }] }),
    ]);
    expect(registry.prompts.map((p) => p.moduleId)).toEqual(["a", "b"]);
  });

  it("n'expose que les modules actives", () => {
    const registry = createRegistry(
      [module("reminders", { tools: [tool("add", "write")] }), module("schedule")],
      { enabled: ["reminders"] }
    );
    expect(registry.modules).toHaveLength(2);
    expect(registry.enabled.map((m) => m.id)).toEqual(["reminders"]);
    expect(registry.tools.map((t) => t.name)).toEqual(["reminders.add"]);
    expect(registry.module("schedule")).toBeDefined();
    expect(registry.tool("schedule.x")).toBeUndefined();
  });

  it("refuse deux modules du meme identifiant", () => {
    expect(() => createRegistry([module("a"), module("a")])).toThrow(RegistryError);
  });

  it("refuse une apiVersion superieure a celle du noyau", () => {
    expect(() =>
      createRegistry([module("futur", { apiVersion: 2 })], { kernelApi: 1 })
    ).toThrow(/Mets a jour le noyau/);
  });

  it("refuse une dependance absente", () => {
    expect(() =>
      createRegistry([module("a", { dependencies: ["b"] })])
    ).toThrow(/n'est pas installe/);
  });

  it("refuse une dependance desactivee", () => {
    expect(() =>
      createRegistry([module("a", { dependencies: ["b"] }), module("b")], {
        enabled: ["a"],
      })
    ).toThrow(/dependance "b" ne l'est pas/);
  });

  it("refuse un cycle de dependances", () => {
    expect(() =>
      createRegistry([
        module("a", { dependencies: ["b"] }),
        module("b", { dependencies: ["a"] }),
      ])
    ).toThrow(/circulaires/);
  });

  it("ignore un module active mais introuvable, en le signalant", () => {
    const log = vi.fn();
    const registry = createRegistry([module("a")], { enabled: ["a", "fantome"], log });
    expect(registry.enabled.map((m) => m.id)).toEqual(["a"]);
    expect(log).toHaveBeenCalledWith(
      "warn",
      expect.stringContaining("fantome")
    );
  });

  it("requireTool leve en listant les outils disponibles", () => {
    const registry = createRegistry([module("a", { tools: [tool("add", "write")] })]);
    expect(() => registry.requireTool("a.unknown")).toThrow(/a\.add/);
  });

  it("indexe les actions par nom qualifie", () => {
    const registry = createRegistry([
      module("reminders", { actions: { create: action("create"), load: action("load") } }),
    ]);
    expect(registry.actions.map((entry) => entry.name)).toEqual([
      "reminders.create",
      "reminders.load",
    ]);
    expect(registry.requireAction("reminders.create").moduleId).toBe("reminders");
  });

  it("refuse des actions de meme nom complet", () => {
    expect(() =>
      createRegistry([
        module("reminders", {
          actions: { a: action("create"), b: action("create") },
        }),
      ])
    ).toThrow(/meme nom complet/);
  });

  it("n'expose pas les actions d'un module desactive", () => {
    const registry = createRegistry(
      [module("reminders", { actions: { load: action("load") } }), module("schedule")],
      { enabled: ["schedule"] }
    );
    expect(registry.actions).toEqual([]);
    expect(() => registry.requireAction("reminders.load")).toThrow(/inconnue/);
  });

  it("expose les jobs et les entrees de navigation des modules actives", () => {
    const icon = () => null;
    const registry = createRegistry([
      module("reminders", {
        jobs: [{ id: "sync", cron: "*/15 * * * *", handler: async () => {} }],
        ui: { page: () => null, rail: { label: "Rappels", icon } },
      }),
    ]);
    expect(registry.jobs[0]?.job.id).toBe("sync");
    expect(registry.jobs[0]?.moduleId).toBe("reminders");
    expect(registry.requireJob("sync").moduleId).toBe("reminders");
    expect(registry.railItems).toEqual([
      { moduleId: "reminders", label: "Rappels", icon },
    ]);
  });

  it("refuse deux modules actives qui declarent le meme job", () => {
    expect(() =>
      createRegistry([
        module("reminders", {
          jobs: [{ id: "sync", cron: "* * * * *", handler: async () => {} }],
        }),
        module("calendar", {
          jobs: [{ id: "sync", cron: "0 * * * *", handler: async () => {} }],
        }),
      ])
    ).toThrow(/job "sync".*"calendar".*"reminders"/);
  });

  it("n'expose pas les jobs d'un module desactive", () => {
    const registry = createRegistry(
      [
        module("reminders", {
          jobs: [{ id: "sync", cron: "* * * * *", handler: async () => {} }],
        }),
        module("calendar"),
      ],
      { enabled: ["calendar"] }
    );
    expect(registry.jobs).toEqual([]);
    expect(registry.job("sync")).toBeUndefined();
  });

  it("requireJob leve en listant les jobs disponibles", () => {
    const registry = createRegistry([
      module("reminders", {
        jobs: [{ id: "sync", cron: "* * * * *", handler: async () => {} }],
      }),
    ]);
    expect(() => registry.requireJob("inconnu")).toThrow(/sync/);
  });
});
