import { defineModule } from "@backstage/module-kit";

import { replyEmailTool, searchEmailsTool, sendEmailTool, triageEmailsTool } from "./tools";

/**
 * Module Emails.
 *
 * Dixieme module migre. La reponse est le seul outil du depot qui exige une
 * confirmation permanente ; les lectures restent non fiables.
 */
export default defineModule({
  id: "emails",
  apiVersion: 1,
  version: "1.0.0",
  label: "Emails",
  selectionDescription: "Lire, trier, répondre et composer des emails Gmail.",
  description:
    "Gmail : recherche dans les messages reçus et envoyés, tri par priorité, réponse et composition envoyées après confirmation explicite.",
  dependencies: [],
  capabilities: { network: ["gmail.googleapis.com"], filesystem: "module-data" },
  tools: [searchEmailsTool, triageEmailsTool, replyEmailTool, sendEmailTool],
});
