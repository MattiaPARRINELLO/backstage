import type { ComponentType } from "react";

import type { KernelRegistry } from "./registry-core";

/**
 * Slot `homeCard` des modules (ADR 0001, decision G).
 *
 * La carte est montee dans le layout racine et transmise au hero client par
 * contexte. Aucun libelle au contrat : la carte porte son propre contenu.
 */
export interface ModuleHomeCardItem {
  readonly id: string;
  readonly component: ComponentType;
}

export function moduleHomeCardItems(registry: KernelRegistry): ModuleHomeCardItem[] {
  return registry.enabled.flatMap((definition) =>
    definition.ui?.homeCard
      ? [{ id: definition.id, component: definition.ui.homeCard }]
      : []
  );
}
