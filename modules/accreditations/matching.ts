import { z } from "zod";

import type { GmailThread } from "@backstage/module-kit";

import type { Accreditation, AccreditationStatus } from "./schema";

/**
 * Rapprochement d'une extraction avec les fiches existantes.
 *
 * Ces regles sont pures et sans stockage : les isoler garde l'outil de scan sous
 * le plafond de lignes et rend chaque regle testable seule.
 */

const STATUS_RANK: Record<AccreditationStatus, number> = {
  pending: 0,
  sent: 1,
  accepted: 2,
  refused: 2,
  "follow-up": 3,
};

export function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function isUnknown(value: string): boolean {
  const normalized = normalize(value);
  return normalized === "" || normalized.includes("inconnu");
}

/**
 * Retrouve une fiche malgre un lieu encore inconnu.
 *
 * Une fiche extraite hier sans salle (`Inconnu`) doit etre completee par le
 * scan du jour, pas dupliquee sous un nouveau couple artiste/lieu.
 */
export function findMatch(
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

export function isoDate(value: string): string {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : "";
}

export function emailOf(from: string | undefined): string {
  return from?.match(/[\w.+-]+@[\w.-]+\.\w+/)?.[0] ?? "";
}

/** Le statut ne recule jamais : un scan ne retrograde pas une fiche acceptee. */
export function mergeStatus(
  current: AccreditationStatus,
  next: AccreditationStatus
): AccreditationStatus {
  if (current === "follow-up" || current === "accepted" || current === "refused") {
    return current;
  }
  return STATUS_RANK[next] > STATUS_RANK[current] ? next : current;
}

/**
 * Adresse du correspondant, jamais celle de l'utilisateur.
 *
 * Quand la demande part de la boite de l'utilisateur, le dernier message est de
 * lui : prendre son adresse transformerait la salle en lui-meme.
 */
export function contactOf(thread: GmailThread, extracted: string): string {
  if (z.string().email().safeParse(extracted).success) return extracted;
  const correspondent = thread.messages.find((message) => !message.fromMe);
  return emailOf(correspondent?.from ?? thread.messages[0]?.from);
}
