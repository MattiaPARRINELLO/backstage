import { describe, expect, it } from "vitest";
import type { ComponentType } from "react";

import { modulePanelItems } from "@/lib/kernel/module-panel";
import { createRegistry } from "@/lib/kernel/registry-core";
import type { ModuleDefinition } from "@backstage/module-kit";

const Page: ComponentType = () => null;
const Panel: ComponentType = () => null;

function moduleWith(id: string, options: { panel?: boolean; railLabel?: string } = {}): ModuleDefinition {
  return {
    id,
    apiVersion: 1,
    version: "1.0.0",
    label: `Module ${id}`,
    selectionDescription: "Description courte.",
    description: "Description longue.",
    ...(options.panel
      ? {
          ui: {
            page: Page,
            panel: Panel,
            ...(options.railLabel ? { rail: { label: options.railLabel, icon: Page } } : {}),
          },
        }
      : {}),
  };
}

describe("slot panel des modules", () => {
  it("expose le panneau d'un module actif, libelle du rail en priorite", () => {
    const registry = createRegistry([
      moduleWith("watch-later", { panel: true, railLabel: "À voir" }),
    ]);
    expect(modulePanelItems(registry)).toEqual([
      { id: "watch-later", label: "À voir", component: Panel },
    ]);
  });

  it("retombe sur le libelle du module sans rail", () => {
    const registry = createRegistry([moduleWith("watch-later", { panel: true })]);
    expect(modulePanelItems(registry)[0]?.label).toBe("Module watch-later");
  });

  it("n'expose rien pour un module desactive", () => {
    const registry = createRegistry([moduleWith("watch-later", { panel: true })], {
      enabled: [],
    });
    expect(modulePanelItems(registry)).toEqual([]);
  });

  it("n'expose rien pour un module sans panneau", () => {
    const registry = createRegistry([moduleWith("watch-later")]);
    expect(modulePanelItems(registry)).toEqual([]);
  });
});
