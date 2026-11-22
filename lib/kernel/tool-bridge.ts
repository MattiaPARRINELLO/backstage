import { z } from "zod";

import type { UnifiedTool } from "@/lib/ai-providers";
import { normalizeToolName } from "@/lib/chat-tool-aliases";

import { createModuleContext } from "./context";
import { registry } from "./registry";
import type { RegisteredTool } from "./registry-core";

/**
 * Pont entre le noyau de chat et les outils des modules.
 *
 * Le noyau ne connaît plus la liste des outils métier : il demande au registre
 * quels outils sont actifs, il convertit leur schéma Zod en JSON Schema pour le
 * modèle, et il exécute celui que le modèle a choisi. Ajouter un outil à un
 * module n'édite donc aucun fichier du noyau.
 */
export interface ModuleToolRun {
  readonly status: "ok" | "error" | "empty";
  readonly text: string;
}

/**
 * Outil de module correspondant à un nom, ancien ou qualifié.
 * `undefined` si le nom appartient encore au noyau ou n'existe pas.
 */
export function resolveModuleTool(name: string): RegisteredTool | undefined {
  return registry.tool(normalizeToolName(name));
}

/** Outils des modules activés, au format attendu par les providers. */
export function moduleTools(): UnifiedTool[] {
  return registry.tools.map((tool) => ({
    name: tool.name,
    description: tool.definition.description,
    parameters: toParameters(tool.definition.params),
  }));
}

/** Le nom est-il porté par un module ? (`add_reminder` répond oui, par alias.) */
export function isModuleTool(name: string): boolean {
  return resolveModuleTool(name) !== undefined;
}

/** Schéma Zod d'un outil converti en JSON Schema pour le modèle. */
export function toParameters(schema: z.ZodType): Record<string, unknown> {
  const json = z.toJSONSchema(schema) as Record<string, unknown>;
  // `$schema` n'est pas une contrainte d'arguments : certains providers le
  // rejettent ou l'exposent au modèle comme un champ attendu.
  delete json.$schema;
  return json;
}

/**
 * Valide les arguments avec le schéma du module, puis exécute l'outil.
 *
 * Le statut vient du `ToolOutput` du module, jamais d'une lecture du texte :
 * c'est ce qui empêche d'annoncer une action qui n'a pas eu lieu.
 */
export async function runModuleTool(
  tool: RegisteredTool,
  args: Record<string, unknown>
): Promise<ModuleToolRun> {
  const parsed = tool.definition.params.safeParse(args);
  if (!parsed.success) {
    return {
      status: "error",
      text: `Erreur : ${parsed.error.issues[0]?.message ?? "arguments invalides"}`,
    };
  }

  try {
    const output = await tool.definition.run(
      parsed.data,
      createModuleContext(tool.moduleId)
    );
    return { status: output.status, text: output.text };
  } catch (error) {
    return {
      status: "error",
      text: `Erreur : ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}
