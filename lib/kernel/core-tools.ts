import {
  defineTool,
  toolEmpty,
  toolError,
  toolOk,
  verifyWrite,
  type AnyToolDefinition,
  type ToolOutput,
} from "@backstage/module-kit";
import { z } from "zod";

import type { UnifiedTool } from "@/lib/ai-providers";
import { hasNewInformation } from "@/lib/memory-dedup";
import {
  addMemoryFact,
  findSimilarMemoryFacts,
  getMemory,
  touchMemoryFact,
} from "@/lib/storage";

import { createModuleContext } from "./context";
import { toParameters } from "./tool-bridge";

/**
 * Outils du noyau, déclarés avec le même contrat qu'un outil de module.
 *
 * Le noyau n'a plus de `switch` par capacité : un outil noyau porte son nom,
 * son schéma, son effet de bord et son exécution, et la politique de
 * confirmation se dérive de cette déclaration comme pour un module.
 *
 * Exception assumée (ADR 0001, décision J) : la mémoire reste une capacité du
 * noyau en v1. Un module ne peut pas l'occuper sans devenir un prérequis du
 * chat lui-même. Toute migration demanderait de rouvrir la décision avec
 * l'humain, pas de déplacer ce fichier.
 */
export const CORE_MODULE_ID = "kernel";

const addMemoryFactSchema = z.object({
  content: z
    .string()
    .describe("Le fait a memoriser, en francais, a la troisieme personne"),
  category: z
    .enum(["dev", "photo", "life", "preference"])
    // Un modele qui omet la categorie passait en `life` avant la declaration :
    // conserver ce repli evite d'echanger une memorisation contre une erreur Zod.
    .default("life")
    .describe(
      "dev = preferences/competences techniques, photo = materiel/style/workflow, " +
        "life = habitudes/contraintes/contexte, preference = preferences generales"
    ),
});

export const addMemoryFactTool = defineTool({
  name: "add_memory_fact",
  description:
    "Memorise un fait durable et stable sur l'utilisateur (preference, contrainte, materiel, competence, evenement important) pour les futures conversations. " +
    "A utiliser des que l'utilisateur te confie ce type d'information, MEME S'IL NE LE DEMANDE PAS. " +
    "Ne pas utiliser pour une demande ponctuelle, une salutation ou une tache deja couverte par un rappel ou un evenement agenda.",
  params: addMemoryFactSchema,
  sideEffect: "write",
  // Un fait piege serait reinjecte dans le prompt systeme des tours suivants
  // (empoisonnement durable de la memoire). Cf. #74.
  requiresConfirmation: true,
  run: async (args) => {
    const content = args.content.trim();
    if (!content) return toolError("Erreur : contenu vide.");

    // Dédoublonnage : un fait déjà connu est renforcé, pas recréé. Même
    // logique que rememberFact et que l'extraction automatique, sinon le
    // modèle finit par saturer la mémoire de doublons.
    //
    // Mais un fait qui ajoute une entité (nom propre, chiffre, URL, pseudo)
    // absente du fait existant n'est PAS un doublon : c'est un enrichissement,
    // et le perdre fait mentir la mémoire (cf. `hasNewInformation`).
    const existing = await findSimilarMemoryFacts(content, args.category);
    if (existing && !hasNewInformation(content, existing.content)) {
      await touchMemoryFact(existing.id);
      // Volontairement pas « Fait memorise » : rien de nouveau n'a été écrit.
      // Le statut `empty` qui en découle empêche le modèle d'annoncer que
      // c'est retenu.
      return toolEmpty(`Rien de nouveau : deja en memoire -> ${existing.content}`);
    }

    const fact = await addMemoryFact(content, args.category, { source: "tool" });
    const problem = await verifyWrite("le fait memorise", async () => {
      const after = await getMemory();
      return after.facts.some((f) => f.id === fact.id);
    });
    if (problem) return toolError(problem);
    return toolOk(`Fait memorise : ${content}`);
  },
});

export const coreTools: readonly AnyToolDefinition[] = [addMemoryFactTool];

const coreToolIndex = new Map(coreTools.map((tool) => [tool.name, tool]));

/** Outil déclaré par le noyau, par son nom non qualifié. */
export function resolveCoreTool(name: string): AnyToolDefinition | undefined {
  return coreToolIndex.get(name);
}

/** Outils noyau au format attendu par les providers. */
export function coreToolDescriptors(): UnifiedTool[] {
  return coreTools.map((tool) => ({
    name: tool.name,
    description: tool.description,
    parameters: toParameters(tool.params),
  }));
}

/**
 * Valide les arguments avec le schéma de la déclaration, puis exécute l'outil.
 * Le statut vient du `ToolOutput`, jamais d'une lecture du texte.
 */
export async function runCoreTool(
  tool: AnyToolDefinition,
  args: Record<string, unknown>
): Promise<ToolOutput> {
  const parsed = tool.params.safeParse(args);
  if (!parsed.success) {
    return toolError(`Erreur : ${parsed.error.issues[0]?.message ?? "arguments invalides"}`);
  }

  try {
    return await tool.run(parsed.data, createModuleContext(CORE_MODULE_ID));
  } catch (error) {
    return toolError(`Erreur : ${error instanceof Error ? error.message : String(error)}`);
  }
}
