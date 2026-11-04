package com.personalbrain.backstage;

import android.content.Context;
import android.os.Handler;
import android.os.Looper;
import android.util.Log;
import android.widget.Toast;

import com.google.firebase.messaging.FirebaseMessaging;

/**
 * Appairage de l'appareil auprès du serveur.
 *
 * L'APK n'a pas accès au cookie de session du TWA (le TWA vit dans Chrome). On
 * passe donc par un code à usage unique, généré depuis l'app web authentifiée
 * puis transmis par le deep link {@code backstage://pair?code=...}. En échange
 * du code, le serveur renvoie un secret propre à l'appareil, conservé
 * localement et utilisé pour rafraîchir le jeton FCM.
 */
final class PairingClient {
    private static final String TAG = "BackstagePair";
    private static final Handler MAIN = new Handler(Looper.getMainLooper());

    private PairingClient() {}

    /** Deep link d'appairage : mémorise le code puis tente l'enregistrement. */
    static void pairAsync(Context ctx, String code) {
        if (code == null || code.isEmpty()) return;
        Context app = ctx.getApplicationContext();
        TokenStore.setPendingCode(app, code);
        syncAsync(app);
    }

    /** Rejoue l'appairage (code en attente) ou rafraîchit le jeton (secret connu). */
    static void syncAsync(Context ctx) {
        final Context app = ctx.getApplicationContext();
        final String secret = TokenStore.secret(app);
        final String code = TokenStore.pendingCode(app);
        if (secret == null && (code == null || code.isEmpty())) return;

        FirebaseMessaging.getInstance().getToken().addOnCompleteListener(task -> {
            if (!task.isSuccessful() || task.getResult() == null) {
                Log.w(TAG, "jeton FCM indisponible");
                return;
            }
            String token = task.getResult();
            TokenStore.setToken(app, token);
            new Thread(() -> register(app, token, code, secret)).start();
        });
    }

    private static void register(Context app, String token, String code, String secret) {
        try {
            String body = secret != null
                    ? "{\"token\":\"" + escape(token) + "\",\"secret\":\"" + escape(secret) + "\"}"
                    : "{\"token\":\"" + escape(token) + "\",\"code\":\"" + escape(code) + "\"}";

            Http.Result res = Http.postJson(Config.BASE_URL + Config.PAIR_ENDPOINT, body);
            if (res.status == 200) {
                String newSecret = Http.jsonString(res.body, "secret");
                if (newSecret != null) {
                    TokenStore.setSecret(app, newSecret);
                    TokenStore.clearPendingCode(app);
                }
                Log.i(TAG, "appareil appairé");
                toast(app, "Notifications activées");
            } else if (res.status == 401 || res.status == 400) {
                TokenStore.clearPendingCode(app);
                Log.w(TAG, "appairage refusé (" + res.status + ")");
                toast(app, "Code d'appairage invalide ou expiré");
            } else {
                Log.w(TAG, "appairage : HTTP " + res.status);
            }
        } catch (Exception e) {
            Log.w(TAG, "appairage échoué : " + e.getClass().getSimpleName());
        }
    }

    private static void toast(Context app, String message) {
        MAIN.post(() -> Toast.makeText(app, message, Toast.LENGTH_LONG).show());
    }

    private static String escape(String value) {
        return value.replace("\\", "\\\\").replace("\"", "\\\"");
    }
}
