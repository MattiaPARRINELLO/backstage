import { defineModule } from "@backstage/module-kit";

import {
  createReminderAction,
  loadRemindersAction,
  markReminderStatusAction,
  removeReminderAction,
  updateReminderAction,
} from "./actions";
import { addReminderTool, listRemindersTool, updateReminderTool } from "./tools";
import { upcomingRemindersPrompt } from "./prompt";

/**
 * Module Rappels.
 *
 * Le module porte ses outils et ses actions. `app/actions/reminders.ts` n'est
 * plus qu'un transport vers `kernelAction` ; le stockage reste dans le noyau
 * jusqu'à la phase 6, qui supprimera les fichiers historiques.
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
  prompt: [upcomingRemindersPrompt],
  actions: {
    load: loadRemindersAction,
    create: createReminderAction,
    update: updateReminderAction,
    remove: removeReminderAction,
    markStatus: markReminderStatusAction,
  },
  events: {
    emits: ["reminder.created", "reminder.updated"],
    listens: [],
  },
});
