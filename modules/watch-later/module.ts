import { defineModule } from "@backstage/module-kit";

import {
  createWatchLaterAction,
  editWatchLaterAction,
  loadWatchLaterAction,
  removeWatchLaterAction,
  reorderWatchLaterAction,
  summarizeWatchLaterAction,
} from "./actions";
import { addWatchLaterTool } from "./tools";
import WatchLaterPage from "./ui/page";

/**
 * Module À voir plus tard.
 *
 * Troisième module migré, sans modification du noyau. Il porte désormais son
 * outil, ses actions et sa page : la route `/m/watch-later` est fournie par le
 * noyau via le slot `page` du contrat (ADR 0001, décision G).
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
  actions: {
    load: loadWatchLaterAction,
    create: createWatchLaterAction,
    summarize: summarizeWatchLaterAction,
    edit: editWatchLaterAction,
    remove: removeWatchLaterAction,
    reorder: reorderWatchLaterAction,
  },
  ui: { page: WatchLaterPage },
});
