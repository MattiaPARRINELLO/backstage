import { defineModule } from "@backstage/module-kit";

import { replyEmailTool, searchEmailsTool, triageEmailsTool } from "./tools";

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
  selectionDescription: "Lire, trier et répondre aux emails Gmail.",
  description:
    "Gmail : recherche dans les messages reçus et envoyés, tri par priorité, réponse envoyée après confirmation explicite.",
  dependencies: [],
  capabilities: { network: ["gmail.googleapis.com"], filesystem: "module-data" },
  tools: [searchEmailsTool, triageEmailsTool, replyEmailTool],
});
