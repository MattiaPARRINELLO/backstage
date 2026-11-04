import { readFile } from "node:fs/promises";
import path from "node:path";
import { GoogleAuth } from "google-auth-library";
import { listDevices, removeDevice, touchDevice } from "./fcm-devices";
import { serverLog } from "./logger";

/**
 * Envoi de notifications natives Android via FCM HTTP v1.
 *
 * Pourquoi HTTP v1 à la main plutôt que `firebase-admin` : l'authentification
 * passe par `google-auth-library`, déjà présent (OAuth Google), et on évite une
 * dépendance lourde pour un seul endpoint. Le compte de service est le même que
 * celui de l'ancien canal Discord : `data/firebase-service-account.json`.
 *
 * Les messages sont **data-only** : Android n'affiche rien tout seul, c'est
 * l'APK qui construit la notification (canal, persistance, Live Update).
 */

const SERVICE_ACCOUNT_FILE = "firebase-service-account.json";
const FCM_SCOPE = "https://www.googleapis.com/auth/firebase.messaging";

export interface FcmPayload {
  title: string;
  body: string;
  tag?: string;
  type?: string;
  url?: string;
  /** Notification épinglée / Live Update Android 16. */
  promoted?: boolean;
  /** Texte court affiché dans la puce de la barre d'état (API 36). */
  criticalText?: string;
  progress?: number;
  progressMax?: number;
  /** Demande la fermeture d'une notification déjà affichée (même `tag`). */
  dismiss?: boolean;
}

interface ServiceAccount {
  project_id: string;
}

let cachedAuth: { auth: GoogleAuth; projectId: string } | null = null;
let serviceAccountMissing = false;

function serviceAccountPath(): string {
  return path.join(process.cwd(), "data", SERVICE_ACCOUNT_FILE);
}

async function getAuth(): Promise<{ auth: GoogleAuth; projectId: string } | null> {
  if (cachedAuth) return cachedAuth;
  if (serviceAccountMissing) return null;

  try {
    const raw = await readFile(serviceAccountPath(), "utf8");
    const credentials = JSON.parse(raw) as ServiceAccount;
    if (!credentials.project_id) {
      void serverLog("fcm", "error", "compte de service sans project_id");
      serviceAccountMissing = true;
      return null;
    }
    const auth = new GoogleAuth({ credentials, scopes: [FCM_SCOPE] });
    cachedAuth = { auth, projectId: credentials.project_id };
    return cachedAuth;
  } catch {
    // Absence normale d'un déploiement sans APK : on loggue une fois, sans
    // casser les rappels web push.
    console.warn("[fcm] data/firebase-service-account.json absent : notifications natives desactivees");
    serviceAccountMissing = true;
    return null;
  }
}

/** Vrai si l'envoi natif est configuré (compte de service présent). */
export async function isFcmConfigured(): Promise<boolean> {
  return (await getAuth()) !== null;
}

function toStringMap(payload: FcmPayload): Record<string, string> {
  const data: Record<string, string> = {
    title: payload.title,
    body: payload.body,
  };
  if (payload.tag) data.tag = payload.tag;
  if (payload.type) data.type = payload.type;
  if (payload.url) data.url = payload.url;
  if (payload.promoted) data.promoted = "1";
  if (payload.criticalText) data.criticalText = payload.criticalText;
  if (typeof payload.progress === "number") data.progress = String(payload.progress);
  if (typeof payload.progressMax === "number") data.progressMax = String(payload.progressMax);
  if (payload.dismiss) data.dismiss = "1";
  return data;
}

interface FcmErrorBody {
  error?: { status?: string; details?: { errorCode?: string }[] };
}

export async function sendFcmToAll(
  payload: FcmPayload
): Promise<{ sent: boolean; devices: number }> {
  try {
    return await sendFcmUnsafe(payload);
  } catch (err) {
    // Une panne FCM ne doit jamais empêcher le web push : le scheduler
    // enchaîne les deux canaux, et un échec natif ne doit pas perdre le rappel.
    void serverLog("fcm", "error", "envoi natif interrompu", err, true);
    return { sent: false, devices: 0 };
  }
}

async function sendFcmUnsafe(
  payload: FcmPayload
): Promise<{ sent: boolean; devices: number }> {
  const deviceList = await listDevices();
  if (deviceList.length === 0) return { sent: false, devices: 0 };

  const config = await getAuth();
  if (!config) return { sent: false, devices: deviceList.length };

  let accessToken: string | undefined;
  try {
    const client = await config.auth.getClient();
    accessToken = (await client.getAccessToken()).token ?? undefined;
  } catch (err) {
    void serverLog("fcm", "error", "authentification FCM impossible", err);
    return { sent: false, devices: deviceList.length };
  }
  if (!accessToken) return { sent: false, devices: deviceList.length };

  const data = toStringMap(payload);
  const endpoint = `https://fcm.googleapis.com/v1/projects/${config.projectId}/messages:send`;

  let sent = 0;
  await Promise.all(
    deviceList.map(async (device) => {
      try {
        const res = await fetch(endpoint, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            message: {
              token: device.token,
              data,
              android: {
                priority: "HIGH",
                ttl: "3600s",
              },
            },
          }),
        });

        if (res.ok) {
          sent += 1;
          await touchDevice(device.token);
          return;
        }

        const body = (await res.json().catch(() => ({}))) as FcmErrorBody;
        const code = body.error?.details?.find((d) => d.errorCode)?.errorCode;
        // Jeton mort (app réinstallée, données effacées) : on purge, sinon
        // l'échec se répète à chaque notification.
        if (code === "UNREGISTERED" || res.status === 404) {
          await removeDevice(device.token);
          console.log("[fcm] jeton obsolète supprimé");
        } else {
          void serverLog("fcm", "error", `envoi refuse (${res.status} ${code ?? body.error?.status ?? ""})`);
        }
      } catch (err) {
        void serverLog("fcm", "error", "envoi FCM échoué", err, true);
      }
    })
  );

  return { sent: sent > 0, devices: deviceList.length };
}
