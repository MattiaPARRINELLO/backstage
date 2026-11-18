import { defineModule } from "@backstage/module-kit";

import { scheduleFollowupTool } from "./tools";

/**
 * Module Relances.
 *
 * Septieme module migre. L'ecriture verifiee par relecture remplace le `case`
 * du dispatcher ; la notification de relance reste dans le noyau
 * (`lib/notification-scheduler.ts`).
 */
export default defineModule({
  id: "followups",
  apiVersion: 1,
  version: "1.0.0",
  label: "Relances",
  selectionDescription:
    "Programmer une relance et recevoir une notification à l'échéance.",
  description:
    "Relances datées : l'application envoie une notification push à l'échéance pour revenir sur un sujet.",
  dependencies: [],
  capabilities: { filesystem: "module-data" },
  tools: [scheduleFollowupTool],
});
