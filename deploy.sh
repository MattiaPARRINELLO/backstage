#!/usr/bin/env bash
set -euo pipefail
IFS=$'\n\t'

# ─── Couleurs ──────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'; NC='\033[0m'

# ─── Config ──────────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
CONFIG_FILE="${SCRIPT_DIR}/.deploy.env"
BUILD_DIR="${SCRIPT_DIR}/.next"
STANDALONE_DIR="${BUILD_DIR}/standalone"
DEPLOY_TMP="${SCRIPT_DIR}/.deploy-tmp"

# ─── 0.0 Bascule vers le checkout principal ─────────────
# Les secrets (.deploy.env) et les donnees reelles (data/) ne vivent que dans le
# checkout principal (celui de ~/Documents/dev/...), jamais dans un worktree T3.
# Lance depuis un worktree, le script s'y relance donc automatiquement : c'est le
# seul dossier ou il peut trouver .deploy.env et deployer du code de main.
MAIN_WORKTREE="$(git -C "$SCRIPT_DIR" worktree list --porcelain 2>/dev/null | sed -n 's/^worktree //p' | head -n1 || true)"

if [ -n "${MAIN_WORKTREE}" ] && [ "${DEPLOY_REEXEC:-0}" != "1" ]; then
  MAIN_REAL="$(cd "${MAIN_WORKTREE}" 2>/dev/null && pwd -P || true)"
  SCRIPT_REAL="$(cd "${SCRIPT_DIR}" && pwd -P)"
  if [ -n "${MAIN_REAL}" ] && [ "${MAIN_REAL}" != "${SCRIPT_REAL}" ]; then
    if [ -f "${MAIN_REAL}/deploy.sh" ]; then
      echo -e "${CYAN}→ Worktree detecte — bascule vers le checkout principal ${MAIN_REAL}${NC}"
      DEPLOY_REEXEC=1 exec bash "${MAIN_REAL}/deploy.sh" "$@"
    fi
    echo -e "${YELLOW}⚠  Checkout principal ${MAIN_REAL} sans deploy.sh — poursuite depuis le worktree${NC}"
  fi
fi

# ─── Chargement config ──────────────────────────────────
# Tout ce qui suit doit s'exécuter dans le checkout principal : `bun run build`
# résout le package.json du dossier COURANT. Sans ce cd, un lancement depuis un
# worktree compilait le worktree mais empaquetait le `.next` (périmé) du
# checkout principal — panne silencieuse constatée le 2026-11-05.
cd "$SCRIPT_DIR"

if [ -f "$CONFIG_FILE" ]; then
  echo -e "${CYAN}→ Chargement de ${CONFIG_FILE}${NC}"
  set -a; source "$CONFIG_FILE"; set +a
else
  echo -e "${YELLOW}⚠  ${CONFIG_FILE} introuvable — utilise les vars d'env existantes${NC}"
fi

: "${SSH_HOST:=}"
: "${SSH_USER:=}"
: "${SSH_PORT:=22}"
: "${SSH_TARGET_DIR:=}"
: "${DEPLOY_METHOD:=rsync}"
# Environnement Node distant à activer avant `npm install` (cPanel Node
# Selector). Vide = on suppose que node est déjà dans le PATH du shell SSH.
: "${DEPLOY_NODEENV:=}"

# ─── 0. Garde : déploiement depuis main uniquement ──────
# Le déploiement pousse l'arbre de travail vers la prod : le lancer depuis une
# branche de travail déploierait du code non revu. Le script bascule donc
# automatiquement sur main (working tree propre exigé) ; sinon il refuse.
if CURRENT_BRANCH="$(git -C "$SCRIPT_DIR" rev-parse --abbrev-ref HEAD 2>/dev/null)"; then
  if [ "$CURRENT_BRANCH" != "main" ]; then
    echo -e "${YELLOW}→ Branche courante « ${CURRENT_BRANCH} » — bascule automatique sur main${NC}"
    if [ -n "$(git -C "$SCRIPT_DIR" status --porcelain)" ]; then
      echo -e "${RED}✗ Bascule impossible : working tree non propre.${NC}"
      echo -e "${YELLOW}  Commit ou stash tes changements avant de déployer.${NC}"
      exit 1
    fi
    git -C "$SCRIPT_DIR" checkout main
  fi
  # Mise à jour de main avant de déployer (désactivable avec DEPLOY_AUTO_PULL=0).
  if [ "${DEPLOY_AUTO_PULL:-1}" != "0" ]; then
    echo -e "${CYAN}→ Mise à jour de main (git pull --ff-only)…${NC}"
    if ! git -C "$SCRIPT_DIR" pull --ff-only; then
      echo -e "${RED}✗ git pull --ff-only a échoué (réseau absent ou main divergente).${NC}"
      echo -e "${YELLOW}  Déploiement interrompu : la prod ne doit pas recevoir un main périmé.${NC}"
      exit 1
    fi
  fi
  if [ -n "$(git -C "$SCRIPT_DIR" status --porcelain)" ]; then
    echo -e "${RED}✗ Déploiement refusé : working tree non propre sur main.${NC}"
    echo -e "${YELLOW}  Commit ou stash tes changements avant de déployer.${NC}"
    exit 1
  fi
  MAIN_SHA="$(git -C "$SCRIPT_DIR" rev-parse --short HEAD)"
  echo -e "${GREEN}✓ Branche main (${MAIN_SHA}), working tree propre${NC}"
else
  echo -e "${RED}✗ Déploiement refusé : ${SCRIPT_DIR} n'est pas un dépôt git.${NC}"
  exit 1
fi

# ─── 1. Build ──────────────────────────────────────────
echo -e "${CYAN}══════════════════════════════════════════════════${NC}"
echo -e "${CYAN}  Build Next.js (standalone)${NC}"
echo -e "${CYAN}══════════════════════════════════════════════════${NC}"
bun run build

# Garde : le standalone empaqueté doit être celui qui vient d'être compilé.
# Un BUILD_ID divergent signifie qu'on s'apprête à pousser un build périmé
# (ex. lancement depuis un worktree avant le correctif du `cd` ci-dessus).
if [ ! -f "${STANDALONE_DIR}/.next/BUILD_ID" ] || \
   [ "$(cat "${STANDALONE_DIR}/.next/BUILD_ID" 2>/dev/null)" != "$(cat "${BUILD_DIR}/BUILD_ID" 2>/dev/null)" ]; then
  echo -e "${RED}✗ Build incohérent : ${STANDALONE_DIR} ne correspond pas à ${BUILD_DIR}.${NC}"
  echo -e "${YELLOW}  Déploiement interrompu pour ne pas pousser un build périmé.${NC}"
  echo -e "${YELLOW}  Vérifie que le script tourne bien dans ${SCRIPT_DIR} (pas dans un worktree).${NC}"
  exit 1
fi

# ─── 2. Préparation du dossier standalone ──────────────
echo -e "\n${CYAN}→ Préparation du dossier standalone…${NC}"

rm -rf "$DEPLOY_TMP"
mkdir -p "$DEPLOY_TMP"

# Copie du serveur standalone (dotglob pour inclure .next/)
shopt -s dotglob
cp -r "$STANDALONE_DIR"/* "$DEPLOY_TMP/"
shopt -u dotglob

# Fichiers statiques (manquants dans standalone — ils sont dans .next/static/ à la racine)
mkdir -p "${DEPLOY_TMP}/.next/static"
cp -r "${BUILD_DIR}/static/"* "${DEPLOY_TMP}/.next/static/"

# Dossier public. Le standalone embarque déjà un public/ (file tracing de
# `outputFileTracingIncludes`) : sans le rm -rf, le cp copierait DANS ce
# dossier et créerait public/public/, rendant tous les assets 404 en prod
# (logos, manifest, service worker, captures de la landing).
rm -rf "${DEPLOY_TMP}/public"
cp -r "${SCRIPT_DIR}/public" "${DEPLOY_TMP}/public"

# Dossier data (si pas déjà sur le serveur). Le standalone embarque déjà un
# data/ (file tracing de Next, qui trace les JSON lus par le code) : sans le
# rm -rf, le cp copierait dans le dossier existant et créerait data/data/.
rm -rf "${DEPLOY_TMP}/data"
cp -r "${SCRIPT_DIR}/data" "${DEPLOY_TMP}/data"

# Génération du .env production
cat > "${DEPLOY_TMP}/.env" <<-EOF
NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}
IA_API_KEY=${IA_API_KEY}
GOOGLE_CLIENT_ID=${GOOGLE_CLIENT_ID}
GOOGLE_CLIENT_SECRET=${GOOGLE_CLIENT_SECRET}
GOOGLE_REDIRECT_URI=${GOOGLE_REDIRECT_URI}
AUTH_SECRET=${AUTH_SECRET}
OPENWEATHERMAP_API_KEY=${OPENWEATHERMAP_API_KEY}
BRAVE_SEARCH_API_KEY=${BRAVE_SEARCH_API_KEY}
NODE_ENV=production
NEXT_PUBLIC_VAPID_PUBLIC_KEY=${NEXT_PUBLIC_VAPID_PUBLIC_KEY}
VAPID_PRIVATE_KEY=${VAPID_PRIVATE_KEY}
VAPID_SUBJECT=${VAPID_SUBJECT}
MICROSOFT_CLIENT_ID=${MICROSOFT_CLIENT_ID}
MICROSOFT_CLIENT_SECRET=${MICROSOFT_CLIENT_SECRET}
MICROSOFT_REDIRECT_URI=${MICROSOFT_REDIRECT_URI}
CRON_SECRET=${CRON_SECRET:-}
CRON_BASE_URL=${CRON_BASE_URL:-}
CESAR_USERNAME=${CESAR_USERNAME}
CESAR_PASSWORD=${CESAR_PASSWORD}
CESAR_BASE=${CESAR_BASE:-}
SETUP_TOKEN=${SETUP_TOKEN:-}
WEBAUTHN_RP_ID=${WEBAUTHN_RP_ID:-}
WEBAUTHN_ORIGIN=${WEBAUTHN_ORIGIN:-}
GOOGLE_TESTING_EXPIRY=${GOOGLE_TESTING_EXPIRY:-}
EOF

if [ -z "${CRON_SECRET:-}" ]; then
  echo -e "${YELLOW}⚠  CRON_SECRET non défini dans .deploy.env — les routes /api/cron/* seront refusées en production. Définissez-le (openssl rand -hex 32) et ajoutez le header x-cron-secret à votre crontab.${NC}"
fi

if [ -z "${SETUP_TOKEN:-}" ]; then
  echo -e "${YELLOW}⚠  SETUP_TOKEN non défini : le premier enregistrement passkey sera REFUSÉ en production (503).${NC}"
  echo -e "${YELLOW}   Générez-le avec 'bun run setup', gardez-le le temps du premier login, puis retirez-le du serveur.${NC}"
fi

if [ -z "${WEBAUTHN_RP_ID:-}" ] || [ -z "${WEBAUTHN_ORIGIN:-}" ]; then
  echo -e "${YELLOW}⚠  WEBAUTHN_RP_ID / WEBAUTHN_ORIGIN non définis — la passkey se fiera à l'en-tête Host de la requête.${NC}"
  echo -e "${YELLOW}   Renseignez votre domaine dans .deploy.env pour un comportement stable.${NC}"
fi

if [ -z "${NEXT_PUBLIC_SITE_URL:-}" ]; then
  echo -e "${YELLOW}⚠  NEXT_PUBLIC_SITE_URL non défini — métadonnées et commande d'installation utiliseront le domaine par défaut du code.${NC}"
  echo -e "${YELLOW}   Renseignez votre URL publique dans .deploy.env (rebuild nécessaire pour la changer).${NC}"
fi

echo -e "${GREEN}✓ Standalone prêt dans ${DEPLOY_TMP}${NC}"

# ─── 3. Déploiement ────────────────────────────────────
echo -e "\n${CYAN}══════════════════════════════════════════════════${NC}"
echo -e "${CYAN}  Déploiement${NC}"
echo -e "${CYAN}══════════════════════════════════════════════════${NC}"

if [ -z "$SSH_HOST" ] || [ -z "$SSH_TARGET_DIR" ]; then
  echo -e "${YELLOW}╔══════════════════════════════════════════════════════════════╗${NC}"
  echo -e "${YELLOW}║  SSH non configuré — création d'une archive manuelle       ║${NC}"
  echo -e "${YELLOW}╚══════════════════════════════════════════════════════════════╝${NC}"
  echo -e "${CYAN}→ Création de backstage-deploy.tar.gz…${NC}"
  tar -czf "${SCRIPT_DIR}/backstage-deploy.tar.gz" -C "$DEPLOY_TMP" .
  echo -e "${GREEN}✓ Archive générée : backstage-deploy.tar.gz${NC}"
  echo -e "${YELLOW}  À faire :${NC}"
  echo -e "  1. Uploader l'archive dans ${SSH_TARGET_DIR:-/le/dossier/cible/}"
  echo -e "  2. $ tar -xzf backstage-deploy.tar.gz"
  echo -e "  3. Configurer l'App Node.js dans cPanel (→ lire docs/deploy-cpanel.md)"
  rm -rf "$DEPLOY_TMP"
  exit 0
fi

# Déploiement via rsync
echo -e "${CYAN}→ Déploiement vers ${SSH_USER}@${SSH_HOST}:${SSH_TARGET_DIR}${NC}"

# ─── 3.1 Backup du déploiement courant (rollback) ──────
# Avant le rsync destructif (--delete), on archive l'application en place
# (hors node_modules et data/) dans backstage-releases/, à côté de l'app.
# Les 5 dernières versions sont conservées ; le data/ (données réelles) n'est
# jamais inclus (ni touché par le rsync).
BACKUP_ROOT="$(dirname ${SSH_TARGET_DIR})/backstage-releases"
BACKUP_TS=$(date +%Y%m%d-%H%M%S)
echo -e "${CYAN}→ Backup du déploiement courant (rollback)…${NC}"
if ssh -p "$SSH_PORT" "${SSH_USER}@${SSH_HOST}" \
  "mkdir -p ${BACKUP_ROOT} && tar -czf ${BACKUP_ROOT}/backstage-${BACKUP_TS}.tar.gz -C ${SSH_TARGET_DIR} --exclude=node_modules --exclude=data . 2>/dev/null && ls -1t ${BACKUP_ROOT}/backstage-*.tar.gz 2>/dev/null | tail -n +6 | xargs -r rm -f && echo ok"; then
  echo -e "${GREEN}  ✓ Backup créé : backstage-${BACKUP_TS}.tar.gz (5 versions conservées)${NC}"
  echo -e "    Rollback : tar -xzf ${BACKUP_ROOT}/backstage-${BACKUP_TS}.tar.gz -C ${SSH_TARGET_DIR}"
else
  echo -e "${YELLOW}  ⚠  Backup impossible — poursuite SANS sauvegarde (risqué)${NC}"
fi

rsync -avz --delete \
  -e "ssh -p ${SSH_PORT}" \
  --include 'data/firebase-service-account.json' \
  --include 'data/config.json' \
  --exclude 'data/*.json' \
  --exclude 'data/backups' \
  --exclude '.htaccess' \
  "$DEPLOY_TMP/" \
  "${SSH_USER}@${SSH_HOST}:${SSH_TARGET_DIR}/"

# ─── 3.5 Vérification des dépendances ──────────────────
# Next trace les dépendances serveur dans `.next/standalone/node_modules` :
# le bundle déployé est exactement celui qui vient d'être construit. On ne
# lance donc plus `npm install` à distance, qui échouait systématiquement sur
# cPanel : le `npm` du nodevenv est un wrapper qui change de dossier et lit un
# `package.json` inexistant dans `VIRTUAL_ENV/lib`.
echo -e "\n${CYAN}→ Vérification des dépendances embarquées…${NC}"
if ssh -p "$SSH_PORT" "${SSH_USER}@${SSH_HOST}" \
  "cd ${SSH_TARGET_DIR} && test -f node_modules/next/package.json && echo ok" 2>/dev/null | grep -q '^ok$'; then
  echo -e "${GREEN}  ✓ Dépendances présentes dans le bundle${NC}"
else
  echo -e "${YELLOW}  ⚠  node_modules/next est absent sur le serveur.${NC}"
  echo -e "${YELLOW}     Vérifie que .next/standalone contient bien node_modules, ou lance :${NC}"
  echo -e "${YELLOW}     cd ${SSH_TARGET_DIR} && npm install --omit=dev${NC}"
fi

# ─── 3.6 Durcissement des permissions ─────────────────
# Les tokens OAuth et le secret de session ne doivent pas être lisibles par
# d'autres comptes du serveur partagé (cPanel) : data/ en 700, fichiers 600.
echo -e "${CYAN}→ Durcissement des permissions data/…${NC}"
ssh -p "$SSH_PORT" "${SSH_USER}@${SSH_HOST}" \
  "cd ${SSH_TARGET_DIR} && chmod 700 data 2>/dev/null; find data -type f -exec chmod 600 {} + 2>/dev/null; chmod 600 .env 2>/dev/null; echo 'ok'" \
  && echo -e "${GREEN}  ✓ Permissions durcies (data/ 700, fichiers 600)${NC}" \
  || echo -e "${YELLOW}  ⚠  chmod data/ échoué — à exécuter manuellement sur le serveur${NC}"

# ─── 4. Restart ────────────────────────────────────────
echo -e "\n${CYAN}→ Redémarrage de l'App Node.js…${NC}"

# Tentative 1 : cPanel API (UAPI)
if command -v curl &>/dev/null && [ -n "${CPANEL_TOKEN:-}" ] && [ -n "${CPANEL_USER:-}" ]; then
  echo -e "${CYAN}  Via cPanel API…${NC}"
  curl -s -H "Authorization: cpanel ${CPANEL_USER}:${CPANEL_TOKEN}" \
    "https://${SSH_HOST}:2083/execute/NodeApps/restart_app?app_name=$(basename ${SSH_TARGET_DIR})" \
    || echo -e "${YELLOW}  API échouée — restart manuel requis${NC}"
# Tentative 2 : Passenger — méthode `tmp/restart.txt` (cPanel Node.js Selector).
# On ne teste PAS `command -v node` pour décider : en cagefs le binaire node
# reste invisible alors que le shell SSH fonctionne, ce test faisait donc
# toujours échouer le restart automatique.
elif ssh -p "$SSH_PORT" -o ConnectTimeout=10 "${SSH_USER}@${SSH_HOST}" \
  "mkdir -p '${SSH_TARGET_DIR}/tmp' && touch '${SSH_TARGET_DIR}/tmp/restart.txt' && echo ok" 2>/dev/null | grep -q '^ok$'; then
  echo -e "${GREEN}  ✓ Redémarrage Passenger demandé (tmp/restart.txt)${NC}"
  echo -e "${YELLOW}    Le rechargement est appliqué à la prochaine requête HTTP sur l'app.${NC}"
  echo -e "${YELLOW}    Si la version servie ne change pas, redémarre via cPanel → Setup Node.js App → Stop / Start${NC}"
else
  echo -e "${YELLOW}  ⚠  Redémarre manuellement depuis cPanel :${NC}"
  echo -e "      cPanel → Setup Node.js App → Stop / Start"
fi

# ─── 5. Nettoyage ──────────────────────────────────────
rm -rf "$DEPLOY_TMP"
echo -e "\n${GREEN}✓ Déploiement terminé${NC}"
