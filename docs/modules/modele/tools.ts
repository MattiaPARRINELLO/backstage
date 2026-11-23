import {
  defineTool,
  toolError,
  toolOk,
  verifyWrite,
} from "@backstage/module-kit";
import { z } from "zod";

import type { Note } from "./schema";
import { notesStore } from "./store";

/**
 * Outil expose au modele : `demo-notes.add`.
 *
 * L'ecriture est relue avant d'etre annoncee. Un echec du stockage ne doit
 * jamais etre presente comme un succes au modele.
 */
export const addNoteTool = defineTool({
  name: "add",
  description: "Ajoute une note en texte libre.",
  params: z.object({ text: z.string().trim().min(1) }),
  sideEffect: "write",
  run: async (args, ctx) => {
    const note: Note = {
      id: crypto.randomUUID(),
      text: args.text,
      createdAt: new Date().toISOString(),
    };

    await notesStore.mutate((data) => {
      data.notes.push(note);
    });

    const failure = await verifyWrite("la note", async () => {
      const { notes } = await notesStore.read();
      return notes.some((stored) => stored.id === note.id);
    });
    if (failure) return toolError(failure);

    await ctx.activity?.("note_created", `Note ajoutee : ${note.text}`);
    return toolOk(`Note ajoutee : ${note.text}`);
  },
});
