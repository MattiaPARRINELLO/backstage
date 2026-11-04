# APK Android — BACKSTAGE

L'application Android n'est pas un portage : c'est un **Trusted Web Activity**
(TWA), c'est-à-dire Chrome qui affiche `https://brain.mprnl.fr` en plein écran,
plus un module natif de notifications (FCM). Conséquences :

- l'origine reste la vraie → **passkeys WebAuthn et session identiques à la PWA**,
  aucun portage du front ;
- un seul code métier (Next.js) pour le web et l'APK ;
- seul l'affichage des notifications est natif, parce que le web push ne permet
  ni notification `ongoing` ni Live Update.

Le projet vit dans `android/` (Gradle, Java, aucun framework).

---

## Ce qui tourne où

| Morceau | Fichier | Rôle |
| ------- | ------- | ---- |
| Lanceur TWA | `android/app/src/main/java/.../MainActivity.java` | ouvre l'URL (accueil, notification, appairage), demande `POST_NOTIFICATIONS` |
| Notifications | `.../Notifications.java` | canaux, persistance, Live Update API 36, clic |
| Réception | `.../BackstageMessagingService.java` | messages FCM **data-only** |
| Appairage | `.../PairingClient.java` + `.../PairingWorker.java` | code à usage unique → secret d'appareil (WorkManager) |
| Envoi | `lib/fcm.ts` | FCM HTTP v1 + purge des jetons morts |
| Appareils | `lib/fcm-devices.ts` | `data/fcm-devices.json`, `data/fcm-pair-codes.json` |
| Route d'appairage | `app/api/push/fcm/pair/route.ts` | échange code ↔ secret (publique, code-gated) |
| Vérification TWA | `app/api/assetlinks/route.ts` + réécriture `/.well-known/assetlinks.json` | prouve domaine ↔ APK |

`sendPushToAll()` (`lib/notification-scheduler.ts`) alimente **les deux canaux**
avec le même JSON : web push pour la PWA, FCM pour l'APK. Une panne FCM ne bloque
jamais le web push.

---

## Prérequis

1. **`android/app/google-services.json`** — non commité (gitignoré). Projet
   Firebase `backstage-97555`, application Android
   `com.personalbrain.backstage`.
2. **`data/firebase-service-account.json`** — compte de service du même projet
   Firebase, requis côté serveur pour signer les envois HTTP v1. Sans lui,
   `isFcmConfigured()` renvoie faux et le bouton d'appairage explique quoi faire.
3. **Clé de signature** — `android/keystore/backstage-release.jks` +
   `android/keystore/keystore.properties` (gitignorés). **Les sauvegarder** :
   sans eux, plus aucune mise à jour de l'APK installé n'est possible (Android
   refuse une signature différente).
4. SDK Android + JDK 17/21 (`local.properties` pointe `sdk.dir`).

---

## Construire

```bash
cd android
JAVA_HOME=/usr/lib/jvm/java-21-openjdk ./gradlew :app:assembleRelease
# → app/build/outputs/apk/release/app-release.apk
```

Test contre un serveur local (HTTP en clair autorisé en debug seulement) :

```bash
adb reverse tcp:3000 tcp:3000
./gradlew :app:assembleDebug -PbaseUrl=http://localhost:3000
```

Après un changement d'empreinte de clé :

```bash
keytool -list -v -keystore keystore/backstage-release.jks -alias backstage | grep SHA256
```

Reporter l'empreinte dans `ANDROID_CERT_SHA256` (env serveur) ou dans
`DEFAULT_SHA256` (`app/api/assetlinks/route.ts`), puis redéployer.

---

## Déployer

L'APK se vérifie auprès du domaine. Il faut donc que
`https://brain.mprnl.fr/.well-known/assetlinks.json` réponde `200` avec
l'empreinte **de la clé qui a signé l'APK**. Tant que ce n'est pas le cas, le
TWA s'ouvre avec une barre d'URL (fonctionnel, mais pas plein écran).

Vérification :

```bash
curl -s https://brain.mprnl.fr/.well-known/assetlinks.json
```

---

## Appairer un téléphone

Le TWA vit dans Chrome : l'APK **ne partage pas** le cookie de session. D'où
l'appairage par code, qui évite de mettre un secret dans l'APK.

1. Sur le web : **Paramètres → Notifications → Appairer l'APK**.
2. Le bouton génère un code à usage unique (10 min) et un lien `intent://`.
3. Le lien ouvre l'APK, qui échange le code contre un **secret d'appareil**
   (stocké haché côté serveur, en clair uniquement sur le téléphone).
4. Le téléphone enregistre ensuite son jeton FCM et le rafraîchit tout seul.

Code perdu ou téléphone réinitialisé : regénérer un code. L'ancien jeton est
purgé automatiquement au premier envoi en échec (`UNREGISTERED`).

---

## Comportement des notifications

- **Canal** : un canal Android par famille (`course`, `reminder`, `brief`,
  `live`), tous en importance haute sauf `live` (basse, silencieuse).
- **Persistance** : aucune notification n'utilise `setTimeoutAfter`, donc elles
  restent dans le tiroir jusqu'à ce qu'on les ferme. Les rappels et cours sont en
  plus `ongoing` (non balayables) le temps de l'évènement.
- **Live Updates (Android 16)** : un message avec `promoted: true` pose
  `FLAG_PROMOTED_ONGOING` + l'extra `android.requestPromotedOngoing`, un
  `ProgressStyle` avec segment coloré, `setOnlyAlertOnce(true)` et un texte
  critique court → carte promue en haut du tiroir, barre de progression et puce
  dans la barre d'état. `Builder.setFlag()` seul ne suffit pas : le drapeau
  n'arrive pas dans la notification postée (vérifié dans `dumpsys
  notification`), il faut aussi forcer `notification.flags`. Si le système
  refuse la promotion (app-op `POST_PROMOTED_NOTIFICATIONS`), la notification
  redevient une notification persistante classique — jamais perdue.
  Les cours sont promus, et fermés automatiquement à l'heure de début par
  `clearEndedLiveNotifs()` (`data/live-notifs.json`).
- **Clic** : ouvre le TWA sur le `url` du message (`/schedule`, `/reminders`…).

Ajouter une notification : passer par `sendPushToAll()` avec les champs
`title`, `body`, `tag` (obligatoire pour pouvoir fermer), `data: { type, url }`,
et éventuellement `promoted` / `criticalText` / `progress` / `progressMax`.

---

## Pièges vérifiés

- `POST_NOTIFICATIONS` refusée → l'app apparaît en **importance NONE** et les
  notifications sont jetées **sans erreur visible**. La permission est demandée
  au premier lancement.
- La `MainActivity` se termine dès le TWA lancé : tout travail asynchrone lancé
  depuis elle est tué. L'appairage passe donc par WorkManager.
- `setOngoing(true)` sur une notification promue est **requis**, sinon le
  système retire la puce.
- La promotion se demande en **deux endroits** : l'extra
  `android.requestPromotedOngoing` (clé non exposée par le SDK) **et**
  `notification.flags |= FLAG_PROMOTED_ONGOING` après `build()`.
  `Builder.setFlag()` seul est silencieusement ignoré.
- Un `<bitmap>` dans un `layer-list` ne peut pas pointer une icône adaptative
  (crash au démarrage) : utiliser `android:drawable`.
- Le TWA exige Chrome ; sans navigateur compatible, l'APK ne peut pas afficher
  l'app (il n'y a volontairement aucune WebView de secours).
