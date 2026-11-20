"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";

import { actionInput } from "@/lib/action";
import { AppError } from "@/lib/errors";
import { createPairCode, listDevices, removeDevice } from "@/lib/fcm-devices";
import { isFcmConfigured } from "@/lib/fcm";

const PAIR_SCHEME = "backstage://pair";
const emptyInput = z.object({});
const tokenInput = z.string().min(1, "Jeton requis");

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
  androidIntent: string;
  expiresAt: string;
}> {
  await actionInput(emptyInput, {});

  const configured = await isFcmConfigured();
  if (!configured) {
    throw new AppError(
      "external_unavailable",
      "Envoi natif non configure : ajoute data/firebase-service-account.json"
    );
  }

  const { code, expiresAt } = await createPairCode();
  return {
    code,
    deepLink: `${PAIR_SCHEME}?code=${code}`,
    // Chrome Android n'ouvre pas toujours un schéma inconnu depuis un lien
    // https ; la forme `intent://` est le chemin fiable vers l'app installée.
    androidIntent: buildAndroidIntent(code),
    expiresAt,
  };
}

function buildAndroidIntent(code: string): string {
  return (
    `intent://pair?code=${encodeURIComponent(code)}` +
    `#Intent;scheme=backstage;package=com.personalbrain.backstage;end`
  );
}

export async function loadAndroidDevices(): Promise<{
  count: number;
  lastSeenAt: string | null;
}> {
  await actionInput(emptyInput, {});
  const devices = await listDevices();
  const lastSeenAt = devices
    .map((d) => d.lastSeenAt)
    .sort()
    .at(-1) ?? null;
  return { count: devices.length, lastSeenAt };
}

export async function forgetAndroidDevice(token: string): Promise<void> {
  const { data } = await actionInput(tokenInput, token);
  await removeDevice(data);
  revalidatePath("/settings");
}
