"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/session";
import { createPairCode, listDevices, removeDevice } from "@/lib/fcm-devices";
import { isFcmConfigured } from "@/lib/fcm";

const PAIR_SCHEME = "backstage://pair";

/**
 * Appairage de l'APK Android aux notifications natives.
 *
 * Le code renvoyé est à usage unique et expire en 10 minutes. Le lien
 * `backstage://pair?code=…` ouvre l'APK installé, qui échange le code contre un
 * secret d'appareil (cf. `app/api/push/fcm/pair`).
 */
export async function createAndroidPairLink(): Promise<{
  code: string;
  deepLink: string;
  expiresAt: string;
}> {
  await requireSession();

  const configured = await isFcmConfigured();
  if (!configured) {
    throw new Error(
      "Envoi natif non configure : ajoute data/firebase-service-account.json"
    );
  }

  const { code, expiresAt } = await createPairCode();
  return { code, deepLink: `${PAIR_SCHEME}?code=${code}`, expiresAt };
}

export async function loadAndroidDevices(): Promise<{
  count: number;
  lastSeenAt: string | null;
}> {
  await requireSession();
  const devices = await listDevices();
  const lastSeenAt = devices
    .map((d) => d.lastSeenAt)
    .sort()
    .at(-1) ?? null;
  return { count: devices.length, lastSeenAt };
}

export async function forgetAndroidDevice(token: string): Promise<void> {
  await requireSession();
  if (!token || typeof token !== "string") {
    throw new Error("Jeton requis");
  }
  await removeDevice(token);
  revalidatePath("/settings");
}
