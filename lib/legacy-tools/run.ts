import { verifyWrite } from "@backstage/module-kit";
import {
  getMemory,
  addMemoryFact,
  findSimilarMemoryFacts,
  touchMemoryFact,
} from "@/lib/storage";
import { hasNewInformation } from "@/lib/memory-dedup";

/**
 * Exécution des outils historiques du noyau, pas encore migrés en modules.
 *
 * Ce fichier est transitoire : chaque domaine migré retire son `case` (phase 6
 * de #84). `lib/chat-tools.ts` ne garde que le pont vers le registre.
 */
export async function executeLegacyTool(
  name: string,
  args: Record<string, unknown>
): Promise<string> {
  switch (name) {
    case "add_memory_fact": {
      const content = String(args.content ?? "").trim();
      const category = String(args.category ?? "life") as "dev" | "photo" | "life" | "preference";
      if (!content) return "Erreur : contenu vide.";
      // Dédoublonnage : un fait déjà connu est renforcé, pas recréé. Même
      // logique que rememberFact et que l'extraction automatique, sinon le
      // modèle finit par saturer la mémoire de doublons.
      //
      // Mais un fait qui ajoute une entité (nom propre, chiffre, URL, pseudo)
      // absente du fait existant n'est PAS un doublon : c'est un enrichissement,
      // et le perdre fait mentir la mémoire (cf. `hasNewInformation`).
      const existing = await findSimilarMemoryFacts(content, category);
      if (existing && !hasNewInformation(content, existing.content)) {
        await touchMemoryFact(existing.id);
        // Volontairement pas « Fait memorise » : rien de nouveau n'a été écrit.
        // Le statut `empty` qui en découle empêche le modèle d'annoncer que
        // c'est retenu.
        return `Rien de nouveau : deja en memoire -> ${existing.content}`;
      }
      const fact = await addMemoryFact(content, category, { source: "tool" });
      // Relecture : le fait est-il bien en mémoire ?
      const problem = await verifyWrite("le fait memorise", async () => {
        const after = await getMemory();
        return after.facts.some((f) => f.id === fact.id);
      });
      if (problem) return problem;
      return `Fait memorise : ${content}`;
    }
    default:
      return `Outil inconnu : ${name}`;
  }
}
