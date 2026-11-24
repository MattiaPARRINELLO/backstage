import type { Accreditation } from "./schema";

/**
 * Règles pures de la relance J+7.
 *
 * Aucune horloge implicite : l'appelant passe `now`. C'est ce qui rend les
 * tests reproductibles et le job idempotent.
 */
const DAY_MS = 86_400_000;
export const FOLLOW_UP_DAYS = 7;
/** Marge avant le concert : mieux vaut relancer trop tôt qu'après l'événement. */
export const CONCERT_MARGIN_DAYS = 2;

function toTime(value: string): number | null {
  const time = new Date(value).getTime();
  return Number.isNaN(time) ? null : time;
}

/**
 * Échéance de relance d'une demande envoyée.
 *
 * Base : `createdAt`, jamais `updatedAt` (une correction de note ne doit pas
 * repousser la relance). Si le concert tombe avant J+7, l'échéance est ramenée
 * à J-2 avant le concert.
 */
export function computeFollowUpAt(
  createdAt: string,
  concertDate: string
): string | undefined {
  const created = toTime(createdAt);
  if (created === null) return undefined;

  let due = created + FOLLOW_UP_DAYS * DAY_MS;
  const concert = toTime(concertDate);
  if (concert !== null) {
    const beforeConcert = concert - CONCERT_MARGIN_DAYS * DAY_MS;
    if (beforeConcert < due) due = beforeConcert;
  }
  return new Date(due).toISOString();
}

/** Vraie si la fiche attend une relance et que l'échéance est atteinte. */
export function isFollowUpDue(entry: Accreditation, now: number): boolean {
  if (entry.needsReview) return false;
  if (entry.status !== "sent") return false;
  if (entry.followUpNotifiedAt !== undefined) return false;
  if (entry.followUpAt === undefined) return false;
  const due = toTime(entry.followUpAt);
  return due !== null && due <= now;
}

export function dueAccreditations(
  entries: readonly Accreditation[],
  now: number
): Accreditation[] {
  return entries.filter((entry) => isFollowUpDue(entry, now));
}

/** Nombre de fiches qui attendent une relance (notification déjà partie). */
export function countAwaitingFollowUp(
  entries: readonly Accreditation[],
  now: number
): number {
  return entries.filter(
    (entry) =>
      !entry.needsReview &&
      (entry.status === "follow-up" || isFollowUpDue(entry, now))
  ).length;
}

const PROMPT_LIMIT = 3;

/**
 * Lignes du prompt système, trois au maximum.
 *
 * Les fiches déjà passées en `follow-up` d'abord (la notification est partie),
 * puis celles dont l'échéance est atteinte mais dont l'envoi a échoué.
 */
export function followUpPromptLines(
  entries: readonly Accreditation[],
  now: number
): string {
  const ready = entries.filter(
    (entry) => !entry.needsReview && entry.status === "follow-up"
  );
  const late = dueAccreditations(entries, now).filter(
    (entry) => entry.status !== "follow-up"
  );
  const selected = [...ready, ...late].slice(0, PROMPT_LIMIT);
  if (selected.length === 0) return "";

  return (
    "Accréditations à relancer :\n" +
    selected
      .map((entry) => `- ${entry.artist} (${entry.venue}, ${entry.concertDate})`)
      .join("\n")
  );
}

function formatConcertDate(value: string): string {
  const time = toTime(value);
  if (time === null) return value;
  return new Date(time).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

/**
 * Texte prêt à envoyer, stocké sur la fiche.
 *
 * Il ne part pas tout seul : le module `emails` ne sait que répondre à un fil
 * existant, et l'envoi neuf est #142. La notification dit qu'il faut relancer,
 * ce texte évite de rédiger deux fois.
 */
export function buildFollowUpDraft(entry: Accreditation): string {
  const lines = [
    "Bonjour,",
    "",
    `Je me permets de revenir vers vous concernant ma demande d'accréditation photo pour ${entry.artist} au ${entry.venue}, le ${formatConcertDate(entry.concertDate)}.`,
    "Avez-vous pu en prendre connaissance ? Je reste disponible pour toute information complémentaire.",
    "",
    "Bien cordialement,",
    "Mattia",
  ];
  return lines.join("\n");
}
