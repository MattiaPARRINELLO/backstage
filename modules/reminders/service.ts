import { addReminder, computeNextRecurrence, getReminders, updateReminder } from "@/lib/storage";
import { dismissReminderCard } from "@/lib/notification-scheduler";
import { pushReminderUpdateToMicrosoft } from "@/lib/reminder-sync";

/**
 * Règles métier des rappels, hors transport.
 *
 * Les Server Actions et les Route Handlers recouvrent volontairement les mêmes
 * opérations (clients React et clients natifs). Ce service porte la règle une
 * seule fois ; les deux transports ne font plus que traduire une requête.
 */

export interface RecurResult {
  readonly ok: boolean;
  readonly nextDue?: string;
  /** Motif d'échec, tel quel dans la réponse HTTP. */
  readonly reason?: string;
}

/**
 * Crée le rappel suivant d'une série récurrente.
 *
 * La règle reste celle de l'application : le rappel d'origine garde son statut,
 * un nouveau rappel est ajouté à la prochaine échéance. Sans récurrence, rien
 * n'est créé et l'appelant reçoit `ok: false`.
 */
export async function recurReminder(id: string): Promise<RecurResult> {
  const data = await getReminders();
  const reminder = data.reminders.find((item) => item.id === id);
  if (!reminder) {
    return { ok: false, reason: "Rappel introuvable" };
  }

  const nextDue = computeNextRecurrence(reminder.dueAt, reminder.recurrence);
  if (!nextDue) {
    return { ok: false, reason: "Pas de récurrence" };
  }

  await addReminder({
    title: reminder.title,
    notes: reminder.notes,
    dueAt: nextDue,
    recurrence: reminder.recurrence,
  });

  return { ok: true, nextDue };
}

/**
 * Marque un rappel « fait ».
 *
 * Reproduit le comportement de l'action `mark_status` : propagation vers
 * Microsoft To Do, puis la carte de notification disparaît. Sans la
 * propagation, le statut local et la tâche Microsoft divergent.
 */
export async function completeReminder(id: string): Promise<boolean> {
  const reminder = await updateReminder(id, {
    status: "done",
    notifiedAt: new Date().toISOString(),
  });
  if (!reminder) return false;
  await pushReminderUpdateToMicrosoft(reminder);
  await dismissReminderCard(id);
  return true;
}

/**
 * Reporte un rappel de quinze minutes par défaut.
 *
 * La route d'origine ne propageait pas vers Microsoft To Do et ne revalidait
 * pas : le comportement est conservé tel quel, pour ne pas changer la
 * synchronisation dans une PR de déplacement de code.
 */
export async function snoozeReminder(id: string, minutes = 15): Promise<boolean> {
  const dueAt = new Date(Date.now() + minutes * 60_000).toISOString();
  const reminder = await updateReminder(id, { dueAt, status: "snoozed" });
  if (!reminder) return false;
  await dismissReminderCard(id);
  return true;
}

/** Rappels en attente dont l'échéance est atteinte (avec une minute de marge). */
export function pendingReminders<T extends { status: string; dueAt: string }>(
  data: { reminders: readonly T[] },
  now: number = Date.now()
): T[] {
  return data.reminders.filter(
    (reminder) =>
      reminder.status === "pending" &&
      new Date(reminder.dueAt).getTime() <= now + 60_000
  );
}

/** Lecture des rappels en attente, pour la route pollée par le service worker. */
export async function listPendingReminders(now: number = Date.now()) {
  return pendingReminders(await getReminders(), now);
}
