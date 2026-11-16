import { NextResponse } from "next/server";
import { createMicrosoftAuthUrl } from "@/lib/microsoft-client";
import { requireSession } from "@/lib/session";
import {
  OAUTH_STATE_COOKIE,
  encodeOAuthState,
  oauthStateCookieOptions,
} from "@/lib/oauth-state";

export async function GET() {
  try {
    await requireSession();
  } catch {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const nonce = crypto.randomUUID();
  const state = encodeOAuthState({ redirect: "/reminders", nonce });
  const response = NextResponse.redirect(createMicrosoftAuthUrl(state));
  response.cookies.set(OAUTH_STATE_COOKIE, nonce, oauthStateCookieOptions());
  return response;
}
