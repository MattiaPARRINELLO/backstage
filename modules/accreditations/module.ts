import { defineModule } from "@backstage/module-kit";

import { scanAccreditationsTool } from "./tools";

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
});
