#!/usr/bin/env bash
# -----------------------------------------------------------------------------
# BACKSTAGE - installation en une commande
#
#   curl -fsSL https://raw.githubusercontent.com/MattiaPARRINELLO/backstage/main/scripts/install.sh | bash
#
# (toute instance sert aussi le script sur /install.sh :
#  curl -fsSL https://votre-domaine/install.sh | bash)
#
# Ce script fait exactement ceci, rien de plus :
#   1. vérifie les prérequis (git, bun, docker ou node)
#   2. clone le dépôt public dans ./backstage (ou un dossier existant)
#   3. installe les dépendances
#   4. génère les secrets locaux (.env.local) via `bun run setup`
#   5. démarre l'application et vérifie qu'elle répond
#
# Aucun sudo, aucun accès réseau hors dépôt officiel et registres de paquets,
# aucune donnée envoyée ailleurs. Les secrets restent sur votre machine.
#
# Compatible bash 3.2+ (macOS), Linux, WSL et Git Bash. Relançable : un dossier
# d'installation existant est réutilisé au lieu d'être refusé.
# -----------------------------------------------------------------------------
set -euo pipefail

REPO_URL="${BACKSTAGE_REPO:-https://github.com/MattiaPARRINELLO/backstage.git}"
TARGET_DIR="${BACKSTAGE_DIR:-backstage}"
PORT="${BACKSTAGE_PORT:-3000}"
REF="${BACKSTAGE_REF:-}"
MODE="docker"
MODE_EXPLICIT=0
START=1

# Couleurs uniquement sur un terminal et si NO_COLOR n'est pas demandé.
if [ -t 1 ] && [ -z "${NO_COLOR:-}" ]; then
  C_INFO='\033[0;36m'
  C_OK='\033[0;32m'
  C_WARN='\033[1;33m'
  C_ERR='\033[0;31m'
  C_RESET='\033[0m'
else
  C_INFO=''
  C_OK=''
  C_WARN=''
  C_ERR=''
  C_RESET=''
fi

info() { printf '%b->%b %s\n' "$C_INFO" "$C_RESET" "$*"; }
ok()   { printf '%b[ok]%b %s\n' "$C_OK" "$C_RESET" "$*"; }
warn() { printf '%b[!]%b %s\n' "$C_WARN" "$C_RESET" "$*" >&2; }
die()  { printf '%b[x]%b %s\n' "$C_ERR" "$C_RESET" "$*" >&2; exit 1; }

SERVER_PID=""
cleanup() {
  if [ -n "$SERVER_PID" ] && kill -0 "$SERVER_PID" 2>/dev/null; then
    kill "$SERVER_PID" 2>/dev/null || true
  fi
}
on_error() {
  status=$?
  screen=${BASH_LINENO[0]:-?}
  printf "\n%b[x]%b Installation interrompue (code %s, ligne %s).\n" "$C_ERR" "$C_RESET" "$status" "$screen" >&2
  kept_dir="${INSTALL_DIR:-${TARGET_DIR:-}}"
  if [ -d "$kept_dir" ]; then
    printf "    Le dossier %s est conservé : relancez la même commande pour reprendre.\n" "$kept_dir" >&2
  fi
  exit "$status"
}
trap on_error ERR
trap cleanup EXIT INT TERM

usage() {
  cat <<'EOF'
BACKSTAGE - installation en une commande

Usage:
  curl -fsSL https://raw.githubusercontent.com/MattiaPARRINELLO/backstage/main/scripts/install.sh | bash
  curl -fsSL https://<votre-domaine>/install.sh | bash -s -- --node

Options:
  --node         Démarre avec Node (bun run build && bun run start) au lieu de Docker
  --docker       Force Docker (échoue si Docker n'est pas utilisable)
  --no-start     Prépare l'installation sans démarrer l'application
  --dir <chemin> Dossier d'installation (défaut : ./backstage)
  --port <n>     Port local (défaut : 3000)
  --ref <ref>    Branche ou tag du dépôt à installer (défaut : branche par défaut)
  -h, --help     Affiche cette aide

Variables d'environnement équivalentes :
  BACKSTAGE_DIR, BACKSTAGE_PORT, BACKSTAGE_REF, BACKSTAGE_REPO, NO_COLOR

Exemples:
  curl -fsSL https://brain.mprnl.fr/install.sh | bash -s -- --port 8080
  BACKSTAGE_DIR=~/apps/backstage curl -fsSL https://brain.mprnl.fr/install.sh | bash
EOF
}

# ---- Arguments --------------------------------------------------------------
while [ $# -gt 0 ]; do
  case "$1" in
    --node) MODE="node" ;;
    --docker) MODE="docker"; MODE_EXPLICIT=1 ;;
    --no-start) START=0 ;;
    --start) START=1 ;;
    --dir)
      [ $# -ge 2 ] || die "--dir attend un chemin"
      TARGET_DIR="$2"
      shift
      ;;
    --dir=*) TARGET_DIR="${1#*=}" ;;
    --port)
      [ $# -ge 2 ] || die "--port attend un numéro"
      PORT="$2"
      shift
      ;;
    --port=*) PORT="${1#*=}" ;;
    --ref)
      [ $# -ge 2 ] || die "--ref attend une branche ou un tag"
      REF="$2"
      shift
      ;;
    --ref=*) REF="${1#*=}" ;;
    -h|--help) usage; exit 0 ;;
    *) die "Option inconnue : $1 (voir --help)" ;;
  esac
  shift
done

case "$PORT" in
  ''|*[!0-9]*) die "Port invalide : '$PORT' (attendu : 1-65535)" ;;
esac
if [ "$PORT" -lt 1 ] || [ "$PORT" -gt 65535 ]; then
  die "Port invalide : $PORT (attendu : 1-65535)"
fi

[ -n "$TARGET_DIR" ] || die "--dir ne peut pas être vide"

# ---- 1. Prérequis -----------------------------------------------------------
info "Vérification des prérequis..."

command -v git >/dev/null 2>&1 || die "git est requis (https://git-scm.com)"

if ! command -v bun >/dev/null 2>&1; then
  cat >&2 <<'EOF'
[x] Bun est requis pour générer les secrets locaux (bun run setup).
    Installez-le vous-même (rien n'est installé automatiquement) :
      curl -fsSL https://bun.sh/install | bash
    Puis relancez cette commande.
EOF
  exit 1
fi

BUN_VERSION="$(bun --version 2>/dev/null || echo inconnue)"
case "$BUN_VERSION" in
  0.*) warn "Bun $BUN_VERSION est ancien ; Bun 1.x est recommandé (https://bun.sh)." ;;
esac

DOCKER_OK=0
COMPOSE_CMD=""
if command -v docker >/dev/null 2>&1; then
  if docker info >/dev/null 2>&1; then
    if docker compose version >/dev/null 2>&1; then
      DOCKER_OK=1
      COMPOSE_CMD="docker compose"
    elif command -v docker-compose >/dev/null 2>&1; then
      DOCKER_OK=1
      COMPOSE_CMD="docker-compose"
    else
      warn "Docker Compose est introuvable (plugin 'docker compose' ou binaire 'docker-compose')."
    fi
  else
    warn "Le démon Docker ne répond pas (droits ou service arrêté)."
  fi
else
  warn "Docker est introuvable."
fi

compose() {
  if [ "$COMPOSE_CMD" = "docker compose" ]; then
    docker compose "$@"
  else
    docker-compose "$@"
  fi
}

NODE_OK=0
check_node() {
  command -v node >/dev/null 2>&1 || return 1
  node -e '
    const [major, minor] = process.versions.node.split(".").map(Number);
    process.exit(major > 20 || (major === 20 && minor >= 9) ? 0 : 1);
  ' >/dev/null 2>&1
}
if check_node; then
  NODE_OK=1
fi

if [ "$MODE" = "docker" ]; then
  if [ "$DOCKER_OK" -ne 1 ]; then
    if [ "$MODE_EXPLICIT" -eq 1 ]; then
      die "Docker est demandé (--docker) mais n'est pas utilisable."
    elif [ "$NODE_OK" -eq 1 ]; then
      warn "Bascule en mode Node (Docker indisponible)."
      MODE="node"
    else
      die "Ni Docker ni Node.js >= 20.9 ne sont disponibles. Installez l'un des deux."
    fi
  fi
elif [ "$NODE_OK" -ne 1 ]; then
  die "Node.js >= 20.9 est requis pour le mode Node (https://nodejs.org)."
fi

if [ "$MODE" = "docker" ]; then
  ok "git $(git --version | awk '{print $3}') · bun $BUN_VERSION · docker + ${COMPOSE_CMD} · port ${PORT}"
else
  ok "git $(git --version | awk '{print $3}') · bun $BUN_VERSION · node $(node --version) · port ${PORT}"
fi

# ---- 2. Récupération du code ------------------------------------------------
if [ -e "$TARGET_DIR" ] && [ ! -d "$TARGET_DIR" ]; then
  die "'$TARGET_DIR' existe et n'est pas un dossier. Choisissez un autre chemin avec --dir."
fi

if [ -d "$TARGET_DIR" ]; then
  if [ -f "$TARGET_DIR/package.json" ] && [ -f "$TARGET_DIR/compose.yaml" ]; then
    warn "Dossier existant réutilisé : $TARGET_DIR (mise à jour du code ignorée)."
  elif [ -z "$(ls -A "$TARGET_DIR" 2>/dev/null || true)" ]; then
    info "Le dossier '$TARGET_DIR' est vide : installation dedans."
  else
    die "Le dossier '$TARGET_DIR' existe déjà et ne ressemble pas à BACKSTAGE.
     Choisissez un autre emplacement :
       BACKSTAGE_DIR=mon-backstage curl -fsSL https://brain.mprnl.fr/install.sh | bash"
  fi
else
  info "Clonage de ${REPO_URL} dans ${TARGET_DIR}/..."
  if [ -n "$REF" ]; then
    git clone --depth 1 --branch "$REF" "$REPO_URL" "$TARGET_DIR"
  else
    git clone --depth 1 "$REPO_URL" "$TARGET_DIR"
  fi
fi

cd "$TARGET_DIR"
INSTALL_DIR="$(pwd)"

# Un dossier existant n'est pas re-cloné : on vérifie quand même le dépôt.
if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  die "'$INSTALL_DIR' n'est pas un dépôt git valide."
fi

# ---- 3. Dépendances ---------------------------------------------------------
info "Installation des dépendances (bun install)..."
if ! bun install --frozen-lockfile; then
  die "L'installation des dépendances a échoué. Vérifiez votre connexion puis relancez."
fi

# ---- 4. Secrets locaux ------------------------------------------------------
# `bun run setup` écrit .env.local : AUTH_SECRET, SETUP_TOKEN, paire VAPID,
# variables WebAuthn. Il n'écrase jamais une valeur existante et reste idempotent.
info "Génération des secrets locaux (.env.local)..."
bun run setup

# Port personnalisé : l'origine WebAuthn par défaut pointe sur 3000. On ajuste
# seulement la valeur par défaut, jamais une origine déjà personnalisée.
if [ "$PORT" != "3000" ] && [ -f .env.local ]; then
  if grep -q "^WEBAUTHN_ORIGIN=http://localhost:3000" .env.local; then
    sed -E "s|^(WEBAUTHN_ORIGIN=http://localhost:)3000|\1${PORT}|" .env.local > .env.local.tmp
    mv .env.local.tmp .env.local
    chmod 600 .env.local 2>/dev/null || true
    info "WEBAUTHN_ORIGIN ajusté au port ${PORT}."
  fi
fi

read_env() {
  awk -v key="$1" 'index($0, key "=") == 1 {
    sub("^[^=]*=", "");
    sub(/[ \t]*#.*$/, "");
    print;
    exit
  }' .env.local
}

SETUP_TOKEN="$(read_env SETUP_TOKEN | tr -d '[:space:]\r')"
LOGIN_URL="http://localhost:${PORT}/login"
if [ -n "$SETUP_TOKEN" ]; then
  LOGIN_URL="${LOGIN_URL}?setupToken=${SETUP_TOKEN}"
fi

# ---- 5. Récapitulatif -------------------------------------------------------
printf '\n'
ok "BACKSTAGE est prêt dans ${INSTALL_DIR}"
cat <<EOF

Une seule chose à faire vous-même : l'API IA.
  Ouvrez .env.local et renseignez :
    NEXT_PUBLIC_API_URL=...   (un endpoint compatible OpenAI)
    IA_API_KEY=...

Puis ouvrez :
  ${LOGIN_URL}
  (le token se trouve dans .env.local et ne sert qu'une fois)

En production : servez l'application en HTTPS et remplacez WEBAUTHN_RP_ID /
WEBAUTHN_ORIGIN par votre domaine (voir docs/self-hosting.md).
EOF
printf '\n'

if [ "$START" -eq 0 ]; then
  info "Démarrage ignoré (--no-start). Pour lancer plus tard :"
  if [ "$MODE" = "docker" ]; then
    info "  cd ${INSTALL_DIR} && BACKSTAGE_PORT=${PORT} ${COMPOSE_CMD} up -d --build"
  else
    info "  cd ${INSTALL_DIR} && bun run build && PORT=${PORT} bun run start"
  fi
  exit 0
fi

wait_for_http() {
  url="$1"
  limit="$2"
  i=0
  while [ "$i" -lt "$limit" ]; do
    if curl -fsS -o /dev/null --max-time 2 "$url" 2>/dev/null; then
      return 0
    fi
    sleep 1
    i=$((i + 1))
  done
  return 1
}

HAS_CURL=0
command -v curl >/dev/null 2>&1 && HAS_CURL=1

if [ "$MODE" = "docker" ]; then
  info "Construction et démarrage de l'image Docker (quelques minutes)..."
  BACKSTAGE_PORT="$PORT" compose up -d --build

  if [ "$HAS_CURL" -eq 1 ]; then
    info "Attente de l'application (jusqu'à 3 min)..."
    if wait_for_http "http://127.0.0.1:${PORT}/login" 180; then
      ok "Application en ligne : http://localhost:${PORT}"
    else
      warn "L'application ne répond pas encore. Derniers journaux :"
      compose logs --tail=50 || true
      die "Démarrage Docker incomplet. Relancez : cd ${INSTALL_DIR} && ${COMPOSE_CMD} logs -f"
    fi
  else
    ok "Application démarrée : http://localhost:${PORT}"
  fi
  info "Journaux : ${COMPOSE_CMD} logs -f · Arrêt : ${COMPOSE_CMD} down"
else
  port_in_use() {
    (exec 3<>"/dev/tcp/127.0.0.1/$1") >/dev/null 2>&1
  }

  if port_in_use "$PORT"; then
    die "Le port ${PORT} est déjà utilisé. Choisissez-en un autre avec --port."
  fi

  info "Build de production..."
  bun run build

  info "Démarrage sur http://localhost:${PORT} (Ctrl-C pour arrêter)"
  PORT="$PORT" bun run start &
  SERVER_PID=$!

  if [ "$HAS_CURL" -eq 1 ]; then
    if wait_for_http "http://127.0.0.1:${PORT}/login" 90; then
      ok "Application en ligne : http://localhost:${PORT}"
    else
      warn "L'application ne répond pas encore ; vérifiez les journaux ci-dessus."
    fi
  fi

  # Un arrêt normal du serveur (Ctrl-C, SIGTERM) ne doit pas ressembler à une
  # erreur d'installation : on retire le trap ERR le temps d'attendre le processus.
  trap - ERR
  wait "$SERVER_PID"
  exit_status=$?
  trap on_error ERR
  SERVER_PID=""
  exit "$exit_status"
fi
