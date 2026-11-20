import { getSubscriptions, type StoredPushSubscription } from "./push-subscriptions";
import { configureVapid, sendPushNotification } from "./send-push";
import { serverLog } from "./logger";
import { sendFcmToAll, type FcmPayload } from "./fcm";

/** Envoie une notification sur les deux canaux : web push (PWA) et FCM (APK). */
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
