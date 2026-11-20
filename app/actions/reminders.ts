"use server";

import { AppError } from "@/lib/errors";
import { kernelAction } from "@/lib/kernel/actions";
import type { Reminder, RemindersData } from "@/lib/types";

/**
 * Transport des actions de rappels.
 *
 * Chaque export est une Server Action d'une ligne : Next exige des fonctions
 * `async` exportées statiquement. La session, la validation, la journalisation
 * et la revalidation sont portées par `kernelAction`, la logique métier par le
 * module. Ce fichier ne connaît plus ni Zod, ni `requireSession`.
 */

export async function loadReminders(): Promise<RemindersData> {
  return kernelAction<RemindersData>("reminders.load", {});
}

export async function createReminder(input: {
  title: string;
  notes?: string;
  dueAt: string;
  recurrence?: Reminder["recurrence"];
}): Promise<Reminder> {
  return kernelAction<Reminder>("reminders.create", input);
}

export async function editReminder(
  id: string,
  updates: Partial<Pick<Reminder, "title" | "notes" | "dueAt" | "status" | "recurrence">>
): Promise<Reminder | null> {
  if (!id || typeof id !== "string") throw new AppError("validation", "Identifiant requis");
  return kernelAction<Reminder | null>("reminders.update", { id, ...updates });
}

export async function removeReminder(id: string): Promise<boolean> {
  if (!id || typeof id !== "string") throw new AppError("validation", "Identifiant requis");
  return kernelAction<boolean>("reminders.remove", { id });
}

export async function markReminderStatus(
  id: string,
  status: Reminder["status"]
): Promise<Reminder | null> {
  if (!id || typeof id !== "string") throw new AppError("validation", "Identifiant requis");
  return kernelAction<Reminder | null>("reminders.mark_status", { id, status });
}
