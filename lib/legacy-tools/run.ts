import { verifyWrite } from "@backstage/module-kit";
import {
  getAccreditations,
  addAccreditation,
  getPhotoShoots,
  addPhotoShoot,
  updatePhotoShoot,
  getMemory,
  addMemoryFact,
  findSimilarMemoryFacts,
  touchMemoryFact,
} from "@/lib/storage";
import { hasNewInformation } from "@/lib/memory-dedup";
import type { PhotoShootStatus, Accreditation } from "@/lib/types";
import { invalidateServerCachePattern } from "@/lib/server-cache";
import {
  fetchGmailMessages,
  sendGmailReply,
} from "@/lib/google-actions";

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
    case "fetch_and_search_emails": {
      const query = args.query ? String(args.query) : undefined;
      const emails = await fetchGmailMessages(query, 10);
      if (emails.length === 0) return "Aucun email trouve.";
      return emails
        .map(
          (e) => {
            const contact = e.to ? `De: ${e.from}\nA: ${e.to}` : `De: ${e.from}`;
            return `ID: ${e.id}\n${contact}\nSujet: ${e.subject}\nDate: ${e.date}\nExtrait: ${e.snippet}`;
          }
        )
        .join("\n\n---\n\n");
    }
    case "send_email_response": {
      const emailId = String(args.email_id ?? "");
      const responseText = String(args.response_text ?? "");
      if (!emailId || !responseText) return "Erreur : email_id et response_text requis.";
      const sentId = await sendGmailReply(emailId, responseText);
      invalidateServerCachePattern(/^gmail:list/);
      return `Reponse envoyee (message id: ${sentId}).`;
    }
    case "triage_emails": {
      const maxResults = typeof args.max_results === "number" ? args.max_results : 10;
      const emails = await fetchGmailMessages(undefined, maxResults);
      if (emails.length === 0) return "Aucun email trouve.";
      const urgent = emails.filter((e) => e.unread && /urgent|rappel|relance|deadline|échéance/i.test(e.subject + " " + e.snippet));
      const normal = emails.filter((e) => !urgent.includes(e));
      let result = "";
      if (urgent.length > 0) {
        result += "🔴 URGENT :\n" + urgent.map((e) => `  - ${e.from}: ${e.subject}`).join("\n") + "\n\n";
      }
      result += "📋 Autres emails :\n" + normal.map((e) => `  - ${e.from}: ${e.subject}${e.unread ? " (non lu)" : ""}`).join("\n");
      return result;
    }
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
    case "add_photo_shoot": {
      const title = String(args.title ?? "").trim();
      const date = String(args.date ?? "").trim();
      const client = String(args.client ?? "").trim();
      const notes = String(args.notes ?? "").trim() || undefined;
      const validStatuses: PhotoShootStatus[] = ["upcoming", "done", "on_pc", "sorted", "edited", "exported", "sent"];
      let status: PhotoShootStatus | undefined;
      if (args.status !== undefined) {
        const s = String(args.status);
        if (!validStatuses.includes(s as PhotoShootStatus)) return `Erreur : status invalide (${s}). Valeurs acceptees : ${validStatuses.join(", ")}`;
        status = s as PhotoShootStatus;
      }
      if (!title || !date || !client) return "Erreur : titre, date et client requis.";
      const shoot = await addPhotoShoot({ title, date, client, notes, status });
      // Relecture : le shooting est-il bien enregistré ?
      const problem = await verifyWrite(`le shooting "${shoot.title}"`, async () => {
        const after = await getPhotoShoots();
        return after.shoots.some((s) => s.id === shoot.id);
      });
      if (problem) return problem;
      return `Shooting ajouté : ${shoot.title} (${shoot.client}) le ${new Date(shoot.date).toLocaleDateString("fr-FR")} [${shoot.status}]`;
    }
    case "update_photo_shoot": {
      const id = String(args.id ?? "").trim();
      if (!id) return "Erreur : ID requis.";
      const updates: Record<string, unknown> = {};
      if (args.status) updates.status = args.status;
      if (args.galleryLink) updates.galleryLink = String(args.galleryLink);
      if (args.photosSent !== undefined) updates.photosSent = Number(args.photosSent);
      const updated = await updatePhotoShoot(id, updates as Parameters<typeof updatePhotoShoot>[1]);
      if (!updated) return "Shooting introuvable.";
      return `Shooting mis à jour : ${updated.title} → ${updated.status}${updated.galleryLink ? ` (galerie: ${updated.galleryLink})` : ""}${updated.photosSent ? ` (${updated.photosSent} photos)` : ""}`;
    }
    case "list_photo_shoots": {
      const data = await getPhotoShoots();
      if (data.shoots.length === 0) return "Aucun shooting photo enregistré.";
      return data.shoots.map((s) =>
        `- ${s.title} (${s.client}) le ${new Date(s.date).toLocaleDateString("fr-FR")} [${s.status}]${s.galleryLink ? ` - ${s.galleryLink}` : ""}${s.photosSent ? ` - ${s.photosSent} photos` : ""}`
      ).join("\n");
    }
    default:
      return `Outil inconnu : ${name}`;
  }
}
