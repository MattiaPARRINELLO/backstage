import type { NextResponse } from "next/server";

// Cookie de nonce OAuth : lie le `state` au navigateur qui a initié le flux.
// Nom unique et partagé par Google et Microsoft ; jamais réutilisé ailleurs.
export const OAUTH_STATE_COOKIE = "pb_oauth_state";
export const OAUTH_STATE_MAX_AGE = 600;

export interface OAuthState {
  /** Nonce aléatoire émis par le serveur et renvoyé dans le cookie. */
  nonce: string;
  /** Destination applicative résolue à l'initiation. */
  redirect: string;
  /** Type de compte Google (`gmail` | `calendar`), absent côté Microsoft. */
  type?: string;
}

/** Options du cookie de nonce : inaccessible au JS, 10 minutes. */
export function oauthStateCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: OAUTH_STATE_MAX_AGE,
  };
}

export function encodeOAuthState(state: OAuthState): string {
  return Buffer.from(JSON.stringify(state)).toString("base64url");
}

/**
 * Décode un `state` OAuth. Renvoie `null` si le JSON est illisible ou si le
 * nonce est absent : un `state` fabriqué par un tiers ne passe jamais.
 */
export function decodeOAuthState(raw: string | null | undefined): OAuthState | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(Buffer.from(raw, "base64url").toString("utf-8")) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    const candidate = parsed as Record<string, unknown>;
    if (typeof candidate.nonce !== "string" || candidate.nonce.length < 8) return null;
    if (typeof candidate.redirect !== "string" || candidate.redirect.length === 0) return null;
    return {
      nonce: candidate.nonce,
      redirect: candidate.redirect,
      ...(typeof candidate.type === "string" ? { type: candidate.type } : {}),
    };
  } catch {
    return null;
  }
}

/**
 * Résout une destination applicative contre l'origine du serveur. Tout ce qui
 * sort de l'origine (URL absolue, `//evil.com`, `/\evil.com`) retombe sur
 * `/chat`. Aucun consommateur UI de `?redirect=` n'existe : la destination est
 * figée ici, à l'initiation.
 */
export function resolveAppDestination(
  raw: string | null | undefined,
  origin: string
): string {
  if (!raw) return "/chat";
  try {
    const url = new URL(raw, origin);
    if (url.origin !== origin) return "/chat";
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return "/chat";
  }
}

/** Efface le cookie de nonce sur une réponse terminale (succès ou erreur). */
export function clearOAuthStateCookie(response: NextResponse): NextResponse {
  response.cookies.set(OAUTH_STATE_COOKIE, "", {
    ...oauthStateCookieOptions(),
    maxAge: 0,
  });
  return response;
}

/**
 * Vérifie que le nonce porté par le `state` est bien celui du cookie émis par
 * ce navigateur. Comparaison stricte, non vide.
 */
export function oauthNonceMatches(
  state: OAuthState | null,
  cookieNonce: string | undefined
): state is OAuthState {
  return Boolean(state && cookieNonce && state.nonce === cookieNonce);
}
