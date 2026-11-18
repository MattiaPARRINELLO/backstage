import type { ModuleContext } from "@backstage/module-kit";

import { createModuleContext } from "./context";
import type { KernelRegistry } from "./registry-core";

/**
 * Blocs de prompt fournis par les modules (ADR 0001, decision F).
 *
 * Le noyau ordonne par priorite decroissante, tronque chaque bloc et applique
 * un budget global. Une exception dans `render` retire le bloc et journalise,
 * sans jamais empecher la reponse : un module ne peut pas casser le prompt.
 */

export const PROMPT_TOTAL_BUDGET = 1500;
export const PROMPT_BLOCK_BUDGET = 400;

export function truncatePromptBlock(text: string, limit: number): string {
  const clean = text.trim();
  if (limit <= 0) return "";
  if (clean.length <= limit) return clean;
  if (limit === 1) return "…";
  return `${clean.slice(0, limit - 1).trimEnd()}…`;
}

export interface RenderPromptOptions {
  readonly totalBudget?: number;
  readonly blockBudget?: number;
  readonly contextFor?: (moduleId: string) => ModuleContext;
  readonly log?: (level: "warn", message: string, error?: unknown) => void;
}

/**
 * Rend les blocs des modules actifs, deja tries par `createRegistry`.
 *
 * Budget restant reparti sur le bloc courant : un bloc trop long est tronque
 * proprement, puis le budget epuise arrete les suivants.
 */
export async function renderModulePrompts(
  registry: KernelRegistry,
  options: RenderPromptOptions = {}
): Promise<string> {
  const totalBudget = options.totalBudget ?? PROMPT_TOTAL_BUDGET;
  const blockBudget = options.blockBudget ?? PROMPT_BLOCK_BUDGET;
  const contextFor = options.contextFor ?? ((moduleId: string) => createModuleContext(moduleId));
  const log = options.log ?? ((level, message, error) => console.warn(message, error));

  const parts: string[] = [];
  let used = 0;

  for (const { moduleId, contribution } of registry.prompts) {
    const remaining = totalBudget - used;
    if (remaining <= 0) break;

    try {
      const text = (await contribution.render(contextFor(moduleId))).trim();
      if (!text) continue;

      const block = truncatePromptBlock(text, Math.min(blockBudget, remaining));
      if (!block) continue;

      parts.push(block);
      used += block.length;
    } catch (error) {
      log("warn", `[prompt] bloc "${moduleId}.${contribution.id}" ignore`, error);
    }
  }

  return parts.join("\n\n");
}
