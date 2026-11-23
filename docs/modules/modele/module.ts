import { defineModule, railIcon } from "@backstage/module-kit";

import { createNoteAction, listNotesAction } from "./actions";
import { addNoteTool } from "./tools";
import NotesPage from "./ui/page";

const noteIcon = railIcon(
  '<path d="M4 4a2 2 0 0 1 2-2h9l5 5v13a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z" /><path d="M14 2v6h6" />'
);

/**
 * Manifeste du module. `module:add` importe ce fichier : il doit exister a la
 * racine du depot, exporter `defineModule` par defaut, et ne rien executer
 * d'autre au chargement.
 */
export default defineModule({
  id: "demo-notes",
  apiVersion: 1,
  version: "0.1.0",
  label: "Notes de demo",
  selectionDescription: "Ajouter et lire des notes en texte libre.",
  description:
    "Module d'exemple : un outil d'ecriture verifiee, une action de lecture, une page et un store JSON.",
  capabilities: { filesystem: "module-data" },
  tools: [addNoteTool],
  actions: {
    list: listNotesAction,
    create: createNoteAction,
  },
  ui: {
    page: NotesPage,
    rail: { label: "Notes", icon: noteIcon },
  },
});
