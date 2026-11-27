import { z } from "zod";
import {
  defineTool,
  toolEmpty,
  toolError,
  toolOk,
  verifyWrite,
  type GmailThread,
  type ModuleMail,
} from "@backstage/module-kit";

import {
  chunk,
  extractThreads,
  OWN_MEDIA,
  type Extraction,
} from "./extraction";
import {
  contactOf,
  findMatch,
  isUnknown,
  isoDate,
  mergeStatus,
  normalize,
} from "./matching";
import type { Accreditation } from "./schema";
import {
  addAccreditation,
  getAccreditations,
  updateAccreditation,
  type AccreditationUpdate,
} from "./service";

/**
 * Scan des accreditations dans Gmail.
 *
 * Extraction 100 % IA : chaque fil est envoye au modele (`ctx.ai.json`, servi
 * par Groq cote noyau) qui rend un JSON valide par Zod. Aucune regex
 * d'extraction : elle se trompait systematiquement sur l'artiste et le lieu.
 * L'ecriture reste locale et relue apres coup.
 */

/** Termes qui designent une accreditation, dans les deux orthographes. */
const PRECISE_TERMS = [
  "accréditation",
  "accréditations",
  "accreditation",
  "accreditations",
  '"photo pass"',
  '"press pass"',
  '"pass photo"',
  '"pass presse"',
  '"demande d\'accès"',
  '"demande d\'acces"',
  '"accès presse"',
  '"acces presse"',
];

/**
 * Termes qui accompagnent une demande sans la nommer.
 *
 * Une demande ecrite « je peux couvrir le concert de samedi ? » n'utilise
 * aucun des termes precis : sans cette famille, elle n'est jamais candidate.
 */
const BROAD_TERMS = [
  "photographe",
  "photographes",
  "couverture",
  "reportage",
  "shooting",
  '"autorisation photo"',
];

const PRECISE_QUERY = `(${PRECISE_TERMS.join(" OR ")}) newer_than:24m`;
const BROAD_QUERY = `(${BROAD_TERMS.join(" OR ")}) newer_than:12m`;
/** Le courrier envoye recent, meme sans mot-cle : une demande est un envoi. */
const SENT_QUERY = "in:sent newer_than:12m";

/** Plafond de fils analyses par scan : borne la duree et le quota Groq. */
const MAX_THREADS = 200;
const BATCH_SIZE = 10;

// Deux scans simultanes (chat + ecran) multiplieraient la consommation du
// quota Gmail et Groq. Le premier garde la main, le second est refuse.
let scanInFlight = false;

/**
 * Rassemble les fils candidats.
 *
 * Les fils trouves par les termes precis passent en premier : un plafond ne
 * doit jamais ecarter une vraie accreditation au profit d'un « reportage »
 * quelconque. Le nombre de candidats est rendu pour annoncer ce qui n'a pas
 * ete analyse, plutot que de le taire.
 */
async function collectThreads(
  mail: ModuleMail
): Promise<{ threads: GmailThread[]; candidates: number }> {
  // Les groupes partent l'un apres l'autre : chacun liste puis lit ses fils
  // complets (10 unites de quota par fil). Trois groupes en parallele
  // multipliaient la rafale par trois et declenchaient le quota Gmail. Le
  // nombre de candidats reste mesure sur les trois groupes, pour annoncer ce
  // que le plafond laisse de cote.
  const groups = [
    await mail.listThreads(PRECISE_QUERY, MAX_THREADS),
    await mail.listThreads(SENT_QUERY, Math.floor(MAX_THREADS / 2)),
    await mail.listThreads(BROAD_QUERY, Math.floor(MAX_THREADS / 2)),
  ];

  const seen = new Set<string>();
  const threads: GmailThread[] = [];
  for (const group of groups) {
    for (const thread of group) {
      if (seen.has(thread.id)) continue;
      seen.add(thread.id);
      threads.push(thread);
    }
  }
  return { threads: threads.slice(0, MAX_THREADS), candidates: threads.length };
}

interface ScanCounters {
  created: number;
  updated: number;
  unchanged: number;
  ignored: number;
  skippedReview: number;
  failed: number;
}

async function applyExtraction(
  entries: Accreditation[],
  thread: GmailThread,
  extraction: Extraction,
  counters: ScanCounters
): Promise<string | null> {
  if (!extraction.artist) {
    counters.ignored++;
    return null;
  }
  // Le media de l'utilisateur n'est pas un artiste : une demande qui ne nomme
  // que Rapstar n'a pas d'artiste exploitable.
  if (OWN_MEDIA.has(normalize(extraction.artist))) {
    counters.ignored++;
    return null;
  }

  const artist = extraction.artist;
  const venue = extraction.venue;
  const concertDate = isoDate(extraction.concertDate);
  const needsReview =
    extraction.uncertainFields.length > 0 ||
    isUnknown(artist) ||
    isUnknown(venue) ||
    !concertDate;
  const contact = contactOf(thread, extraction.contactEmail);
  const current = findMatch(entries, artist, venue);

  if (current) {
    // Une seconde extraction incertaine ne remplace pas silencieusement une
    // fiche que l'utilisateur doit deja verifier.
    if (current.needsReview && needsReview) {
      counters.skippedReview++;
      return null;
    }
    const nextStatus = mergeStatus(current.status, extraction.status);
    const updates: AccreditationUpdate = {
      ...(isUnknown(current.venue) && !isUnknown(venue) ? { venue } : {}),
      ...(isUnknown(current.concertDate) && concertDate ? { concertDate } : {}),
      ...(!current.contactEmail && contact ? { contactEmail: contact } : {}),
      ...(nextStatus !== current.status ? { status: nextStatus } : {}),
      ...(needsReview !== current.needsReview ? { needsReview } : {}),
      ...(current.emailThreadId ? {} : { emailThreadId: thread.id }),
    };
    if (Object.keys(updates).length === 0) {
      counters.unchanged++;
      return null;
    }

    const changed = await updateAccreditation(current.id, updates);
    const problem = await verifyWrite(`la fiche "${current.artist}"`, async () => {
      const after = await getAccreditations();
      return after.accreditations.some((entry) => entry.id === current.id);
    });
    if (problem) return problem;
    if (changed) {
      const index = entries.findIndex((entry) => entry.id === current.id);
      if (index >= 0) entries[index] = changed;
      counters.updated++;
    }
    return null;
  }

  const createdAccreditation = await addAccreditation({
    artist,
    venue: venue || "Inconnu",
    concertDate: concertDate || "Date inconnue",
    needsReview,
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
  if (problem) return problem;

  const status = mergeStatus("pending", extraction.status);
  const updates: AccreditationUpdate = {
    emailThreadId: thread.id,
    ...(status !== "pending"
      ? { status, notes: `Email: ${thread.messages[0]?.id ?? thread.id}` }
      : {}),
  };
  const changed = await updateAccreditation(createdAccreditation.id, updates);
  counters.created++;
  entries.push(changed ?? { ...createdAccreditation, status });
  return null;
}

export const scanAccreditationsTool = defineTool({
  name: "scan",
  description:
    "Analyse les fils Gmail pour trouver des demandes d'accreditation (accreditation, photo pass, presse, couverture, photographe, envoles recents). Extrait artiste, lieu, date, statut par IA et cree/met a jour les fiches dans accreditations.json.",
  params: z.object({}),
  sideEffect: "write",
  describeAction: () =>
    "Analyser les fils Gmail pour creer ou mettre a jour les fiches d'accreditations",
  run: async (_args, ctx) => {
    const ai = ctx.ai;
    if (!ai) {
      return toolError(
        "Extraction IA indisponible : configure GROQ_API_KEY dans .env.local, puis relance le scan."
      );
    }
    const mail = ctx.mail;
    if (!mail) {
      return toolError(
        "Acces mail indisponible : cet hote ne fournit pas la boite du noyau, le scan est impossible."
      );
    }

    try {
      if (scanInFlight) {
        return toolError(
          "Un scan des accreditations est deja en cours. Attends qu'il se termine avant de relancer."
        );
      }
      scanInFlight = true;

      const { threads, candidates } = await collectThreads(mail);
      if (threads.length === 0) return toolEmpty("Aucun fil d'accreditation trouve.");

      const existing = await getAccreditations();
      const entries = [...existing.accreditations];
      const counters: ScanCounters = {
        created: 0,
        updated: 0,
        unchanged: 0,
        ignored: 0,
        skippedReview: 0,
        failed: 0,
      };

      const delayMs = Math.max(0, ai.jsonDelayMs ?? 0);
      let lastError = "";

      for (const [index, batch] of chunk(threads, BATCH_SIZE).entries()) {
        if (index > 0 && delayMs > 0) {
          await new Promise((resolve) => setTimeout(resolve, delayMs));
        }
        let extractions: Map<string, Extraction>;
        try {
          extractions = await extractThreads(ai, batch);
        } catch (error) {
          lastError = error instanceof Error ? error.message : String(error);
          ctx.log("warn", `${batch.length} fil(s) non analyses`, error);
          counters.failed += batch.length;
          continue;
        }
        for (const thread of batch) {
          const extraction = extractions.get(thread.id);
          if (!extraction) {
            counters.failed++;
            continue;
          }
          const problem = await applyExtraction(entries, thread, extraction, counters);
          if (problem) return toolError(problem);
        }
      }

      if (counters.failed > 0 && counters.created === 0 && counters.updated === 0) {
        return toolError(
          `Scan interrompu : ${counters.failed} fil(s) sur ${threads.length} n'ont pas pu etre analyses${
            lastError ? ` (${lastError})` : ""
          }.`
        );
      }

      const parts = [
        `${counters.created} nouvelle(s)`,
        `${counters.updated} mise(s) a jour`,
        `${counters.unchanged} inchangee(s)`,
        `${counters.ignored} ignoree(s)`,
      ];
      if (counters.skippedReview > 0) {
        parts.push(`${counters.skippedReview} non remplacee(s) car a verifier`);
      }
      if (counters.failed > 0) parts.push(`${counters.failed} non analysee(s)`);
      const header =
        candidates > threads.length
          ? `Scan de ${threads.length} fils sur ${candidates} candidats (plafond ${MAX_THREADS})`
          : `Scan de ${threads.length} fils`;
      return toolOk(`${header} : ${parts.join(", ")}.`);
    } catch (error) {
      return toolError(
        `Erreur lors du scan des accreditations : ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    } finally {
      scanInFlight = false;
    }
  },
});
