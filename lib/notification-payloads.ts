import type { LiveCard } from "./notification-live-cards";
import { COURSE_LEAD_MIN, REMINDER_LEAD_MIN } from "./notification-lead-times";

export function clock(ms: number): string {
  return new Date(ms).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}

/** Minutes restantes (arrondies) avant une echeance. */
export function remainingMinutes(at: number, now = Date.now()): number {
  return Math.max(0, Math.round((at - now) / 60_000));
}

/** Payload de la carte « cours » : la salle passe en titre, l'heure en corps. */
export function coursePayload(course: LiveCard, update = false): string {
  const start = clock(course.at);
  const remainingMin = remainingMinutes(course.at);
  const room = (course.room ?? "").trim();
  const title = room ? `${room} — ${course.subject}` : course.subject;

  return JSON.stringify({
    title,
    body: [`Début ${start}`, course.teacher].filter(Boolean).join(" — "),
    icon: "/icons/icon-192.png",
    badge: "/icons/icon-192.png",
    tag: course.tag,
    data: { type: "course", url: "/schedule" },
    requireInteraction: true,
    // Rafraichissement : meme `tag`, remplacement silencieux (pas de son).
    renotify: !update,
    silent: update,
    timestamp: Date.now(),
    vibrate: update ? [] : [300, 150, 300, 150, 300],
    // APK Android : carte promue (Live Update), fermee au debut du cours.
    promoted: true,
    criticalText: (room || "Cours").slice(0, 28),
    progress: Math.max(0, COURSE_LEAD_MIN - remainingMin),
    progressMax: COURSE_LEAD_MIN,
  });
}

/** Payload de la carte « rappel dans N min » (memes regles que les cours). */
export function reminderPayload(
  card: LiveCard & { id: string; notes?: string; recurrence?: string },
  update = false
): string {
  const due = clock(card.at);
  const remainingMin = remainingMinutes(card.at);
  const late = Date.now() > card.at;

  return JSON.stringify({
    title: late ? `Rappel : ${card.subject}` : `Rappel dans ${remainingMin} min : ${card.subject}`,
    body: [due, card.notes || card.place].filter(Boolean).join(" — ") || "Rappel",
    icon: "/icons/icon-192.png",
    badge: "/icons/icon-192.png",
    tag: card.tag,
    // `reminderId` et `recurrence` sont consommes par le service worker (actions
    // « Fait » / « +15 min ») ; l'APK les ignore et ouvre simplement /reminders.
    data: { type: "reminder", reminderId: card.id, url: "/reminders", recurrence: card.recurrence },
    requireInteraction: true,
    renotify: !update,
    silent: update,
    timestamp: Date.now(),
    actions: [
      { action: "done", title: "✓ Fait" },
      { action: "snooze", title: "⏰ +15 min" },
    ],
    vibrate: update ? [] : [300, 150, 300, 150, 300],
    // APK Android : carte promue, fermee quand le rappel est traite.
    promoted: true,
    criticalText: due.slice(0, 28),
    progress: Math.max(0, REMINDER_LEAD_MIN - remainingMin),
    progressMax: REMINDER_LEAD_MIN,
  });
}
