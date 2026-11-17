import { z } from "zod";
import { defineTool, toolError, toolOk, verifyWrite } from "@backstage/module-kit";
import { newId } from "@backstage/module-kit/storage-core";

import { reminderRecurrenceSchema, reminderStatusSchema, type Reminder } from "./schema";
import { remindersStore } from "./store";

function formatDue(reminder: Reminder): string {
  return new Date(reminder.dueAt).toLocaleString("fr-FR");
}

/**
 * Outils du module, déclarés avec leur effet et leur fiabilité.
 *
 * Les textes reprennent ceux du dispatch actuel : la phase 3 doit changer la
 * source de l'outil, pas le comportement vu par l'utilisateur.
 */
export const addReminderTool = defineTool({
  name: "add",
  description:
    "Cree un rappel avec une date d'echeance. Repond avec l'identifiant du rappel cree.",
  params: z.object({
    title: z.string().trim().min(1),
    notes: z.string().trim().optional(),
    due_at: z.string().min(1),
    recurrence: reminderRecurrenceSchema.optional(),
  }),
  sideEffect: "write",
  describeAction: (args) => `Creer le rappel « ${args.title} » pour le ${args.due_at}`,
  run: async (args) => {
    const due = new Date(args.due_at);
    if (Number.isNaN(due.getTime())) {
      return toolError("Erreur : due_at doit etre une date ISO 8601 valide.");
    }
    const now = new Date().toISOString();
    const reminder: Reminder = {
      id: newId(),
      title: args.title,
      notes: args.notes || undefined,
      dueAt: args.due_at,
      status: "pending",
      createdAt: now,
      updatedAt: now,
      recurrence: args.recurrence,
    };

    const written = await remindersStore.mutate((data) => {
      data.reminders.unshift(reminder);
    });
    if (!written) return toolError("Erreur : le rappel n'a pas ete enregistre.");

    // Relecture : sans elle, un echec silencieux du stockage serait annonce
    // comme un succes au modele.
    const problem = await verifyWrite(`le rappel "${reminder.title}"`, async () => {
      const after = await remindersStore.read();
      return after.reminders.some((item) => item.id === reminder.id);
    });
    if (problem) return toolError(problem);

    return toolOk(
      `Rappel cree : "${reminder.title}" pour le ${formatDue(reminder)} (id: ${reminder.id}).`
    );
  },
});

export const listRemindersTool = defineTool({
  name: "list",
  description: "Liste les rappels existants avec leur identifiant, leur titre et leur echeance.",
  params: z.object({
    status: reminderStatusSchema.optional(),
  }),
  sideEffect: "read",
  run: async (args) => {
    const data = await remindersStore.read();
    const reminders = args.status
      ? data.reminders.filter((reminder) => reminder.status === args.status)
      : data.reminders;
    if (reminders.length === 0) {
      return toolOk("Aucun rappel pour le moment.");
    }
    return toolOk(
      reminders
        .map(
          (reminder) =>
            `- [${reminder.id}] "${reminder.title}" -> ${formatDue(reminder)} (${reminder.status})`
        )
        .join("\n")
    );
  },
});

export const updateReminderTool = defineTool({
  name: "update",
  description:
    "Modifie un rappel existant : titre, notes, echeance, statut ou recurrence. Utilise l'outil list pour trouver l'identifiant.",
  params: z.object({
    id: z.string().min(1),
    title: z.string().trim().min(1).optional(),
    notes: z.string().optional(),
    due_at: z.string().optional(),
    status: reminderStatusSchema.optional(),
    recurrence: reminderRecurrenceSchema.optional(),
  }),
  sideEffect: "write",
  describeAction: (args) => `Modifier le rappel ${args.id}`,
  run: async (args) => {
    if (args.due_at !== undefined) {
      const due = new Date(args.due_at);
      if (Number.isNaN(due.getTime())) {
        return toolError("Erreur : due_at doit etre une date ISO 8601 valide.");
      }
    }

    let updated: Reminder | undefined;
    await remindersStore.mutate((data) => {
      const index = data.reminders.findIndex((reminder) => reminder.id === args.id);
      if (index < 0) return null;
      const current = data.reminders[index] as Reminder;
      const next: Reminder = {
        ...current,
        ...(args.title !== undefined ? { title: args.title } : {}),
        ...(args.notes !== undefined ? { notes: args.notes } : {}),
        ...(args.due_at !== undefined ? { dueAt: args.due_at } : {}),
        ...(args.status !== undefined ? { status: args.status } : {}),
        ...(args.recurrence !== undefined ? { recurrence: args.recurrence } : {}),
        updatedAt: new Date().toISOString(),
      };
      data.reminders[index] = next;
      updated = next;
    });

    if (!updated) return toolError("Rappel introuvable.");

    const problem = await verifyWrite(`le rappel "${updated.title}"`, async () => {
      const after = await remindersStore.read();
      return after.reminders.some((item) => item.id === args.id);
    });
    if (problem) return toolError(problem);

    return toolOk(
      `Rappel modifie : "${updated.title}" -> ${formatDue(updated)} (${updated.status}).`
    );
  },
});
