package com.personalbrain.backstage;

import android.app.Activity;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.util.Log;

import androidx.browser.customtabs.CustomTabsIntent;
import androidx.browser.trusted.TrustedWebActivityIntentBuilder;

/**
 * Point d'entrée unique de l'APK.
 *
 * L'application elle-même est un Trusted Web Activity : c'est Chrome qui
 * affiche {@code https://brain.mprnl.fr}. Conséquence importante : l'origine
 * reste la vraie, donc les passkeys WebAuthn et la session fonctionnent
 * exactement comme dans la PWA — aucun portage du front n'est nécessaire.
 *
 * Cette activité ne fait que choisir l'URL à ouvrir (accueil, notification,
 * appairage) puis délègue.
 */
public class MainActivity extends Activity {
    public static final String EXTRA_URL = "url";
    private static final String TAG = "BackstageMain";

    @Override
    protected void onCreate(Bundle state) {
        super.onCreate(state);
        Notifications.ensureChannels(this);
        handle(getIntent());
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        handle(intent);
    }

    private void handle(Intent intent) {
        Uri data = intent == null ? null : intent.getData();

        // Deep link d'appairage : backstage://pair?code=XXXX
        if (data != null && Config.SCHEME.equals(data.getScheme()) && "pair".equals(data.getHost())) {
            String code = data.getQueryParameter("code");
            if (code != null && !code.isEmpty()) {
                PairingClient.pairAsync(this, code);
            }
            // On continue vers l'application : l'appairage se termine en tâche de fond.
            open(Config.DEFAULT_PATH);
            return;
        }

        String path = intent == null ? null : intent.getStringExtra(EXTRA_URL);
        open(path == null || path.isEmpty() ? Config.DEFAULT_PATH : path);
    }

    private void open(String path) {
        Uri uri = Uri.parse(Config.BASE_URL + (path.startsWith("/") ? path : "/" + path));
        try {
            TrustedWebActivityIntentBuilder builder = new TrustedWebActivityIntentBuilder(uri);
            builder.setNavigationBarColor(getColor(R.color.backstage_background));
            builder.setColorScheme(CustomTabsIntent.COLOR_SCHEME_DARK);
            CustomTabsIntent intent = builder.buildCustomTabsIntent();
            intent.launchUrl(this, uri);
        } catch (Exception e) {
            // Aucun navigateur compatible : on n'a plus de webview de secours,
            // donc on le dit explicitement plutôt que de laisser un écran noir.
            Log.e(TAG, "lancement TWA impossible : " + e.getClass().getSimpleName());
        } finally {
            finish();
        }
    }
}
