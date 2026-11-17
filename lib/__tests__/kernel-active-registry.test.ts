import { describe, expect, it } from "vitest";

/**
 * Le registre actif est construit depuis `modules/index.ts` et
 * `modules.config.json`. Ce test vérifie le câblage réel, pas la logique du
 * registre (couverte par `kernel-registry.test.ts`).
 */
const { registry } = await import("@/lib/kernel/registry");

describe("registre actif", () => {
  it("charge les modules listes dans la racine de composition", () => {
    expect(registry.modules.map((definition) => definition.id)).toEqual(["reminders"]);
  });

  it("n'expose que les modules actives dans modules.config.json", () => {
    expect(registry.enabled.map((definition) => definition.id)).toEqual(["reminders"]);
  });

  it("expose les outils du module sous leur nom qualifie", () => {
    expect(registry.tools.map((tool) => tool.name)).toEqual([
      "reminders.add",
      "reminders.list",
      "reminders.update",
    ]);
  });

  it("derive la confirmation du contrat, sans liste", () => {
    expect(registry.requireTool("reminders.add").confirmable).toBe(true);
    expect(registry.requireTool("reminders.add").requiresConfirmation).toBe(false);
    expect(registry.requireTool("reminders.list").confirmable).toBe(false);
  });
});
