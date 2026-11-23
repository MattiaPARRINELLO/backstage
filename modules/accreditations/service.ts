import { newId } from "@backstage/module-kit/storage-core";

import { computeFollowUpAt } from "./followup";
import type {
  Accreditation,
  AccreditationStatus,
  AccreditationsData,
} from "./schema";
import { accreditationsStore } from "./store";

/**
 * Opérations métier du module sur ses fiches.
 *
 * Elles remplacent les fonctions historiques de `lib/storage/accreditations.ts`
 * pour le module : même fichier, même comportement, mais le module ne dépend
 * plus de l'intérieur du noyau.
 */
export async function getAccreditations(): Promise<AccreditationsData> {
  return accreditationsStore.read();
}

export async function addAccreditation(input: {
  artist: string;
  venue: string;
  concertDate: string;
  contactEmail?: string | undefined;
  notes?: string | undefined;
}): Promise<Accreditation> {
  const now = new Date().toISOString();
  const accreditation: Accreditation = {
    id: newId(),
    artist: input.artist,
    venue: input.venue,
    concertDate: input.concertDate,
    status: "pending",
    contactEmail: input.contactEmail,
    notes: input.notes,
    createdAt: now,
    updatedAt: now,
  };
  await accreditationsStore.mutate((data) => {
    data.accreditations.unshift(accreditation);
  });
  return accreditation;
}

export interface AccreditationUpdate {
  readonly artist?: string | undefined;
  readonly venue?: string | undefined;
  readonly concertDate?: string | undefined;
  readonly status?: AccreditationStatus | undefined;
  readonly contactEmail?: string | undefined;
  readonly notes?: string | undefined;
  readonly emailThreadId?: string | undefined;
  readonly followUpAt?: string | undefined;
  readonly followUpNotifiedAt?: string | undefined;
  readonly followUpDraft?: string | undefined;
}

export async function updateAccreditation(
  id: string,
  updates: AccreditationUpdate
): Promise<Accreditation | null> {
  let updated: Accreditation | null = null;
  await accreditationsStore.mutate((data) => {
    const index = data.accreditations.findIndex((entry) => entry.id === id);
    if (index < 0) return null;
    const current = data.accreditations[index];
    if (!current) return null;
    // Affectation champ par champ : avec `exactOptionalPropertyTypes`, étaler
    // `updates` écraserait un champ obligatoire par `undefined`.
    const next: Accreditation = {
      ...current,
      updatedAt: new Date().toISOString(),
    };
    if (updates.artist !== undefined) next.artist = updates.artist;
    if (updates.venue !== undefined) next.venue = updates.venue;
    if (updates.concertDate !== undefined) next.concertDate = updates.concertDate;
    if (updates.status !== undefined) {
      next.status = updates.status;
      // Une demande envoyée programme sa relance depuis la date de création.
      if (updates.status === "sent" && next.followUpAt === undefined) {
        next.followUpAt = computeFollowUpAt(next.createdAt, next.concertDate);
      }
      // Acceptée ou refusée : plus rien à relancer.
      if (updates.status === "accepted" || updates.status === "refused") {
        delete next.followUpAt;
      }
    }
    // Corriger la date du concert d'une demande encore en attente de relance
    // recalcule l'échéance, sans toucher à une relance déjà partie.
    if (
      updates.concertDate !== undefined &&
      next.status === "sent" &&
      next.followUpNotifiedAt === undefined
    ) {
      next.followUpAt = computeFollowUpAt(next.createdAt, next.concertDate);
    }
    if (updates.contactEmail !== undefined) next.contactEmail = updates.contactEmail;
    if (updates.notes !== undefined) next.notes = updates.notes;
    if (updates.emailThreadId !== undefined) next.emailThreadId = updates.emailThreadId;
    if (updates.followUpAt !== undefined) next.followUpAt = updates.followUpAt;
    if (updates.followUpNotifiedAt !== undefined) {
      next.followUpNotifiedAt = updates.followUpNotifiedAt;
    }
    if (updates.followUpDraft !== undefined) next.followUpDraft = updates.followUpDraft;
    data.accreditations[index] = next;
    updated = next;
  });
  return updated;
}

export async function deleteAccreditation(id: string): Promise<boolean> {
  let deleted = false;
  await accreditationsStore.mutate((data) => {
    const before = data.accreditations.length;
    data.accreditations = data.accreditations.filter((entry) => entry.id !== id);
    deleted = data.accreditations.length !== before;
    return deleted ? undefined : null;
  });
  return deleted;
}

export async function searchAccreditations(query: string): Promise<Accreditation[]> {
  const data = await getAccreditations();
  const q = query.toLowerCase();
  return data.accreditations.filter(
    (entry) =>
      entry.artist.toLowerCase().includes(q) ||
      entry.venue.toLowerCase().includes(q) ||
      (entry.notes !== undefined && entry.notes.toLowerCase().includes(q))
  );
}
