import { z } from "zod";

import type { GmailThread } from "@backstage/module-kit";

import { accreditationStatusSchema } from "./schema";

/**
 * Extraction IA d'une demande d'accreditation depuis un fil Gmail.
 *
 * Un fil, pas un message : la reponse « c'est ok pour vendredi » ne contient
 * aucun mot-cle, elle n'a de sens qu'avec la demande qui la precede. Les fils
 * partent par lots pour rester sous le quota de tokens par minute de Groq.
 */

const extractionFields = {
  artist: z.string().trim().default(""),
  venue: z.string().trim().default(""),
  concertDate: z.string().trim().default(""),
  status: accreditationStatusSchema.default("pending"),
  contactEmail: z.string().trim().default(""),
  uncertainFields: z.array(z.enum(["artist", "venue", "concertDate"])).default([]),
};

const extractionSchema = z.object(extractionFields);

const batchItemSchema = z.object({ id: z.string(), ...extractionFields });

const batchSchema = z.union([
  z.object({ results: z.array(batchItemSchema) }),
  z.array(batchItemSchema),
]);

export const extractionResultSchema = extractionSchema;

export type Extraction = z.infer<typeof extractionSchema>;

export interface ExtractionAi {
  json?: (input: { system: string; prompt: string }) => Promise<string>;
  complete: (input: {
    system?: string;
    prompt: string;
    maxChars?: number;
  }) => Promise<string>;
}

/** Le media de l'utilisateur, jamais l'artiste d'une demande. */
export const OWN_MEDIA = new Set(["rapstar"]);

const RULES = `Regles :
- Rapstar est le media de l'utilisateur (le demandeur), jamais un artiste. Ne mets jamais "Rapstar" dans artist.
- Un message "De: ... (vous)" vient de l'utilisateur lui-meme.
- artist : nom de l'artiste ou du groupe, tel qu'ecrit. Retire les mots parasites ("pour", "concert de", "demande d'accréditation", "photo pass", "Rapstar"). Si le message le plus recent ne le nomme pas, cherche-le dans les messages precedents du fil.
- venue : salle ou lieu du concert, sans "au", "a", "chez".
- concertDate : date du concert au format YYYY-MM-DD, ou "" si absente.
- status : "accepted" si l'email accepte ou confirme, "refused" s'il refuse ou decline, "sent" si la demande vient de l'utilisateur et n'a pas encore de reponse, sinon "pending".
- contactEmail : adresse email du correspondant (la salle, le tourneur, le label), jamais celle de l'utilisateur.
- uncertainFields : champs douteux parmi "artist", "venue" et "concertDate". Ajoute "venue" si la salle est absente ou inconnue, "concertDate" si la date est absente ou peu fiable, et "artist" si le libelle peut designer un evenement plutot qu'un artiste. Utilise [] seulement si les trois champs sont surs.
- Si le fil n'est pas une demande d'accreditation photo (newsletter, facture, publicite), mets artist a "".`;

const SINGLE_SYSTEM = `Tu extrais une demande d'accreditation photo depuis un fil d'emails.
Reponds uniquement un objet JSON avec exactement ces cles :
{"artist":"","venue":"","concertDate":"","status":"pending","contactEmail":"","uncertainFields":[]}

${RULES}`;

const BATCH_SYSTEM = `Tu extrais des demandes d'accreditation photo depuis plusieurs fils d'emails.
Chaque fil commence par "### Fil <id>". Reponds uniquement un objet JSON :
{"results":[{"id":"<id du fil>","artist":"","venue":"","concertDate":"","status":"pending","contactEmail":"","uncertainFields":[]}]}
Une entree par fil fourni, avec son id exactement recopie.

${RULES}`;

const NEWEST_BODY_CHARS = 1400;
const OLDER_BODY_CHARS = 600;
const MAX_MESSAGES = 4;

const QUOTE_BREAKS = [
  /^-{2,}\s*(message|forwarded|transfere)/i,
  /^(le|on)\s.+(a ecrit|wrote)\s*:?\s*$/i,
  /^_{5,}$/,
  /^>/,
];

function unaccent(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

/**
 * Coupe l'historique cite et la signature de la reponse.
 *
 * Sans cela, les 1400 caracteres utiles du message sont consommes par trois
 * echanges precedents, et le modele ne voit jamais l'artiste ni la date.
 */
export function stripQuoted(body: string): string {
  const kept: string[] = [];
  for (const line of body.split(/\r?\n/)) {
    const plain = unaccent(line.trim());
    if (QUOTE_BREAKS.some((pattern) => pattern.test(plain))) break;
    kept.push(line);
  }
  return kept.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

function formatMessage(message: GmailThread["messages"][number], index: number): string {
  const limit = index === 0 ? NEWEST_BODY_CHARS : OLDER_BODY_CHARS;
  const author = message.fromMe ? `${message.from} (vous)` : message.from;
  const body = stripQuoted(message.body || message.snippet).slice(0, limit);
  return [
    `--- Message ${index + 1}${index === 0 ? " (le plus recent)" : ""}`,
    `De: ${author}`,
    `A: ${message.to ?? ""}`,
    `Date: ${message.date}`,
    `Sujet: ${message.subject}`,
    "Corps:",
    body,
  ].join("\n");
}

export function buildThreadPrompt(thread: GmailThread): string {
  return thread.messages
    .slice(0, MAX_MESSAGES)
    .map((message, index) => formatMessage(message, index))
    .join("\n\n");
}

export function buildBatchPrompt(threads: readonly GmailThread[]): string {
  return threads
    .map((thread) => `### Fil ${thread.id}\n${buildThreadPrompt(thread)}`)
    .join("\n\n");
}

/** Extrait le premier objet JSON d'une reponse de modele, entoure ou non. */
function sliceJson(raw: string): unknown | null {
  const objectStart = raw.indexOf("{");
  const arrayStart = raw.indexOf("[");
  const isArray = arrayStart >= 0 && (objectStart < 0 || arrayStart < objectStart);
  const start = isArray ? arrayStart : objectStart;
  const end = isArray ? raw.lastIndexOf("]") : raw.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(raw.slice(start, end + 1));
  } catch {
    return null;
  }
}

export function parseSingle(raw: string): Extraction | null {
  const json = sliceJson(raw);
  if (json === null) return null;
  const parsed = extractionSchema.safeParse(json);
  return parsed.success ? parsed.data : null;
}

/**
 * Lit une reponse de lot. Un fil absent de la reponse est simplement omis :
 * l'appelant le retente seul puis le compte en echec.
 */
export function parseBatch(
  raw: string,
  threads: readonly GmailThread[]
): Map<string, Extraction> {
  const known = new Set(threads.map((thread) => thread.id));
  const result = new Map<string, Extraction>();
  const json = sliceJson(raw);
  if (json === null) return result;
  const parsed = batchSchema.safeParse(json);
  if (!parsed.success) return result;
  const items = Array.isArray(parsed.data) ? parsed.data : parsed.data.results;
  for (const item of items) {
    if (!known.has(item.id)) continue;
    const { id, ...fields } = item;
    result.set(id, fields);
  }
  return result;
}

async function ask(
  ai: ExtractionAi,
  system: string,
  prompt: string
): Promise<string> {
  if (ai.json) return ai.json({ system, prompt });
  return ai.complete({ system, prompt });
}

/**
 * Extrait chaque fil du lot, avec repli fil par fil.
 *
 * Un lot refusable (modele bavard, JSON casse) ne doit pas perdre les fils
 * qu'il contenait : seuls les fils reellement illisibles manquent au retour.
 */
export async function extractThreads(
  ai: ExtractionAi,
  threads: readonly GmailThread[]
): Promise<Map<string, Extraction>> {
  const found =
    threads.length === 0
      ? new Map<string, Extraction>()
      : parseBatch(await ask(ai, BATCH_SYSTEM, buildBatchPrompt(threads)), threads);

  const missing = threads.filter((thread) => !found.has(thread.id));
  if (missing.length === 0) return found;

  // Le lot a echoue ou rendu incomplet : on retente chaque fil seul.
  for (const thread of missing) {
    try {
      const single = parseSingle(await ask(ai, SINGLE_SYSTEM, buildThreadPrompt(thread)));
      if (single) found.set(thread.id, single);
    } catch {
      // Fil laisse en echec : le scan le compte et le dit.
    }
  }
  return found;
}

/** Decoupe en lots de taille fixe, sans muter la liste source. */
export function chunk<T>(items: readonly T[], size: number): T[][] {
  const batches: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    batches.push(items.slice(index, index + size));
  }
  return batches;
}
