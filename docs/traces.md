# Traces verticales

Une trace verticale suit **une action utilisateur de bout en bout**, à travers
toutes les couches. Elle ne remplace pas la carte du code
([`code-map.md`](contributing/code-map.md)) : la carte dit où poser
un fichier, la trace dit par où passe une intention.

Règle de lecture : chaque étape est un titre, une phrase qui dit ce qui se passe
et pourquoi ce fichier existe là, puis un lien `fichier:ligne`. Aucune
paraphrase de code.

Ces traces décrivent le système **avant** le refactor modulaire. Après #84, si
une trace ne correspond plus, c'est le signal qu'un couplage a bougé : à
corriger ici, pas à ignorer.

---

## Trace 1 — Un message de chat, de la frappe au rendu

L'intention : « je tape une question et j'attends une réponse qui peut appeler
des outils ».

1. **La vue tient le fil et l'état de streaming.** `ChatView` monte la
   conversation, rejoue les messages existants et expose le bouton Stop.
   [`components/chat/ChatView.tsx:71`](../components/chat/ChatView.tsx:71)

2. **Le client ouvre un POST SSE.** `api.chat.stream` envoie les messages et le
   `sessionId` au Route Handler, puis lit le flux avec `readSse`.
   [`lib/api-client.ts:161`](../lib/api-client.ts:161)

3. **La route authentifie et borne.** Le Route Handler vérifie la session,
   valide le corps avec Zod, applique le rate limit et ouvre le flux SSE.
   [`app/api/chat/route.ts:265`](../app/api/chat/route.ts:265)

4. **La boucle d'outils pilote la génération.** Tant que le modèle demande des
   outils, la route les exécute et relance le provider ; c'est cette boucle qui
   décide quand la réponse est complète.
   [`app/api/chat/route.ts:464`](../app/api/chat/route.ts:464)

5. **Le provider est interchangeable.** `streamChatCompletion` branche OpenAI ou
   Anthropic selon le modèle demandé, sans que la route connaisse la différence.
   [`lib/ai-providers.ts:40`](../lib/ai-providers.ts:40)

6. **Les outils sont déclarés puis exécutés.** `tools` expose les schémas à
   l'agent ; `runTool`/`executeTool` valident les arguments et appliquent la
   politique de confirmation (`REQUIRE_CONFIRMATION`, `UNTRUSTED_TOOLS`).
   [`lib/chat-tools.ts:207`](../lib/chat-tools.ts:207) ·
   [`lib/chat-tools.ts:575`](../lib/chat-tools.ts:575) ·
   [`lib/chat-tools.ts:601`](../lib/chat-tools.ts:601)

7. **Une confirmation repasse par une route dédiée.** Une action externe ou
   contaminée produit un `ACTION_BLOCKED`, puis l'utilisateur confirme via
   `POST /api/chat/confirm-batch`, qui rejoue les outils avec `confirmed`.
   [`app/api/chat/confirm-batch/route.ts:18`](../app/api/chat/confirm-batch/route.ts:18)

8. **Le résultat d'outil est normalisé avant d'être affiché.** `renderToolText`
   et `classifyToolText` donnent un statut (`ok`, `error`, `empty`, `blocked`)
   et un texte honnête, au lieu du JSON brut du provider.
   [`lib/tool-result.ts:78`](../lib/tool-result.ts:78)

9. **Le fil affiche l'activité, pas seulement la réponse.** `ActivityTrail`
   rend la suite d'étapes (outil, arguments, statut) sous le message assistant.
   [`components/chat/MessageBlocks.tsx:285`](../components/chat/MessageBlocks.tsx:285)

**Ce que cette trace interdit** : appeler un outil depuis un composant, formater
du texte d'outil ailleurs que dans `lib/tool-result.ts`, ou court-circuiter la
route pour parler directement au provider.

---

## Trace 2 — Un rappel créé, stocké, notifié

L'intention : « rappelle-moi d'appeler le CROUS demain à 9 h ».

1. **La page ne parle jamais au stockage.** `handleCreate` appelle la Server
   Action et se contente de gérer l'état d'attente et le toast.
   [`app/reminders/page.tsx:89`](../app/reminders/page.tsx:89)

2. **La Server Action authentifie puis valide.** `createReminder` appelle
   `requireSession()`, valide le payload avec Zod, écrit, journalise l'activité
   et revalide `/reminders`.
   [`app/actions/reminders.ts:54`](../app/actions/reminders.ts:54)

3. **Le store domaine construit l'objet métier.** `addReminder` génère l'`id`,
   normalise les champs et délègue l'écriture : il ne connaît ni React ni HTTP.
   [`lib/storage/reminders.ts:10`](../lib/storage/reminders.ts:10)

4. **Le moteur JSON sérialise les écritures.** `mutateJson` prend un verrou,
   sauvegarde périodiquement puis écrit de façon atomique.
   [`lib/storage-core.ts:104`](../lib/storage-core.ts:104)

5. **L'écriture est un remplacement de fichier.** `writeJsonAtomic` écrit un
   `.tmp` puis le renomme, ce qui évite un `reminders.json` tronqué.
   [`lib/storage-core.ts:93`](../lib/storage-core.ts:93)

6. **Le client interroge les rappels échus.** `GET /api/reminders/pending`
   renvoie les rappels `pending` dont l'échéance est passée (avec une minute de
   marge), pour les clients non-React et le service worker.
   [`app/api/reminders/pending/route.ts:5`](../app/api/reminders/pending/route.ts:5)

7. **Une notification locale est tirée par le client.** `fireBrowserNotification`
   affiche la notification si la permission est accordée.
   [`lib/notifications.ts:23`](../lib/notifications.ts:23)

8. **Le push distant arrive par le service worker.** L'événement `push` décode
   la charge et appelle `showNotification`, y compris application fermée.
   [`public/sw.js:82`](../public/sw.js:82)

**Ce que cette trace interdit** : écrire `reminders.json` depuis une page,
dupliquer la règle de retard dans plusieurs fichiers, ou notifier sans passer
par le service worker pour l'app fermée.

---

## Trace 3 — Une connexion OAuth Google

L'intention : « je relie mon compte Google pour l'agenda et les mails ».

1. **Le démarrage OAuth fabrique un `state` signé.** La route construit un
   `state` encodé (type de compte, destination, nonce) et redirige vers Google.
   [`app/api/auth/google/route.ts:22`](../app/api/auth/google/route.ts:22)

2. **Le `state` est aussi un cookie lié au navigateur.** `encodeOAuthState` et
   le nonce en cookie `httpOnly` empêchent de rejouer un `state` volé.
   [`lib/oauth-state.ts:28`](../lib/oauth-state.ts:28)

3. **Le callback vérifie puis échange le code.** La route décode le `state`,
   compare le nonce, puis échange le code contre des tokens.
   [`app/api/auth/google/callback/route.ts:18`](../app/api/auth/google/callback/route.ts:18)

4. **L'échange vit dans le client Google.** `exchangeAuthorizationCode` isole
   l'appel réseau et les erreurs du provider.
   [`lib/google-client.ts:179`](../lib/google-client.ts:179)

5. **Les tokens sont écrits comme n'importe quelle donnée.** `saveTokens`
   préserve le `refresh_token` existant et réutilise `writeJsonAtomic`.
   [`lib/google-client.ts:52`](../lib/google-client.ts:52)

6. **Les appels suivants passent par un client rafraîchi.** `getGoogleClient`
   recharge les tokens, rafraîchit si nécessaire et marque la liaison cassée en
   cas d'échec, pour que l'interface propose de relier à nouveau.
   [`lib/google-client.ts:135`](../lib/google-client.ts:135)

7. **L'état de la liaison est exposé séparément.** `GET /api/auth/google/status`
   répond à l'interface sans jamais renvoyer les tokens.
   [`app/api/auth/google/status/route.ts:9`](../app/api/auth/google/status/route.ts:9)

**Ce que cette trace interdit** : lire un token Google depuis un composant,
stocker un token ailleurs que par `saveTokens`, ou faire un `fetch` OAuth à la
main dans une route.
