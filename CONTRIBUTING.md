# Contribuer a BACKSTAGE

**English summary.** BACKSTAGE is a single-user, self-hosted AI second brain built
with Next.js 16, React 19 and Bun. Contributions are welcome for bug fixes, docs,
tests, accessibility and self-hosting. Run `bun install`, then `bun run setup:dev`
and `bun dev` to work without an API key or a passkey. Open a small pull request
with tests and say in it whether an AI assistant helped you write the code.

Le reste de ce document est en francais.

---

## 1. Ce dont tu as besoin

| Outil | Version | Role |
| --- | --- | --- |
| [Bun](https://bun.sh) | 1.x | installation, scripts, tests, serveur de dev |
| Node.js | >= 20.9 | runtime de production (`output: standalone`) |
| Git | n'importe quelle version | |
| Docker | optionnel | uniquement pour tester `compose.yaml` |

Aucune cle API n'est necessaire pour developper : le mode `mock` repond a la
place du modele et une connexion locale remplace la passkey.

## 2. Installation en une commande

```bash
bun install && bun run setup:dev && bun dev
```

Puis ouvrir <http://localhost:3000/api/auth/dev-login>. Cette URL ouvre une
session locale (`owner`) sans WebAuthn et redirige vers `/chat`.

`bun run setup:dev` est idempotent. Il genere dans `.env.local` :

- `AUTH_SECRET`, `SETUP_TOKEN`, les cles VAPID et les variables WebAuthn ;
- `AI_PROVIDER=mock` : reponses IA scriptees, aucun appel reseau ;
- `DEV_AUTH_BYPASS=true` : connexion locale sans passkey.

Ces deux dernieres variables sont ignorees en production. Si tu as deja un
`.env.local` de production, ne lance pas `setup:dev` dessus : garde-le et ajoute
les variables a la main.

Pour utiliser un vrai modele, retirer `AI_PROVIDER=mock` et renseigner
`NEXT_PUBLIC_API_URL` (endpoint compatible OpenAI) et `IA_API_KEY`.

### Connexion par passkey (optionnelle)

Le flux WebAuthn fonctionne sur `http://localhost:3000`. Ouvre
`/login?setupToken=<SETUP_TOKEN>` : le token est dans `.env.local` et ne sert
qu'une fois. En developpement, sans `SETUP_TOKEN`, le premier enregistrement est
tolere (`isOpenBootstrapAllowed()`), mais un token reste la facon propre de
tester la production.

## 3. Commandes

| Commande | Effet |
| --- | --- |
| `bun dev` | serveur de developpement sur <http://localhost:3000> |
| `bun run build` | build de production Next.js |
| `bun run start` | sert le build de production |
| `bun run lint` | ESLint (flat config) |
| `bunx tsc --noEmit` | verification TypeScript |
| `bun run test` | suite Vitest complete |
| `bun run test:watch` | Vitest en mode watch |
| `bun run test:e2e` | Playwright (installe Chromium avant) |
| `bun run setup` | secrets locaux pour un vrai deploiement |
| `bun run setup:dev` | secrets locaux + mode mock sans passkey |
| `bun run reset:passkey` | efface les passkeys et reouvre le bootstrap |

### Lancer un seul fichier de test

```bash
bunx vitest run lib/__tests__/ai-providers-mock.test.ts
```

Par nom de test :

```bash
bunx vitest run -t "repond sans cle API"
```

Les tests unitaires vivent dans `lib/__tests__/`, `app/actions/__tests__/`,
`app/calendar/__tests__/` et `app/api/chat/__tests__/`. Les tests E2E sont dans
`e2e/` et ne doivent provoquer aucune mutation ni appeler un vrai provider IA.

## 4. Branches et commits

Format de branche : `type/sujet-court`, par exemple `docs/contributing`,
`fix/reminder-timezone`, `feat/gallery-filter`, `chore/bump-deps`.

Les messages suivent [Conventional Commits](https://www.conventionalcommits.org/),
en francais, comme l'historique du depot :

```
feat(chat): ajoute le filtre par date
fix(reminders): corrige le fuseau horaire
docs(contributing): documente le mode mock
test(setup): couvre la generation des secrets
chore(deps): met a jour vitest
```

- Un commit = une intention. Pas de melange entre refactor, correction et formatage.
- Le sujet fait moins de 72 caracteres, sans point final.
- Le corps explique le pourquoi, pas seulement le quoi.

## 5. Taille et contenu d'une pull request

- Une PR traite **un seul sujet** et reste sous **400 lignes** modifiees.
  Au-dela, decoupe-la.
- Une correction de bug inclut un test qui echoue avant et passe apres.
- Une modification d'interface inclut une capture avant/apres.
- Une modification de comportement met a jour la documentation concernee.
- Pas de reformatage massif, pas de renommage sans rapport, pas de fichier
  genere (`.next/`, `coverage/`, `test-results/`).

### Avant d'ouvrir la PR

```bash
bun run lint
bunx tsc --noEmit
bun run test
bun run build
```

La checklist de la PR reprend ces quatre commandes. Coche uniquement celles que
tu as reellement lancees.

## 6. Ce qui est bienvenu, ce qui est hors perimetre

**Bienvenu**

- corrections de bugs avec reproduction ;
- tests manquants sur les routes API, Server Actions et scripts ;
- documentation, tutoriels, corrections de liens et de commandes ;
- accessibilite : focus, libelles, contraste, navigation clavier ;
- auto-hebergement : Docker, cPanel, reverse proxy, sauvegardes ;
- ameliorations du mode de developpement (`setup`, scripts, DX) ;
- petites ameliorations de performance mesurees.

**Hors perimetre pour l'instant**

- multi-utilisateur, equipes, partage de compte ;
- base de donnees externe ou file d'attente distribuee (le stockage JSON local
  est un choix assume) ;
- nouvelles integrations SaaS sans cas d'usage personnel clair ;
- refonte visuelle globale sans maquette ni discussion prealable ;
- changement de licence ou de stack.

En cas de doute, ouvre une issue avant d'ecrire beaucoup de code.

## 7. Transparence sur l'aide IA

Si tu utilises un assistant IA (ChatGPT, Claude, Copilot, Cursor, un agent de
code, etc.) pour ecrire une partie de ta contribution, **dis-le dans la pull
request** :

- quel outil ;
- ce que l'IA a produit ;
- ce que tu as relu, execute et verifie toi-meme.

La mention va dans le corps de la PR, pas seulement dans un commentaire. Une
contribution assistee par IA est acceptable ; une contribution assistee par IA
presentee comme entierement humaine ne l'est pas.

## 8. Comportement

Toute participation est couverte par le
[Code de conduite](./CODE_OF_CONDUCT.md). Signaler un probleme :
contact.mprnl@gmail.com.

## 9. Besoin d'aide

- Carte du code : [docs/contributing/code-map.md](./docs/contributing/code-map.md)
- Premiere PR en 15 minutes :
  [docs/contributing/premiere-pr.md](./docs/contributing/premiere-pr.md)
- Architecture detaillee : [docs/architecture.md](./docs/architecture.md)
- Auto-hebergement : [docs/self-hosting.md](./docs/self-hosting.md)
- Ouvrir une issue : les modeles dans `.github/ISSUE_TEMPLATE/` demandent le
  fichier concerne, le comportement attendu et une piste de resolution.
