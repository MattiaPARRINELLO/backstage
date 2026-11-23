import { jsonStore } from "@backstage/module-kit/json-store";

import { accreditationsDataSchema, emptyAccreditations } from "./schema";

/**
 * Store du module.
 *
 * `legacyPath` : les données vivent encore dans `data/accreditations.json`, le
 * fichier historique. Le module lit et écrit exactement ce fichier : aucune
 * migration, aucune perte pour une installation existante.
 */
export const accreditationsStore = jsonStore({
  moduleId: "accreditations",
  file: "accreditations.json",
  legacyPath: "accreditations.json",
  schema: accreditationsDataSchema,
  fallback: emptyAccreditations,
});
