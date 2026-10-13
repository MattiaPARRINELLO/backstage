#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# BACKSTAGE — installation en une commande
#
#   curl -fsSL https://raw.githubusercontent.com/MattiaPARRINELLO/backstage/main/scripts/install.sh | bash
#
# (toute instance sert aussi le script sur /install.sh : curl -fsSL https://votre-domaine/install.sh | bash)
#
# Ce script fait exactement ceci, rien de plus :
#   1. vérifie les prérequis (git, docker ou node, bun)
#   2. clone le dépôt public dans ./backstage
#   3. installe les dépendances
#   4. génère les secrets locaux (.env.local) via `bun run setup`
#   5. affiche la marche à suivre, puis démarre l'application
#
# Aucun sudo, aucun accès réseau hors dépôt officiel et registres de paquets,
# aucune donnée envoyée ailleurs. Les secrets restent sur votre machine.
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

REPO_URL="${BACKSTAGE_REPO:-https://github.com/MattiaPARRINELLO/backstage.git}"
TARGET_DIR="${BACKSTAGE_DIR:-backstage}"
PORT="${BACKSTAGE_PORT:-3000}"

info()  { printf '\033[0;36m→\033[0m %s\n' "$*"; }
ok()    { printf '\033[0;32m✓\033[0m %s\n' "$*"; }
warn()  { printf '\033[1;33m!\033[0m %s\n' "$*"; }
die()   { printf '\033[0;31m✗\033[0m %s\n' "$*" >&2; exit 1; }

usage() {
  cat <<'EOF'
BACKSTAGE — installation en une commande

Usage:
  curl -fsSL https://raw.githubusercontent.com/MattiaPARRINELLO/backstage/main/scripts/install.sh | bash
  curl -fsSL https://<votre-domaine>/install.sh | bash -s -- --node

Options:
  --node      Démarre avec Node (npm run build && start) au lieu de Docker
  --no-start  Prépare l'installation sans démarrer l'application
  -h, --help  Affiche cette aide

Variables d'environnement utiles :
  BACKSTAGE_DIR    dossier d'installation (défaut : ./backstage)
  BACKSTAGE_PORT   port local (défaut : 3000)
EOF
}

MODE="docker"
START=1
for arg in "$@"; do
  case "$arg" in
    --node) MODE="node" ;;
    --no-start) START=0 ;;
    -h|--help) usage; exit 0 ;;
    *) die "Option inconnue : $arg (voir --help)" ;;
  esac
done

# ── 1. Prérequis ────────────────────────────────────────────────────────────
info "Vérification des prérequis…"
command -v git >/dev/null 2>&1 || die "git est requis (https://git-scm.com)"

if ! command -v bun >/dev/null 2>&1; then
  cat >&2 <<'EOF'
✗ Bun est requis pour générer les secrets locaux (bun run setup).
  Installez-le vous-même (rien n'est installé automatiquement) :
    curl -fsSL https://bun.sh/install | bash
  Puis relancez cette commande.
EOF
  exit 1
fi

if [ "$MODE" = "docker" ]; then
  if ! command -v docker >/dev/null 2>&1; then
    warn "Docker introuvable — bascule sur le mode Node."
    MODE="node"
  elif ! docker info >/dev/null 2>&1; then
    warn "Le démon Docker ne répond pas — bascule sur le mode Node."
    MODE="node"
  fi
fi

if [ "$MODE" = "node" ] && ! command -v node >/dev/null 2>&1; then
  die "Node.js >= 20.9 est requis (https://nodejs.org) — ou installez Docker."
fi

ok "git $(git --version | awk '{print $3}') · bun $(bun --version) · mode ${MODE}"

# ── 2. Récupération du code ─────────────────────────────────────────────────
if [ -e "$TARGET_DIR" ]; then
  die "Le dossier « $TARGET_DIR » existe déjà. Choisissez-en un autre :
     BACKSTAGE_DIR=mon-backstage curl -fsSL https://brain.mprnl.fr/install.sh | bash"
fi

info "Clonage de ${REPO_URL} dans ${TARGET_DIR}/…"
git clone --depth 1 "$REPO_URL" "$TARGET_DIR"
cd "$TARGET_DIR"

# ── 3. Dépendances ──────────────────────────────────────────────────────────
info "Installation des dépendances (bun install)…"
bun install --frozen-lockfile

# ── 4. Secrets locaux ───────────────────────────────────────────────────────
# `bun run setup` écrit .env.local : AUTH_SECRET, SETUP_TOKEN, paire VAPID,
# variables WebAuthn. Il n'écrase jamais une valeur existante.
info "Génération des secrets locaux (.env.local)…"
bun run setup

SETUP_TOKEN="$(sed -n 's/^SETUP_TOKEN=\(.*\)#.*/\1/p' .env.local | tr -d ' ')"

# ── 5. Démarrage ────────────────────────────────────────────────────────────
printf '\n'
ok "BACKSTAGE est prêt dans $(pwd)"
cat <<EOF

Une seule chose à faire vous-même : l'API IA.
  Ouvrez .env.local et renseignez :
    NEXT_PUBLIC_API_URL=…   (un endpoint compatible OpenAI)
    IA_API_KEY=…

Puis ouvrez :
  http://localhost:${PORT}/login?setupToken=${SETUP_TOKEN:-VOTRE_TOKEN}
  (le token se trouve dans .env.local et ne sert qu'une fois)
EOF
printf '\n'

if [ "$START" -eq 0 ]; then
  info "Démarrage ignoré (--no-start). Pour lancer plus tard : cd $TARGET_DIR"
  [ "$MODE" = "docker" ] && info "  docker compose up -d --build" || info "  bun run build && bun run start"
  exit 0
fi

if [ "$MODE" = "docker" ]; then
  info "Construction et démarrage de l'image Docker…"
  docker compose up -d --build
  ok "Application démarrée : http://localhost:${PORT}"
  info "Journaux : docker compose logs -f · Arrêt : docker compose down"
else
  info "Build de production…"
  bun run build
  info "Démarrage sur http://localhost:${PORT} (Ctrl-C pour arrêter)"
  PORT="$PORT" bun run start
fi
