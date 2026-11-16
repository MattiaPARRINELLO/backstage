import { NextRequest, NextResponse } from "next/server";
import { createOAuth2Client, type GoogleAccountType } from "@/lib/google-client";
import { requireSession } from "@/lib/session";
import {
  OAUTH_STATE_COOKIE,
  encodeOAuthState,
  oauthStateCookieOptions,
  resolveAppDestination,
} from "@/lib/oauth-state";

const SCOPES: Record<GoogleAccountType, string[]> = {
  gmail: [
    "https://www.googleapis.com/auth/gmail.modify",
    "https://www.googleapis.com/auth/userinfo.profile",
  ],
  calendar: [
    "https://www.googleapis.com/auth/calendar",
    "https://www.googleapis.com/auth/userinfo.profile",
  ],
};

export async function GET(request: NextRequest) {
  try {
    await requireSession();
  } catch {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const type = (request.nextUrl.searchParams.get("type") ?? "gmail") as GoogleAccountType;

  if (!["gmail", "calendar"].includes(type)) {
    return NextResponse.json({ error: "Type invalide. Utilise 'gmail' ou 'calendar'." }, { status: 400 });
  }

  const oauth2Client = createOAuth2Client();
  // Destination résolue MAINTENANT, contre l'origine de l'application : le
  // callback ne fera que vérifier qu'elle reste sur cette origine.
  const redirect = resolveAppDestination(
    request.nextUrl.searchParams.get("redirect"),
    request.nextUrl.origin
  );
  const nonce = crypto.randomUUID();
  const state = encodeOAuthState({ type, redirect, nonce });

  const authUrl = oauth2Client.generateAuthUrl({
    access_type: "offline",
    scope: SCOPES[type],
    prompt: "consent",
    state,
  });

  // Le nonce part dans un cookie httpOnly : un `state` rejoué depuis un autre
  // navigateur ne pourra pas fournir le même cookie.
  const response = NextResponse.redirect(authUrl);
  response.cookies.set(OAUTH_STATE_COOKIE, nonce, oauthStateCookieOptions());
  return response;
}
