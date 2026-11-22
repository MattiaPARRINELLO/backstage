import type { UnifiedTool } from "@/lib/ai-providers";
import { renderToolText, type ToolStatus } from "@/lib/tool-result";

import { confirmationMessage } from "./kernel/pending-actions";
import { coreToolDescriptors, resolveCoreTool, runCoreTool } from "./kernel/core-tools";
import { toolPolicy } from "./kernel/tool-policy";
import { moduleTools, resolveModuleTool, runModuleTool } from "./kernel/tool-bridge";

/**
 * Pont entre le chat et les outils : sélection et exécution uniquement.
 *
 * Les outils du noyau sont déclarés dans `kernel/core-tools.ts`, ceux des
 * modules dans leur manifeste. Aucun `switch` par capacité ne vit ici.
 */
export {
  ACTION_BLOCKED_PREFIX,
  clearPendingActions,
  confirmationMessage,
  consumePendingAction,
  hasPendingAction,
  pendingActionKey,
  registerPendingAction,
} from "./kernel/pending-actions";
export { toolPolicy, type ToolPolicy } from "./kernel/tool-policy";
export type { PendingActionReason } from "@/lib/tool-result";

/**
 * Outils exposés au modèle : ceux du noyau et ceux des modules activés, sous
 * leur nom qualifié (`reminders.add`). Un module désactivé n'apparaît pas.
 */
export const tools: UnifiedTool[] = [...coreToolDescriptors(), ...moduleTools()];

export interface ToolRunResult {
  status: ToolStatus;
  text: string;
  rendered: string;
}

/**
 * Exécute un outil et renvoie son statut. Point d'entrée unique pour tout
 * appelant : le statut vient du `ToolOutput` de la déclaration, jamais d'une
 * supposition sur la formulation du texte.
 */
export async function runTool(
  name: string,
  args: Record<string, unknown>,
  confirmed = false
): Promise<ToolRunResult> {
  const moduleTool = resolveModuleTool(name);
  if (moduleTool) {
    if (moduleTool.requiresConfirmation && !confirmed) {
      return blocked(name);
    }
    const result = await runModuleTool(moduleTool, args);
    return {
      status: result.status,
      text: result.text,
      rendered: renderToolText(result.status, result.text),
    };
  }

  const coreTool = resolveCoreTool(name);
  if (coreTool) {
    // Défense en profondeur : même si un appelant oublie le contrôle en amont,
    // une action qui exige une confirmation n'est jamais exécutée seule.
    if (toolPolicy(name).requiresConfirmation && !confirmed) {
      return blocked(name);
    }
    const result = await runCoreTool(coreTool, args);
    return {
      status: result.status,
      text: result.text,
      rendered: renderToolText(result.status, result.text),
    };
  }

  const text = `Outil inconnu : ${name}`;
  return { status: "error", text, rendered: renderToolText("error", text) };
}

function blocked(name: string): ToolRunResult {
  const text = confirmationMessage(name);
  return { status: "blocked", text, rendered: renderToolText("blocked", text) };
}

/** Nom du résultat, pour les appelants historiques qui n'ont besoin que du texte. */
export async function executeTool(
  name: string,
  args: Record<string, unknown>,
  confirmed = false
): Promise<string> {
  return (await runTool(name, args, confirmed)).text;
}
