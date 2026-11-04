import { randomInt } from "node:crypto";
import { readJsonSafe } from "./storage";
import { mutateJson } from "./storage-core";

/**
 * Codes d'appairage pour ajouter une passkey sur un autre appareil.
 *
 * Une passkey est liee a l'appareil (ou au gestionnaire de cles) qui l'a creee.
 * Or l'enregistrement d'une cle supplementaire exige une session active, donc
 * un appareil deja authentifie : sans code d'appairage, un PC ne peut jamais
 * recevoir sa propre cle (cf. `app/api/auth/passkey/register-options`).
 *
 * Le code est genere depuis une session authentifiee, vaut 10 minutes et ne
 * sert qu'une fois. Il ne remplace pas la biometrie : il autorise seulement
 * l'appareil inconnu a lancer la ceremonie WebAuthn.
 */

interface PasskeyPairCode {
  code: string;
  createdAt: string;
  expiresAt: string;
}

interface PairCodesData {
  codes: PasskeyPairCode[];
}

const CODES_FILE = "passkey-pair-codes.json";
const defaultCodes: PairCodesData = { codes: [] };

/** 10 minutes pour ouvrir le lien sur l'autre appareil et valider la biometrie. */
const CODE_TTL_MS = 10 * 60 * 1000;
/** Un code non utilise s'accumule : on garde les 5 plus recents. */
const MAX_PENDING_CODES = 5;
// Sans 0/o/1/l/i : le code peut etre recopie a la main depuis un autre ecran.
const ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";
const CODE_LENGTH = 10;

function normalize(code: string): string {
  return code.trim().toLowerCase();
}

function isFresh(entry: PasskeyPairCode, now: number): boolean {
  return new Date(entry.expiresAt).getTime() > now;
}

/** Genere un code a usage unique (Server Action authentifiee). */
export async function createPasskeyPairCode(): Promise<{ code: string; expiresAt: string }> {
  let code = "";
  for (let i = 0; i < CODE_LENGTH; i++) {
    code += ALPHABET[randomInt(ALPHABET.length)];
  }

  const now = Date.now();
  const expiresAt = new Date(now + CODE_TTL_MS).toISOString();

  await mutateJson<PairCodesData>(CODES_FILE, defaultCodes, (data) => {
    const alive = (data.codes ?? []).filter((c) => isFresh(c, now));
    data.codes = [...alive, { code, createdAt: new Date(now).toISOString(), expiresAt }].slice(
      -MAX_PENDING_CODES
    );
  });

  return { code, expiresAt };
}

/**
 * Verifie un code sans le consommer : l'ecran de connexion doit pouvoir
 * afficher « code invalide » avant de lancer la ceremonie, puis la verification
 * consomme le code.
 */
export async function isValidPasskeyPairCode(code: string): Promise<boolean> {
  const cleaned = normalize(code);
  if (!cleaned) return false;

  const data = await readJsonSafe<PairCodesData>(CODES_FILE, defaultCodes);
  const now = Date.now();
  return (data.codes ?? []).some((c) => c.code === cleaned && isFresh(c, now));
}

/** Consomme un code : un second essai avec le meme code echoue. */
export async function consumePasskeyPairCode(code: string): Promise<boolean> {
  const cleaned = normalize(code);
  if (!cleaned) return false;

  const now = Date.now();
  let valid = false;
  await mutateJson<PairCodesData>(CODES_FILE, defaultCodes, (data) => {
    const match = (data.codes ?? []).find((c) => c.code === cleaned && isFresh(c, now));
    valid = Boolean(match);
    data.codes = (data.codes ?? []).filter((c) => c !== match && isFresh(c, now));
  });

  return valid;
}
