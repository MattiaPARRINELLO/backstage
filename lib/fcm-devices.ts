import { createHash, randomBytes, randomInt } from "node:crypto";
import { readJsonSafe } from "./storage";
import { mutateJson } from "./storage-core";

/**
 * Appareils Android appairés pour les notifications natives (FCM).
 *
 * L'APK n'a pas accès au cookie de session du TWA (le TWA vit dans Chrome) :
 * l'appairage passe par un code à usage unique généré depuis l'app web, puis
 * échangé contre un secret propre à l'appareil. Le secret est stocké haché,
 * jamais en clair.
 */

export interface FcmDevice {
  token: string;
  secretHash: string;
  platform: string;
  label: string;
  createdAt: string;
  lastSeenAt: string;
}

interface DevicesData {
  devices: FcmDevice[];
}

interface PairCodesData {
  codes: { code: string; createdAt: string; expiresAt: string }[];
}

const DEVICES_FILE = "fcm-devices.json";
const CODES_FILE = "fcm-pair-codes.json";
const defaultDevices: DevicesData = { devices: [] };
const defaultCodes: PairCodesData = { codes: [] };

/** 10 minutes pour saisir/ouvrir le lien d'appairage. */
const CODE_TTL_MS = 10 * 60 * 1000;
/** Un code non utilisé s'accumule : on garde les 5 plus récents. */
const MAX_PENDING_CODES = 5;
// Sans 0/o/1/l/i : le code peut être recopié à la main depuis le téléphone.
const ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";

function hashSecret(secret: string, token: string): string {
  return createHash("sha256").update(`${secret}:${token}`).digest("hex");
}

export async function listDevices(): Promise<FcmDevice[]> {
  const data = await readJsonSafe<DevicesData>(DEVICES_FILE, defaultDevices);
  return data.devices ?? [];
}

/** Génère un code d'appairage à usage unique (Server Action authentifiée). */
export async function createPairCode(): Promise<{ code: string; expiresAt: string }> {
  let code = "";
  for (let i = 0; i < 10; i++) {
    code += ALPHABET[randomInt(ALPHABET.length)];
  }
  const now = Date.now();
  const expiresAt = new Date(now + CODE_TTL_MS).toISOString();

  await mutateJson<PairCodesData>(CODES_FILE, defaultCodes, (data) => {
    const alive = data.codes.filter((c) => new Date(c.expiresAt).getTime() > now);
    data.codes = [...alive, { code, createdAt: new Date(now).toISOString(), expiresAt }].slice(
      -MAX_PENDING_CODES
    );
  });

  return { code, expiresAt };
}

/**
 * Échange un code d'appairage contre un secret d'appareil.
 * Le code est consommé : un second essai avec le même code échoue.
 */
export async function redeemPairCode(
  code: string,
  token: string
): Promise<{ secret: string } | null> {
  const now = Date.now();
  const cleaned = code.trim().toLowerCase();
  if (!cleaned) return null;

  let valid = false;
  await mutateJson<PairCodesData>(CODES_FILE, defaultCodes, (data) => {
    const match = data.codes.find(
      (c) => c.code === cleaned && new Date(c.expiresAt).getTime() > now
    );
    valid = Boolean(match);
    data.codes = data.codes.filter((c) => c !== match && new Date(c.expiresAt).getTime() > now);
  });
  if (!valid) return null;

  const secret = randomBytes(32).toString("base64url");
  const secretHash = hashSecret(secret, token);
  const iso = new Date(now).toISOString();

  await mutateJson<DevicesData>(DEVICES_FILE, defaultDevices, (data) => {
    const existing = data.devices.find((d) => d.token === token);
    if (existing) {
      existing.secretHash = secretHash;
      existing.lastSeenAt = iso;
      return;
    }
    // Un même téléphone peut changer de jeton FCM : on garde un seul appareil
    // par jeton, les anciens jetons étant purgés à l'échec d'envoi.
    data.devices.push({
      token,
      secretHash,
      platform: "android",
      label: "Android",
      createdAt: iso,
      lastSeenAt: iso,
    });
  });

  return { secret };
}

/** Vérifie qu'un appareil connaît bien son secret (rafraîchissement de jeton). */
export async function authenticateDevice(token: string, secret: string): Promise<boolean> {
  const devices = await listDevices();
  const device = devices.find((d) => d.token === token);
  if (!device) return false;
  return device.secretHash === hashSecret(secret, token);
}

export async function touchDevice(token: string): Promise<void> {
  const iso = new Date().toISOString();
  await mutateJson<DevicesData>(DEVICES_FILE, defaultDevices, (data) => {
    const device = data.devices.find((d) => d.token === token);
    if (!device) return null;
    device.lastSeenAt = iso;
  });
}

export async function removeDevice(token: string): Promise<void> {
  await mutateJson<DevicesData>(DEVICES_FILE, defaultDevices, (data) => {
    const before = data.devices.length;
    data.devices = data.devices.filter((d) => d.token !== token);
    if (data.devices.length === before) return null;
  });
}
