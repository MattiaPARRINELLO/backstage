import type { Accreditation, AccreditationStatus } from "../schema";

/**
 * Libellés, teintes et ordre des statuts.
 *
 * Les teintes sont des variables du thème, jamais une couleur écrite en clair :
 * la page ne possède aucune valeur de design (docs/design.md).
 */
export const STATUS_META: Record<
  AccreditationStatus,
  { label: string; toneClass: string }
> = {
  pending: { label: "En attente", toneClass: "text-[var(--text-2)]" },
  sent: { label: "Envoyée", toneClass: "text-[var(--accent)]" },
  accepted: { label: "Acceptée", toneClass: "text-[var(--success)]" },
  refused: { label: "Refusée", toneClass: "text-[var(--danger)]" },
  "follow-up": { label: "À relancer", toneClass: "text-[var(--warning)]" },
};

export const STATUS_ORDER: readonly AccreditationStatus[] = [
  "pending",
  "sent",
  "follow-up",
  "accepted",
  "refused",
];

export type FilterId = "all" | "review" | AccreditationStatus;

export const FILTER_ORDER: readonly { id: FilterId; label: string }[] = [
  { id: "all", label: "Tout" },
  { id: "review", label: "À vérifier" },
  ...STATUS_ORDER.map((status) => ({ id: status, label: STATUS_META[status].label })),
];

/** Date exploitable, ou `-Infinity` quand le scan a laissé « Date inconnue ». */
function concertTime(value: string): number {
  const time = new Date(value).getTime();
  return Number.isNaN(time) ? -Infinity : time;
}

/** Tri par date de concert décroissante, dates inconnues en dernier. */
export function sortAccreditations(
  accreditations: readonly Accreditation[]
): Accreditation[] {
  return [...accreditations].sort((a, b) => {
    const left = concertTime(a.concertDate);
    const right = concertTime(b.concertDate);
    if (left === right) return 0;
    return right - left;
  });
}

/** Compte les statuts metier et, separement, les fiches a verifier. */
export function countByStatus(
  accreditations: readonly Accreditation[]
): Record<FilterId, number> {
  const counts: Record<FilterId, number> = {
    all: accreditations.length,
    review: 0,
    pending: 0,
    sent: 0,
    accepted: 0,
    refused: 0,
    "follow-up": 0,
  };
  for (const entry of accreditations) {
    counts[entry.status] += 1;
    if (entry.needsReview) counts.review += 1;
  }
  return counts;
}

/** Filtre par statut ou revue, puis recherche sur l'artiste, le lieu ou le contact. */
export function filterAccreditations(
  accreditations: readonly Accreditation[],
  filter: FilterId,
  query: string
): Accreditation[] {
  const needle = query.trim().toLowerCase();
  return accreditations.filter((entry) => {
    if (filter === "review" && !entry.needsReview) return false;
    if (filter !== "all" && filter !== "review" && entry.status !== filter) return false;
    if (!needle) return true;
    return (
      entry.artist.toLowerCase().includes(needle) ||
      entry.venue.toLowerCase().includes(needle) ||
      (entry.contactEmail?.toLowerCase().includes(needle) ?? false)
    );
  });
}

export function formatConcertDate(value: string): string {
  const time = new Date(value).getTime();
  if (Number.isNaN(time)) return value;
  return new Date(time).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/**
 * Message lisible pour un echec d'action.
 *
 * Une Server Action peut lever une `Error`, un `string` ou un objet inconnu
 * selon la couche qui echoue (validation Zod, session, stockage). Le repli
 * evite d'afficher « [object Object] » ou une chaine vide dans un toast.
 */
export function describeActionError(cause: unknown, fallback: string): string {
  if (cause instanceof Error && cause.message.trim()) return cause.message;
  if (typeof cause === "string" && cause.trim()) return cause;
  return fallback;
}
