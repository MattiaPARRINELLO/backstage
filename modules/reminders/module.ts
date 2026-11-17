import { defineModule } from "@backstage/module-kit";

import { addReminderTool, listRemindersTool, updateReminderTool } from "./tools";

/**
 * Module Rappels.
 *
 * Phase 3 de #84 : strangler. Le module existe, ses outils sont enregistrés,
 * mais l'application continue d'utiliser `app/actions/reminders.ts` et
 * `lib/storage/reminders.ts`. La bascule est la phase 4.
 */
export default defineModule({
  id: "reminders",
  apiVersion: 1,
  version: "1.0.0",
  label: "Rappels",
  selectionDescription: "Rappels datés : créer, lister, modifier.",
  description:
    "Rappels avec échéance, récurrence et synchronisation Microsoft To Do, " +
    "relus après écriture pour ne jamais annoncer un enregistrement qui n'a pas eu lieu.",
  dependencies: [],
  capabilities: {
    env: ["MICROSOFT_CLIENT_ID", "MICROSOFT_CLIENT_SECRET"],
    filesystem: "module-data",
  },
  tools: [addReminderTool, listRemindersTool, updateReminderTool],
  events: {
    emits: ["reminder.created", "reminder.updated"],
    listens: [],
  },
});
