import { defineModule } from "@backstage/module-kit";

import { addPhotoShootTool, listPhotoShootsTool, updatePhotoShootTool } from "./tools";

/**
 * Module Photo (shootings).
 *
 * Separe des accreditations (autre fichier, autre ecran, autre cycle de vie).
 * Les lectures et ecritures restent dans `lib/storage/photo-shoots.ts`.
 */
export default defineModule({
  id: "photo",
  apiVersion: 1,
  version: "1.0.0",
  label: "Photo",
  selectionDescription: "Suivre les shootings photo : ajouter, mettre à jour, lister.",
  description:
    "Shootings photo avec statut (à venir, trié, retouché, exporté, envoyé), lien galerie et nombre de photos envoyées.",
  dependencies: [],
  capabilities: { filesystem: "module-data" },
  tools: [addPhotoShootTool, updatePhotoShootTool, listPhotoShootsTool],
});
