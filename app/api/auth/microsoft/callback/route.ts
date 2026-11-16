import { NextRequest, NextResponse } from "next/server";
import { getMicrosoftTokensFromCode, saveMicrosoftTokens } from "@/lib/microsoft-client";
import { requireSession } from "@/lib/session";
import {
  OAUTH_STATE_COOKIE,
  clearOAuthStateCookie,
  decodeOAuthState,
  oauthNonceMatches,
} from "@/lib/oauth-state";
import { serverLog } from "@/lib/logger";

function invalidState(): NextResponse {
  return clearOAuthStateCookie(
    NextResponse.json({ error: "state OAuth invalide" }, { status: 400 })
  );
}

export async function GET(request: NextRequest) {
  try {
    await requireSession();
  } catch {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get("code");
  const error = searchParams.get("error");
  const errorDescription = searchParams.get("error_description");

  // `state` vérifié AVANT tout échange de code : sans nonce correspondant au
  // cookie, la requête ne peut pas venir de ce navigateur.
  const state = decodeOAuthState(searchParams.get("state"));
  const cookieNonce = request.cookies.get(OAUTH_STATE_COOKIE)?.value;
  if (!oauthNonceMatches(state, cookieNonce)) {
    return invalidState();
  }

  if (error) {
    const detail = errorDescription ? ` (${errorDescription})` : "";
    void serverLog("microsoft-callback", "error", `OAuth error: ${error}${detail}`);
    return clearOAuthStateCookie(
      NextResponse.json({ error: `Microsoft OAuth error: ${error}${detail}` }, { status: 400 })
    );
  }

  if (!code) {
    return clearOAuthStateCookie(
      NextResponse.json({ error: "Missing authorization code" }, { status: 400 })
    );
  }

  try {
    // Dernier verrou : la destination du state doit rester sur l'origine.
    const destination = new URL(state.redirect, request.url);
    if (destination.origin !== new URL(request.url).origin) {
      return invalidState();
    }

    const tokens = await getMicrosoftTokensFromCode(code);
    await saveMicrosoftTokens(tokens);
    destination.search = "";
    destination.pathname = "/reminders";
    destination.searchParams.set("todo", "linked");
    return clearOAuthStateCookie(NextResponse.redirect(destination));
  } catch (err) {
    void serverLog("microsoft-callback", "error", "Microsoft callback error", err, true);
    const message = err instanceof Error ? err.message : "Erreur inconnue";
    return clearOAuthStateCookie(NextResponse.json({ error: message }, { status: 500 }));
  }
}
