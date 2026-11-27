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

// Gmail applique un quota de 250 unites par minute et par utilisateur. Un scan
// qui demande 200 fils complets (10 unites chacun) depasse ce plafond et recoit
// un 403 « Quota exceeded ... Units per minute per user ». On retente les 403
// et 429 de quota en respectant `Retry-After`, avec une attente par defaut
// alignee sur la fenetre d'une minute.
const QUOTA_MAX_ATTEMPTS = 3;
const QUOTA_MAX_WAIT_MS = 60_000;

function isQuotaError(status: number, body: string): boolean {
  if (status === 429) return true;
  if (status !== 403) return false;
  return /quota exceeded|rate limit exceeded|user rate limit|daily limit|units per minute|rateLimitExceeded|userRateLimitExceeded|quotaExceeded|dailyLimitExceeded/i.test(
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
  // Pas d'en-tete : le quota est par minute, on attend la fenetre complete.
  return Math.min(60_000 * 2 ** attempt, QUOTA_MAX_WAIT_MS);
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
      // Ne pas journaliser l'URL : elle contient des identifiants venus de
      // Gmail, et CodeQL la voit comme une entree utilisateur (log injection).
      console.warn(
        `[google] quota ${res.status}, nouvelle tentative dans ${wait} ms`
      );
      await sleep(wait);
      continue;
    }

    throw new Error(`Google API error ${res.status}: ${text.slice(0, 300)}`);
  }

  throw new Error("Google API error: quota toujours depasse apres plusieurs tentatives");
}
