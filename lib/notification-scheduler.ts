import { getVapidDetails } from "./send-push";
import { checkScheduleNotifs, syncScheduleIfStale } from "./notification-schedule";
import { checkReminders, checkIntentions } from "./notification-reminders";
import { triggerDailyBrief } from "./notification-daily-brief";

// Orchestration : le scheduler ne calcule rien lui-meme, il cadence les unites
// (cartes de cours, rappels et relances, brief du jour) et porte leur etat de
// demarrage. Les fonctions publiques restent reexportees ici pour que les
// appelants (instrumentation, routes cron, modules rappels) n'aient qu'un point
// d'entree a connaitre.

let schedulerStarted = false;
let reminderInterval: ReturnType<typeof setInterval> | null = null;
let dailyBriefTimeout: ReturnType<typeof setTimeout> | null = null;
let dailyBriefInterval: ReturnType<typeof setInterval> | null = null;

const REMINDER_INTERVAL_MS = 60_000;
const DAILY_BRIEF_HOUR = 7;

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
    // n'ont pas besoin de VAPID, seule la PWA en depend.
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

  console.log("[scheduler] Started: reminders every 60s, daily brief at", DAILY_BRIEF_HOUR + "h");
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

export { checkScheduleNotifs, syncScheduleIfStale, checkReminders, checkIntentions };
export { triggerDailyBrief };
export { dismissLiveCard, dismissReminderCard } from "./notification-live-cards";
