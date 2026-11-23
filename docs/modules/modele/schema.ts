import { z } from "zod";

/** Une note : identifiant stable, texte, date de creation ISO. */
export const noteSchema = z.object({
  id: z.string().min(1),
  text: z.string().min(1),
  createdAt: z.string().min(1),
});

export const notesDataSchema = z.object({
  notes: z.array(noteSchema),
});

/** Reponse de l'action `list`, validee cote page avant affichage. */
export const notesSchema = z.array(noteSchema);

export type Note = z.infer<typeof noteSchema>;
export type NotesData = z.infer<typeof notesDataSchema>;
