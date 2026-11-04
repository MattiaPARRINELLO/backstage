package com.personalbrain.backstage;

import android.Manifest;
import android.app.Activity;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.util.Log;

import androidx.browser.customtabs.CustomTabsIntent;
import androidx.browser.trusted.TrustedWebActivityIntentBuilder;

import com.google.androidbrowserhelper.trusted.TwaLauncher;

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
    // Android 13+ : sans cette permission, les notifications sont purement et
    // simplement jetées (l'app apparaît en importance NONE dans les réglages).
    private static final int REQ_NOTIFICATIONS = 1001;

    private TwaLauncher twaLauncher;

    @Override
    protected void onCreate(Bundle state) {
        super.onCreate(state);
        Notifications.ensureChannels(this);

        // L'appairage passe avant la permission : il ne doit pas en dépendre,
        // et le travail est planifié (WorkManager) donc il survit à finish().
        startPairingIfNeeded(getIntent());

        if (needsNotificationPermission()) {
            requestPermissions(new String[] { Manifest.permission.POST_NOTIFICATIONS }, REQ_NOTIFICATIONS);
            return; // on continue dans onRequestPermissionsResult()
        }

        openFrom(getIntent());
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode == REQ_NOTIFICATIONS) {
            boolean granted = grantResults.length > 0 && grantResults[0] == PackageManager.PERMISSION_GRANTED;
            if (!granted) {
                Log.w(TAG, "notifications refusées par l'utilisateur");
            }
            openFrom(getIntent());
        }
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        startPairingIfNeeded(intent);
        openFrom(intent);
    }

    private boolean needsNotificationPermission() {
        return Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU
                && checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED;
    }

    private void startPairingIfNeeded(Intent intent) {
        Uri data = intent == null ? null : intent.getData();
        if (data == null || !Config.SCHEME.equals(data.getScheme()) || !"pair".equals(data.getHost())) {
            return;
        }
        String code = data.getQueryParameter("code");
        if (code != null && !code.isEmpty()) {
            PairingClient.pairAsync(this, code);
        }
    }

    private void openFrom(Intent intent) {
        Uri data = intent == null ? null : intent.getData();
        if (data != null && Config.SCHEME.equals(data.getScheme()) && "pair".equals(data.getHost())) {
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

            // TwaLauncher (et pas buildCustomTabsIntent) : c'est lui qui ouvre une
            // CustomTabsSession vérifiée auprès de Chrome. Sans session, Chrome
            // traite l'intent comme un simple Custom Tab et affiche la barre
            // d'URL — même quand assetlinks.json est valide.
            twaLauncher = new TwaLauncher(this);
            twaLauncher.launch(builder, null, null, () -> runOnUiThread(this::finish));
        } catch (Exception e) {
            // Aucun navigateur compatible : on n'a pas de webview de secours,
            // donc on le dit plutôt que de laisser un écran noir.
            Log.e(TAG, "lancement TWA impossible : " + e.getClass().getSimpleName());
            finish();
        }
    }

    @Override
    protected void onDestroy() {
        if (twaLauncher != null) {
            twaLauncher.destroy();
            twaLauncher = null;
        }
        super.onDestroy();
    }
}
