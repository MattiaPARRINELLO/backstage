import {
  isConfirmable,
  isUntrusted,
  requiresConfirmation,
} from "@backstage/module-kit";

import { resolveCoreTool } from "./core-tools";
import { resolveModuleTool } from "./tool-bridge";

/**
 * Politique d'un outil, dérivée de sa déclaration.
 *
 * Un module déclare son effet de bord et sa fiabilité dans son manifeste ; un
 * outil du noyau les déclare dans `core-tools.ts`. Aucune liste de noms par
 * capacité ne vit ici : ajouter un outil n'édite pas ce fichier.
 */

export interface ToolPolicy {
  readonly requiresConfirmation: boolean;
  readonly confirmable: boolean;
  /** Une écriture, donc sensible à la provenance du tour. */
  readonly write: boolean;
  readonly untrusted: boolean;
}

const UNKNOWN_TOOL: ToolPolicy = {
  requiresConfirmation: false,
  confirmable: false,
  write: false,
  untrusted: false,
};

export function toolPolicy(name: string): ToolPolicy {
  const moduleTool = resolveModuleTool(name);
  if (moduleTool) {
    return {
      requiresConfirmation: moduleTool.requiresConfirmation,
      confirmable: moduleTool.confirmable,
      write: moduleTool.definition.sideEffect === "write",
      untrusted: moduleTool.untrusted,
    };
  }

  const coreTool = resolveCoreTool(name);
  if (coreTool) {
    return {
      requiresConfirmation: requiresConfirmation(coreTool),
      confirmable: isConfirmable(coreTool),
      write: coreTool.sideEffect === "write",
      untrusted: isUntrusted(coreTool),
    };
  }

  return UNKNOWN_TOOL;
}
