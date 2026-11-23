import { defineAction } from "@backstage/module-kit";
import { z } from "zod";

import { notesSchema } from "./schema";
import { notesStore } from "./store";

/**
 * Actions appelees par la page via `useModuleAction`. Le noyau porte la
 * session, la validation Zod, le journal d'activite et la revalidation.
 */
export const listNotesAction = defineAction({
  name: "list",
  input: z.object({}),
  run: async () => {
    const { notes } = await notesStore.read();
    return notesSchema.parse(notes);
  },
});

export const createNoteAction = defineAction({
  name: "create",
  input: z.object({ text: z.string().trim().min(1) }),
  revalidate: ["/m/demo-notes"],
  run: async (input) => {
    const note = {
      id: crypto.randomUUID(),
      text: input.text,
      createdAt: new Date().toISOString(),
    };
    await notesStore.mutate((data) => {
      data.notes.push(note);
    });
    return note;
  },
});
