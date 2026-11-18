import type { UnifiedTool } from "@/lib/ai-providers";
import {
  classifyToolText,
  classifyExternalContentText,
  renderToolText,
  type ToolStatus,
} from "@/lib/tool-result";

import { executeLegacyTool } from "@/lib/legacy-tools/run";
import { legacyTools } from "@/lib/legacy-tools/schemas";
import { confirmationMessage } from "./kernel/pending-actions";
import { toolPolicy } from "./kernel/tool-policy";
import { moduleTools, resolveModuleTool, runModuleTool } from "./kernel/tool-bridge";

/**
 * Pont entre le chat et les outils : sélection et exécution uniquement.
 *
 * Le registre des actions en attente, les listes de politique, les libellés,
 * les schémas et l'exécution des outils historiques vivent hors de ce fichier.
 * Les ré-exports gardent l'API historique des appelants.
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
export {
  CONFIRMABLE_TOOLS,
  REQUIRE_CONFIRMATION,
  UNTRUSTED_TOOLS,
  WRITE_TOOLS,
  toolPolicy,
  type ToolPolicy,
} from "./kernel/tool-policy";
export type { PendingActionReason } from "@/lib/tool-result";

/**
 * Outils exposés au modèle : les outils historiques du noyau et ceux des
 * modules activés, sous leur nom qualifié (`reminders.add`). Un module
 * désactivé n'apparaît pas.
 */
export const tools: UnifiedTool[] = [...legacyTools, ...moduleTools()];

export interface ToolRunResult {
  status: ToolStatus;
  text: string;
  rendered: string;
}

// Outils dont le texte renvoyé contient du contenu externe tel quel (emails) :
// le statut vient de l'appel, pas des mots présents dans ce contenu.
const EXTERNAL_CONTENT_TOOLS = new Set<string>(["fetch_and_search_emails"]);

/**
 * Exécute un outil et renvoie son statut. Point d'entrée unique pour tout
 * appelant : le statut est déduit du résultat, jamais d'une supposition.
 */
export async function runTool(
  name: string,
  args: Record<string, unknown>,
  confirmed = false
): Promise<ToolRunResult> {
  // Outil d'un module : le statut est porté par la donnée, plus déduit du texte.
  const moduleTool = resolveModuleTool(name);
  if (moduleTool) {
    if (moduleTool.requiresConfirmation && !confirmed) {
      const text = confirmationMessage(name);
      return { status: "blocked", text, rendered: renderToolText("blocked", text) };
    }
    const result = await runModuleTool(moduleTool, args);
    return {
      status: result.status,
      text: result.text,
      rendered: renderToolText(result.status, result.text),
    };
  }

  let text: string;
  let status: ToolStatus;
  try {
    text = await executeTool(name, args, confirmed);
    status = EXTERNAL_CONTENT_TOOLS.has(name)
      ? classifyExternalContentText(text)
      : classifyToolText(text);
  } catch (err) {
    text = `Erreur: ${err instanceof Error ? err.message : String(err)}`;
    status = "error";
  }
  return { status, text, rendered: renderToolText(status, text) };
}

export async function executeTool(
  name: string,
  args: Record<string, unknown>,
  confirmed = false
): Promise<string> {
  // Défense en profondeur : même si un appelant oublie le contrôle en amont,
  // une action à effet externe n'est jamais exécutée sans confirmation.
  if (toolPolicy(name).requiresConfirmation && !confirmed) {
    return confirmationMessage(name);
  }
  const moduleTool = resolveModuleTool(name);
  if (moduleTool) {
    if (moduleTool.requiresConfirmation && !confirmed) return confirmationMessage(name);
    return (await runModuleTool(moduleTool, args)).text;
  }
  return executeLegacyTool(name, args);
}
