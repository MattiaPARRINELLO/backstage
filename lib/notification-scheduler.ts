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
/** Délai d'annonce des rappels et des cours (même règle : 1 h avant). */
const REMINDER_LEAD_MIN = 60;
/**
 * Fenêtre de rattrapage après l'échéance : couvre un redémarrage ou une coupure
 * du serveur, sans ressusciter les rappels oubliés depuis des semaines (un
 * rappel encore `pending` de l'an dernier ne doit pas surgir aujourd'hui).
 */
const REMINDER_GRACE_MIN = 6 * 60;

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

const COURSE_LEAD_MIN = 60;

// Cartes « live » (Android 16) : une notification promue reste épinglée jusqu'à
// sa fin prévue, donc on tient un registre de ce qui est affiché pour savoir
// quoi fermer et ne pas re-poster.
//
// - cours : postée 1 h avant, rafraîchie chaque minute, fermée au démarrage de
//   la séance ;
// - rappel : postée 1 h avant l'échéance, rafraîchie chaque minute, fermée
//   quand le rappel est fait, supprimé, ou reporté.
const LIVE_NOTIFS_FILE = "live-notifs.json";

interface LiveCard {
  tag: string;
  kind: "course" | "reminder";
  /** id du rappel, pour pouvoir le fermer quand il change d'état. */
  refId?: string;
  subject: string;
  /** Salle du cours (ou notes du rappel). */
  place: string;
  /** Enseignant, affiché dans le corps de la carte de cours. */
  teacher?: string;
  /** Salle seule, pour la puce de la barre d'état. */
  room?: string;
  /** Démarrage du cours ou échéance du rappel. */
  at: number;
  /**
   * Minutes restantes au moment du dernier envoi : sert à ne rafraîchir la
   * carte que quand le compte à rebours (ou la barre de progression) change.
   */
  sentMin?: number;
  /** Tentatives de fermeture déjà effectuées (voir `dismissLiveCard`). */
  dismissTries?: number;
}

/**
 * Nombre de ticks (1 min) pendant lesquels on réessaie de fermer une carte
 * dont la consigne de fermeture n'a atteint aucun appareil. Au-delà, on cède :
 * un téléphone resté hors ligne des jours ne doit pas faire tourner la boucle.
 */
const MAX_DISMISS_TRIES = 5;

async function readLiveCards(): Promise<LiveCard[]> {
  const { readJsonSafe } = await import("./storage");
  const data = await readJsonSafe<{ items: Partial<LiveCard>[] }>(LIVE_NOTIFS_FILE, { items: [] });
  // `start` était le nom du champ avant la généralisation aux rappels.
  return (data.items ?? []).map((item) => ({
    tag: item.tag ?? "",
    kind: item.kind ?? "course",
    refId: item.refId,
    subject: item.subject ?? "",
    place: item.place ?? "",
    teacher: item.teacher,
    room: item.room,
    at: item.at ?? (item as { start?: number }).start ?? 0,
    sentMin: item.sentMin,
    dismissTries: item.dismissTries,
  }));
}

async function writeLiveCards(mutator: (items: LiveCard[]) => void): Promise<void> {
  const { mutateJson } = await import("./storage-core");
  await mutateJson<{ items: LiveCard[] }>(LIVE_NOTIFS_FILE, { items: [] }, (data) => {
    mutator(data.items);
  });
}

function clock(ms: number): string {
  return new Date(ms).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}

/** Ferme une carte déjà affichée, sur les deux canaux. */
export async function dismissLiveCard(tag: string, url: string): Promise<void> {
  const { sent, devices } = await sendPushToAll(
    JSON.stringify({
      title: "BACKSTAGE",
      body: "",
      tag,
      data: { type: "live", url },
      dismiss: true,
    })
  );
  await writeLiveCards((items) => {
    const index = items.findIndex((i) => i.tag === tag);
    if (index < 0) return;
    // La consigne n'est pas arrivée alors qu'un appareil est censé l'écouter
    // (réseau, appareil éteint) : on garde la carte pour la retenter au tick
    // suivant. Sinon elle restait affichée pour toujours, plus personne ne
    // connaissant son `tag`.
    if (!sent && devices > 0) {
      const card = items[index];
      card.dismissTries = (card.dismissTries ?? 0) + 1;
      if (card.dismissTries < MAX_DISMISS_TRIES) return;
    }
    items.splice(index, 1);
  });
}

/** Ferme la carte d'un rappel (fait, supprimé, reporté). */
export async function dismissReminderCard(reminderId: string): Promise<void> {
  try {
    await dismissLiveCard(`reminder-${reminderId}`, "/reminders");
  } catch (err) {
    void serverLog("scheduler", "error", "dismissReminderCard failed", err);
  }
}

/** Minutes restantes (arrondies) avant une échéance. */
function remainingMinutes(at: number, now = Date.now()): number {
  return Math.max(0, Math.round((at - now) / 60_000));
}

/** Payload de la carte « cours » : la salle passe en titre, l'heure en corps. */
function coursePayload(course: LiveCard, update = false): string {
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
    // Rafraîchissement : même `tag`, remplacement silencieux (pas de son).
    renotify: !update,
    silent: update,
    timestamp: Date.now(),
    vibrate: update ? [] : [300, 150, 300, 150, 300],
    // APK Android : carte promue (Live Update), fermée au début du cours.
    promoted: true,
    criticalText: (room || "Cours").slice(0, 28),
    progress: Math.max(0, COURSE_LEAD_MIN - remainingMin),
    progressMax: COURSE_LEAD_MIN,
  });
}

/** Payload de la carte « rappel dans N min » (mêmes règles que les cours). */
function reminderPayload(
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
    // `reminderId` et `recurrence` sont consommés par le service worker (actions
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
    // APK Android : carte promue, fermée quand le rappel est traité.
    promoted: true,
    criticalText: due.slice(0, 28),
    progress: Math.max(0, REMINDER_LEAD_MIN - remainingMin),
    progressMax: REMINDER_LEAD_MIN,
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

/** Cartes de cours : postées 1 h avant, mises à jour chaque minute, fermées au début. */
export async function checkScheduleNotifs(): Promise<void> {
  try {
    const now = Date.now();
    const courses = await getCourses();
    const tracked = await readLiveCards();
    const courseCards = tracked.filter((i) => i.kind === "course");

    // 1. Cours commencés (ou oubliés) : fermeture, même en mode focus — une
    //    carte périmée ne doit pas rester dans la barre d'état.
    for (const item of courseCards.filter((i) => now >= i.at)) {
      await dismissLiveCard(item.tag, "/schedule");
    }

    if (await isFocusActive()) return;
    if (!courses.length) return;

    // 2. Cours à venir dans la fenêtre : une seule carte par séance.
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

      // Carte déjà affichée : la barre de progression doit suivre l'heure
      // réelle. On la remplace silencieusement quand le compte change, sinon
      // elle reste figée sur « 60 min » jusqu'au début du cours.
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
  payload: string,
  options: { quiet?: boolean } = {}
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
      if (!options.quiet) console.log(`[scheduler] Envoi push à ${subs.length} appareil(s)...`);

      const results = await Promise.allSettled(
        subs.map(async (sub: StoredPushSubscription) => {
          try {
            await sendPushNotification(sub.endpoint, sub.keys, payload);
            if (!options.quiet) console.log(`[scheduler] Push OK → ${sub.endpoint.slice(0, 50)}...`);
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
      } else if (!options.quiet) {
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

    // 1. Cartes orphelines : le rappel a été fait, supprimé ou reporté sans
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

      // Carte déjà affichée : « rappel dans N min » doit décroître pour de bon.
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

      // On n'enregistre la carte que si l'envoi a réussi : sinon elle sera
      // retentée au prochain tick au lieu d'être perdue.
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

// Le cron cPanel et le scheduler interne tombent sur la meme minute a 7h :
// sans serialisation, les deux lancaient une generation et deux briefs du
// meme jour partaient chez le provider (constate en production). Les appels
// sont donc chaines ; le second relit le brief ecrit par le premier.
let briefTriggerQueue: Promise<unknown> = Promise.resolve();

export function triggerDailyBrief(
  source: "cron" | "page-test" | "interne" = "interne",
  ip?: string
): Promise<{ sent: boolean; devices: number } | { skipped: string }> {
  const run = briefTriggerQueue.then(() => runDailyBriefTrigger(source, ip));
  briefTriggerQueue = run.catch(() => undefined);
  return run;
}

async function runDailyBriefTrigger(
  source: "cron" | "page-test" | "interne",
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
