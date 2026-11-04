package com.personalbrain.backstage;

import android.content.Context;

import androidx.annotation.NonNull;
import androidx.work.Constraints;
import androidx.work.ExistingWorkPolicy;
import androidx.work.NetworkType;
import androidx.work.OneTimeWorkRequest;
import androidx.work.WorkManager;
import androidx.work.Worker;
import androidx.work.WorkerParameters;

/**
 * Appairage exécuté par WorkManager.
 *
 * La MainActivity se termine juste après avoir lancé le TWA : un travail
 * asynchrone lancé depuis elle (jeton FCM puis POST serveur) était interrompu.
 * WorkManager garantit l'exécution même si le processus meurt entre-temps, et
 * la contrainte réseau évite un échec quand le téléphone est hors ligne au
 * moment du scan du lien.
 */
public class PairingWorker extends Worker {
    public PairingWorker(@NonNull Context context, @NonNull WorkerParameters params) {
        super(context, params);
    }

    @NonNull
    @Override
    public Result doWork() {
        PairingClient.syncBlocking(getApplicationContext());
        return Result.success();
    }

    /** Un seul appairage en attente à la fois : le dernier code remplace l'ancien. */
    static void enqueue(Context context) {
        Constraints constraints = new Constraints.Builder()
                .setRequiredNetworkType(NetworkType.CONNECTED)
                .build();
        OneTimeWorkRequest request = new OneTimeWorkRequest.Builder(PairingWorker.class)
                .setConstraints(constraints)
                .build();
        WorkManager.getInstance(context.getApplicationContext())
                .enqueueUniqueWork("backstage-pairing", ExistingWorkPolicy.REPLACE, request);
    }
}
