import { z } from "zod";
import { defineTool, toolEmpty, toolError, toolOk, verifyWrite } from "@backstage/module-kit";

import { fetchGmailMessages } from "@/lib/google-actions";
import type { AccreditationStatus } from "./schema";
import {
  addAccreditation,
  getAccreditations,
  updateAccreditation,
} from "./service";

/**
 * Scan des accréditations dans Gmail.
 *
 * Analyse les emails pour créer ou mettre à jour les fiches : artiste, lieu,
 * date et statut. Écriture locale, jamais confiée au texte du modèle, et relue
 * après coup : le modèle ne doit jamais annoncer une fiche qui n'existe pas.
 */
export const scanAccreditationsTool = defineTool({
  name: "scan",
  description:
    "Analyse les emails Gmail pour trouver des demandes d'accreditation (mots-cles: accreditation, photo pass, press). Extrait artiste, lieu, date, statut et cree/met a jour les fiches dans accreditations.json.",
  params: z.object({}),
  sideEffect: "write",
  describeAction: () =>
    "Analyser les emails pour créer ou mettre à jour les fiches d'accréditations",
  run: async () => {
    try {
      const messages = await fetchGmailMessages(
        "accréditation OR photo pass OR press OR accredit",
        20
      );
      if (messages.length === 0) return toolEmpty("Aucun email d'accreditation trouve.");

      let created = 0;
      let updated = 0;
      const existing = await getAccreditations();
      const existingKeys = new Set(
        existing.accreditations.map((entry) => `${entry.artist}|${entry.venue}`.toLowerCase())
      );

      for (const message of messages) {
        const from = message.from ?? "";
        const text = `${message.subject ?? ""} ${message.snippet ?? ""}`.toLowerCase();

        const artistMatch = text.match(
          /(?:pour|concert de|show de|photo de)\s+([a-zàâçéèêëîïôûùüÿñæœ-]+(?:\s+[a-zàâçéèêëîïôûùüÿñæœ-]+){0,2})/i
        );
        const venueMatch = text.match(
          /(?:au|à|chez)\s+([a-zàâçéèêëîïôûùüÿñæœ-]+(?:\s+[a-zàâçéèêëîïôûùüÿñæœ-]+){0,2})/i
        );
        const dateMatch = text.match(
          /(\d{1,2})[\/\s](janvier|février|mars|avril|mai|juin|juillet|août|septembre|octobre|novembre|décembre|\d{1,2})[\/\s](\d{4}|\d{2})/i
        );

        const artist = artistMatch?.[1]?.trim() ?? "";
        const venue = venueMatch?.[1]?.trim() ?? "";
        const concertDate = dateMatch?.[0]?.trim() ?? "";
        if (!artist) continue;

        let status: AccreditationStatus = "pending";
        if (text.includes("accepté") || text.includes("confirme") || text.includes("approved")) {
          status = "accepted";
        } else if (text.includes("refusé") || text.includes("decliné") || text.includes("denied")) {
          status = "refused";
        } else if (text.includes("envoyé") || text.includes("sent") || text.includes("demande")) {
          status = "sent";
        }

        const key = `${artist}|${venue || "inconnu"}`.toLowerCase();
        if (existingKeys.has(key)) {
          const current = existing.accreditations.find(
            (entry) => `${entry.artist}|${entry.venue}`.toLowerCase() === key
          );
          if (current && current.status !== status) {
            await updateAccreditation(current.id, { status });
            const problem = await verifyWrite(
              `le statut de "${current.artist}"`,
              async () => {
                const after = await getAccreditations();
                return after.accreditations.some(
                  (entry) => entry.id === current.id && entry.status === status
                );
              }
            );
            if (problem) return toolError(problem);
            updated++;
          }
        } else {
          const createdAccreditation = await addAccreditation({
            artist,
            venue: venue || "Inconnu",
            concertDate: concertDate || "Date inconnue",
            contactEmail: from,
          });
          const problem = await verifyWrite(
            `l'accreditation "${createdAccreditation.artist}"`,
            async () => {
              const after = await getAccreditations();
              return after.accreditations.some(
                (entry) => entry.id === createdAccreditation.id
              );
            }
          );
          if (problem) return toolError(problem);
          if (status !== "pending") {
            await updateAccreditation(createdAccreditation.id, {
              status,
              notes: `Email: ${message.id}`,
            });
          }
          created++;
          existingKeys.add(key);
        }
      }

      return toolOk(
        `Scan termine : ${created} nouvelle(s) accreditation(s) creee(s), ${updated} mise(s) a jour.`
      );
    } catch (error) {
      return toolError(
        `Erreur lors du scan des accreditations : ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  },
});
