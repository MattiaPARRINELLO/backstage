import type { ComponentType } from "react";

import type { KernelRegistry } from "./registry-core";

/**
 * Resolution du slot `page` d'un module (ADR 0001, decision G).
 *
 * Fonction pure pour que la route `/m/[module]` reste une coquille mince et que
 * le comportement « module absent ou desactive » soit testable sans Next.
 * Un module desactive n'occupe aucun slot.
 */
export function modulePage(
  registry: KernelRegistry,
  moduleId: string
): ComponentType | undefined {
  return registry.enabled.find((definition) => definition.id === moduleId)?.ui?.page;
}

/** Libelle du module, pour le titre de page ; `undefined` s'il n'est pas actif. */
export function modulePageTitle(
  registry: KernelRegistry,
  moduleId: string
): string | undefined {
  return registry.enabled.find((definition) => definition.id === moduleId)?.label;
}
