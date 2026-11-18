import type { UnifiedTool } from "@/lib/ai-providers";

/**
 * Schémas des outils historiques du noyau, pas encore migrés en modules.
 *
 * Ce fichier est transitoire : chaque domaine migré retire ses schémas d'ici
 * (phase 6 de #84). Il ne contient aucune logique, seulement la description
 * exposée au modèle.
 */
export const legacyTools: UnifiedTool[] = [
  {
    name: "add_memory_fact",
    description:
      "Memorise un fait durable et stable sur l'utilisateur (preference, contrainte, materiel, competence, evenement important) pour les futures conversations. " +
      "A utiliser des que l'utilisateur te confie ce type d'information, MEME S'IL NE LE DEMANDE PAS. " +
      "Ne pas utiliser pour une demande ponctuelle, une salutation ou une tache deja couverte par un rappel ou un evenement agenda.",
    parameters: {
      type: "object",
      properties: {
        content: { type: "string", description: "Le fait a memoriser, en francais, a la troisieme personne" },
        category: {
          type: "string",
          enum: ["dev", "photo", "life", "preference"],
          description:
            "dev = preferences/competences techniques, photo = materiel/style/workflow, " +
            "life = habitudes/contraintes/contexte, preference = preferences generales",
        },
      },
      required: ["content", "category"],
    },
  },
];
