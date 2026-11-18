import { RAIL_FALLBACK_ICON, railIconMarkup } from "@backstage/module-kit";
import type { ComponentType } from "react";

/**
 * Serialisation d'une icone de rail pour le chrome client.
 *
 * Une icone declarative (`railIcon()` du kit) porte son SVG ; un composant
 * ordinaire (client, donc non serialisable) retombe sur un glyphe neutre pour
 * que le module garde son entree de navigation.
 */
export function renderRailIcon(icon: ComponentType<{ className?: string }>): string {
  const markup = railIconMarkup(icon);
  if (markup) return markup;

  console.warn(
    "[module-rail] icone non declarative, glyphe neutre utilise. Utiliser railIcon() du kit."
  );
  return RAIL_FALLBACK_ICON;
}
