import { resolveModuleTool } from "./tool-bridge";

/**
 * Libellé lisible d'une action en attente de confirmation (aucun argument
 * affiché intégralement, confidentialité).
 *
 * Le noyau ne connaît aucune capacité par son nom : un outil de module fournit
 * son propre libellé via `describeAction`, y compris pour les anciens noms
 * d'outils que `resolveModuleTool` normalise en alias. Un outil qui n'en déclare
 * pas retombe sur son nom, ce qui reste honnête sans cas particulier.
 */
export function describeToolAction(name: string, args: Record<string, unknown>): string {
  const moduleTool = resolveModuleTool(name);
  if (!moduleTool) return name;

  try {
    return moduleTool.definition.describeAction?.(args) ?? name;
  } catch {
    return name;
  }
}
