import { jsonStore } from "@backstage/module-kit/json-store";

import { emptyWatchLater, watchLaterDataSchema } from "./schema";

/**
 * Store du module.
 *
 * `legacyPath` : les donnees vivent encore dans `data/watch-later.json`, le
 * fichier historique. Le module lit et ecrit exactement ce fichier : aucune
 * migration, aucune perte pour une installation existante.
 */
export const watchLaterStore = jsonStore({
  moduleId: "watch-later",
  file: "watch-later.json",
  legacyPath: "watch-later.json",
  schema: watchLaterDataSchema,
  fallback: emptyWatchLater,
});
