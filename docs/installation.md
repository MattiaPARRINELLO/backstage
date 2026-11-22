# Installation et déploiement

Contenu déplacé du README pour laisser une vitrine courte. Rien n'a été
supprimé, seulement déplacé.

## Déployer en 3 commandes

```bash
curl -fsSL https://backstage.mprnl.fr/install.sh | bash
```

Ou à la main :

```bash
git clone https://github.com/MattiaPARRINELLO/backstage.git && cd backstage
cp .env.example .env.local && bun install && bun run setup
docker compose up -d --build     # http://localhost:3000
```

Le script d'installation ([`scripts/install.sh`](../scripts/install.sh))
vérifie les prérequis, clone le dépôt, installe les dépendances, génère les
secrets locaux et démarre l'app (Docker, ou `--node`). Il ne fait rien d'autre :
aucun `sudo`, aucune donnée envoyée nulle part.

📘 Guide complet (variables, HTTPS, backups, cPanel) :
[`self-hosting.md`](self-hosting.md) · [`deploy-cpanel.md`](deploy-cpanel.md)

## Installation locale

```bash
git clone https://github.com/MattiaPARRINELLO/backstage.git
cd backstage
bun install
cp .env.example .env.local
bun run setup            # génère AUTH_SECRET, SETUP_TOKEN, VAPID, WebAuthn
bun dev
```

L'app démarre sur [http://localhost:3000](http://localhost:3000).
`bun run setup` est idempotent : il ne réécrit jamais une valeur déjà présente.

**Contribuer sans clé API ni passkey** (mode développement) :

```bash
bun install && bun run setup:dev && bun dev
```

Puis ouvrir
[http://localhost:3000/api/auth/dev-login](http://localhost:3000/api/auth/dev-login).
`AI_PROVIDER=mock` renvoie des réponses scriptées et `DEV_AUTH_BYPASS=true`
ouvre une session locale. Les deux sont ignorés en production. Détail :
[`CONTRIBUTING.md`](../CONTRIBUTING.md).

**Premier login :** ouvrir
[http://localhost:3000/login?setupToken=…](http://localhost:3000/login) (le
token est dans `.env.local`). Il ne sert qu'une fois. En production, sans
`SETUP_TOKEN`, l'enregistrement est refusé (503) — volontairement.

## Variables d'environnement

Obligatoires : `NEXT_PUBLIC_API_URL`, `IA_API_KEY` (tout endpoint compatible
OpenAI), `AUTH_SECRET`, `WEBAUTHN_RP_ID` / `WEBAUTHN_ORIGIN`, `SETUP_TOKEN`.

| Var                         | Rôle                                                       |
| --------------------------- | ---------------------------------------------------------- |
| `NEXT_PUBLIC_API_URL`       | Base URL de l'API IA (endpoint compatible OpenAI)           |
| `IA_API_KEY`                | Clé API du provider IA                                     |
| `AUTH_SECRET`               | Signe les JWT de session (passkey + Google + Microsoft)    |
| `WEBAUTHN_RP_ID`            | Domaine de la passkey (`localhost` en dev)                 |
| `WEBAUTHN_ORIGIN`           | Origine WebAuthn (`http://localhost:3000` en dev)          |
| `SETUP_TOKEN`               | Bootstrap one-time du premier passkey (à retirer ensuite)  |
| `GOOGLE_CLIENT_ID`          | OAuth Google (Calendar + Gmail) — optionnel                |
| `GOOGLE_CLIENT_SECRET`      | OAuth Google                                               |
| `GOOGLE_REDIRECT_URI`       | Callback OAuth Google                                      |
| `MICROSOFT_CLIENT_ID`       | OAuth Microsoft (sync reminders → Microsoft To Do)         |
| `MICROSOFT_CLIENT_SECRET`   | Valeur du secret Microsoft (pas le Secret ID)              |
| `MICROSOFT_REDIRECT_URI`    | Callback OAuth Microsoft                                   |
| `OPENWEATHERMAP_API_KEY`    | Météo (brief quotidien, préparation concert)               |
| `BRAVE_SEARCH_API_KEY`      | Recherche web Brave (optionnel, fallback DuckDuckGo)       |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | Paire VAPID Web Push (notifications)                    |
| `VAPID_PRIVATE_KEY`         | Paire VAPID Web Push                                       |
| `VAPID_SUBJECT`             | Contact mailto pour Web Push                               |
| `CRON_SECRET`               | Protège `/api/cron/*` (obligatoire en prod)                |
| `CRON_BASE_URL`             | URL publique utilisée par les crons                        |
| `CESAR_USERNAME`            | Emploi du temps CESAR — optionnel                           |
| `CESAR_PASSWORD`            | Emploi du temps CESAR                                       |

Liste commentée : [`.env.example`](../.env.example).

## Commandes

```bash
bun dev              # dev server
bun run build        # production build
bun run start        # production server (standalone + .env.local + assets)
bun run setup        # génère les secrets locaux (.env.local)
bun run lint         # eslint (flat config)
bun run lint:budget  # verifie que les warnings eslint restent sous le plafond fige
bun run check:docs   # vérifie les références de fichiers de la documentation
bunx tsc --noEmit    # type-check
bun run test         # vitest (unit tests)
bun run test:watch   # vitest (watch)
bun run test:e2e     # playwright (e2e)
bun run analyze      # build + bundle-analyzer
bun run cron:list        # lignes de crontab des jobs des modules actives
bun run cron:reminders   # déclencheur reminders (scripts/cron-scheduler.ts)
bun run cron:daily-brief # déclencheur brief du matin
bun run module:add <url>#<ref>  # installe un module externe (commit figé)
bun run module:list      # modules externes installés (modules.lock.json)
bun run module:doctor    # vérifie manifestes, activation et apiVersion
bun run reset:passkey    # reset des passkeys enregistrées
```

## Structure du dépôt

```
app/
  ├─ page.tsx          # Landing publique (thème clair par défaut)
  ├─ login/            # Passkey (WebAuthn), carte centrée
  ├─ chat/             # Conversation IA + panneau de contexte
  ├─ today/ week/ focus/  # La journée : agrégat, semaine, minuteur
  ├─ photos/           # Kanban shootings + galerie de livraison
  ├─ brain/            # Mémoire : faits, filtres, graphe
  ├─ watch-later/      # Liens, articles, vidéos
  ├─ calendar/ reminders/ gmail/ leetcode/ schedule/  # Intégrations
  ├─ settings/         # Modèles, accent, connexions, compte
  ├─ search/ activity/  # Recherche unifiée, journal d'activité
  ├─ demo-calls/ privacy/ offline/ notif/  # Démo, pages publiques
  ├─ actions/          # Server Actions (22 domaines)
  └─ api/              # Route handlers (SSE chat, auth, google, cron, push…)
components/
  ├─ chat/             # ChatView, streaming, tool calls, accueil
  ├─ layout/           # AppShell, Chrome (rail), ContextPanel, FluxTimeline
  ├─ ui/               # Primitives React (Button, Card, Input, Pill, Toast…)
  ├─ widgets/          # Calendar, Gmail, LeetCode, Accreditations
  └─ landing/          # Sections de la landing
lib/
  ├─ storage-core.ts   # Moteur JSON : écritures atomiques, verrous, backups
  ├─ storage/          # CRUD par domaine (reminders, memory, concerts, gallery…)
  ├─ types/            # Types métier par domaine (ré-exportés via types.ts)
  ├─ ai-providers/     # Adaptateurs OpenAI et Anthropic
  ├─ chat-runs.ts      # Générations de chat survivant à la navigation
  ├─ cesar-client.ts   # Emploi du temps CESAR (fetch pur, sans navigateur)
  ├─ google-client.ts  # OAuth Google + refresh tokens
  ├─ microsoft-client.ts # OAuth Microsoft + Graph todo
  ├─ session-core.ts   # JWT session (Node fs)
  ├─ session-edge.ts   # JWT session (runtime edge, proxy)
  ├─ cache.ts          # TTL, SWR, optimistic updates
  ├─ daily-brief.ts    # Brief du matin
  └─ offline.ts        # IndexedDB + queue offline
public/
  ├─ sw.js             # Service worker
  ├─ manifest.json     # PWA manifest
  └─ icons/            # Icônes PWA (192, 512, apple-touch)
scripts/               # cron-scheduler, reset-passkey, setup (secrets locaux), QA
Dockerfile             # image auto-hébergeable (build standalone)
compose.yaml           # déploiement Docker prêt à l'emploi
docs/                  # architecture, design, product, self-hosting, deploy-cpanel, android-apk
app/globals.css        # Tokens + primitives .ui-* (système décrit dans docs/design.md)
app/landing.css        # Styles de la landing, isolés sous .landing-page
```

## Santé du projet

- CI (GitHub Actions) : lint, vérification des références doc, typecheck, tests
  unitaires, build, e2e à chaque push.
- [`design.md`](design.md) — le système visuel.
- [`product.md`](product.md) — objectif, utilisateurs, modules, ton.
- [`architecture.md`](architecture.md) — les invariants techniques.
- [`self-hosting.md`](self-hosting.md) — variables, Docker, HTTPS, backups.
- [`deploy-cpanel.md`](deploy-cpanel.md) — procédure mutualisée + crontab.
