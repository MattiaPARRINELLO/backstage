import { defineAction } from "@backstage/module-kit";
import { z } from "zod";

import { dismissReminderCard } from "@/lib/notification-scheduler";
import {
  pushNewReminderToMicrosoft,
  pushReminderDeleteToMicrosoft,
  pushReminderUpdateToMicrosoft,
  reconcileRemindersWithMicrosoft,
} from "@/lib/reminder-sync";
import { addReminder, deleteReminder, getReminders, updateReminder } from "@/lib/storage";

import type { Reminder } from "@/lib/types";

import { reminderRecurrenceSchema, reminderStatusSchema } from "./schema";

const idSchema = z.string().min(1, "Identifiant requis");

// Message utilisateur explicite : le message par defaut de Zod est en anglais
// et parle de valeurs enumerees, pas d'un statut de rappel.
const statusInput = z.enum(["pending", "done", "snoozed"], {
  error: "Statut invalide",
});

const createInput = z.object({
  title: z.string().trim().min(1, "Titre requis"),
  notes: z.string().trim().optional(),
  dueAt: z
    .string()
    .min(1, "Date d'echeance requise")
    .refine((value) => !Number.isNaN(new Date(value).getTime()), "Date d'echeance invalide"),
  recurrence: reminderRecurrenceSchema.optional(),
});

const updateInput = z
  .object({
    id: idSchema,
    title: z.string().trim().min(1).optional(),
    notes: z.string().trim().optional(),
    dueAt: z.string().min(1).optional(),
    status: reminderStatusSchema.optional(),
    recurrence: reminderRecurrenceSchema.optional(),
  })
  .strict();

/**
 * Actions du module.
 *
 * La logique métier vit ici ; `app/actions/reminders.ts` ne garde qu'une
 * coquille de transport vers `kernelAction`. Les libellés d'activité et les
 * appels Microsoft To Do restent les mêmes qu'avant la bascule.
 */
export const loadRemindersAction = defineAction({
  name: "load",
  input: z.object({}),
  run: async () => {
    // Applique les changements faits côté Microsoft To Do avant de rendre.
    await reconcileRemindersWithMicrosoft();
    return getReminders();
  },
});

export const createReminderAction = defineAction({
  name: "create",
  input: createInput,
  revalidate: ["/reminders"],
  run: async (input, ctx) => {
    const reminder = await addReminder(input);
    await ctx.activity?.(
      "reminder_created",
      `Rappel créé : ${reminder.title}`,
      reminder.dueAt
    );
    // Crée la tâche équivalente dans Microsoft To Do (→ Samsung Reminder).
    return pushNewReminderToMicrosoft(reminder);
  },
});

export const updateReminderAction = defineAction({
  name: "update",
  input: updateInput,
  revalidate: ["/reminders"],
  run: async (input, ctx): Promise<Reminder | null> => {
    const { id, ...updates } = input;
    const reminder = await updateReminder(id, updates);
    if (reminder) {
      await ctx.activity?.(
        "reminder_updated",
        `Rappel modifié : ${reminder.title}`,
        reminder.status
      );
      // Propage la modification vers Microsoft To Do (titre, date, notes, statut).
      await pushReminderUpdateToMicrosoft(reminder);
    }
    return reminder;
  },
});

export const removeReminderAction = defineAction({
  name: "remove",
  input: z.object({ id: idSchema }),
  revalidate: ["/reminders"],
  run: async (input, ctx): Promise<boolean> => {
    // Supprime d'abord côté Microsoft To Do (si lié), puis localement.
    const data = await getReminders();
    const target = data.reminders.find((reminder) => reminder.id === input.id);
    if (target) await pushReminderDeleteToMicrosoft(target);

    const deleted = await deleteReminder(input.id);
    if (deleted) {
      await ctx.activity?.("reminder_deleted", "Rappel supprimé", input.id);
      // La carte de notification n'a plus de raison d'être.
      await dismissReminderCard(input.id);
    }
    return deleted;
  },
});

export const markReminderStatusAction = defineAction({
  name: "mark_status",
  input: z.object({ id: idSchema, status: statusInput }),
  revalidate: ["/reminders"],
  run: async (input): Promise<Reminder | null> => {
    const reminder = await updateReminder(input.id, { status: input.status });
    if (reminder) await pushReminderUpdateToMicrosoft(reminder);
    // Fait ou reporté : la carte disparaît (elle sera repostée si le rappel
    // revient en attente plus tard).
    if (reminder && input.status !== "pending") await dismissReminderCard(input.id);
    return reminder;
  },
});
