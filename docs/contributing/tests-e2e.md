# Lancer les tests E2E

La suite Playwright verifie les parcours qui dependent d'un vrai navigateur :
pages publiques, redirections deny-by-default, et quelques pages authentifiees
en lecture seule. Elle ne declenche aucune mutation et n'appelle jamais un vrai
provider IA.

## 1. Prerequis

```bash
bun install                     # deja fait si l'app tourne
bunx playwright install chromium
```

Le projet n'a besoin que de Chromium. Le serveur de developpement est lance
automatiquement par Playwright (`webServer` de `playwright.config.ts`,
`bun run dev`, <http://localhost:3000>).

## 2. Lancer toute la suite

Reprendre la commande du job `e2e` de `.github/workflows/ci.yml` :

```bash
AUTH_SECRET="$(openssl rand -hex 32)" \
VAPID_PRIVATE_KEY="" NEXT_PUBLIC_VAPID_PUBLIC_KEY="" \
bun run test:e2e
```

- `AUTH_SECRET` doit etre **explicite et identique** entre le cookie genere et
  la verification du serveur. `e2e/global-setup.ts` signe un cookie de session
  avec ce secret ; `next dev` herite de l'environnement et ne remplace pas une
  variable deja definie depuis `.env.local`.
- `VAPID_PRIVATE_KEY` et `NEXT_PUBLIC_VAPID_PUBLIC_KEY` vides neutralisent le
  scheduler : aucune notification push reelle pendant les tests.
- La suite complete prend quelques dizaines de secondes et lance 17 tests sur
  l'etat actuel du depot.

Si tu preferes utiliser le secret de ton `.env.local` :

```bash
( set -a; . ./.env.local >/dev/null 2>&1; set +a; bun run test:e2e )
```

## 3. `e2e/.auth/`, et pourquoi il n'est pas commite

`e2e/global-setup.ts` ecrit `e2e/.auth/state.json` avant la suite. Ce fichier
contient un `storageState` Playwright : un cookie `pb_session` signe avec
`AUTH_SECRET`, valable pour `localhost`. Le projet `chromium` le charge pour
ouvrir les pages protegees sans repasser par la passkey.

- Le dossier est regenere a chaque lancement.
- Il est ignore par Git (`/e2e/.auth/` dans `.gitignore`) : un cookie de session
  valide est un secret, il ne doit jamais entrer dans le depot.
- Si les tests authentifies retombent sur `/login`, supprimer `e2e/.auth/` puis
  relancer avec un `AUTH_SECRET` explicite.

## 4. Lancer un seul fichier ou un seul test

Un fichier :

```bash
AUTH_SECRET="$(openssl rand -hex 32)" bunx playwright test e2e/public.spec.ts
```

Un test par son nom :

```bash
AUTH_SECRET="$(openssl rand -hex 32)" bunx playwright test --grep "la page de login"
```

Un seul projet (les pages publiques n'ont pas besoin de session) :

```bash
AUTH_SECRET="$(openssl rand -hex 32)" bunx playwright test e2e/public.spec.ts --project=no-auth
```

Les deux projets de `playwright.config.ts` :

- `chromium` : pages authentifiees en lecture seule, charge
  `e2e/.auth/state.json`, ignore `e2e/public.spec.ts` ;
- `no-auth` : uniquement `e2e/public.spec.ts`, sans cookie.

## 5. Regles pour une nouvelle spec

- Aucune mutation : pas de creation, modification ou suppression de rappel,
  mail, evenement, fichier de `data/`.
- Aucun appel a un vrai provider IA : rester sur des pages en lecture ou le
  mode `AI_PROVIDER=mock`.
- Tester les attributs accessibles (role, nom) plutot que des selecteurs CSS
  fragiles quand c'est possible.
- Une spec authentifiee va dans le projet `chromium` (elle herite du
  `storageState`) ; une spec publique doit s'appeler `public.spec.ts` ou etre
  rattachee au projet `no-auth`.

## 6. Depannage

| Symptom | Cause |
| --- | --- |
| Toutes les pages authentifiees redirigent vers `/login` | `AUTH_SECRET` absent ou different entre le cookie et le serveur |
| `Executable doesn't exist` | lancer `bunx playwright install chromium` |
| `Port 3000 is already in use` | arreter le `bun dev` manuel : la suite reutilise le serveur existant en local |
| Un test echoue uniquement en CI | la CI rejoue chaque test deux fois (`retries: 2`) et n'a pas de `.env.local` |
