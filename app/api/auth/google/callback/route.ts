import { NextRequest, NextResponse } from "next/server";
import { saveTokens, clearGoogleBroken, exchangeAuthorizationCode, type GoogleAccountType } from "@/lib/google-client";
import { authedRoute } from "@/lib/route";
import { getConfig } from "@/lib/config";
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

export const GET = authedRoute(async (_session, request: NextRequest) => {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get("code");
  const error = searchParams.get("error");

  // Le `state` doit être lisible ET porter le nonce du cookie émis par ce
  // navigateur. Sinon : 400, sans repli silencieux sur gmail ni sur /chat.
  const state = decodeOAuthState(searchParams.get("state"));
  const cookieNonce = request.cookies.get(OAUTH_STATE_COOKIE)?.value;
  if (!oauthNonceMatches(state, cookieNonce)) {
    return invalidState();
  }

  if (state.type !== "gmail" && state.type !== "calendar") {
    return invalidState();
  }
  const type: GoogleAccountType = state.type;

  if (error) {
    return clearOAuthStateCookie(
      NextResponse.json({ error: `Google OAuth error: ${error}` }, { status: 400 })
    );
  }

  if (!code) {
    return clearOAuthStateCookie(
      NextResponse.json({ error: "Missing authorization code" }, { status: 400 })
    );
  }

  // Dernier verrou : même si le state a été forgé, la destination doit
  // rester sur l'origine de l'application. `/\evil.com` est bloqué ici,
  // avant tout échange de code.
  const destination = new URL(state.redirect, request.url);
  if (destination.origin !== new URL(request.url).origin) {
    return invalidState();
  }
  destination.searchParams.set(type, "linked");

  try {
    // Échange du code via fetch direct avec timeout (google-auth-library
    // ne pose aucun timeout : il peut pendre sur un hébergeur partagé et
    // laisser le navigateur « sur la page Google qui charge »).
    const redirectUri = getConfig().GOOGLE_REDIRECT_URI;
    if (!redirectUri) {
      throw new Error("GOOGLE_REDIRECT_URI doit etre configure");
    }
    const tokens = await exchangeAuthorizationCode(code, redirectUri);

    if (!tokens.refresh_token) {
      return clearOAuthStateCookie(
        NextResponse.json(
          { error: "Aucun refresh token recu. Revoque l'acces depuis ton compte Google et reessaie." },
          { status: 400 }
        )
      );
    }

    await saveTokens(type, tokens, { resetObtainedAt: true });
    // Re-link réussi : lève la bannière « à reconnecter » sans attendre
    // le premier refresh suivant (le marqueur de casse serait sinon obsolète).
    await clearGoogleBroken(type);

    return clearOAuthStateCookie(NextResponse.redirect(destination));
  } catch (err) {
    void serverLog("google-callback", "error", "Google callback error", err, true);
    const message = err instanceof Error ? err.message : "Erreur inconnue";
    return clearOAuthStateCookie(NextResponse.json({ error: message }, { status: 500 }));
  }
});
