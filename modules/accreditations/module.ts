import { defineModule, railIcon } from "@backstage/module-kit";

import {
  createAccreditationAction,
  editAccreditationAction,
  loadAccreditationsAction,
  removeAccreditationAction,
  scanAccreditationsAction,
  updateAccreditationStatusAction,
} from "./actions";
import { scanAccreditationsTool } from "./tools";
import { accreditationsFollowUpPrompt } from "./prompt";
import AccreditationsPage from "./ui/page";
import { AccreditationsHomeCard } from "./ui/HomeCard";

const ticketIcon = railIcon(
  '<path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z" /><path d="M13 5v2" /><path d="M13 11v2" /><path d="M13 17v2" />'
);

/**
 * Module Accréditations.
 *
 * Séparé de Photo : autre fichier de données (`accreditations.json`), autre
 * écran, autre cycle de vie. La lecture Gmail est bornée par la recherche.
 */
export default defineModule({
  id: "accreditations",
  apiVersion: 1,
  version: "1.0.0",
  label: "Accréditations",
  selectionDescription:
    "Scanner les emails d'accréditation et mettre à jour les fiches.",
  description:
    "Demandes d'accréditation photo : artiste, lieu, date et statut, extraits des emails Gmail et conservés dans accreditations.json.",
  dependencies: [],
  capabilities: { network: ["gmail.googleapis.com"], filesystem: "module-data" },
  tools: [scanAccreditationsTool],
  prompt: [accreditationsFollowUpPrompt],
  actions: {
    load: loadAccreditationsAction,
    create: createAccreditationAction,
    edit: editAccreditationAction,
    updateStatus: updateAccreditationStatusAction,
    remove: removeAccreditationAction,
    scan: scanAccreditationsAction,
  },
  ui: {
    page: AccreditationsPage,
    rail: { label: "Accréditations", icon: ticketIcon },
    homeCard: AccreditationsHomeCard,
  },
  jobs: [
    {
      id: "accreditations-follow-up",
      cron: "0 * * * *",
      handler: async (ctx) => {
        const { runAccreditationFollowUpCheck } = await import("./followup-job");
        await runAccreditationFollowUpCheck(ctx);
      },
    },
  ],
});
