import { defineModule } from "@backstage/module-kit";

import {
  createCalendarEventTool,
  deleteCalendarEventTool,
  searchCalendarEventsTool,
  updateCalendarEventTool,
} from "./tools";

/**
 * Module Calendrier.
 *
 * Neuvieme module migre. Le client Google reste dans le noyau
 * (`lib/google-actions.ts`), avec ses tokens ; le module porte les quatre
 * outils et leurs regles d'effet.
 */
export default defineModule({
  id: "calendar",
  apiVersion: 1,
  version: "1.0.0",
  label: "Calendrier",
  selectionDescription: "Créer, modifier, supprimer et chercher des événements Google.",
  description:
    "Google Calendar : création, modification, suppression et recherche d'événements, avec couleur optionnelle.",
  dependencies: [],
  capabilities: { network: ["www.googleapis.com"], filesystem: "module-data" },
  tools: [
    createCalendarEventTool,
    updateCalendarEventTool,
    deleteCalendarEventTool,
    searchCalendarEventsTool,
  ],
});
