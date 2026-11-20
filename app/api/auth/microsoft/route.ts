import { NextResponse } from "next/server";
import { createMicrosoftAuthUrl } from "@/lib/microsoft-client";
import { authedRoute } from "@/lib/route";
import {
  OAUTH_STATE_COOKIE,
  encodeOAuthState,
  oauthStateCookieOptions,
} from "@/lib/oauth-state";

export const GET = authedRoute(async (_session) => {
  const nonce = crypto.randomUUID();
  const state = encodeOAuthState({ redirect: "/reminders", nonce });
  const response = NextResponse.redirect(createMicrosoftAuthUrl(state));
  response.cookies.set(OAUTH_STATE_COOKIE, nonce, oauthStateCookieOptions());
  return response;
});
