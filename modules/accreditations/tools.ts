import { z } from "zod";
import { defineTool, toolEmpty, toolError, toolOk, verifyWrite } from "@backstage/module-kit";

import { fetchGmailMessages } from "@/lib/google-actions";
import {
  accreditationStatusSchema,
  type Accreditation,
  type AccreditationStatus,
} from "./schema";
import {
  addAccreditation,
  getAccreditations,
  updateAccreditation,
  type AccreditationUpdate,
} from "./service";

/**
 * Scan des accréditations dans Gmail.
 *
 * Extraction 100 % IA : chaque email est envoyé au modèle (`ctx.ai.json`,
 * servi par Groq côté noyau) qui rend un JSON validé par Zod. Aucune regex
 * d'extraction : elle se trompait systématiquement sur l'artiste et le lieu.
 * L'écriture reste locale et relue après coup.
 */

const extractionSchema = z.object({
  artist: z.string().trim().default(""),
  venue: z.string().trim().default(""),
  concertDate: z.string().trim().default(""),
  status: accreditationStatusSchema.default("pending"),
  contactEmail: z.string().trim().default(""),
});

type Extraction = z.infer<typeof extractionSchema>;

interface EmailMessage {
  id: string;
  from?: string | undefined;
  subject?: string | undefined;
  snippet?: string | undefined;
}

const SYSTEM = `Tu extrais une demande d'accreditation photo depuis un email.
Reponds uniquement un objet JSON avec exactement ces cles :
{"artist":"","venue":"","concertDate":"","status":"pending","contactEmail":""}

Regles :
- artist : nom de l'artiste ou du groupe, tel qu'ecrit. Retire les mots parasites ("pour", "concert de", "demande d'accréditation", "photo pass").
- venue : salle ou lieu du concert, sans "au", "a", "chez".
- concertDate : date du concert au format YYYY-MM-DD, ou "" si absente.
- status : "accepted" si l'email accepte ou confirme, "refused" s'il refuse ou decline, "sent" s'il confirme l'envoi de la demande, sinon "pending".
- contactEmail : adresse email de l'expediteur, ou "".
Si l'email n'est pas une demande d'accreditation, mets artist a "".`;

const STATUS_RANK: Record<AccreditationStatus, number> = {
  pending: 0,
  sent: 1,
  accepted: 2,
  refused: 2,
  "follow-up": 3,
};

function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function isUnknown(value: string): boolean {
  const normalized = normalize(value);
  return normalized === "" || normalized.includes("inconnu");
}

/**
 * Retrouve une fiche malgré un lieu encore inconnu.
 *
 * Une fiche extraite hier sans salle (`Inconnu`) doit être complétée par le
 * scan du jour, pas dupliquée sous un nouveau couple artiste/lieu.
 */
function findMatch(
  entries: readonly Accreditation[],
  artist: string,
  venue: string
): Accreditation | undefined {
  const normalizedArtist = normalize(artist);
  const sameArtist = entries.filter(
    (entry) => normalize(entry.artist) === normalizedArtist
  );
  if (sameArtist.length === 0) return undefined;
  const exact = sameArtist.find(
    (entry) => normalize(entry.venue) === normalize(venue)
  );
  if (exact) return exact;
  const unknownVenue = sameArtist.find((entry) => isUnknown(entry.venue));
  if (unknownVenue) return unknownVenue;
  if (sameArtist.length === 1 && isUnknown(venue)) return sameArtist[0];
  return undefined;
}

function isoDate(value: string): string {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : "";
}

function emailOf(from: string | undefined): string {
  return from?.match(/[\w.+-]+@[\w.-]+\.\w+/)?.[0] ?? "";
}

/** Le statut ne recule jamais : un scan ne rétrograde pas une fiche acceptée. */
function mergeStatus(
  current: AccreditationStatus,
  next: AccreditationStatus
): AccreditationStatus {
  if (current === "follow-up" || current === "accepted" || current === "refused") {
    return current;
  }
  return STATUS_RANK[next] > STATUS_RANK[current] ? next : current;
}

function buildPrompt(message: EmailMessage): string {
  return [
    `De: ${message.from ?? ""}`,
    `Sujet: ${message.subject ?? ""}`,
    "Corps:",
    (message.snippet ?? "").slice(0, 2000),
  ].join("\n");
}

function parseModelJson(raw: string): Extraction | null {
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    const parsed = extractionSchema.safeParse(JSON.parse(raw.slice(start, end + 1)));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

type ExtractionAi = {
  json?: (input: { system: string; prompt: string }) => Promise<string>;
  complete: (input: { system?: string; prompt: string; maxChars?: number }) => Promise<string>;
};

async function extractOne(
  ai: ExtractionAi,
  message: EmailMessage
): Promise<Extraction | null> {
  const raw = await extractWithAi(ai, message);
  const parsed = parseModelJson(raw);
  if (!parsed) throw new Error(`reponse IA illisible pour l'email ${message.id}`);
  return parsed;
}

async function extractWithAi(
  ai: ExtractionAi,
  message: EmailMessage
): Promise<string> {
  const prompt = buildPrompt(message);
  if (ai.json) return ai.json({ system: SYSTEM, prompt });
  return ai.complete({ system: SYSTEM, prompt });
}

export const scanAccreditationsTool = defineTool({
  name: "scan",
  description:
    "Analyse les emails Gmail pour trouver des demandes d'accreditation (mots-cles: accreditation, photo pass, press). Extrait artiste, lieu, date, statut par IA et cree/met a jour les fiches dans accreditations.json.",
  params: z.object({}),
  sideEffect: "write",
  describeAction: () =>
    "Analyser les emails pour créer ou mettre à jour les fiches d'accréditations",
  run: async (_args, ctx) => {
    const ai = ctx.ai;
    if (!ai) {
      return toolError(
        "Extraction IA indisponible : configure GROQ_API_KEY dans .env.local, puis relance le scan."
      );
    }

    try {
      const messages = await fetchGmailMessages(
        "accréditation OR photo pass OR press OR accredit",
        20
      );
      if (messages.length === 0) return toolEmpty("Aucun email d'accreditation trouve.");

      const existing = await getAccreditations();
      const entries = [...existing.accreditations];

      let created = 0;
      let updated = 0;
      let unchanged = 0;
      let ignored = 0;
      let failed = 0;
      let lastError = "";

      for (const message of messages) {
        let extraction: Extraction | null;
        try {
          extraction = await extractOne(ai, message);
        } catch (error) {
          failed++;
          lastError = error instanceof Error ? error.message : String(error);
          ctx.log("warn", `extraction impossible pour l'email ${message.id}`, error);
          continue;
        }
        if (!extraction || !extraction.artist) {
          ignored++;
          continue;
        }

        const artist = extraction.artist;
        const venue = extraction.venue;
        const concertDate = isoDate(extraction.concertDate);
        const contact = z.string().email().safeParse(extraction.contactEmail).success
          ? extraction.contactEmail
          : emailOf(message.from);
        const current = findMatch(entries, artist, venue);

        if (current) {
          const nextStatus = mergeStatus(current.status, extraction.status);
          const updates: AccreditationUpdate = {
            ...(isUnknown(current.venue) && !isUnknown(venue) ? { venue } : {}),
            ...(isUnknown(current.concertDate) && concertDate ? { concertDate } : {}),
            ...(!current.contactEmail && contact ? { contactEmail: contact } : {}),
            ...(nextStatus !== current.status ? { status: nextStatus } : {}),
          };
          if (Object.keys(updates).length === 0) {
            unchanged++;
            continue;
          }

          const changed = await updateAccreditation(current.id, updates);
          const problem = await verifyWrite(
            `la fiche "${current.artist}"`,
            async () => {
              const after = await getAccreditations();
              return after.accreditations.some((entry) => entry.id === current.id);
            }
          );
          if (problem) return toolError(problem);
          if (changed) {
            const index = entries.findIndex((entry) => entry.id === current.id);
            if (index >= 0) entries[index] = changed;
            updated++;
          }
          continue;
        }

        const createdAccreditation = await addAccreditation({
          artist,
          venue: venue || "Inconnu",
          concertDate: concertDate || "Date inconnue",
          contactEmail: contact || undefined,
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

        const status = mergeStatus("pending", extraction.status);
        if (status !== "pending") {
          await updateAccreditation(createdAccreditation.id, {
            status,
            notes: `Email: ${message.id}`,
          });
        }
        created++;
        entries.push({ ...createdAccreditation, status });
      }

      if (failed > 0 && created === 0 && updated === 0) {
        return toolError(
          `Scan interrompu : ${failed} email(s) n'ont pas pu etre analyses (${lastError}).`
        );
      }

      const parts = [
        `${created} nouvelle(s)`,
        `${updated} mise(s) a jour`,
        `${unchanged} inchangee(s)`,
        `${ignored} ignoree(s)`,
      ];
      if (failed > 0) parts.push(`${failed} illisible(s)`);
      return toolOk(`Scan termine : ${parts.join(", ")}.`);
    } catch (error) {
      return toolError(
        `Erreur lors du scan des accreditations : ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  },
});
