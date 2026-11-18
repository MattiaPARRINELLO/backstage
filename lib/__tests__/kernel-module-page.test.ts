import { describe, expect, it } from "vitest";
import type { ComponentType } from "react";

import { modulePage, modulePageTitle } from "@/lib/kernel/module-page";
import { createRegistry } from "@/lib/kernel/registry-core";
import type { ModuleDefinition } from "@backstage/module-kit";

const Page: ComponentType = () => null;

function moduleWith(id: string, withPage = true): ModuleDefinition {
  return {
    id,
    apiVersion: 1,
    version: "1.0.0",
    label: `Module ${id}`,
    selectionDescription: "Description courte.",
    description: "Description longue.",
    ...(withPage ? { ui: { page: Page } } : {}),
  };
}

describe("slot page des modules", () => {
  it("rend la page d'un module active", () => {
    const registry = createRegistry([moduleWith("watch-later")]);
    expect(modulePage(registry, "watch-later")).toBe(Page);
    expect(modulePageTitle(registry, "watch-later")).toBe("Module watch-later");
  });

  it("ne rend rien pour un module desactive", () => {
    const registry = createRegistry([moduleWith("watch-later")], { enabled: [] });
    expect(modulePage(registry, "watch-later")).toBeUndefined();
    expect(modulePageTitle(registry, "watch-later")).toBeUndefined();
  });

  it("ne rend rien pour un module inconnu", () => {
    const registry = createRegistry([moduleWith("watch-later")]);
    expect(modulePage(registry, "inconnu")).toBeUndefined();
  });

  it("ne rend rien pour un module sans slot page", () => {
    const registry = createRegistry([moduleWith("watch-later", false)]);
    expect(modulePage(registry, "watch-later")).toBeUndefined();
  });
});
