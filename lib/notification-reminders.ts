import { getReminders } from "./storage";
import { sendPushToAll } from "./push-dispatch";
import { serverLog } from "./logger";
import { isFocusActive } from "./notification-focus";
import { REMINDER_GRACE_MIN, REMINDER_LEAD_MIN } from "./notification-lead-times";
import {
  readLiveCards,
  writeLiveCards,
  dismissLiveCard,
  type LiveCard,
} from "./notification-live-cards";
import { reminderPayload, remainingMinutes } from "./notification-payloads";

export async function checkReminders() {
  try {
    const data = await getReminders();
    const now = Date.now();
    const pending = data.reminders.filter((r) => {
      if (r.status !== "pending") return false;
      const due = new Date(r.dueAt).getTime();
      return (
        due <= now + REMINDER_LEAD_MIN * 60_000 && due >= now - REMINDER_GRACE_MIN * 60_000
      );
    });

    const tracked = await readLiveCards();
    const reminderCards = tracked.filter((c) => c.kind === "reminder");

    // 1. Cartes orphelines : le rappel a ete fait, supprime ou reporte sans
    //    passer par l'action (sync Microsoft, autre client, cron).
    const pendingIds = new Set(
      data.reminders.filter((r) => r.status === "pending").map((r) => r.id)
    );
    for (const card of reminderCards) {
      if (!card.refId || !pendingIds.has(card.refId)) {
        await dismissLiveCard(card.tag, "/reminders");
      }
    }

    if (await isFocusActive()) return; // silence pendant le focus

    for (const r of pending) {
      const tag = `reminder-${r.id}`;
      const card: LiveCard & { id: string; notes?: string; recurrence?: string } = {
        tag,
        kind: "reminder",
        refId: r.id,
        subject: r.title,
        place: r.notes ?? "",
        at: new Date(r.dueAt).getTime(),
        id: r.id,
        notes: r.notes,
        recurrence: r.recurrence,
      };
      const sentMin = remainingMinutes(card.at, now);
      const existing = reminderCards.find((c) => c.tag === tag);

      // Carte deja affichee : « rappel dans N min » doit decroitre pour de bon.
      if (existing) {
        if (existing.sentMin === sentMin) continue;
        const { sent } = await sendPushToAll(reminderPayload(card, true), { quiet: true });
        if (!sent) continue;
        await writeLiveCards((items) => {
          const trackedCard = items.find((i) => i.tag === tag);
          if (trackedCard) trackedCard.sentMin = sentMin;
        });
        continue;
      }

      // On n'enregistre la carte que si l'envoi a reussi : sinon elle sera
      // retentee au prochain tick au lieu d'etre perdue.
      const { sent } = await sendPushToAll(reminderPayload(card));
      if (!sent) continue;

      await writeLiveCards((items) => {
        items.push({
          tag,
          kind: "reminder",
          refId: r.id,
          subject: r.title,
          place: r.notes ?? "",
          at: card.at,
          sentMin,
        });
      });
    }
  } catch (err) {
    void serverLog("scheduler", "error", "checkReminders failed", err);
  }
}

export async function checkIntentions() {
  try {
    if (await isFocusActive()) return; // silence pendant le focus
    const { listPendingIntentions, resolveIntention } = await import("./storage");
    const now = Date.now();
    const due = (await listPendingIntentions()).filter(
      (i) => new Date(i.dueAt).getTime() <= now + 60_000
    );

    for (const it of due) {
      const payload = JSON.stringify({
        title: `Relance : ${it.subject}`,
        body: it.message || `Tu voulais relancer sur « ${it.subject} ».`,
        icon: "/icons/icon-192.png",
        badge: "/icons/icon-192.png",
        tag: "intention-" + it.id,
        data: { type: "intention", intentionId: it.id, url: "/chat" },
        requireInteraction: true,
        renotify: true,
        silent: false,
        timestamp: Date.now(),
        vibrate: [300, 150, 300, 150, 300],
      });

      // Marquee faite UNIQUEMENT si l'envoi a reussi, sinon retentee au tick suivant.
      const { sent } = await sendPushToAll(payload);
      if (sent) {
        await resolveIntention(it.id, "done");
      }
    }
  } catch (err) {
    void serverLog("scheduler", "error", "checkIntentions failed", err);
  }
}
