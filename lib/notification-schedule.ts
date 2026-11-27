import { getCourses, getCoursesStartingSoon, courseNotifKey } from "./storage";
import { sendPushToAll } from "./push-dispatch";
import { serverLog } from "./logger";
import { isFocusActive } from "./notification-focus";
import { COURSE_LEAD_MIN } from "./notification-lead-times";
import {
  readLiveCards,
  writeLiveCards,
  dismissLiveCard,
  type LiveCard,
} from "./notification-live-cards";
import { clock, coursePayload, remainingMinutes } from "./notification-payloads";

/** Cartes de cours : postees 1 h avant, mises a jour chaque minute, fermees au debut. */
let scheduleCheck: Promise<void> | null = null;

// Le cron cPanel et le scheduler interne appellent tous les deux ce controle
// chaque minute. Sans verrou, les deux lisaient le registre avant que l'autre
// n'ecrive et postaient la meme carte deux fois ; l'un des deux envois pouvait
// aussi consommer le quota avant l'autre.
export function checkScheduleNotifs(): Promise<void> {
  if (scheduleCheck) return scheduleCheck;
  scheduleCheck = runScheduleCheck().finally(() => {
    scheduleCheck = null;
  });
  return scheduleCheck;
}

async function runScheduleCheck(): Promise<void> {
  try {
    const now = Date.now();
    const courses = await getCourses();
    const tracked = await readLiveCards();
    const courseCards = tracked.filter((i) => i.kind === "course");

    // 1. Cours commences (ou oublies) : fermeture, meme en mode focus : une
    //    carte perimee ne doit pas rester dans la barre d'etat.
    for (const item of courseCards.filter((i) => now >= i.at)) {
      await dismissLiveCard(item.tag, "/schedule");
    }

    if (await isFocusActive()) return;
    if (!courses.length) return;

    // 2. Cours a venir dans la fenetre : une seule carte par seance.
    const upcoming = getCoursesStartingSoon(courses, COURSE_LEAD_MIN, now);
    for (const c of upcoming) {
      const tag = `course-${courseNotifKey(c, COURSE_LEAD_MIN)}`;
      const room = c.room?.trim() ?? "";
      const item: LiveCard = {
        tag,
        kind: "course",
        subject: c.subject,
        place: room,
        room,
        teacher: c.teacher,
        at: c.start,
      };
      const sentMin = remainingMinutes(item.at, now);
      const existing = courseCards.find((i) => i.tag === tag);

      // Carte deja affichee : la barre de progression doit suivre l'heure
      // reelle. On la remplace silencieusement quand le compte change, sinon
      // elle reste figee sur « 60 min » jusqu'au debut du cours.
      if (existing) {
        if (existing.sentMin === sentMin) continue;
        const { sent } = await sendPushToAll(coursePayload(item, true), { quiet: true });
        if (!sent) continue;
        await writeLiveCards((items) => {
          const card = items.find((i) => i.tag === tag);
          if (card) card.sentMin = sentMin;
        });
        continue;
      }

      const { sent } = await sendPushToAll(coursePayload(item));
      if (!sent) continue;

      item.sentMin = sentMin;
      await writeLiveCards((items) => {
        items.push(item);
      });
      const { logActivity } = await import("./storage");
      await logActivity(
        "course_notified",
        `Cours à venir : ${c.subject}`,
        `${clock(c.start)} — ${room}`
      );
    }
  } catch (err) {
    void serverLog("scheduler", "error", "checkScheduleNotifs failed", err);
  }
}

/** Sync EDT CESAR si perime (> 6 h, 0 seance, ou dernier sync en echec). Non bloquant. */
export async function syncScheduleIfStale(): Promise<void> {
  try {
    const { isScheduleStale, syncSchedule } = await import("./storage");
    if (await isScheduleStale()) {
      await syncSchedule();
    }
  } catch (err) {
    void serverLog("scheduler", "error", "syncScheduleIfStale failed", err);
  }
}
