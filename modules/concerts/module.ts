import { defineModule } from "@backstage/module-kit";

import { listConcertsTool, prepareConcertTool } from "./tools";

/**
 * Module Concerts.
 *
 * Huitieme module migre. La lecture et la preparation restent dans
 * `lib/storage/concerts.ts` jusqu'a la migration complete du domaine (la meteo
 * y vit encore, cf. charte SRP).
 */
export default defineModule({
  id: "concerts",
  apiVersion: 1,
  version: "1.0.0",
  label: "Concerts",
  selectionDescription: "Lister les concerts suivis et préparer un terrain.",
  description:
    "Concerts suivis (shootés, sélection, montage, livrés) et préparation terrain : météo, infos salle, checklist photo.",
  dependencies: [],
  capabilities: {
    network: ["api.openweathermap.org"],
    env: ["OPENWEATHERMAP_API_KEY"],
    filesystem: "module-data",
  },
  tools: [listConcertsTool, prepareConcertTool],
});
