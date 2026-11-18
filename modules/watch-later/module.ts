import { defineModule, railIcon } from "@backstage/module-kit";

import {
  createWatchLaterAction,
  editWatchLaterAction,
  loadWatchLaterAction,
  removeWatchLaterAction,
  reorderWatchLaterAction,
  summarizeWatchLaterAction,
} from "./actions";
import { addWatchLaterTool } from "./tools";
import { WatchLaterPanel } from "./ui/Panel";
import WatchLaterPage from "./ui/page";

const bookmarkIcon = railIcon(
  '<path d="M17 3a2 2 0 0 1 2 2v15a1 1 0 0 1-1.496.868l-4.512-2.578a2 2 0 0 0-1.984 0l-4.512 2.578A1 1 0 0 1 5 20V5a2 2 0 0 1 2-2z" />'
);

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
  ui: {
    page: WatchLaterPage,
    rail: { label: "À voir", icon: bookmarkIcon },
    panel: WatchLaterPanel,
  },
});
