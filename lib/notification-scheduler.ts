import { getVapidDetails } from "./send-push";
import { createJobRunner, type JobRunner } from "./kernel/job-runner";
import type { RegisteredJob } from "./kernel/registry-core";

// Orchestration : le scheduler ne connait aucun nom de job. Il verifie VAPID
// (pour le web push), recoit les jobs du registre et laisse le runner
// selectionner ceux qui sont dus a chaque minute. Les fonctions publiques
// restent reexportees ici pour que les appelants (instrumentation, modules
// rappels) n'aient qu'un point d'entree a connaitre.

let schedulerStarted = false;
let runner: JobRunner | null = null;

export function startScheduler(jobs: readonly RegisteredJob[]) {
  if (schedulerStarted) return;
  schedulerStarted = true;

  const vapidDetails = getVapidDetails();
  const vapidReady = Boolean(vapidDetails.publicKey && vapidDetails.privateKey);
  if (!vapidReady) {
    // Ne pas couper le scheduler : les notifications natives (APK Android)
    // n'ont pas besoin de VAPID, seule la PWA en depend.
    console.warn("[scheduler] VAPID absent : web push desactive, notifications natives conservees");
  }

  runner = createJobRunner({ jobs });
  runner.start();
  console.log(`[scheduler] Started: ${jobs.length} job(s) du registre, tick 60s`);
}

export function stopScheduler() {
  runner?.stop();
  runner = null;
  schedulerStarted = false;
  console.log("[scheduler] Stopped");
}

export { checkScheduleNotifs, syncScheduleIfStale } from "./notification-schedule";
export { checkReminders, checkIntentions } from "./notification-reminders";
export { triggerDailyBrief } from "./notification-daily-brief";
export { dismissLiveCard, dismissReminderCard } from "./notification-live-cards";
