# Documentation de BACKSTAGE — commence ici

Ce fichier est le **seul point d'entrée** de la documentation. Il ne remplace
pas les autres documents : il décide dans quel ordre les lire, pour que tu
n'aies pas à choisir.

## L'ordre de lecture

Un seul ordre, du produit vers l'exploitation :

1. [`product.md`](product.md) — objectif, utilisateurs, modules, ton (5 min).
2. [`architecture.md`](architecture.md) — les invariants techniques : chat,
   mémoire, CESAR, notifications, OAuth (30 min).
3. [`design.md`](design.md) — tokens, typographie, composants `.ui-*`, motion
   (20 min).
4. [`code-map.md`](contributing/code-map.md) — quel dossier fait
   quoi, où ajouter une route, une action, un écran (15 min).
5. [`CONTRIBUTING.md`](../CONTRIBUTING.md) — installation, commandes,
   conventions, périmètre, transparence IA (15 min).
6. [`self-hosting.md`](self-hosting.md) — Docker, variables, HTTPS, backups
   (20 min).

Le reste (Android, cPanel, tests E2E, roadmap) se lit au besoin, jamais en
entrée.

## Trois parcours, trois durées

### En 5 minutes : voir l'application tourner

Objectif : une app qui répond, sans clé IA et sans passkey.

1. Cloner le dépôt et installer : `git clone` puis `bun install` (voir
   [`CONTRIBUTING.md`](../CONTRIBUTING.md), section 2).
2. `bun run setup:dev` : génère les secrets locaux et active `AI_PROVIDER=mock`
   et `DEV_AUTH_BYPASS=true`.
3. `bun dev`, puis ouvrir
   [http://localhost:3000/api/auth/dev-login](http://localhost:3000/api/auth/dev-login).
4. Ouvrir `/chat` et envoyer un message : la réponse est scriptée, aucun réseau
   n'est appelé.
5. Pour aller plus loin : [`CONTRIBUTING.md`](../CONTRIBUTING.md), section 3
   (commandes).

### En 30 minutes : comprendre une requête de bout en bout

Objectif : suivre un message de chat de la route jusqu'au rendu.

1. [`architecture.md`](architecture.md) — le contrat du provider IA et la boucle
   d'outils.
2. [`code-map.md`](contributing/code-map.md) — la carte des
   dossiers.
3. [`traces.md`](traces.md) — la trace verticale du message de chat, étape
   par étape.
4. `app/api/chat/route.ts` — la route SSE qui porte la génération.
5. `lib/chat-tools.ts` — les outils exposés à l'agent et leur dispatch.
6. `components/chat/ChatView.tsx` — le rendu du fil et des appels d'outils.
7. [`design.md`](design.md) — pourquoi les états de streaming ressemblent à ça.

### En 1 heure : ajouter une capacité

Objectif : écrire du code qui respecte les couches existantes.

1. [`product.md`](product.md) — la capacité a-t-elle sa place ici ?
2. [`code-map.md`](contributing/code-map.md) — où poser chaque
   fichier, et pourquoi pas ailleurs.
3. [`AGENTS.md`](../AGENTS.md) — les règles qui cassent le build si on les
   ignore (`proxy.ts` protège par défaut, Server Actions canoniques).
4. [`premiere-pr.md`](contributing/premiere-pr.md) — le parcours
   complet d'une première PR.
5. [`design.md`](design.md) — les classes `.ui-*` avant d'écrire une couleur.
6. [`tests-e2e.md`](contributing/tests-e2e.md) — si ta capacité a
   une interface, son test de bout en bout.

## Documents de référence

| Fichier | Contenu |
| --- | --- |
| [`product.md`](product.md) | objectif, utilisateurs, modules, ton |
| [`architecture.md`](architecture.md) | invariants techniques détaillés |
| [`traces.md`](traces.md) | trois traces verticales : chat, rappel, OAuth |
| [`glossaire.md`](glossaire.md) | vingt-huit termes du projet, définition et fichier propriétaire |
| [`design.md`](design.md) | système visuel `.ui-*` |
| [`code-map.md`](contributing/code-map.md) | carte du code |
| [`premiere-pr.md`](contributing/premiere-pr.md) | première PR |
| [`tests-e2e.md`](contributing/tests-e2e.md) | lancer et écrire les tests Playwright |
| [`self-hosting.md`](self-hosting.md) | Docker, variables, HTTPS, backups |
| [`deploy-cpanel.md`](deploy-cpanel.md) | déploiement mutualisé et crontab |
| [`android-apk.md`](android-apk.md) | TWA + FCM, build et appairage |
| [`roadmap-multi-utilisateurs.md`](roadmap-multi-utilisateurs.md) | prospectif, hors périmètre actuel |
| [journal du chantier modulaire](refactor/decision-log.md) | une entrée par constat mesuré, avec preuve `fichier:ligne` (#84) |
