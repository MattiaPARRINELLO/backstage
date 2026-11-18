import { describe, expect, it } from "vitest";
import type { ComponentType } from "react";

import { modulePath, moduleRailItems } from "@/lib/kernel/module-nav";
import { createRegistry } from "@/lib/kernel/registry-core";
import type { ModuleDefinition } from "@backstage/module-kit";

const Icon: ComponentType<{ className?: string }> = () => null;
const Page: ComponentType = () => null;

function moduleWith(id: string, rail = true): ModuleDefinition {
  return {
    id,
    apiVersion: 1,
    version: "1.0.0",
    label: `Module ${id}`,
    selectionDescription: "Description courte.",
    description: "Description longue.",
    ...(rail ? { ui: { page: Page, rail: { label: `Rail ${id}`, icon: Icon } } } : {}),
  };
}

describe("slot rail des modules", () => {
  it("expose une entree par module actif, avec la route unique", () => {
    const registry = createRegistry([moduleWith("watch-later")]);
    expect(moduleRailItems(registry)).toEqual([
      {
        id: "watch-later",
        label: "Rail watch-later",
        href: "/m/watch-later",
        icon: Icon,
      },
    ]);
    expect(modulePath("watch-later")).toBe("/m/watch-later");
  });

  it("n'expose rien pour un module desactive", () => {
    const registry = createRegistry([moduleWith("watch-later")], { enabled: [] });
    expect(moduleRailItems(registry)).toEqual([]);
  });

  it("n'expose rien pour un module sans slot rail", () => {
    const registry = createRegistry([moduleWith("watch-later", false)]);
    expect(moduleRailItems(registry)).toEqual([]);
  });
});
