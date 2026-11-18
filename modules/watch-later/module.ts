import { defineModule } from "@backstage/module-kit";

import { addWatchLaterTool } from "./tools";

/**
 * Module À voir plus tard.
 *
 * Troisième module migré, sans modification du noyau. Seul l'outil est migré
 * ici : les Server Actions de la page restent dans le noyau jusqu'à leur
 * migration, comme pour l'emploi du temps.
 */
export default defineModule({
  id: "watch-later",
  apiVersion: 1,
  version: "1.0.0",
  label: "À voir plus tard",
  selectionDescription: "Garder un lien (article, vidéo, photo, musique) pour plus tard.",
  description:
    "Liste de liens à conserver : articles, vidéos, photos et musiques, avec catégorie et résumé automatique.",
  dependencies: [],
  capabilities: { filesystem: "module-data" },
  tools: [addWatchLaterTool],
});
