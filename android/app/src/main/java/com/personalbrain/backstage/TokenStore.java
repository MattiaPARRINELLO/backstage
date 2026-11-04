package com.personalbrain.backstage;

import android.content.Context;
import android.content.SharedPreferences;

/**
 * Petit magasin local : jeton FCM + secret d'appairage.
 *
 * Le secret n'est jamais affiché ni journalisé : il ne sert qu'à rafraîchir le
 * jeton auprès du serveur.
 */
final class TokenStore {
    private static final String PREFS = "backstage.push";

    private TokenStore() {}

    private static SharedPreferences prefs(Context ctx) {
        return ctx.getApplicationContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    static String token(Context ctx) {
        return prefs(ctx).getString("token", null);
    }

    static void setToken(Context ctx, String token) {
        if (token == null || token.isEmpty()) return;
        prefs(ctx).edit().putString("token", token).apply();
    }

    static String secret(Context ctx) {
        return prefs(ctx).getString("secret", null);
    }

    static void setSecret(Context ctx, String secret) {
        if (secret == null || secret.isEmpty()) return;
        prefs(ctx).edit().putString("secret", secret).apply();
    }

    /** Code d'appairage reçu par deep link, en attente du jeton FCM. */
    static String pendingCode(Context ctx) {
        return prefs(ctx).getString("pendingCode", null);
    }

    static void setPendingCode(Context ctx, String code) {
        prefs(ctx).edit().putString("pendingCode", code == null ? "" : code).apply();
    }

    static void clearPendingCode(Context ctx) {
        prefs(ctx).edit().remove("pendingCode").apply();
    }
}
