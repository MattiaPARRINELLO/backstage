import { jsonStore } from "@backstage/module-kit/json-store";

import { notesDataSchema } from "./schema";

/**
 * Store du module. Le fichier vit dans `data/demo-notes/notes.json` : le kit
 * namespacce par identifiant de module et valide le schema en lecture comme en
 * ecriture.
 */
export const notesStore = jsonStore({
  moduleId: "demo-notes",
  file: "notes.json",
  schema: notesDataSchema,
  fallback: { notes: [] },
});
