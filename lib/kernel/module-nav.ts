import type { ComponentType } from "react";

import type { KernelRegistry } from "./registry-core";

/**
 * Slot `rail` des modules (ADR 0001, decision G).
 *
 * Le registre ne contient deja que les modules actifs : un module desactive
 * n'ajoute donc aucune entree de navigation. La fonction reste pure pour se
 * tester sans Next ni navigateur.
 */
export interface ModuleRailItem {
  readonly id: string;
  readonly label: string;
  readonly href: string;
  readonly icon: ComponentType<{ className?: string }>;
}

/** Route unique d'une page de module. */
export function modulePath(moduleId: string): string {
  return `/m/${moduleId}`;
}

export function moduleRailItems(registry: KernelRegistry): ModuleRailItem[] {
  return registry.railItems.map((item) => ({
    id: item.moduleId,
    label: item.label,
    href: modulePath(item.moduleId),
    icon: item.icon,
  }));
}
