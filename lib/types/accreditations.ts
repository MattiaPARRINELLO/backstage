/**
 * Réexport historique du domaine.
 *
 * La source de vérité est le schéma du module (`modules/accreditations/schema.ts`).
 * Ce fichier reste pour que `lib/types` et le noyau continuent de voir le type
 * sans dépendre de l'intérieur du module.
 */
export type {
  Accreditation,
  AccreditationStatus,
  AccreditationsData,
} from "@/modules/accreditations/schema";
