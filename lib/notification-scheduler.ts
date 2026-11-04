import { getReminders, getCourses, getCoursesStartingSoon, courseNotifKey } from "./storage";
import { getSubscriptions, type StoredPushSubscription } from "./push-subscriptions";
import { getConfig } from "./config";
import { configureVapid, getVapidDetails, sendPushNotification } from "./send-push";
import { serverLog } from "./logger";
import { markdownToText } from "./utils";
import { sendFcmToAll, type FcmPayload } from "./fcm";
import type { DailyBrief } from "./types";

let schedulerStarted = false;
let reminderInterval: ReturnType<typeof setInterval> | null = null;
let dailyBriefTimeout: ReturnType<typeof setTimeout> | null = null;
let dailyBriefInterval: ReturnType<typeof setInterval> | null = null;

const REMINDER_INTERVAL_MS = 60_000;
const DAILY_BRIEF_HOUR = 7;
const NOTIFIED_FILE = "notified-reminders.json";

// Focus mode actif : les notifications sont mises en silence. Les rappels et
// relances restent en attente et seront envoyés après la fin de la session.
async function isFocusActive(): Promise<boolean> {
  try {
    const { getFocusState } = await import("./focus");
    const state = await getFocusState();
    if (!state.active || !state.endsAt) return false;
    return new Date(state.endsAt).getTime() > Date.now();
  } catch {
    return false;
  }
}

async function getNotifiedReminders(): Promise<Set<string>> {
  try {
    const { readJsonSafe } = await import("./storage");
    const data = await readJsonSafe<{ ids: string[] }>(NOTIFIED_FILE, { ids: [] });
    return new Set(data.ids);
  } catch {
    return new Set();
  }
}

async function markReminderNotified(id: string): Promise<void> {
  try {
    const { mutateJson } = await import("./storage-core");
    await mutateJson<{ ids: string[] }>(NOTIFIED_FILE, { ids: [] }, (data) => {
      if (data.ids.includes(id)) return null; // déjà notifié → pas d'écriture
      data.ids.push(id);
    });
  } catch (err) {
    void serverLog("scheduler", "error", "Erreur persistance notification", err);
  }
}

const COURSE_LEAD_MIN = 30;

// Notifications « live » (Android 16) : une carte promue reste épinglée jusqu'à
// sa fin prévue. On garde donc l'échéance pour envoyer nous-mêmes la fermeture.
//
// Cycle d'un cours : postée à −30 min (« Cours dans 30 min »), elle est fermée
// dès que le cours commence — une fois la séance entamée, elle n'apprend plus
// rien. Le fichier ne sert qu'à savoir quoi fermer et à ne pas re-poster.
const LIVE_NOTIFS_FILE = "live-notifs.json";

interface LiveNotif {
  tag: string;
  subject: string;
  place: string;
  start: number;
}

async function readLiveNotifs(): Promise<LiveNotif[]> {
  const { readJsonSafe } = await import("./storage");
  const data = await readJsonSafe<{ items: LiveNotif[] }>(LIVE_NOTIFS_FILE, { items: [] });
  return data.items ?? [];
}

async function writeLiveNotifs(mutator: (items: LiveNotif[]) => void): Promise<void> {
  const { mutateJson } = await import("./storage-core");
  await mutateJson<{ items: LiveNotif[] }>(LIVE_NOTIFS_FILE, { items: [] }, (data) => {
    mutator(data.items);
  });
}

function clock(ms: number): string {
  return new Date(ms).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}

/** Payload de la carte « cours dans N min ». */
function coursePayload(course: LiveNotif): string {
  const start = clock(course.start);
  const remainingMin = Math.max(0, Math.round((course.start - Date.now()) / 60_000));

  return JSON.stringify({
    title: `Cours dans ${remainingMin} min : ${course.subject}`,
    body: [start, course.place].filter(Boolean).join(" — "),
    icon: "/icons/icon-192.png",
    badge: "/icons/icon-192.png",
    tag: course.tag,
    data: { type: "course", url: "/schedule" },
    requireInteraction: true,
    renotify: true,
    silent: false,
    timestamp: Date.now(),
    vibrate: [300, 150, 300, 150, 300],
    // APK Android : carte promue (Live Update), fermée au début du cours.
    promoted: true,
    criticalText: `Début ${start}`.slice(0, 28),
    progress: Math.max(0, COURSE_LEAD_MIN - remainingMin),
    progressMax: COURSE_LEAD_MIN,
  });
}

// Le brief du jour est déclenché à la fois par le scheduler interne (7h) et par
// le cron cPanel : sans cette garde, chaque appel renvoyait un DM et un push.
const NOTIFIED_BRIEFS_FILE = "notified-briefs.json";
const BRIEF_HISTORY_DAYS = 7;

async function isBriefAlreadySent(date: string): Promise<boolean> {
  try {
    const { readJsonSafe } = await import("./storage");
    const data = await readJsonSafe<{ briefs: { date: string; at: string }[] }>(
      NOTIFIED_BRIEFS_FILE,
      { briefs: [] }
    );
    return data.briefs.some((b) => b.date === date);
  } catch {
    return false;
  }
}

async function markBriefSent(date: string): Promise<void> {
  try {
    const { mutateJson } = await import("./storage-core");
    const oldest = new Date(Date.now() - BRIEF_HISTORY_DAYS * 86_400_000).toISOString().slice(0, 10);
    await mutateJson<{ briefs: { date: string; at: string }[] }>(
      NOTIFIED_BRIEFS_FILE,
      { briefs: [] },
      (data) => {
        if (data.briefs.some((b) => b.date === date)) return null; // déjà marqué
        data.briefs = data.briefs.filter((b) => b.date >= oldest);
        data.briefs.push({ date, at: new Date().toISOString() });
      }
    );
  } catch (err) {
    void serverLog("scheduler", "error", "Erreur persistance brief notifie", err);
  }
}

/** Cartes de cours : postées à −30 min, fermées dès que le cours commence. */
export async function checkScheduleNotifs(): Promise<void> {
  try {
    const now = Date.now();
    const courses = await getCourses();
    const tracked = await readLiveNotifs();
    const trackedTags = new Set(tracked.map((i) => i.tag));

    // 1. Cours commencés (ou oubliés) : fermeture, même en mode focus — une
    //    carte périmée ne doit pas rester dans la barre d'état.
    const started = tracked.filter((i) => now >= i.start);
    for (const item of started) {
      await sendPushToAll(
        JSON.stringify({
          title: "BACKSTAGE",
          body: "",
          tag: item.tag,
          data: { type: "live", url: "/schedule" },
          dismiss: true,
        })
      );
    }
    if (started.length > 0) {
      const startedTags = new Set(started.map((i) => i.tag));
      await writeLiveNotifs((items) => {
        for (let i = items.length - 1; i >= 0; i--) {
          if (startedTags.has(items[i].tag)) items.splice(i, 1);
        }
      });
    }

    if (await isFocusActive()) return;
    if (!courses.length) return;

    // 2. Cours à venir dans la fenêtre : une seule carte par séance.
    const upcoming = getCoursesStartingSoon(courses, COURSE_LEAD_MIN, now);
    for (const c of upcoming) {
      const tag = `course-${courseNotifKey(c, COURSE_LEAD_MIN)}`;
      if (trackedTags.has(tag)) continue;

      const item: LiveNotif = {
        tag,
        subject: c.subject,
        place: [c.room, c.teacher].filter(Boolean).join(" — "),
        start: c.start,
      };

      const { sent } = await sendPushToAll(coursePayload(item));
      if (!sent) continue;

      trackedTags.add(tag);
      await writeLiveNotifs((items) => {
        items.push(item);
      });
      const { logActivity } = await import("./storage");
      await logActivity(
        "course_notified",
        `Cours à venir : ${c.subject}`,
        `${clock(c.start)} — ${c.room ?? ""}`
      );
    }
  } catch (err) {
    void serverLog("scheduler", "error", "checkScheduleNotifs failed", err);
  }
}

/** Sync EDT CESAR si périmé (> 6 h, 0 séance, ou dernier sync en échec). Non bloquant. */
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

export async function sendPushToAll(
  payload: string
): Promise<{ sent: boolean; devices: number }> {
  // Deux canaux pour la même notification : web push (PWA installée) et FCM
  // (APK Android). Les deux partent du même JSON, chacun ignore les champs
  // qu'il ne comprend pas.
  const native = await sendFcmToAll(toFcmPayload(payload));

  const subs = await getSubscriptions();
  let webSent = false;
  if (subs.length > 0) {
    const vapidDetails = configureVapid();
    if (!vapidDetails.publicKey || !vapidDetails.privateKey) {
      void serverLog("scheduler", "error", "VAPID keys missing");
    } else {
      console.log(`[scheduler] Envoi push à ${subs.length} appareil(s)...`);

      const results = await Promise.allSettled(
        subs.map(async (sub: StoredPushSubscription) => {
          try {
            await sendPushNotification(sub.endpoint, sub.keys, payload);
            console.log(`[scheduler] Push OK → ${sub.endpoint.slice(0, 50)}...`);
            return true;
          } catch (err: unknown) {
            const e = err as { statusCode?: number; body?: string };
            void serverLog("scheduler", "error", `Push ÉCHEC ${e.statusCode || ""} → ${sub.endpoint.slice(0, 50)}...`, undefined, true);
            if (e.statusCode === 410 || e.statusCode === 404 || e.statusCode === 401) {
              const { removeSubscription } = await import("./push-subscriptions");
              await removeSubscription(sub.endpoint);
              console.log(`[scheduler] Souscription invalide supprimée: ${sub.endpoint.slice(0, 50)}...`);
            }
            return false;
          }
        })
      );

      webSent = results.some((r) => r.status === "fulfilled" && r.value === true);

      const failed = results.filter((r) => r.status === "fulfilled" && r.value === false).length;
      if (failed > 0) {
        console.warn(`[scheduler] ${failed}/${subs.length} push notifications failed`);
      } else {
        console.log(`[scheduler] ${subs.length}/${subs.length} push envoyés avec succès`);
      }
    }
  }

  return { sent: webSent || native.sent, devices: subs.length + native.devices };
}

/** Traduit le JSON web push en message natif (data-only côté APK). */
function toFcmPayload(raw: string): FcmPayload {
  let parsed: {
    title?: string;
    body?: string;
    tag?: string;
    promoted?: boolean;
    criticalText?: string;
    progress?: number;
    progressMax?: number;
    dismiss?: boolean;
    data?: { type?: string; url?: string };
  };
  try {
    parsed = JSON.parse(raw);
  } catch {
    parsed = { body: raw };
  }
  const data = parsed.data ?? {};
  return {
    title: parsed.title ?? "BACKSTAGE",
    body: (parsed.body ?? "").slice(0, 400),
    tag: parsed.tag,
    type: data.type,
    url: data.url,
    promoted: parsed.promoted === true,
    criticalText: parsed.criticalText,
    progress: parsed.progress,
    progressMax: parsed.progressMax,
    dismiss: parsed.dismiss === true,
  };
}

export async function checkReminders() {
  try {
    if (await isFocusActive()) return; // silence pendant le focus
    const data = await getReminders();
    const now = Date.now();
    const pending = data.reminders.filter(
      (r) => r.status === "pending" && new Date(r.dueAt).getTime() <= now + 60_000
    );

    const notifiedReminders = await getNotifiedReminders();

    // Purge les IDs de rappels qui n'existent plus (supprimés ou terminés)
    const allReminderIds = new Set(data.reminders.map((r) => r.id));
    const purged = [...notifiedReminders].filter((id) => !allReminderIds.has(id));
    if (purged.length > 0) {
      for (const id of purged) notifiedReminders.delete(id);
      const { writeJsonAtomic } = await import("./storage");
      await writeJsonAtomic(NOTIFIED_FILE, { ids: [...notifiedReminders] });
    }

    for (const r of pending) {
      if (notifiedReminders.has(r.id)) continue;

      const payload = JSON.stringify({
        title: r.title,
        body: r.notes || "Rappel",
        icon: "/icons/icon-192.png",
        badge: "/icons/icon-192.png",
        tag: "reminder-" + r.id,
        data: { type: "reminder", reminderId: r.id, url: "/reminders", recurrence: r.recurrence },
        requireInteraction: true,
        renotify: true,
        silent: false,
        timestamp: Date.now(),
        actions: [
          { action: "done", title: "✓ Fait" },
          { action: "snooze", title: "⏰ +15 min" },
        ],
        vibrate: [300, 150, 300, 150, 300],
      });

      // On marque le rappel notifié SEULEMENT si l'envoi a réussi : sinon il
      // sera retenté au prochain tick au lieu d'être perdu.
      const { sent } = await sendPushToAll(payload);
      if (sent) {
        notifiedReminders.add(r.id);
        await markReminderNotified(r.id);
      }
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

      // Marquée faite UNIQUEMENT si l'envoi a réussi, sinon retentée au tick suivant.
      const { sent } = await sendPushToAll(payload);
      if (sent) {
        await resolveIntention(it.id, "done");
      }
    }
  } catch (err) {
    void serverLog("scheduler", "error", "checkIntentions failed", err);
  }
}

export async function triggerDailyBrief(
  source: "cron" | "page-test" | "interne" = "interne",
  ip?: string
): Promise<
  { sent: boolean; devices: number } | { skipped: string }
> {
  try {
    const config = await getConfig();
    if (!config.features.dailyBrief) return { skipped: "dailyBrief desactive" };

    const { readJsonSafe } = await import("./storage");
    const data = await readJsonSafe<{ briefs: DailyBrief[] }>("daily-briefs.json", { briefs: [] });
    const today = new Date().toISOString().slice(0, 10);
    let todayBrief = data.briefs.find((b) => b.date === today);

    if (!todayBrief) {
      console.log("[scheduler] Pas de brief pour aujourd'hui, génération automatique...");
      const { generateDailyBrief } = await import("./daily-brief");
      const summary = await generateDailyBrief();
      if (!summary) {
        console.log("[scheduler] Échec génération brief");
        return { skipped: "generation impossible" };
      }
      const updated = await readJsonSafe<{ briefs: DailyBrief[] }>("daily-briefs.json", { briefs: [] });
      todayBrief = updated.briefs.find((b) => b.date === today);
      if (!todayBrief) {
        console.log("[scheduler] Brief généré mais introuvable après sauvegarde");
        return { skipped: "brief introuvable apres sauvegarde" };
      }
    }

    const briefBody = markdownToText(todayBrief.summary);
    const payload = JSON.stringify({
      title: "Brief du jour",
      body: briefBody.slice(0, 180) + (briefBody.length > 180 ? "…" : ""),
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      tag: "daily-brief",
      data: { type: "daily-brief", url: "/notif/daily-brief" },
      requireInteraction: true,
      renotify: true,
      silent: false,
      timestamp: Date.now(),
      vibrate: [300, 150, 300],
    });

    // Un seul envoi par jour : le cron cPanel et le scheduler interne peuvent
    // tomber sur la meme minute. La source "page-test" reste un envoi manuel
    // volontaire, donc toujours autorise.
    if (source !== "page-test" && (await isBriefAlreadySent(today))) {
      return { skipped: "brief deja envoye aujourd'hui" };
    }

    const result = await sendPushToAll(payload);
    if (result.sent) {
      await markBriefSent(today);
    }
    const { logActivity } = await import("./storage");
    await logActivity(
      "daily_brief_sent",
      result.sent ? "Brief du jour envoyé" : "Brief du jour : envoi échoué",
      `${result.devices} appareil(s) ciblé(s) [${source}]${ip ? ` depuis ${ip}` : ""}`
    );
    return result;
  } catch (err) {
    void serverLog("scheduler", "error", "triggerDailyBrief failed", err);
    return { skipped: "erreur interne" };
  }
}

function startDailyBrief() {
  const now = new Date();
  const target = new Date(now.getFullYear(), now.getMonth(), now.getDate(), DAILY_BRIEF_HOUR, 0, 0);
  if (now.getTime() >= target.getTime()) {
    target.setDate(target.getDate() + 1);
  }

  const msUntilTarget = target.getTime() - now.getTime();
  dailyBriefTimeout = setTimeout(() => {
    triggerDailyBrief();
    dailyBriefInterval = setInterval(() => {
      const h = new Date().getHours();
      if (h === DAILY_BRIEF_HOUR) triggerDailyBrief();
    }, 3_600_000);
  }, msUntilTarget);
}

export function startScheduler() {
  if (schedulerStarted) return;
  schedulerStarted = true;

  const vapidDetails = getVapidDetails();
  const vapidReady = Boolean(vapidDetails.publicKey && vapidDetails.privateKey);
  if (!vapidReady) {
    // Ne pas couper le scheduler : les notifications natives (APK Android)
    // n'ont pas besoin de VAPID, seule la PWA en dépend.
    console.warn("[scheduler] VAPID absent : web push desactive, notifications natives conservees");
  }

  checkReminders();
  checkIntentions();
  checkScheduleNotifs();
  syncScheduleIfStale();
  reminderInterval = setInterval(() => {
    checkReminders();
    checkIntentions();
    checkScheduleNotifs();
    syncScheduleIfStale();
  }, REMINDER_INTERVAL_MS);

  startDailyBrief();

  console.log("[scheduler] Started — reminders every 60s, daily brief at", DAILY_BRIEF_HOUR + "h");
}

export function stopScheduler() {
  if (reminderInterval) {
    clearInterval(reminderInterval);
    reminderInterval = null;
  }
  if (dailyBriefTimeout) {
    clearTimeout(dailyBriefTimeout);
    dailyBriefTimeout = null;
  }
  if (dailyBriefInterval) {
    clearInterval(dailyBriefInterval);
    dailyBriefInterval = null;
  }
  schedulerStarted = false;
  console.log("[scheduler] Stopped");
}
