# Déployer BACKSTAGE sur cPanel (hébergement mutualisé)

Ce document complète [deploy.sh](../deploy.sh). Docker reste plus simple si votre
hébergeur le permet — voir [self-hosting.md](./self-hosting.md).

> Le mot de passe CESAR et les tokens sont lus depuis `.deploy.env`.
> Ce fichier est gitignoré et doit rester hors du dépôt.

## 1. Préparer l'application Node dans cPanel

1. cPanel → **Setup Node.js App** → *Create application*.
2. Renseigner :
   - *Application root* : le dossier de l'app (ex. `/home/USER/brain.mprnl.fr`)
   - *Application URL* : le domaine ou le sous-domaine
   - *Application startup file* : `server.js`
   - *Node version* : la plus récente disponible (20 ou 22)
3. Noter le chemin de l'environnement virtuel affiché
   (`/home/USER/nodevenv/APP/VERSION/bin/activate`) : il servira à
   `DEPLOY_NODEENV`.

## 2. Configurer `.deploy.env`

```bash
cp .deploy.env.example .deploy.env
```

Variables minimales :

| Variable | Rôle |
| --- | --- |
| `SSH_HOST` / `SSH_USER` / `SSH_PORT` | accès SSH (cPanel → SSH Access) |
| `SSH_TARGET_DIR` | *Application root* noté à l'étape 1 |
| `DEPLOY_NODEENV` | chemin du `nodevenv` (vide si `node` est déjà dans le PATH) |
| `NEXT_PUBLIC_API_URL`, `IA_API_KEY` | provider IA |
| `AUTH_SECRET` | `openssl rand -hex 32` |
| `WEBAUTHN_RP_ID`, `WEBAUTHN_ORIGIN` | le domaine public (`https://…`) |
| `SETUP_TOKEN` | token one-time du premier passkey |
| `CRON_SECRET`, `CRON_BASE_URL` | protection et URL des routes `/api/cron/*` |

Les lignes OAuth (Google, Microsoft) doivent pointer vers le **domaine de
production** : `https://VOTRE-DOMAINE/api/auth/google/callback`.

## 3. Déployer

```bash
./deploy.sh
```

Le script enchaîne : `bun run build` → préparation du dossier *standalone*
(`.next/standalone` + `.next/static` + `public/` + `assets/`) → sauvegarde de la
version en place dans `backstage-releases/` (5 dernières, hors `node_modules` et
`data/`) → `rsync --delete` → `npm install --production` → durcissement des
permissions (`data/` en 700, fichiers 600) → redémarrage.

**`data/` n'est jamais écrasé** : seuls `config.json` et
`firebase-service-account.json` sont synchronisés, le reste des JSON est exclu
du rsync.

## 4. Premier login

```
https://VOTRE-DOMAINE/login?setupToken=VOTRE_SETUP_TOKEN
```

Le token ne sert qu'une fois. Ensuite, retirez `SETUP_TOKEN` de l'environnement
cPanel (ou du `.deploy.env`) : sans lui, un nouvel enregistrement passkey est
refusé (503) en production.

## 5. Tâches planifiées

```cron
# Rappels (notifications) — toutes les minutes
* * * * * curl -s -H "x-cron-secret: VOTRE_CRON_SECRET" https://VOTRE-DOMAINE/api/cron/reminders >/dev/null

# Brief du jour — 7h00
0 7 * * * curl -s -H "x-cron-secret: VOTRE_CRON_SECRET" https://VOTRE-DOMAINE/api/cron/daily-brief >/dev/null
```

Si `CRON_SECRET` est vide, les deux routes répondent `401`.

## 6. Rollback

```bash
tar -xzf ~/brain.mprnl.fr/../backstage-releases/backstage-AAAAMMJJ-HHMMSS.tar.gz -C ~/brain.mprnl.fr
```

puis redémarrer l'app. `data/` n'est pas concerné par la restauration.
