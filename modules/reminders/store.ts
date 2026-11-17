import { jsonStore } from "@backstage/module-kit/json-store";

import { emptyReminders, remindersDataSchema } from "./schema";

/**
 * Store du module.
 *
 * `legacyPath` : les données vivent encore dans `data/reminders.json`, le
 * fichier historique. La phase 3 de #84 ne déplace rien : le module lit et
 * écrit exactement le fichier que l'application utilisait avant lui.
 */
export const remindersStore = jsonStore({
  moduleId: "reminders",
  file: "reminders.json",
  legacyPath: "reminders.json",
  schema: remindersDataSchema,
  fallback: emptyReminders,
});
