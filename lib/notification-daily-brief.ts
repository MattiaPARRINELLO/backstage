import { getConfig } from "./app-config";
import { sendPushToAll } from "./push-dispatch";
import { serverLog } from "./logger";
import { markdownToText } from "./utils";
import type { DailyBrief } from "./types";

// Le brief du jour est declenche a la fois par le scheduler interne (7h) et par
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
        if (data.briefs.some((b) => b.date === date)) return null; // deja marque
        data.briefs = data.briefs.filter((b) => b.date >= oldest);
        data.briefs.push({ date, at: new Date().toISOString() });
      }
    );
  } catch (err) {
    void serverLog("scheduler", "error", "Erreur persistance brief notifie", err);
  }
}

// Le cron cPanel et le scheduler interne tombent sur la meme minute a 7h :
// sans serialisation, les deux lancaient une generation et deux briefs du
// meme jour partaient chez le provider (constate en production). Les appels
// sont donc chaines ; le second relit le brief ecrit par le premier.
let briefTriggerQueue: Promise<unknown> = Promise.resolve();

export type DailyBriefSource = "cron" | "page-test" | "interne";

export function triggerDailyBrief(
  source: DailyBriefSource = "interne",
  ip?: string
): Promise<{ sent: boolean; devices: number } | { skipped: string }> {
  const run = briefTriggerQueue.then(() => runDailyBriefTrigger(source, ip));
  briefTriggerQueue = run.catch(() => undefined);
  return run;
}

async function runDailyBriefTrigger(
  source: DailyBriefSource,
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
      console.log("[scheduler] Pas de brief pour aujourd'hui, generation automatique...");
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
