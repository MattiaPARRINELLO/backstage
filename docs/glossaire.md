# Glossaire

Les noms de ce projet sont personnels. Ce glossaire donne, pour chacun, une
définition d'une phrase et le fichier propriétaire. Si un terme manque ici, il
manque aussi dans le code : ouvre une issue.

| Terme | Définition | Référence |
| --- | --- | --- |
| **Accent** | L'unique couleur d'action du produit, réglable dans les réglages ; elle porte l'action et la sélection, jamais la décoration. | [`app/globals.css`](../app/globals.css) |
| **Accréditation** | Demande d'accès presse pour un concert, suivie jusqu'à l'obtention ou le refus ; distincte du shooting lui-même. | [`lib/types/accreditations.ts`](../lib/types/accreditations.ts) |
| **Activité** | Journal horodaté des actions de l'application et de l'agent, affiché sur `/activity`. | [`lib/types/activity.ts`](../lib/types/activity.ts) |
| **Brain** | La page `/brain` : les faits mémorisés par l'IA, éditables, filtrables et reliés en graphe. | [`app/brain/page.tsx`](../app/brain/page.tsx) |
| **Brief** | Résumé quotidien généré à partir des rappels, de l'agenda, de la météo et des cours ; mis en cache pour la journée. | [`lib/daily-brief.ts`](../lib/daily-brief.ts) |
| **CESAR** | Le portail d'emploi du temps universitaire, scrapé en HTTP pur (sans navigateur) puis normalisé en séances. | [`lib/cesar-client.ts`](../lib/cesar-client.ts) |
| **Chat run** | Une génération de chat côté serveur qui survit à la navigation : on peut quitter `/chat` et se réattacher au flux. | [`lib/chat-runs.ts`](../lib/chat-runs.ts) |
| **Confirmation** | Validation explicite exigée avant une action externe (`send_email_response`) ou une écriture issue d'un tour contaminé. | [`lib/chat-tools.ts`](../lib/chat-tools.ts) |
| **`data/`** | Le store de fichiers JSON (gitignoré, secrets réels) : une écriture atomique, un verrou, des backups. | [`lib/storage-core.ts`](../lib/storage-core.ts) |
| **Flux** | La colonne « aujourd'hui » du panneau de contexte : rappels échus, cours et événements à venir, dans l'ordre. | [`components/layout/FluxTimeline.tsx`](../components/layout/FluxTimeline.tsx) |
| **Galerie** | La vue « Livraison » des photos, où chaque shooting avance par état (`shooted`, `selecting`, `editing`, `delivered`). | [`lib/types/gallery.ts`](../lib/types/gallery.ts) |
| **Intention** | Une relance en attente (« penser à… ») affichée dans la journée ; distincte d'un rappel, qui a une échéance. | [`lib/storage/intentions.ts`](../lib/storage/intentions.ts) |
| **Mémoire** | Les faits durables sur l'utilisateur, avec catégorie, source et relations ; c'est ce que l'agent peut citer. | [`lib/types/memory.ts`](../lib/types/memory.ts) |
| **Mock** | Provider IA factice activé par `AI_PROVIDER=mock` : réponses scriptées, aucun réseau, utilisé en développement et en test. | [`lib/ai-providers/mock.ts`](../lib/ai-providers/mock.ts) |
| **Module / noyau** | Cible du refactor : le noyau ne connaît aucun domaine, chaque capacité devient un module activable. Aujourd'hui prospectif. | [`docs/roadmap-multi-utilisateurs.md`](roadmap-multi-utilisateurs.md) |
| **Outil** | Une fonction exposée à l'agent (schéma Zod + dispatch), par exemple `add_reminder` ou `search_web`. | [`lib/chat-tools.ts`](../lib/chat-tools.ts) |
| **Pairing** | Code à usage unique qui relie un appareil (APK Android, nouvelle passkey) à la session existante. | [`lib/passkey-pairing.ts`](../lib/passkey-pairing.ts) |
| **Passkey** | Le credential WebAuthn qui remplace le mot de passe ; un seul compte, une seule passkey enregistrée. | [`lib/auth.ts`](../lib/auth.ts) |
| **Pending action** | Une action mise de côté en attendant la confirmation de l'utilisateur, avec un TTL de quinze minutes. | [`lib/chat-tools.ts`](../lib/chat-tools.ts) |
| **Provenance** | L'état d'un tour qui a lu du contenu tiers non fiable ; toute écriture y devient une pending action. | [`lib/tool-result.ts`](../lib/tool-result.ts) |
| **Provider** | L'adaptateur qui parle à OpenAI ou Anthropic derrière une interface unique (`streamChatCompletion`). | [`lib/ai-providers.ts`](../lib/ai-providers.ts) |
| **Proxy** | Le garde d'authentification de `proxy.ts` : tout est privé sauf les chemins publics déclarés. | [`proxy.ts`](../proxy.ts) |
| **Rappel** | Une tâche datée avec statut et récurrence, synchronisable vers Microsoft To Do. | [`lib/types/reminders.ts`](../lib/types/reminders.ts) |
| **Session** | Le JWT signé qui porte l'identité entre le navigateur et le serveur ; vérifié par `requireSession()`. | [`lib/session.ts`](../lib/session.ts) |
| **Shooting** | Une séance photo de concert, avec date, salle, artistes et avancement du traitement. | [`lib/types/concerts.ts`](../lib/types/concerts.ts) |
| **Tour** | Un échange utilisateur → assistant, avec son fil d'étapes (pensées, outils) dans l'ordre de génération. | [`app/api/chat/route.ts`](../app/api/chat/route.ts) |
| **Watch-later** | La file de liens, articles et vidéos à garder, avec aperçu et catégorie. | [`lib/types/watch-later.ts`](../lib/types/watch-later.ts) |
| **Web Push / VAPID** | Les notifications poussées par le serveur et affichées par le service worker, application fermée comprise. | [`public/sw.js`](../public/sw.js) |
