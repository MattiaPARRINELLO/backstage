import { z } from "zod";

/**
 * Schémas de données des rappels.
 *
 * `looseObject` : les champs inconnus sont conservés. Une version antérieure ou
 * un autre écrivain (réconciliation Microsoft To Do) peut avoir laissé des
 * champs que ce module ne connaît pas encore ; les supprimer à la première
 * écriture serait une perte de données silencieuse.
 */
export const reminderStatusSchema = z.enum(["pending", "done", "snoozed"]);
export const reminderRecurrenceSchema = z.enum(["daily", "weekly", "monthly"]);

export const reminderSchema = z.looseObject({
  id: z.string().min(1),
  title: z.string(),
  notes: z.string().optional(),
  dueAt: z.string().min(1),
  status: reminderStatusSchema,
  createdAt: z.string(),
  // Les anciennes donnees peuvent porter `null` : le type de sortie reste
  // `string | undefined`, celui que l'interface attend.
  notifiedAt: z
    .string()
    .nullish()
    .transform((value) => value ?? undefined)
    .optional(),
  recurrence: reminderRecurrenceSchema.optional(),
  microsoftTaskId: z.string().optional(),
  microsoftListId: z.string().optional(),
  updatedAt: z.string().optional(),
});

export const remindersDataSchema = z.looseObject({
  reminders: z.array(reminderSchema),
});

export type Reminder = z.infer<typeof reminderSchema>;
export type RemindersData = z.infer<typeof remindersDataSchema>;

export const emptyReminders: RemindersData = { reminders: [] };
