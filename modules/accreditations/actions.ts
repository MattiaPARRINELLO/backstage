import { defineAction } from "@backstage/module-kit";
import { z } from "zod";

import {
  addAccreditation,
  deleteAccreditation,
  getAccreditations,
  updateAccreditation,
} from "./service";
import { accreditationStatusSchema } from "./schema";

const idSchema = z.string().min(1, "Identifiant requis");

const emailSchema = z
  .string()
  .trim()
  .email("Email invalide")
  .optional()
  .or(z.literal(""));

const createInput = z.object({
  artist: z.string().trim().min(1, "Artiste requis"),
  venue: z.string().trim().min(1, "Lieu requis"),
  concertDate: z
    .string()
    .trim()
    .min(1, "Date du concert requise")
    .refine(
      (value) => !Number.isNaN(new Date(value).getTime()),
      "Date du concert invalide"
    ),
  contactEmail: emailSchema,
  notes: z.string().trim().optional(),
});

const editInput = z
  .object({
    id: idSchema,
    artist: z.string().trim().min(1, "Artiste requis").optional(),
    venue: z.string().trim().min(1, "Lieu requis").optional(),
    // Pas de validation de date : le scan peut avoir écrit « Date inconnue »,
    // et corriger l'artiste ne doit pas échouer à cause de ce champ.
    concertDate: z.string().trim().min(1).optional(),
    contactEmail: emailSchema,
    notes: z.string().trim().optional(),
  })
  .strict();

const updateStatusInput = z.object({
  id: idSchema,
  status: accreditationStatusSchema,
});

/**
 * Actions du module Accréditations.
 *
 * La logique et le stockage vivent dans le module ; le noyau porte la session,
 * la validation et la revalidation. Le journal d'activité passe par
 * `ctx.activity`, jamais par un import de `lib/storage`.
 */
export const loadAccreditationsAction = defineAction({
  name: "load",
  input: z.object({}),
  run: async () => getAccreditations(),
});

export const createAccreditationAction = defineAction({
  name: "create",
  input: createInput,
  revalidate: ["/m/accreditations"],
  run: async (input, ctx) => {
    const accreditation = await addAccreditation({
      artist: input.artist,
      venue: input.venue,
      concertDate: input.concertDate,
      contactEmail: input.contactEmail ? input.contactEmail : undefined,
      notes: input.notes,
    });
    await ctx.activity?.(
      "accreditation_created",
      `Accréditation : ${accreditation.artist} @ ${accreditation.venue}`,
      accreditation.concertDate
    );
    return accreditation;
  },
});

export const editAccreditationAction = defineAction({
  name: "edit",
  input: editInput,
  revalidate: ["/m/accreditations"],
  run: async ({ id, ...updates }, ctx) => {
    const accreditation = await updateAccreditation(id, {
      ...updates,
      contactEmail: updates.contactEmail ? updates.contactEmail : undefined,
    });
    if (accreditation) {
      await ctx.activity?.(
        "accreditation_updated",
        `Accréditation modifiée : ${accreditation.artist}`,
        accreditation.status
      );
    }
    return accreditation;
  },
});

export const updateAccreditationStatusAction = defineAction({
  name: "updateStatus",
  input: updateStatusInput,
  revalidate: ["/m/accreditations"],
  run: async ({ id, status }, ctx) => {
    const accreditation = await updateAccreditation(id, { status });
    if (accreditation) {
      await ctx.activity?.(
        "accreditation_updated",
        `Statut d'accréditation : ${accreditation.artist} → ${status}`,
        status
      );
    }
    return accreditation;
  },
});

export const removeAccreditationAction = defineAction({
  name: "remove",
  input: z.object({ id: idSchema }),
  revalidate: ["/m/accreditations"],
  run: async ({ id }, ctx) => {
    const deleted = await deleteAccreditation(id);
    if (deleted) {
      await ctx.activity?.("accreditation_deleted", "Accréditation supprimée", id);
    }
    return deleted;
  },
});
