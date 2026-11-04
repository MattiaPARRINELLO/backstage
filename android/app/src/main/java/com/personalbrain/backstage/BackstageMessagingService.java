package com.personalbrain.backstage;

import android.util.Log;

import androidx.annotation.NonNull;

import com.google.firebase.messaging.FirebaseMessagingService;
import com.google.firebase.messaging.RemoteMessage;

import java.util.HashMap;
import java.util.Map;

/**
 * Réception des messages FCM.
 *
 * Le serveur envoie volontairement des messages **data-only** : Android ne
 * fabrique alors aucune notification lui-même, et c'est {@link Notifications}
 * qui décide du canal, de la priorité, de la persistance et du clic. Avec un
 * message `notification`, l'application ne pourrait pas rendre une notification
 * `ongoing` / Live Update.
 */
public class BackstageMessagingService extends FirebaseMessagingService {
    private static final String TAG = "BackstageFcm";

    @Override
    public void onNewToken(@NonNull String token) {
        super.onNewToken(token);
        TokenStore.setToken(this, token);
        PairingClient.syncAsync(this);
    }

    @Override
    public void onMessageReceived(@NonNull RemoteMessage message) {
        Map<String, String> data = message.getData();
        if (data == null || data.isEmpty()) return;
        Notifications.show(this, new HashMap<>(data));
        Log.i(TAG, "notification affichée (type=" + data.get("type") + ")");
    }
}
