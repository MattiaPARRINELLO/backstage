import { z } from "zod";

/**
 * Schéma de données du module.
 *
 * Le fichier reste `data/accreditations.json`, le chemin historique, déclaré
 * comme `legacyPath` au store. `looseObject` conserve les champs qu'une version
 * antérieure aurait laissés : les supprimer à la première écriture serait une
 * perte de données silencieuse.
 */
export const accreditationStatusSchema = z.enum([
  "pending",
  "sent",
  "accepted",
  "refused",
  "follow-up",
]);

export const accreditationSchema = z.looseObject({
  id: z.string().min(1),
  artist: z.string(),
  venue: z.string(),
  concertDate: z.string(),
  status: accreditationStatusSchema,
  emailThreadId: z.string().optional(),
  contactEmail: z.string().optional(),
  notes: z.string().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
  // Relance J+7 : date calculée quand la demande part, marque d'envoi pour ne
  // jamais relancer deux fois, et texte prêt à envoyer (l'envoi reste manuel
  // tant que #142 n'existe pas).
  followUpAt: z.string().optional(),
  followUpNotifiedAt: z.string().optional(),
  followUpDraft: z.string().optional(),
});

export const accreditationsDataSchema = z.looseObject({
  accreditations: z.array(accreditationSchema),
});

export type AccreditationStatus = z.infer<typeof accreditationStatusSchema>;
export type Accreditation = z.infer<typeof accreditationSchema>;
export type AccreditationsData = z.infer<typeof accreditationsDataSchema>;

/** Valeur par défaut, clonée par le store à chaque lecture. */
export const emptyAccreditations: AccreditationsData = { accreditations: [] };
