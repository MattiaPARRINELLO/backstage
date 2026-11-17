import { addReminder, computeNextRecurrence, getReminders } from "@/lib/storage";

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
