package com.personalbrain.backstage;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.util.Log;

import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;

import java.util.Map;

/**
 * Rendu des notifications natives.
 *
 * Toute la politique d'affichage vit ici, côté APK : le serveur envoie un
 * message de données (pas un message `notification`), donc c'est l'application
 * qui décide du canal, de la persistance et du contenu.
 *
 * Persistance : une notification Android reste dans le tiroir jusqu'à ce que
 * l'utilisateur la ferme ou que l'application l'annule. On n'appelle donc jamais
 * `setTimeoutAfter`, et les notifications « en direct » (prochain cours, brief
 * en cours) sont `ongoing` + promues, ce qui les épingle en haut du tiroir et
 * les affiche comme une puce dans la barre d'état (Live Updates, Android 16).
 */
final class Notifications {
    private static final String TAG = "BackstageNotif";

    static final String CHANNEL_DEFAULT = "default";
    static final String CHANNEL_REMINDERS = "reminders";
    static final String CHANNEL_COURSES = "courses";
    static final String CHANNEL_BRIEF = "brief";
    static final String CHANNEL_LIVE = "live";

    private Notifications() {}

    static void ensureChannels(Context ctx) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        NotificationManager nm = ctx.getSystemService(NotificationManager.class);
        if (nm == null) return;
        nm.createNotificationChannel(channel(ctx, CHANNEL_DEFAULT, R.string.channel_default,
                R.string.channel_default_desc, NotificationManager.IMPORTANCE_HIGH));
        nm.createNotificationChannel(channel(ctx, CHANNEL_REMINDERS, R.string.channel_reminders,
                R.string.channel_reminders_desc, NotificationManager.IMPORTANCE_HIGH));
        nm.createNotificationChannel(channel(ctx, CHANNEL_COURSES, R.string.channel_courses,
                R.string.channel_courses_desc, NotificationManager.IMPORTANCE_HIGH));
        nm.createNotificationChannel(channel(ctx, CHANNEL_BRIEF, R.string.channel_brief,
                R.string.channel_brief_desc, NotificationManager.IMPORTANCE_DEFAULT));
        nm.createNotificationChannel(channel(ctx, CHANNEL_LIVE, R.string.channel_live,
                R.string.channel_live_desc, NotificationManager.IMPORTANCE_LOW));
    }

    private static NotificationChannel channel(Context ctx, String id, int nameRes, int descRes, int importance) {
        NotificationChannel ch = new NotificationChannel(id, ctx.getString(nameRes), importance);
        ch.setDescription(ctx.getString(descRes));
        ch.enableVibration(true);
        ch.setShowBadge(true);
        return ch;
    }

    static String channelFor(String type) {
        if (type == null) return CHANNEL_DEFAULT;
        switch (type) {
            case "reminder":
            case "intention":
                return CHANNEL_REMINDERS;
            case "course":
            case "schedule":
                return CHANNEL_COURSES;
            case "daily-brief":
                return CHANNEL_BRIEF;
            case "live":
                return CHANNEL_LIVE;
            default:
                return CHANNEL_DEFAULT;
        }
    }

    static void show(Context ctx, Map<String, String> data) {
        ensureChannels(ctx);

        // Message de contrôle : le serveur demande la fermeture d'une
        // notification en direct (cours terminé, brief du jour refermé).
        if ("1".equals(value(data, "dismiss", null))) {
            String cancelTag = value(data, "tag", null);
            cancel(ctx, cancelTag);
            return;
        }

        String title = value(data, "title", "BACKSTAGE");
        String body = value(data, "body", "");
        String tag = value(data, "tag", null);
        String url = value(data, "url", Config.DEFAULT_PATH);
        String type = value(data, "type", "default");
        boolean promoted = "1".equals(value(data, "promoted", "0"));
        String criticalText = value(data, "criticalText", null);
        int progressMax = parseInt(value(data, "progressMax", "0"), 0);
        int progress = parseInt(value(data, "progress", "0"), 0);

        // Une carte promue reste dans le canal de son type : un rappel doit
        // sonner même épinglé. Le canal « live » (silencieux) ne sert qu'aux
        // messages de contrôle.
        String channel = channelFor(type);
        int id = idFor(tag != null ? tag : url);

        PendingIntent contentIntent = openIntent(ctx, url, id);
        int smallIcon = R.drawable.ic_stat_notification;
        int light = Color.parseColor("#ff9900");

        Notification notification;
        if (promoted && Build.VERSION.SDK_INT >= Build.VERSION_CODES.BAKLAVA) {
            Notification.Builder builder = new Notification.Builder(ctx, channel)
                    .setSmallIcon(smallIcon)
                    .setColor(light)
                    .setContentTitle(title)
                    .setContentText(body)
                    .setStyle(new Notification.BigTextStyle().bigText(body))
                    .setContentIntent(contentIntent)
                    .setAutoCancel(false)
                    .setOngoing(true)
                    .setOnlyAlertOnce(true)
                    .setShowWhen(true)
                    .setWhen(System.currentTimeMillis())
                    .setCategory(Notification.CATEGORY_PROGRESS)
                    .setVisibility(Notification.VISIBILITY_PRIVATE)
                    .setShortCriticalText(criticalText != null ? criticalText : title);

            if (progressMax > 0) {
                Notification.ProgressStyle style = new Notification.ProgressStyle()
                        .addProgressSegment(new Notification.ProgressStyle.Segment(progressMax).setColor(light))
                        .setProgress(Math.max(0, Math.min(progress, progressMax)));
                builder.setStyle(style);
            }

            // API 36 : demande l'affichage en « Live Update » (puce dans la barre
            // d'état, section dédiée en haut du tiroir). Trois choses sont
            // nécessaires, et le drapeau seul ne suffit pas : le flag, l'extra
            // "android.requestPromotedOngoing" (clé non exposée par le SDK, lue
            // par SystemUI), et une notification « promotable »
            // (ProgressStyle + texte critique + couleur + ongoing).
            Bundle extras = new Bundle();
            extras.putBoolean("android.requestPromotedOngoing", true);
            builder.setExtras(extras);
            builder.setFlag(Notification.FLAG_PROMOTED_ONGOING, true);
            notification = builder.build();
            notification.flags |= Notification.FLAG_PROMOTED_ONGOING;

            Log.i(TAG, "live update: promotable=" + notification.hasPromotableCharacteristics());
        } else {
            NotificationCompat.Builder builder = new NotificationCompat.Builder(ctx, channel)
                    .setSmallIcon(smallIcon)
                    .setColor(light)
                    .setContentTitle(title)
                    .setContentText(body)
                    .setStyle(new NotificationCompat.BigTextStyle().bigText(body))
                    .setContentIntent(contentIntent)
                    .setAutoCancel(true)
                    .setOngoing(promoted)
                    .setCategory(promoted ? NotificationCompat.CATEGORY_PROGRESS : NotificationCompat.CATEGORY_REMINDER)
                    .setPriority(NotificationCompat.PRIORITY_MAX)
                    .setVisibility(NotificationCompat.VISIBILITY_PRIVATE)
                    .setShowWhen(true)
                    .setWhen(System.currentTimeMillis())
                    .setVibrate(promoted ? null : new long[] {300, 150, 300});
            notification = builder.build();
        }

        try {
            NotificationManagerCompat.from(ctx).notify(id, notification);
        } catch (SecurityException e) {
            // Permission POST_NOTIFICATIONS refusée : rien à afficher, et surtout
            // ne pas faire planter le service.
            Log.w(TAG, "notify refusé : permission manquante");
        }

    }

    /** Annule une notification en direct (cours terminé, brief lu). */
    static void cancel(Context ctx, String tag) {
        int id = idFor(tag != null ? tag : Config.DEFAULT_PATH);
        NotificationManagerCompat.from(ctx).cancel(id);
    }

    private static PendingIntent openIntent(Context ctx, String url, int id) {
        Intent intent = new Intent(ctx, MainActivity.class);
        intent.setData(Uri.parse(Config.SCHEME + "://open"));
        intent.putExtra(MainActivity.EXTRA_URL, url);
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        int flags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) flags |= PendingIntent.FLAG_IMMUTABLE;
        return PendingIntent.getActivity(ctx, id, intent, flags);
    }

    private static int idFor(String key) {
        if (key == null) return 1000;
        return 1000 + Math.abs(key.hashCode() % 100000);
    }

    private static String value(Map<String, String> data, String key, String fallback) {
        String v = data.get(key);
        return v == null || v.isEmpty() ? fallback : v;
    }

    private static int parseInt(String raw, int fallback) {
        try {
            return Integer.parseInt(raw);
        } catch (Exception e) {
            return fallback;
        }
    }
}
