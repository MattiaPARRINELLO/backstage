import type { ComponentType } from "react";

import type { KernelRegistry } from "./registry-core";

/**
 * Slot `panel` des modules (ADR 0001, decision G).
 *
 * Le libelle vient du rail quand il existe (« À voir »), sinon du libelle du
 * module : pas de champ supplementaire au contrat. Le panneau est monte dans le
 * layout racine et transmis au chrome client par contexte.
 */
export interface ModulePanelItem {
  readonly id: string;
  readonly label: string;
  readonly component: ComponentType;
}

export function modulePanelItems(registry: KernelRegistry): ModulePanelItem[] {
  return registry.enabled.flatMap((definition) =>
    definition.ui?.panel
      ? [
          {
            id: definition.id,
            label: definition.ui.rail?.label ?? definition.label,
            component: definition.ui.panel,
          },
        ]
      : []
  );
}
