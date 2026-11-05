<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all
differ from your training data. Read the relevant guide in
`node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.

<!-- END:nextjs-agent-rules -->

# BACKSTAGE — instructions agent

Assistant personnel PWA : chat IA, rappels, calendrier, mails, mémoire, photo.
Mono-utilisateur, auth par passkey, données JSON locales.

Le **détail des mécanismes** (chat, mémoire, CESAR, notifications, OAuth, pièges
de déploiement) est dans [`docs/architecture.md`](docs/architecture.md).
Ce fichier ne garde que les règles qui font casser le build ou la prod.

---

## Règles d'or

1. **`proxy.ts` protège tout par défaut.** Une nouvelle route est privée sauf
   ajout explicite dans `PUBLIC_PATHS` / `PUBLIC_API_PREFIXES`.
2. **Server Actions : donnée brute + `throw`.** Pas de wrapper `{ ok, error }`.
3. **`requireSession()` en première ligne** de chaque Server Action.
4. **Bun uniquement** : `bun run <script>`, jamais `npm`/`yarn`/`bun build`.
5. **`data/` est gitignoré et contient des secrets réels** : ne jamais l'afficher,
   le committer ni le logger.
6. **Committer chaque unité de travail vérifiée**, message en français.
   Working tree propre en fin de tâche.

---

## Stack

|               |                                                                  |
| ------------- | ---------------------------------------------------------------- |
| Runtime       | Bun (`bun.lock`)                                                 |
| Framework     | Next.js 16.2.10 — App Router, `output: "standalone"`             |
| React         | 19.2.4                                                           |
| CSS           | Tailwind v4 via `@tailwindcss/postcss`                           |
| Validation    | Zod 4                                                            |
| Auth          | Passkey WebAuthn (`@simplewebauthn/*`) + JWT maison              |
| IA            | SDK OpenAI 6 + Anthropic, unifiés dans `lib/ai-providers/`       |
| Data          | JSON dans `data/`, écritures atomiques                           |
| Push          | `web-push` (VAPID) + FCM Android                                 |
| Tests         | Vitest 4 (node) + Playwright                                     |
| UI            | `lucide-react`, `react-markdown` + `remark-gfm`                  |

**Pas de Capacitor.** L'app native est un TWA (`android/`) + FCM : les passkeys
WebAuthn cassent sous Capacitor. Voir `docs/android-apk.md`.

---

## Commandes

| Usage             | Commande                                      |
| ----------------- | --------------------------------------------- |
| Dev               | `bun dev`                                     |
| Build             | `bun run build`                               |
| Prod              | `bun run start`                               |
| Lint              | `bun run lint`                                |
| Typecheck         | `bunx tsc --noEmit`                           |
| Tests unitaires   | `bun run test`                                |
| Tests E2E         | `bun run test:e2e`                            |
| Setup local       | `bun run setup`                               |
| Setup sans cle IA | `bun run setup:dev`                           |
| Reset passkey     | `bun run reset:passkey`                       |
| APK Android       | `cd android && ./gradlew :app:assembleRelease`|

⚠️ `bun build` est le bundler Bun et **ne construit pas** l'app Next.

⚠️ `bun run setup` (`scripts/setup.ts`) génère `AUTH_SECRET`, `SETUP_TOKEN`, la
paire VAPID et `WEBAUTHN_*` dans `.env.local`. Idempotent. Sans lui, le premier
enregistrement passkey est refusé (503) en production.

---

## Arborescence

```
app/                pages, Server Actions (actions/), Route Handlers (api/)
app/globals.css     tokens, primitives .ui-*, animations
components/
  ui/               primitives qui délèguent l'apparence aux classes .ui-*
  layout/           AppShell, Chrome, ContextPanel, FluxTimeline
  chat/ landing/ widgets/ brain/
lib/
  storage/          CRUD par domaine
  types/            types par domaine (barrel @/lib/types)
  ai-providers/     openai, anthropic, models, config
  chat-runs.ts      registre des générations de chat
  cesar-client.ts   CESAR, fetch HTTP pur
e2e/  scripts/  android/  public/
docs/               architecture.md, self-hosting, deploy-cpanel, android-apk
```

| Composant utilisé par     | Emplacement                               |
| ------------------------- | ----------------------------------------- |
| Une seule page            | `app/<page>/MonComposant.tsx`             |
| Plusieurs pages           | `components/<catégorie>/MonComposant.tsx` |
| Primitive UI générique    | `components/ui/`                          |

⚠️ **Design system** : un bouton, une carte, une tuile, une plaque, une puce ou
un champ n'a **qu'une** définition — les classes `.ui-*` de `app/globals.css`
(`@layer components`). Les composants de `components/ui/` traduisent une API en
classes ; ils n'écrivent jamais une couleur ni un rayon. Pas de `!` : utiliser
une variante (`--sm`, `--xs`, `--icon`, `--block`, `--area`, `--tile`).
Tout est décrit dans `docs/design.md`.

---

## Server Actions — pattern canonique

```ts
"use server";

import { requireSession } from "@/lib/session";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { addReminder, logActivity } from "@/lib/storage";
import type { Reminder } from "@/lib/types";

const createReminderSchema = z.object({
  title: z.string().trim().min(1, "Titre requis"),
  dueAt: z.string().min(1, "Date d'echeance requise"),
});

export async function createReminder(input: {
  title: string;
  dueAt: string;
}): Promise<Reminder> {
  await requireSession(); // 1. auth systématique

  const parsed = createReminderSchema.safeParse(input); // 2. Zod
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Payload invalide");
  }

  const reminder = await addReminder(parsed.data); // 3. storage
  await logActivity("reminder_created", `Rappel créé : ${reminder.title}`);
  revalidatePath("/reminders"); // 4. revalidation

  return reminder; // 5. donnée BRUTE
}
```

- **Retour** : la donnée brute. **Jamais** de wrapper.
- **Erreur** : `throw new Error("message en français")`, sans accent.
- **Validation** : Zod en tête de fichier, `.strict()` sur les updates,
  `safeParse` puis throw du premier `issue.message`.
- **IDs** : `if (!id || typeof id !== "string") throw new Error("Identifiant requis")`.
- **Revalidation** : `revalidatePath` uniquement (`revalidateTag` n'est pas utilisé).
- **Recouvrement assumé** Actions ↔ Route Handlers (`/api/reminders/[id]/done`,
  `/api/memory/remember`, `/api/gallery`…) pour les clients non-React. Toute
  modification d'un côté doit être répercutée de l'autre.

---

## Data layer

`lib/storage-core.ts` fournit `writeJsonAtomic`, `mutateJson`, `readJsonSafe`,
`readOrCreate`, `maybeBackup`.

⚠️ `lib/storage.ts` est un barrel **partiel** : il ne ré-exporte de
`storage-core` que `readJsonSafe` et `writeJsonAtomic`. Pour `mutateJson`,
`readOrCreate`, `maybeBackup`, importer `@/lib/storage-core` directement.

Fichiers `data/` : accreditations, activity, chat-history, concerts, config,
consent, demo-calls, emails, fcm-devices, fcm-pair-codes, gallery, intentions,
leetcode, live-notifs, memory, notified-briefs, passkey-pair-codes, photo-shoots,
push-subscriptions, reminders, schedule, server-cache, users, watch-later.
Tokens OAuth : `calendar-token`, `gmail-token`, `microsoft-todo-token`,
`firebase-service-account`. Backups : `data/backups/`.

**Types** : `lib/types/<domaine>.ts`, barrel pur dans `lib/types.ts`.
Toujours importer depuis `@/lib/types`.

---

## Sécurité

- `proxy.ts` (runtime Node) utilise `lib/session-edge.ts`. Sans session :
  `401 JSON` pour `/api/*`, `redirect("/login")` sinon.
- Dans les Server Actions, importer `lib/session.ts` (jamais `session-core` ni
  `session-edge`).
- Routes sensibles (`/api/chat/confirm`, `/api/chat/stop`, `/install.sh`,
  appairage passkey/APK) : voir `docs/architecture.md`.
- `checkRateLimit` n'est branché que sur `/api/chat`. Pas de CSRF actif
  (`SameSite=lax` seul) : signale toute action coûteuse ajoutée.

---

## Tests

- **Vitest** (`environment: "node"`, alias `@` → racine) dans `lib/__tests__/`,
  `app/actions/__tests__/`, `app/calendar/__tests__/`, `app/api/chat/__tests__/`.
- Test dépendant du FS : mocker `process.cwd()` **puis** `await import()` le
  module storage. `lib/__tests__/__fs-mock-helper.ts` ne doit jamais importer de
  code projet (dépendances circulaires).
- **Playwright** : `workers: 1`, deux projets (`chromium` authentifié via
  `e2e/.auth/state.json`, `no-auth`). Les specs ne déclenchent **aucune
  mutation** et n'appellent pas le backend IA. `e2e/.auth/` ne se committe pas.

---

## Variables d'environnement

`.env.local` contient des credentials réels : ne jamais l'afficher ni le logger.
Modèle commenté : [`.env.example`](.env.example).

Obligatoires : `NEXT_PUBLIC_API_URL`, `IA_API_KEY`, `AUTH_SECRET`,
`WEBAUTHN_RP_ID`, `WEBAUTHN_ORIGIN`, `SETUP_TOKEN`.
Options : Google, Microsoft, `OPENWEATHERMAP_API_KEY`, `BRAVE_SEARCH_API_KEY`,
VAPID, `CRON_SECRET`/`CRON_BASE_URL`, `CESAR_*`, `GOOGLE_TESTING_EXPIRY`,
`ANDROID_CERT_SHA256`, `AI_PROVIDER=mock` (fournisseur IA factice),
`DEV_AUTH_BYPASS=true` (session locale hors production).
Déploiement : `.deploy.env.example`.

Contrat du provider IA (session header, baseURL des deux SDK, modèles qui
périment) : `docs/architecture.md` § *Contrat du provider IA*.

---

## Conventions

- **Alias** `@/*` → racine, partout.
- **Nommage** : `kebab-case.ts` pour `lib/`, `PascalCase.tsx` pour les
  composants. ASCII uniquement.
- **Logging** : `console.error` / `console.warn` avec préfixe module
  (`[watch-later]`, `[storage]`).
- **Directives** : `"use server"` en tête des fichiers `app/actions/*`,
  `"use client"` sur les composants interactifs.
- **Langue** : messages utilisateur et commits en français ; code et identifiants
  en anglais.
- Ne jamais committer `.env*`, `.deploy.env`, `data/`, `android/data/`,
  `coverage/`, `test-results/`, `*.tsbuildinfo`, `e2e/.auth/`.

---

## Documentation

| Fichier                | Contenu                                                  |
| ---------------------- | -------------------------------------------------------- |
| `README.md`            | présentation, installation, structure                    |
| `AGENTS.md`            | règles agent (ce fichier)                                |
| `CONTRIBUTING.md`      | installation dev, commandes, conventions, périmètre      |
| `docs/contributing/`   | carte du code, tutoriel première PR                      |
| `docs/architecture.md` | invariants détaillés (chat, mémoire, CESAR, push, OAuth) |
| `docs/design.md`       | tokens, typographie, composants `.ui-*`, motion          |
| `docs/product.md`      | objectif, utilisateurs, modules, ton                      |
| `docs/self-hosting.md` | Docker, variables, HTTPS, backups                        |
| `docs/deploy-cpanel.md`| déploiement mutualisé + crontab                          |
| `docs/android-apk.md`  | TWA + FCM (build, signature, appairage)                  |
| `.env.example`         | variables d'environnement commentées                     |

---

## Dette technique connue

À ne pas corriger spontanément :

1. Server Actions non rate-limitées (seul `/api/chat` l'est).
2. `components/reminders/` et `components/watch-later/` vides.
3. Route Handlers ↔ Server Actions : recouvrement à maintenir à la main.
4. `data/.setup-consumed` : marqueur du bootstrap consommé — purger via
   `bun run reset:passkey` uniquement.
5. Docker : `NEXT_PUBLIC_VAPID_PUBLIC_KEY` est inliné au build (ARG) ; un rebuild
   est requis si la clé change.

---

## Si tu bloques

1. API Next.js incertaine → `node_modules/next/dist/docs/`
2. Auth / routing → `proxy.ts`, puis `lib/session.ts`
3. Pattern d'action → `app/actions/reminders.ts`
4. Question produit → `docs/product.md` ; UI → `docs/design.md`
5. Déploiement → `docs/self-hosting.md`, `docs/deploy-cpanel.md`
6. Pattern inconnu → lire un fichier voisin et l'imiter
7. Ambiguïté d'architecture → demander, ne pas deviner

---

## Maintenance de ce fichier

Toute modification structurelle (nouveau dossier racine, changement de
`proxy.ts`, nouveau script `package.json`, nouveau provider OAuth, nouvelle
variable d'env, nouvel outil) doit être répercutée ici **dans le même commit**.
Un `AGENTS.md` périmé est plus dangereux qu'un `AGENTS.md` absent.
