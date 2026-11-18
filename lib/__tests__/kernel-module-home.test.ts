import { describe, expect, it } from "vitest";
import type { ComponentType } from "react";

import { moduleHomeCardItems } from "@/lib/kernel/module-home";
import { createRegistry } from "@/lib/kernel/registry-core";
import type { ModuleDefinition } from "@backstage/module-kit";

const Page: ComponentType = () => null;
const HomeCard: ComponentType = () => null;

function moduleWith(id: string, homeCard = true): ModuleDefinition {
  return {
    id,
    apiVersion: 1,
    version: "1.0.0",
    label: `Module ${id}`,
    selectionDescription: "Description courte.",
    description: "Description longue.",
    ...(homeCard ? { ui: { page: Page, homeCard: HomeCard } } : {}),
  };
}

describe("slot homeCard des modules", () => {
  it("expose la carte d'un module actif", () => {
    const registry = createRegistry([moduleWith("watch-later")]);
    expect(moduleHomeCardItems(registry)).toEqual([
      { id: "watch-later", component: HomeCard },
    ]);
  });

  it("n'expose rien pour un module desactive", () => {
    const registry = createRegistry([moduleWith("watch-later")], { enabled: [] });
    expect(moduleHomeCardItems(registry)).toEqual([]);
  });

  it("n'expose rien pour un module sans carte", () => {
    const registry = createRegistry([moduleWith("watch-later", false)]);
    expect(moduleHomeCardItems(registry)).toEqual([]);
  });
});
