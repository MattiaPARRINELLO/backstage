import { describe, expect, it } from "vitest";

import config from "@/modules.config.json";
import { modules as composition } from "@/modules/index";

/**
 * Le registre actif est construit depuis `modules/index.ts` et
 * `modules.config.json`. Ce test vérifie le câblage réel, pas la logique du
 * registre (couverte par `kernel-registry.test.ts`).
 *
 * Les attendus sont dérivés de la composition et de la configuration, jamais
 * d'une liste figée : installer un module ne doit pas faire échouer la suite du
 * noyau (vérifié par #210).
 */
const { registry } = await import("@/lib/kernel/registry");

const moduleConfig: Record<string, { enabled?: boolean }> = config.modules;
const enabledDefinitions = composition.filter(
  (definition) => moduleConfig[definition.id]?.enabled === true
);

const expectedModules = composition.map((definition) => definition.id).sort();
const expectedEnabled = enabledDefinitions.map((definition) => definition.id).sort();
const expectedTools = enabledDefinitions
  .flatMap((definition) =>
    (definition.tools ?? []).map((tool) => `${definition.id}.${tool.name}`)
  )
  .sort((a, b) => a.localeCompare(b));
const expectedJobs = enabledDefinitions
  .flatMap((definition) =>
    (definition.jobs ?? []).map((job) => ({ id: job.id, key: `${definition.id}.${job.id}` }))
  )
  .sort((a, b) => a.id.localeCompare(b.id))
  .map((entry) => entry.key);

describe("registre actif", () => {
  it("charge les modules listes dans la racine de composition", () => {
    expect(registry.modules.map((definition) => definition.id)).toEqual(expectedModules);
  });

  it("n'expose que les modules actives dans modules.config.json", () => {
    expect(registry.enabled.map((definition) => definition.id)).toEqual(expectedEnabled);
  });

  it("expose les outils du module sous leur nom qualifie", () => {
    expect(registry.tools.map((tool) => tool.name)).toEqual(expectedTools);
  });

  it("derive la confirmation du contrat, sans liste", () => {
    expect(registry.requireTool("reminders.add").confirmable).toBe(true);
    expect(registry.requireTool("reminders.add").requiresConfirmation).toBe(false);
    expect(registry.requireTool("reminders.list").confirmable).toBe(false);
  });

  it("expose les jobs declares par les modules actives", () => {
    expect(registry.jobs.map((entry) => `${entry.moduleId}.${entry.job.id}`)).toEqual(expectedJobs);
  });
});
