import type { OAuth2Client } from "google-auth-library";

import { request as httpRequest, type HttpMethod } from "@/lib/http";

/**
 * Appel HTTP authentifié a une API Google.
 *
 * Isole dans un seul fichier la lecture du jeton et la forme de l'erreur : les
 * actions Gmail et Calendar n'ont plus a la repeter, et le fichier qui les porte
 * reste sous le plafond de lignes.
 */
export type GoogleFetchOptions = { method?: HttpMethod; body?: string };

const GOOGLE_FETCH_TIMEOUT_MS = 20_000;

// Gmail applique un quota par utilisateur (250 unites/seconde). Un scan qui
// demande 400 fils en parallele depasse ce plafond et recoit des 429 que rien
// ne rattrapait : le scan s'arretait a mi-parcours. On retente donc les 429 et
// les 403 de quota en respectant `Retry-After`.
const QUOTA_MAX_ATTEMPTS = 4;
const QUOTA_MAX_WAIT_MS = 20_000;

function isQuotaError(status: number, body: string): boolean {
  if (status === 429) return true;
  if (status !== 403) return false;
  return /rateLimitExceeded|userRateLimitExceeded|quotaExceeded|dailyLimitExceeded/i.test(
    body
  );
}

function retryDelayMs(response: Response, attempt: number): number {
  const header = response.headers.get("retry-after");
  if (header) {
    const seconds = Number(header);
    if (Number.isFinite(seconds) && seconds >= 0) {
      return Math.min(seconds * 1000, QUOTA_MAX_WAIT_MS);
    }
    const date = Date.parse(header);
    if (Number.isFinite(date)) {
      return Math.min(Math.max(date - Date.now(), 0), QUOTA_MAX_WAIT_MS);
    }
  }
  return Math.min(500 * 2 ** attempt, 8_000) + Math.floor(Math.random() * 250);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function googleFetch<T>(
  auth: OAuth2Client,
  url: string,
  init?: GoogleFetchOptions
): Promise<T> {
  const accessToken = auth.credentials.access_token;
  if (!accessToken) {
    throw new Error("Google access token manquant. Reconnecte ton compte Google.");
  }

  for (let attempt = 0; attempt < QUOTA_MAX_ATTEMPTS; attempt += 1) {
    const res = await httpRequest(url, {
      label: "google-api",
      timeoutMs: GOOGLE_FETCH_TIMEOUT_MS,
      ...init,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
    });
    const text = await res.text();
    if (res.ok) {
      if (!text) return null as T;
      return JSON.parse(text) as T;
    }

    if (isQuotaError(res.status, text) && attempt < QUOTA_MAX_ATTEMPTS - 1) {
      const wait = retryDelayMs(res, attempt);
      console.warn(
        `[google] quota ${res.status} sur ${url.split("?")[0]}, nouvelle tentative dans ${wait} ms`
      );
      await sleep(wait);
      continue;
    }

    throw new Error(`Google API error ${res.status}: ${text.slice(0, 300)}`);
  }

  throw new Error("Google API error: quota toujours depasse apres plusieurs tentatives");
}
