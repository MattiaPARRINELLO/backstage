# BACKSTAGE — architecture et invariants

Complément de [`AGENTS.md`](../AGENTS.md) : ce document garde le **détail** des
mécanismes non évidents. `AGENTS.md` énonce les règles ; ici on explique
pourquoi elles existent et ce qui casse si on les ignore.

---

## Pages particulières

- `/chat` — accueil = `components/chat/HomeHero.tsx` (affiché seulement quand la
  conversation est vide). Agrégat serveur `getHomeOverview()` (`app/actions/home.ts`,
  lectures `data/*.json` uniquement — aucun appel réseau) + **cache client partagé**
  avec les widgets du panneau de droite (`CALENDAR_CACHE_KEY`, `GMAIL_CACHE_KEY`
  exportés par `components/widgets/`). ➡️ Ne jamais dupliquer ces fetchers : réutiliser
  les mêmes clés, sinon l'accueil déclenche des requêtes réseau en double.
  L'ancienne exception visuelle (dégradés radiaux, sheen, particules,
  animations d'inactivité) est **supprimée** : l'accueil suit la direction
  commune (cf. `design.md` §1 et §6). Il ne reste que `home-rise`, `home-swap`
  et `home-caret`.
  ⚠️ La composition d'accueil est **ancrée en haut** et le conteneur de
  `ChatView.tsx` n'a **pas** de padding haut dans ce cas : c'est ce qui amène le
  tour de cou du badge détaillé (`/backstage-logo.png`) jusqu'au bord supérieur
  de la fenêtre, qui tient alors lieu de ligne de coupe. Réintroduire
  `py-8 sm:py-12` ou `justify-center` casse l'effet (et fait déborder la
  colonne). La marge négative de `HomeHero.tsx` est **mobile uniquement**. Le
  logo simple reste l'icône partout ailleurs.
- Panneau de droite (`components/layout/ContextPanel.tsx`) — 5 vues : « Flux »
  (défaut) = `FluxTimeline.tsx`, qui **fusionne cours + événements agenda +
  rappels** en une ligne de temps groupée par jour ; puis Agenda / Inbox / Code /
  Photos, qui réutilisent les widgets de `components/widgets/`. Un bloc « En
  retard » plafonné à 4 entrées précède la ligne de temps. Quand un outil IA
  tourne, le panneau bascule sur une vue contextuelle (ne pas casser ce chemin).
- `components/chat/SessionSidebar.tsx` — historique des conversations. Bandeau de
  3 compteurs en pied, alimenté par `home:overview` + `GMAIL_CACHE_KEY`
  (mêmes clés partagées, aucune requête supplémentaire).
- ⏱️ `lib/clock.ts` expose `useNow()` : horloge partagée (tick 30 s) dont le
  **snapshot serveur vaut 0**. C'est ce qui rend les salutations et l'heure live
  hydratation-safe. Ne pas réintroduire de `useState`/`useEffect` pour ça :
  la règle ESLint `react-hooks/set-state-in-effect` du projet le refuse.
- `/today` — page d'agrégat « Aujourd'hui » (rappels du jour, agenda, relances),
  2e destination du rail.
- `/gallery` — redirige vers `/photos` (la galerie de livraison est la vue
  « Livraison » de Photos, `app/photos/GalleryKanban.tsx`).
- `/photos` — kanban shootings + toggle de vue « Shootings / Livraison ».
- `/demo-calls` — console privée authentifiée des appels IA de la démo publique
  (`/api/demo`) : question/réponse, IP, user-agent, statut, durée et sources.
- `/schedule` — emploi du temps CESAR (vue semaine + bouton Sync). Nourrit aussi
  la section « Cours » de `/today`, le daily brief et les notifications −30 min.

---

## Auth & sécurité

### Ajout d'une clé d'accès sur un autre appareil (`lib/passkey-pairing.ts`)

Une passkey est liée à l'appareil (ou au gestionnaire de clés) qui l'a créée.
Comme l'enregistrement d'une clé supplémentaire exige une **session active**
(`register-options` renvoie `401` sinon), un PC n'a aucun moyen d'obtenir sa
propre clé quand la seule passkey vit sur le téléphone — et le QR code
« utiliser un téléphone » échoue si la clé est dans un fournisseur qui ne
répond pas au protocole hybrid (Samsung Pass, par exemple).

Le pont est un **code d'appairage** :

| Étape | Où | Quoi |
| ----- | -- | ---- |
| 1 | `/settings` → Sécurité → « Ajouter un appareil » | `createPasskeyPairing()` (Server Action, `requireSession`) génère un code de 10 caractères, TTL 10 min, 5 codes en attente max |
| 2 | Autre appareil | `https://<domaine>/login?pair=<code>` : `register-options` accepte le header `x-pair-code` |
| 3 | `register-verify` | le code est **consommé** (`consumePasskeyPairCode`) puis la clé enregistrée et la session ouverte |

- Le code ne remplace jamais la biométrie : il autorise seulement l'appareil
  inconnu à lancer la cérémonie WebAuthn. Il est à usage unique, jamais stocké
  en clair ailleurs que dans `data/passkey-pair-codes.json` (inespionnable sans
  session, le fichier reste côté serveur).
- Un code invalide/expiré est une **impasse explicite** sur `/login`, pas un
  repli silencieux vers « Se connecter » (qui ne peut pas aboutir sans clé).
- Ne pas remplacer ce mécanisme par un `SETUP_TOKEN` réutilisable : cela
  rouvrirait l'enregistrement public d'une nouvelle passkey.

### OAuth : `state` lié au navigateur (`lib/oauth-state.ts`)

Les callbacks Google et Microsoft ne font plus confiance au `state` seul : il
est du JSON base64url non signé, donc forgeable. Le nonce est émis par le
serveur à l'initiation et renvoyé dans un cookie `httpOnly` `pb_oauth_state`
(`sameSite: "lax"`, `secure` en production, `path: "/"`, 10 min).

- Callback : `state` illisible, nonce absent ou différent du cookie →
  **400 `state OAuth invalide`**, avant tout échange de code. Aucun repli
  silencieux sur `gmail` ni sur une destination par défaut.
- Google : le `type` (`gmail` | `calendar`) doit être explicite ; la destination
  `?redirect=` est résolue **à l'initiation** contre l'origine du serveur, donc
  `//evil.com`, `/\evil.com` et les URL absolues retombent sur `/chat`. Le
  callback revérifie `destination.origin === new URL(request.url).origin` et
  refuse sinon en 400.
- Microsoft : mêmes contrôles, destination finale `/reminders?todo=linked`.
- Le cookie de nonce est effacé sur toutes les réponses terminales, succès
  comme erreur.
- Pas de PKCE dans ce lot : le modèle d'authentification est inchangé.

### Routes notables hors `/api/auth`

- `/api/chat/confirm` — **exécute les outils IA à effet externe après
  confirmation utilisateur** (bouton Confirmer/Annuler dans le chat). Session
  requise ; seuls les outils listés dans `REQUIRE_CONFIRMATION`
  (`lib/chat-tools.ts`) sont exécutables ; journalise dans `activity.json`
  (`ai_action`). Le modèle ne peut jamais s'auto-confirmer.
- `/api/chat/stream` — `GET ?sessionId=` se **réattache** à une génération en
  cours : instantané (`snapshot`) puis suite du flux en direct. `204` si aucune
  génération active. Utilisé au retour sur une conversation.
- `/api/chat/stop` — `POST { sessionId }` arrête explicitement la génération
  (bouton Stop / Esc). Seul chemin qui annule la requête IA : une simple
  déconnexion du client ne l'annule plus (cf. ci-dessous).
- `/api/reminders/[id]/done` — reproduit `markReminderStatus` (push MS +
  revalidation) ; appelé par le service worker.
- `/api/schedule` — `GET` = emploi du temps en cache, `POST` = sync CESAR forcée.
  Doublon assumé de `syncScheduleNow` (`app/actions/schedule.ts`).
- `/install.sh` — `GET` sert `scripts/install.sh` (source unique, versionnée) en
  `text/x-shellscript`. Public (cf. `PUBLIC_PATHS`). Le fichier est embarqué dans
  le build standalone via `outputFileTracingIncludes` (`./scripts/*.sh`) : si on
  déplace le script, mettre à jour `next.config.ts` **et** `app/install.sh/route.ts`.
  La landing affiche la commande (`INSTALL_COMMAND` dans `app/landing-content.ts`).

### Trois implémentations de session — ne pas confondre

| Fichier               | Runtime   | Usage                                                                              |
| --------------------- | --------- | ---------------------------------------------------------------------------------- |
| `lib/session-edge.ts` | edge/node | proxy (`proxy.ts`) uniquement                                                      |
| `lib/session-core.ts` | node      | logique JWT + `fs`                                                                 |
| `lib/session.ts`      | node      | **à importer dans les Server Actions** — expose `requireSession()`, `getSession()` |

### Helpers sécurité — état réel

| Helper                  | Fichier             | Consommé par                           |
| ----------------------- | ------------------- | -------------------------------------- |
| `checkRateLimit(key)`   | `lib/rate-limit.ts` | `app/api/chat/route.ts` **uniquement** |
| `isAuthorizedCron(req)` | `lib/cron-auth.ts`  | les 2 routes `/api/cron/*`             |

⚠️ **Dette connue** : pas de protection CSRF active (seule atténuation :
`SameSite=lax`). Les Server Actions ne sont pas rate-limitées. Si tu ajoutes une
action coûteuse (IA, scraping), signale-le.

### next.config.ts — headers

Toujours : `X-Frame-Options: DENY`, `X-Content-Type-Options`, `Referrer-Policy`,
`Permissions-Policy`, `X-DNS-Prefetch-Control`.
En production seulement : `HSTS` + `CSP`.

⚠️ La CSP autorise `script-src 'unsafe-inline'` — requis par les scripts inline
de préchargement RSC de Next. Ne pas « corriger » sans vérifier que l'app démarre.

⚠️ `outputFileTracingIncludes` embarque les icônes, les scripts shell **et
`sharp`** dans le build standalone : ces fichiers sont lus au runtime (`fs`,
exécution shell, `require()` dynamique), donc l'analyse statique des imports ne
les voit pas. Sans `sharp`, `/_next/image` répond `500` (« Module sharp not
found ») et **toutes** les images `next/image` sont cassées en production.

⚠️ Toujours copier `public/` **après l'avoir supprimé** dans un déploiement
standalone : `.next/standalone` embarque déjà un `public/` partiel (tracing), et
un `cp -r public "$DEPLOY/public"` créerait `public/public/` → tous les assets
(logos, `manifest.json`, `sw.js`, captures) en **404**. Même piège que `data/`.

---

## Chat

### Génération survivant à la navigation (`lib/chat-runs.ts`)

Le tour de chat **n'est plus possédé par la page**. Trois pièces :

| Pièce | Rôle |
| ----- | ---- |
| `lib/chat-runs.ts` (serveur) | Registre en mémoire d'un run par `sessionId` : instantané (texte accumulé, outils, lots à confirmer), abonnés, `AbortController`. Purge 10 min après la fin, 20 runs max. |
| `components/chat/live-run.ts` (client) | Le `fetch` SSE vit **hors React** : changer de page démonte `ChatView` sans couper la requête ; les évènements sont bufferisés et rejoués au retour. Une coupure réseau (app en arrière-plan, réseau mobile) déclenche une **reconnexion automatique** vers `/api/chat/stream`, sans jamais afficher le `Failed to fetch` brut. |
| `ChatLayout` | Mémorise la conversation active dans `sessionStorage` (`pb:active-chat-session`) pour rouvrir la bonne conversation au retour sur `/chat`. |

- **Coupure réseau = détachement, pas erreur.** `live-run.ts` attend le retour
  au premier plan (`visibilitychange`) et le réseau (`online`) avant de se
  réattacher, avec un backoff plafonné. Si le run serveur a disparu, il
  recharge l'historique ; si la requête initiale n'est jamais arrivée, il
  demande de renvoyer le message.
- **Battement de cœur SSE** (`: keep-alive` toutes les 15 s) sur `/api/chat` et
  `/api/chat/stream` : une longue recherche d'outil laissait la connexion
  muette assez longtemps pour qu'Apache/Passenger ou nginx la coupe.
- **`cancel()` du flux ne coupe plus la génération.** Une déconnexion (navigation,
  onglet fermé) détache seulement le listener ; la boucle IA continue.
- **La réponse est écrite côté serveur** (`appendAssistantTurn`) avant
  l'extraction mémoire, donc même onglet fermé la réponse est dans
  `chat-history.json` au retour. L'écriture est idempotente : si le client a
  déjà sauvegardé la même réponse, aucun doublon n'est créé.
- **Arrêt explicite uniquement** via `POST /api/chat/stop` (bouton Stop / Esc) :
  sans ça, un Stop serait indiscernable d'une fermeture d'onglet. La réponse
  partielle déjà streamée est conservée.
- L'évènement `done` marque le run `finished` **avant** l'écriture disque : un
  client qui se réattache dans l'intervalle n'attend pas indéfiniment.
- ⚠️ Le registre est **en mémoire, process unique** (comme le scheduler et le
  rate-limit). Un redéploiement en cours de génération la perd ; un déploiement
  multi-instance nécessiterait un stockage partagé.

### Commenter un extrait de réponse (`components/chat/SelectionComment.tsx`)

Sélectionner du texte dans une réponse de l'IA ouvre une micro pop-up
(`pointerup` + `keyup`, jamais dans un message utilisateur grâce à
`data-chat-role="assistant"`). L'extrait et son commentaire s'empilent comme
modules au-dessus du champ d'envoi.

- **Format du message** : `formatQuotedMessage` (`components/chat/chat-data.ts`)
  sérialise chaque extrait en citation Markdown suivie de `Commentaire : …`. Le
  modèle reçoit donc une citation lisible, et `parseQuotedMessage` reconstruit
  les cartes à l'affichage comme à la relecture de l'historique.
- **Pas de champ dédié en base** : le contenu du message porte tout ; les
  conversations existantes restent lisibles.
- **Pièges évités** : ne pas différer la lecture de la sélection avec
  `requestAnimationFrame` (un onglet non peint ne le déclenche jamais) ; la
  pop-up ne doit pas voler la sélection (`mousedown` neutralisé), et les
  boutons d'envoi restent actifs même sans texte libre.

### Fil d'activité du tour

Chaque tour assistant affiche **un seul fil d'activité**, au-dessus de la
réponse : une ligne repliée, un rail vertical une fois ouvert.

- `lib/chat-runs.ts` conserve `steps` (`thought` | `tool`), dans l'ordre réel de
  la génération. Les évènements `reasoning` (thinking Anthropic,
  `reasoning_content` OpenAI) sont cumulés dans l'étape pensée courante,
  plafonnés à `MAX_THOUGHT_CHARS` (4 000). Ils restent absents si le modèle
  n'expose pas sa réflexion : aucune pensée n'est inventée.
- L'instantané (`snapshot`) transporte `steps` en plus de `tools` /
  `activeTools` : une reprise au milieu d'un tour restitue le fil complet.
- Chaque outil porte sa **durée réelle** (`toolStartedAt`, mesurée par appel) ;
  l'en-tête affiche la durée totale du tour (`activityMs`).
- Le fil est persisté avec le message (`steps`, `activityMs` dans
  `chat-history.json`). Les tours antérieurs, qui n'ont que `toolCalls`, sont
  reconstruits à l'affichage (`stepsOf`).
- Rendu : `ActivityTrail` dans `components/chat/MessageBlocks.tsx`. Les cartes
  d'action du bas ont disparu : un résultat d'outil ne s'affiche plus que dans
  le fil.

### Statut des outils IA — ne jamais annoncer une action non faite

`lib/tool-result.ts` (module **pur**, sans import) définit le statut machine
d'une exécution d'outil : `ok` / `error` / `empty` / `blocked`.

- `runTool(name, args, confirmed)` (`lib/chat-tools.ts`) est le **point d'entrée
  unique** : il appelle `executeTool`, classifie le texte (`classifyToolText` :
  « Erreur », « introuvable », « inconnu », « ACTION_BLOCKED »…) et renvoie
  `{ status, text, rendered }`. Le texte envoyé au modèle est préfixé
  `[OK]` / `[ERREUR]` / `[VIDE]` / `[BLOQUE]`.
- Les écritures locales (rappel, relance, watch-later, mémoire, shooting) sont
  **vérifiées par relecture** (`verifyWrite`) : si l'élément n'est pas
  retrouvé après enregistrement, l'outil renvoie une erreur. C'est ce qui
  empêche l'agent d'annoncer « rappel créé » alors que rien n'a été écrit.
- `app/api/chat/route.ts` envoie `status` dans l'événement SSE `tool_result`
  (consommé par `ChatView` / `MessageBlocks`, ligne d'outil en échec dans le
  fil d'activité) et injecte `TOOL_HONESTY_RULE` dès qu'un résultat n'est pas
  `[OK]`.
- `/api/chat/confirm-batch` dérive `ok` du **statut**, plus du texte : un
  résultat « Rappel introuvable. » sans exception est affiché comme un échec.
- Après une confirmation, le client reporte le résultat sur l'appel d'outil
  concerné (`status: "success"`), puis transmet au tour suivant un bloc
  `actionContext` limité aux **outils à effet de bord** (`SIDE_EFFECT_TOOL_NAMES`
  dans `lib/tool-result.ts`). La route l'injecte dans le prompt système sous
  `<executed_actions>`. Sans ça, le modèle repart d'un contexte où l'action est
  encore « bloquée » et affirme que le mail n'est pas parti. Les résultats de
  lecture (emails, pages web) sont exclus : contenu externe non fiable.

➡️ Tout nouvel outil d'écriture doit passer par `runTool` et se vérifier par
relecture. Tout nouvel consommateur doit utiliser le statut, jamais une
recherche de sous-chaîne dans le texte.

### Provenance des écritures (`UNTRUSTED_TOOLS` / `WRITE_TOOLS`)

La politique produit ne généralise pas les confirmations : seul
`send_email_response` est sensible par nature. En revanche, une écriture
**induite par du contenu tiers** (corps d'email, page web, issue GitHub, météo,
description d'événement) ne peut pas être distinguée d'une demande utilisateur
par le seul texte du modèle. Le serveur la gate donc :

- `UNTRUSTED_TOOLS` = outils dont le résultat vient d'une source externe
  (`web_search`, `fetch_and_search_emails`, `fetch_page_meta`, `triage_emails`,
  `search_calendar_events`, `list_github_issues`, `lookup_concerts`,
  `get_weather`, `prepare_concert`).
- `WRITE_TOOLS` = outils qui modifient des données (rappels, calendrier,
  shootings, accréditations, watch-later, mémoire, issue GitHub, email).
- Le taint est calculé **sans état serveur** : tout `<tool_result
  name="...">` d'un outil non fiable présent dans les messages reçus, ou tout
  appel non fiable du lot courant, contamine le tour. Il s'accumule sur les
  itérations du tour et reste actif tant que le contenu figure dans
  l'historique.
- Une écriture d'un tour contaminé n'est pas exécutée : elle est enregistrée
  dans le registre d'actions en attente avec `reason: "provenance"` et proposée
  via une carte de confirmation. Sans contenu externe, `add_reminder` et
  `create_calendar_event` restent directs.
- Exception permanente : `add_memory_fact` est dans `REQUIRE_CONFIRMATION`
  (`reason: "policy"`), car un fait piégé est réinjecté dans le prompt système
  des tours suivants.
- `lib/chat-prompts.ts` place les faits mémorisés **sous** l'avertissement
  « contenu non fiable », dans `<memory_facts source="donnees">`. Ce n'est pas
  un contrôle d'autorisation : l'autorisation est dans `app/api/chat/route.ts`.

### Mémoire automatique — deux chemins, une seule écriture

L'IA alimente `data/memory.json` par **deux** voies, qui partagent le même
moteur d'écriture (`lib/memory-autosave.ts`) :

| Voie                    | Déclencheur                                            |
| ----------------------- | ------------------------------------------------------ |
| Outil `add_memory_fact` | le modèle juge un fait durable, sans qu'on le demande  |
| `runMemoryExtraction`   | à chaque fin de tour de chat (`app/api/chat/route.ts`) |

- **`lib/memory-autosave.ts` ne vérifie PAS la session** : il est appelé soit
  depuis une Server Action déjà authentifiée (`app/actions/brain.ts`), soit
  depuis la route de chat (session vérifiée en tête de handler). Ne jamais y
  remettre `requireSession()` — hors scope requête Next, ça jette.
- **Dédoublonnage obligatoire** : `findSimilarMemoryFacts` avant toute
  création, sinon `touchMemoryFact`. Un fait déjà connu est renforcé, pas
  recréé. Les sources sont `manual` / `tool` / `auto-extract`.
- **Garde anti-perte** (`lib/memory-dedup.ts`, module pur) : un fait qui apporte
  une entité absente du fait existant (nom propre, chiffre, URL, pseudo) n'est
  PAS un doublon — il est créé. Sans elle, « collabore avec Rapstar, portfolio
  photo.mprnl.fr » était absorbé par « Est photographe live & concert » et
  l'information était perdue en silence. Deux autres pertes sont couvertes :
  un fait hors sujet n'est jamais un doublon (assez de mots porteurs communs
  exigés — « pas de carte de presse » ne peut plus être absorbé par un fait sur
  un photographe), et une négation face à une affirmation est une
  contradiction, pas une reformulation. `findSimilarMemoryFacts` ne renvoie
  qu'un candidat : c'est la garde, pas la proximité de thème désignée par l'IA,
  qui décide. La garde est appliquée aux **quatre** chemins d'écriture
  (`add_memory_fact`, `rememberFact`, `/api/memory/remember`,
  `persistExtractedFacts`).
- **Un dédoublonnage n'est pas un succès** : `add_memory_fact` répond
  « Rien de nouveau : deja en memoire -> … », classé `empty` par
  `classifyToolText`. En `ok`, le modèle annonçait « c'est retenu » alors que
  rien n'avait été écrit.
- **Le parsing d'extraction est volontairement tolérant** (puce markdown,
  gras, virgule décimale, pourcentage) mais **exige une confiance explicite** :
  sans elle, une phrase de commentaire (« Dev : rien à signaler ») deviendrait
  un fait. Seuil `MIN_FACT_CONFIDENCE` = 0.7, plafond `MAX_FACTS_PER_TURN` = 8.
- **`runMemoryExtraction` est `await`** dans `finishTurn()` avant
  `controller.close()`. Ne pas la repasser en `void` : détachée, elle perdait
  l'écriture en silence. Le client lit le flux jusqu'à sa fermeture, l'événement
  SSE `memory_facts` (toast « 🧠 N faits mémorisés ») arrive donc bien après le
  `done`.
- Le prompt d'extraction reçoit les faits **déjà en mémoire**
  (`listFactsForExtractionPrompt`) pour ne pas les ré-extraire à chaque tour.

---

## Emploi du temps CESAR (`lib/cesar-client.ts`)

⚠️ **Aucun navigateur en prod** (cPanel `npm install --production`, pas de
Chromium) : le client est du **fetch HTTP pur** — `GET /connexion` (CSRF) →
`POST` login → skip de l'écran CVEC → `GET /schedule` → décodage de l'attribut
`data-tui-calendar-event-lesson-schedules-value` (JSON de toutes les séances).
Ne jamais réintroduire Playwright ici : ça casse la prod standalone.

- Sortie normalisée : `ScheduleCourse` (matière, prof, salle+bâtiment, start/end
  en ms, annulés filtrés) dans `data/schedule.json`.
- ⚠️ `getNextCourse()` (`lib/storage/schedule.ts`) retourne le premier cours dont
  `end > now` — donc **le cours en cours s'il y en a un**, et il ne filtre pas
  `cancelled`. Pour « le prochain à venir », filtrer `!cancelled` puis `start > now`.
- Sync automatique : `syncScheduleIfStale()` (notification-scheduler) si l'EDT a
  plus de 6 h, est vide, ou si le dernier sync a échoué. Garde anti-concurrence
  dans `lib/storage/schedule.ts`.
- Notifications : `checkScheduleNotifs()` envoie un push **1 h avant** chaque
  cours (salle en titre, heure + prof en corps), **rafraîchi silencieusement
  chaque minute** (barre de progression), fermé au démarrage de la séance —
  registre `data/live-notifs.json`, qui sert d'anti-doublon et de source pour la
  fermeture.
- Chat : outil **lecture seule** `get_schedule` (`scope: today|week|next`,
  `subject` optionnel) — jamais dans `REQUIRE_CONFIRMATION`.
- Daily brief : bloc « Cours du jour » + instruction de citer la salle du
  prochain cours.

---

## Notifications push (`lib/notification-scheduler.ts`)

Deux canaux, un seul point d'envoi : **web push** (`lib/send-push.ts` +
`lib/push-subscriptions.ts`, VAPID) pour la PWA, et **FCM** (`lib/fcm.ts` +
`lib/fcm-devices.ts`) pour l'APK Android. `sendPushToAll(payload)` alimente les
deux avec le même JSON ; une panne FCM ne bloque jamais le web push. Le payload
web est rendu par `public/sw.js` ; côté APK il est **data-only** et c'est
`Notifications.java` qui construit la notification (canal, persistance, Live
Update).

- **Événements** : cours (`checkScheduleNotifs`, −60 min), rappels
  (`checkReminders`), relances (`checkIntentions`), brief du jour
  (`triggerDailyBrief`). Tous passent par `sendPushToAll(payload)`.
- **Urgence** : toutes les notifs sont envoyées en `urgency: "high"` (livraison
  immédiate par le push service, pas de regroupement) avec `TTL` 1 h
  (`lib/send-push.ts`). Côté payload, `requireInteraction`, `renotify`,
  `silent: false`, `timestamp` et une vibration marquée les rendent persistantes
  et visibles sur le téléphone. `renotify` **exige** un `tag` (toujours fourni).
- **`sent`** est vrai dès qu'un appareil abonné (web **ou** natif) a reçu le
  push — sinon un rappel serait retenté toutes les 60 s indéfiniment.
- **Démarrage** : le scheduler ne dépend **pas** de VAPID. Il tournait avant
  uniquement si les clés web étaient présentes, ce qui éteignait aussi les
  notifications natives d'un déploiement APK-seul.
- **Live Updates (Android 16)** : un message avec `promoted: true` devient une
  vraie Live Update (carte promue en haut du tiroir, barre de progression, puce
  dans la barre d'état). La recette exacte, validée sur un S24 sous Android 16 :
  `setOngoing(true)` + `setOnlyAlertOnce(true)` + `setShortCriticalText()` +
  `setColor()` + `ProgressStyle` avec **un segment coloré**, plus la demande de
  promotion via l'extra `android.requestPromotedOngoing` **et**
  `notification.flags |= FLAG_PROMOTED_ONGOING`. `Builder.setFlag()` seul ne
  suffit pas : le drapeau n'arrive pas dans la notification postée (constaté en
  comparant `dumpsys notification`). Le système peut la refuser selon l'app-op
  `POST_PROMOTED_NOTIFICATIONS` ; dans ce cas elle redevient une notification
  persistante classique, jamais perdue. Vérifier la promotion :
  `adb logcat | grep "live update"` (`promotable=true`) et `dumpsys
  notification | grep PROMOTED_ONGOING`. Les cours sont promus : carte postée à
  1 h avant, fermée dès que le cours commence (`data/live-notifs.json` — une fois
  la séance entamée elle n'apprend plus rien) ; un message `dismiss: true`
  ferme la notification du `tag` correspondant. **Les deux canaux doivent
  traiter ce message** : `public/sw.js` ferme via
  `registration.getNotifications({ tag })` (sinon le SW ré-affichait un message
  vide avec le même `tag`, et la carte restait dans le tiroir après le cours),
  et `Notifications.java` annule via `NotificationManagerCompat.cancel(id)`. Le
  registre ne purge une carte qu'une fois la consigne réellement délivrée à un
  appareil (5 tentatives max), sinon la notification devenait orpheline.
  **Rafraîchissement** : une carte
  affichée est renvoyée chaque fois que les minutes restantes changent
  (`sentMin` du registre), avec `silent: true` / `renotify: false` côté web et
  `setOnlyAlertOnce(true)` côté APK — sinon le texte figé (« dans 60 min ») ne
  bouge plus jusqu'à la fin. Règle verrouillée par
  `lib/__tests__/course-notifications.test.ts`.
- **Rappels** : même règle que les cours — carte promue postée 1 h avant
  l'échéance (`REMINDER_LEAD_MIN`), fermée par `dismissReminderCard(id)` dès que
  le rappel est fait, supprimé ou reporté (`app/actions/reminders.ts`,
  `/api/reminders/[id]/done`, `/api/reminders/[id]/snooze`), ou quand un tick
  constate qu'il n'est plus `pending` (sync Microsoft, autre client). Le même
  registre `data/live-notifs.json` porte cours **et** rappels (`kind`).
  Attention : le canal Android d'une carte est celui de son type — un rappel
  sonne, il n'est pas silencieux comme le canal `live`. Le compte à rebours
  (« Rappel dans N min ») est rafraîchi selon la même règle que les cours.
  Tests : `lib/__tests__/reminder-cards.test.ts`.
- **Appairage APK** : le TWA vit dans Chrome, l'APK n'a donc pas le cookie de
  session. `app/actions/push.ts` génère un code à usage unique (10 min) →
  `backstage://pair?code=…` → `app/api/push/fcm/pair` renvoie un secret
  d'appareil, stocké **haché** (`data/fcm-devices.json`). Ne jamais remplacer ça
  par un secret d'appairage partagé dans l'APK : il ouvrirait les notifications
  privées à quiconque l'extrait.
- **Anti-doublon du brief** : le cron cPanel (`0 7 * * *`) et le scheduler
  interne visent la même minute ; `triggerDailyBrief` n'envoie qu'une fois par
  jour (`data/notified-briefs.json`, 7 jours d'historique) sauf source
  `page-test`, qui reste un renvoi manuel volontaire. Le marquage n'a lieu que
  si l'envoi a réellement abouti.

---

## Intégrations externes

| Service                  | Client                                                           | Tokens                                           |
| ------------------------ | ---------------------------------------------------------------- | ------------------------------------------------ |
| Google (Gmail, Calendar) | `lib/google-client.ts`, `lib/google-actions.ts`                  | `data/{gmail,calendar}-token.json`, refresh auto |
| Microsoft To Do          | `lib/microsoft-client.ts`, `lib/reminder-sync.ts`                | `data/microsoft-todo-token.json`                 |
| LeetCode                 | `lib/leetcode-api.ts`                                            | —                                                |
| Web search               | `lib/web.ts` — Brave + fallback DuckDuckGo, garde SSRF           | —                                                |
| Emploi du temps CESAR    | `lib/cesar-client.ts` (fetch pur, aucun navigateur)              | `CESAR_USERNAME` / `CESAR_PASSWORD`              |
| Météo                    | OpenWeatherMap (`lib/daily-brief.ts`, `lib/storage/concerts.ts`) | —                                                |
| GitHub (issues)          | `lib/github-actions.ts` — REST API, fetch pur                    | `GITHUB_TOKEN` + `GITHUB_REPO`                   |
| Push                     | `lib/send-push.ts`, `lib/push-subscriptions.ts`                  | VAPID                                            |

⚠️ **Sync bidirectionnelle Microsoft** : `loadReminders()` appelle
`reconcileRemindersWithMicrosoft()` ; create/update/delete poussent vers MS.
Toute modification du CRUD rappels doit préserver ces appels.

⚠️ **API LeetCode — pièges vérifiés** (`alfa-leetcode-api.onrender.com`, tier
gratuit : démarrage à froid possible) :

- Les compteurs ne sont **pas** sur `/{pseudo}` (qui ne renvoie que le profil)
  mais sur `/{pseudo}/solved` (`solvedProblem`, `easySolved`…). Les lire sur le
  profil donne quatre zéros silencieux.
- Un pseudo inconnu répond **HTTP 200** avec un tableau `errors` : le code HTTP
  ne suffit pas, il faut inspecter le corps.
- `/{pseudo}/calendar` renvoie `submissionCalendar`, une **chaîne JSON**
  `{ "<epoch secondes>": n }` (minuit UTC, jours actifs seulement) et un champ
  `streak` de sémantique non documentée : la série est **recalculée** par
  `computeStreak()` (`lib/leetcode-utils.ts`), jamais lue depuis l'API.
- `/{pseudo}/contest` est facultatif : un compte sans concours renvoie
  `contestParticipation: []` et son échec ne doit pas priver du reste.
- `ranking` vaut 5 000 001 tant que le compte n'est pas classé → afficher
  « non classé » (`UNRANKED_RANKING`), jamais le nombre brut.

La synchro est pilotée par un TTL de 30 min (`SYNC_TTL_MS` dans
`app/actions/leetcode.ts`) et non plus par `streak === 0`, qui figeait les
chiffres à vie. L'échec d'un sync est remonté via `syncError` (jamais persisté) :
ne pas réintroduire de `catch {}` vide, c'est ce qui a masqué la panne.

### Issues GitHub (`lib/github-actions.ts`)

Deux outils : `create_github_issue` et `list_github_issues`. L'agent peut donc
ouvrir une issue de bug (avec les infos de debug disponibles) ou une demande de
fonctionnalité.

- **Dépôt figé** par `GITHUB_REPO` (`owner/nom`) : aucun argument d'outil ne
  peut changer la cible, donc un contenu externe injecté (email, page web) ne
  peut pas détourner l'écriture vers un autre dépôt.
- **Pas de confirmation** : la création s'exécute directement, comme les autres
  écritures locales, sauf si le tour est contaminé par du contenu externe
  (cf. § *Provenance des écritures*). Un jeton limité aux issues
  (`issues: write`) est la seule protection de périmètre — le révoquer désactive
  proprement la fonctionnalité.
- **Libellés restreints** à `bug`, `enhancement`, `documentation` : un libellé
  absent du dépôt ferait échouer la création.
- `list_github_issues` écarte les pull requests (l'API les renvoie dans
  `/issues`).
- Le prompt impose de vérifier l'existence d'une issue équivalente avant
  création, et d'annoncer **l'URL renvoyée par l'API**, jamais une URL composée.

---

## Mode développement sans clé ni passkey

Deux interrupteurs, réservés au développement local :

| Variable | Effet | Garde |
| -------- | ----- | ----- |
| `AI_PROVIDER=mock` | `lib/ai-providers/mock.ts` répond à la place du modèle (aucun appel réseau, catalogue `mock-backstage`) | aucune, mais la valeur n'a d'effet que si elle est présente |
| `DEV_AUTH_BYPASS=true` | `GET /api/auth/dev-login` ouvre une session `owner` sans WebAuthn | `NODE_ENV !== "production"` **et** valeur exacte, sinon 404 |

`bun run setup:dev` écrit ces deux variables dans `.env.local`. Ne jamais les
activer sur une instance exposée : `DEV_AUTH_BYPASS` ouvrirait l'application à
quiconque atteint l'URL.

---

## instrumentation.ts — piège documenté

```ts
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("dotenv/config");
    const { startScheduler } = await import("./lib/notification-scheduler");
    startScheduler();
  }
}
```

⚠️ Les imports sont **dynamiques et gardés par `NEXT_RUNTIME`** volontairement.
Un import statique de `dotenv` embarque `fs`/`path`/`os`/`crypto` dans le bundle
edge et **crashe le proxy** (`__import_unsupported is not defined`).
**Ne pas convertir en imports statiques.**

---

## Contrat du provider IA (OpenCode Go)

`NEXT_PUBLIC_API_URL` = `https://opencode.ai/zen/go/v1`. Le provider impose deux
choses, réunies dans `lib/ai-providers/config.ts` :

- **`x-opencode-session` obligatoire** (identifiant stable par conversation) —
  sans lui : `400 MissingSessionID`. La session remonte depuis le client
  (`ChatView` → `api.chat.stream` → body `sessionId` → route → adaptateur) ;
  les appels hors conversation utilisent `DEFAULT_SESSION_ID`.
- **User-Agent dédié** (`personalbrain/1.0`), pas celui du SDK.

⚠️ Les deux SDK n'attendent pas la même baseURL : le SDK **OpenAI** reçoit
l'URL complète (`/v1/chat/completions`), le SDK **Anthropic** ajoute lui-même
`/v1` — d'où `getAnthropicClientConfig()` qui retire le suffixe `/v1`, sinon
`/v1/v1/messages` → 404.

⚠️ **Les identifiants de modèles périment vite** (`deepseek-v4-flash` →
`400 Model is unavailable`, `kimi-k2.6` → `410 ModelDeprecated`). Ne jamais
réécrire une liste à la main comme source de vérité :

- `lib/ai-providers/models.ts` interroge `GET /models` (cache 1 h) et lit le
  protocole déclaré par le provider (`api.messages` → SDK Anthropic,
  `chat-completions` → OpenAI, `responses`, `generate-content`).
  `getModelProtocol()` est **synchrone** (cache seulement) car le routage SDK ne
  peut pas attendre un appel réseau ; cache froid → repli statique.
- `lib/app-config.ts` (`getModel`, `getTitleModel`) remplace automatiquement un
  modèle configuré qui n'existe plus par un modèle vivant du catalogue déjà en
  cache, et rafraîchit ce catalogue en arrière-plan sinon.
- Les constantes `OPENAI_MODELS` / `ANTHROPIC_MODELS` de
  `lib/ai-providers/config.ts` ne sont qu'un **repli hors ligne** : elles ne
  doivent contenir que des modèles vérifiés vivants.
