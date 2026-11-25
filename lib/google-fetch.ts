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

export async function googleFetch<T>(
  auth: OAuth2Client,
  url: string,
  init?: GoogleFetchOptions
): Promise<T> {
  const accessToken = auth.credentials.access_token;
  if (!accessToken) {
    throw new Error("Google access token manquant. Reconnecte ton compte Google.");
  }
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
  if (!res.ok) {
    throw new Error(`Google API error ${res.status}: ${text.slice(0, 300)}`);
  }
  if (!text) return null as T;
  return JSON.parse(text) as T;
}
