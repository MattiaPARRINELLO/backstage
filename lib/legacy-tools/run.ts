import { verifyWrite } from "@backstage/module-kit";
import {
  getAccreditations,
  addAccreditation,
  getMemory,
  addMemoryFact,
  findSimilarMemoryFacts,
  touchMemoryFact,
} from "@/lib/storage";
import { hasNewInformation } from "@/lib/memory-dedup";
import type { Accreditation } from "@/lib/types";
import { fetchGmailMessages } from "@/lib/google-actions";

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
    case "scan_accreditations": {
      try {
        const messages = await fetchGmailMessages("accréditation OR photo pass OR press OR accredit", 20);
        if (messages.length === 0) return "Aucun email d'accreditation trouve.";

        let created = 0;
        let updated = 0;
        const existing = await getAccreditations();
        const existingKeys = new Set(
          existing.accreditations.map((a: Accreditation) => `${a.artist}|${a.venue}`.toLowerCase())
        );

        for (const msg of messages) {
          const subj = msg.subject ?? "";
          const from = msg.from ?? "";
          const body = msg.snippet ?? "";
          const text = `${subj} ${body}`.toLowerCase();

          const artistMatch = text.match(/(?:pour|concert de|show de|photo de)\s+([a-zàâçéèêëîïôûùüÿñæœ-]+(?:\s+[a-zàâçéèêëîïôûùüÿñæœ-]+){0,2})/i);
          const venueMatch = text.match(/(?:au|à|chez)\s+([a-zàâçéèêëîïôûùüÿñæœ-]+(?:\s+[a-zàâçéèêëîïôûùüÿñæœ-]+){0,2})/i);
          const dateMatch = text.match(/(\d{1,2})[\/\s](janvier|février|mars|avril|mai|juin|juillet|août|septembre|octobre|novembre|décembre|\d{1,2})[\/\s](\d{4}|\d{2})/i);

          const artist = artistMatch ? artistMatch[1].trim() : "";
          const venue = venueMatch ? venueMatch[1].trim() : "";
          const concertDate = dateMatch ? dateMatch[0].trim() : "";

          if (!artist) continue;

          let status: Accreditation["status"] = "pending";
          if (text.includes("accepté") || text.includes("confirme") || text.includes("approved")) {
            status = "accepted";
          } else if (text.includes("refusé") || text.includes("decliné") || text.includes("denied")) {
            status = "refused";
          } else if (text.includes("envoyé") || text.includes("sent") || text.includes("demande")) {
            status = "sent";
          }

          const key = `${artist}|${venue || "inconnu"}`.toLowerCase();
          if (existingKeys.has(key)) {
            const idx = existing.accreditations.findIndex(
              (a: Accreditation) => `${a.artist}|${a.venue}`.toLowerCase() === key
            );
            if (idx >= 0 && existing.accreditations[idx].status !== status) {
              existing.accreditations[idx].status = status;
              existing.accreditations[idx].updatedAt = new Date().toISOString();
              existing.accreditations[idx].emailThreadId = msg.id;
              updated++;
            }
          } else {
            const newAcc = await addAccreditation({
              artist,
              venue: venue || "Inconnu",
              concertDate: concertDate || "Date inconnue",
              contactEmail: from,
            });
            if (status !== "pending") {
              const { updateAccreditation } = await import("@/lib/storage");
              await updateAccreditation(newAcc.id, { status, notes: `Email: ${msg.id}` });
            }
            created++;
            existingKeys.add(key);
          }
        }

        return `Scan termine : ${created} nouvelle(s) accreditation(s) creee(s), ${updated} mise(s) a jour.`;
      } catch (err) {
        return `Erreur lors du scan des accreditations : ${err instanceof Error ? err.message : String(err)}`;
      }
    }
    default:
      return `Outil inconnu : ${name}`;
  }
}
