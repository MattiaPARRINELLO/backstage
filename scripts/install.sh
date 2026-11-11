#!/usr/bin/env bash
# shellcheck disable=SC2329  # handlers appelés uniquement via trap()
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
VERBOSE="${BACKSTAGE_VERBOSE:-0}"

TTY=0
[ -t 1 ] && TTY=1

# ---- Palette ----------------------------------------------------------------
# Couleurs désactivées si la sortie n'est pas un terminal, si NO_COLOR est posé
# ou si le terminal est muet. Truecolor quand il est annoncé, sinon 256 couleurs.
COLOR=0
if [ "$TTY" -eq 1 ] && [ -t 2 ] && [ -z "${NO_COLOR:-}" ] && [ "${TERM:-dumb}" != "dumb" ]; then
  COLOR=1
fi

if [ "$COLOR" -eq 1 ]; then
  if [ "${COLORTERM:-}" = "truecolor" ] || [ "${COLORTERM:-}" = "24bit" ]; then
    C_ACCENT=$'\033[38;2;125;148;255m'
    C_OK=$'\033[38;2;155;191;138m'
    C_WARN=$'\033[38;2;224;164;94m'
    C_ERR=$'\033[38;2;217;136;120m'
    C_DIM=$'\033[38;2;154;160;171m'
  else
    C_ACCENT=$'\033[38;5;105m'
    C_OK=$'\033[38;5;108m'
    C_WARN=$'\033[38;5;179m'
    C_ERR=$'\033[38;5;174m'
    C_DIM=$'\033[38;5;246m'
  fi
  C_BOLD=$'\033[1m'
  C_RESET=$'\033[0m'
else
  C_ACCENT=''
  C_OK=''
  C_WARN=''
  C_ERR=''
  C_DIM=''
  C_BOLD=''
  C_RESET=''
fi

# ---- Glyphes ----------------------------------------------------------------
# Unicode quand la locale le permet, ASCII sinon (C locale, terminaux anciens).
UNICODE=0
CHARMAP="$(locale charmap 2>/dev/null || true)"
case "$CHARMAP" in
  UTF-8|utf-8|UTF8) UNICODE=1 ;;
  *)
    case "${LC_ALL:-}${LC_CTYPE:-}${LANG:-}" in
      *UTF-8*|*utf8*|*UTF8*) UNICODE=1 ;;
    esac
    ;;
esac

if [ "$UNICODE" -eq 1 ]; then
  RULE='─'
  CHECK='✓'
  CROSS='✕'
  DOT='·'
  SPIN_FRAMES=(⠋ ⠙ ⠹ ⠸ ⠼ ⠴ ⠦ ⠧ ⠇ ⠏)
  BOX_TL='┌'
  BOX_TR='┐'
  BOX_BL='└'
  BOX_BR='┘'
  BOX_H='─'
  BOX_V='│'
  BOX_ML='├'
  BOX_MR='┤'
else
  RULE='-'
  CHECK='+'
  CROSS='x'
  DOT='.'
  SPIN_FRAMES=('|' '/' '-' "\\")
  BOX_TL='+'
  BOX_TR='+'
  BOX_BL='+'
  BOX_BR='+'
  BOX_H='-'
  BOX_V='|'
  BOX_ML='+'
  BOX_MR='+'
fi

SPINNER=0
if [ "$TTY" -eq 1 ] && [ "$VERBOSE" != "1" ] && [ "${TERM:-dumb}" != "dumb" ]; then
  SPINNER=1
fi

repeat_char() {
  out=""
  i=0
  while [ "$i" -lt "$2" ]; do
    out="$out$1"
    i=$((i + 1))
  done
  printf '%s' "$out"
}

format_duration() {
  secs="${1:-0}"
  if [ "$secs" -ge 60 ]; then
    printf '%d min %02d s' "$((secs / 60))" "$((secs % 60))"
  else
    printf '%d s' "$secs"
  fi
}

# ---- Sortie ----------------------------------------------------------------
banner() {
  printf '\n'
  printf '  %s%sBACKSTAGE%s\n' "$C_ACCENT" "$C_BOLD" "$C_RESET"
  printf '  %sinstallation auto-hébergée%s\n' "$C_DIM" "$C_RESET"
  printf '  %s%s%s\n\n' "$C_DIM" "$(repeat_char "$RULE" 44)" "$C_RESET"
}

section() {
  printf '\n  %s%s%s  %s%s%s\n' "$C_ACCENT" "$1" "$C_RESET" "$C_BOLD" "$2" "$C_RESET"
}

detail() {
  printf '     %s%s%s\n' "$C_DIM" "$1" "$C_RESET"
}

step_ok() {
  printf '  %s%s%s %s' "$C_OK" "$CHECK" "$C_RESET" "$1"
  if [ -n "${2:-}" ]; then
    printf '  %s%s%s' "$C_DIM" "$(format_duration "$2")" "$C_RESET"
  fi
  printf '\n'
}

step_fail() {
  printf '  %s%s%s %s' "$C_ERR" "$CROSS" "$C_RESET" "$1"
  if [ -n "${2:-}" ]; then
    printf '  %s%s%s' "$C_DIM" "$(format_duration "$2")" "$C_RESET"
  fi
  printf '\n'
}

warn() { printf '  %s!%s %s\n' "$C_WARN" "$C_RESET" "$*" >&2; }
die()  { printf '\n  %s%s%s %s\n' "$C_ERR" "$CROSS" "$C_RESET" "$*" >&2; exit 1; }

show_log() {
  printf '\n'
  printf '     %sles dernières lignes de la commande :%s\n\n' "$C_DIM" "$C_RESET" >&2
  tail -n 40 "$1" 2>/dev/null | sed 's/^/     /' >&2 || true
  printf '\n' >&2
}

# ---- Cycle de vie ----------------------------------------------------------
SERVER_PID=""
STEP_PID=""

# `bun run start` lance Next en enfant : tuer le seul PID parent laisserait un
# serveur orphelin qui garde le port. On tue donc toute la descendance.
kill_tree() {
  parent="$1"
  if command -v pgrep >/dev/null 2>&1; then
    for child in $(pgrep -P "$parent" 2>/dev/null || true); do
      kill_tree "$child"
    done
  fi
  kill "$parent" 2>/dev/null || true
}

cleanup() {
  if [ -n "$STEP_PID" ]; then
    kill_tree "$STEP_PID"
    STEP_PID=""
  fi
  if [ -n "$SERVER_PID" ]; then
    kill_tree "$SERVER_PID"
    SERVER_PID=""
  fi
}

on_signal() {
  cleanup
  exit 130
}

on_error() {
  status=$?
  screen=${BASH_LINENO[0]:-?}
  printf '\n  %s%s%s Installation interrompue (code %s, ligne %s).\n' "$C_ERR" "$CROSS" "$C_RESET" "$status" "$screen" >&2
  kept_dir="${INSTALL_DIR:-${TARGET_DIR:-}}"
  if [ -n "$kept_dir" ] && [ -d "$kept_dir" ]; then
    printf '     %sLe dossier %s est conservé : relancez la même commande pour reprendre.%s\n' "$C_DIM" "$kept_dir" "$C_RESET" >&2
  fi
  exit "$status"
}

trap on_error ERR
trap cleanup EXIT
trap on_signal INT TERM

# ---- Arguments -------------------------------------------------------------
usage() {
  if [ "$TTY" -eq 1 ]; then
    banner
  fi
  cat <<'EOF'
BACKSTAGE - installation en une commande

Usage:
  curl -fsSL https://raw.githubusercontent.com/MattiaPARRINELLO/backstage/main/scripts/install.sh | bash
  curl -fsSL https://<votre-domaine>/install.sh | bash -s -- --node

Options:
  --node         Démarre avec Node (bun run build && bun run start) au lieu de Docker
  --docker       Force Docker (échoue si Docker n'est pas utilisable)
  --no-start     Prépare l'installation sans démarrer l'application
  --verbose      Affiche toute la sortie des commandes (désactive l'animation)
  --dir <chemin> Dossier d'installation (défaut : ./backstage)
  --port <n>     Port local (défaut : 3000)
  --ref <ref>    Branche ou tag du dépôt à installer (défaut : branche par défaut)
  -h, --help     Affiche cette aide

Variables d'environnement équivalentes :
  BACKSTAGE_DIR, BACKSTAGE_PORT, BACKSTAGE_REF, BACKSTAGE_REPO,
  BACKSTAGE_VERBOSE, NO_COLOR

Exemples:
  curl -fsSL https://backstage.mprnl.fr/install.sh | bash -s -- --port 8080
  BACKSTAGE_DIR=~/apps/backstage curl -fsSL https://backstage.mprnl.fr/install.sh | bash
EOF
}

while [ $# -gt 0 ]; do
  case "$1" in
    --node) MODE="node" ;;
    --docker) MODE="docker"; MODE_EXPLICIT=1 ;;
    --no-start) START=0 ;;
    --start) START=1 ;;
    --verbose) VERBOSE=1; SPINNER=0 ;;
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

# ---- Étapes ----------------------------------------------------------------
run_step() {
  label="$1"
  shift
  started=$SECONDS

  # --verbose : sortie intégrale, en direct.
  if [ "$VERBOSE" = "1" ]; then
    if "$@"; then status=0; else status=$?; fi
    elapsed=$((SECONDS - started))
    if [ "$status" -ne 0 ]; then
      step_fail "$label" "$elapsed"
      exit 1
    fi
    step_ok "$label" "$elapsed"
    return 0
  fi

  # Sinon la sortie est capturée : animation sur un terminal, ligne sobre
  # sinon. Elle n'est affichée qu'en cas d'échec.
  log=$(mktemp "${TMPDIR:-/tmp}/backstage.XXXXXX") || die "Impossible de créer un fichier temporaire"
  if [ "$SPINNER" -ne 1 ]; then
    printf '  %s%s%s %s\n' "$C_DIM" "$DOT" "$C_RESET" "$label"
  fi
  "$@" >"$log" 2>&1 &
  STEP_PID=$!

  if [ "$SPINNER" -eq 1 ]; then
    i=0
    frames=${#SPIN_FRAMES[@]}
    while kill -0 "$STEP_PID" 2>/dev/null; do
      frame="${SPIN_FRAMES[$((i % frames))]}"
      printf '\r\033[K  %s%s%s %s %s%s%s' \
        "$C_ACCENT" "$frame" "$C_RESET" "$label" "$C_DIM" "$(format_duration "$((SECONDS - started))")" "$C_RESET"
      sleep 0.1
      i=$((i + 1))
    done
    printf '\r\033[K'
  fi

  if wait "$STEP_PID"; then status=0; else status=$?; fi
  STEP_PID=""
  elapsed=$((SECONDS - started))
  if [ "$status" -ne 0 ]; then
    step_fail "$label" "$elapsed"
    show_log "$log"
    rm -f "$log"
    printf '     %sRelancez avec --verbose pour voir toute la sortie.%s\n' "$C_DIM" "$C_RESET" >&2
    exit 1
  fi
  rm -f "$log"
  step_ok "$label" "$elapsed"
}

wait_for_http() {
  url="$1"
  limit="$2"
  label="$3"
  animate="${4:-1}"
  started=$SECONDS
  i=0
  frames=${#SPIN_FRAMES[@]}
  animated=0
  if [ "$SPINNER" -eq 1 ] && [ "$animate" -eq 1 ]; then
    animated=1
  fi

  while [ "$((SECONDS - started))" -lt "$limit" ]; do
    if curl -fsS -o /dev/null --max-time 2 "$url" 2>/dev/null; then
      if [ "$animated" -eq 1 ]; then
        printf '\r\033[K'
      fi
      step_ok "$label" "$((SECONDS - started))"
      return 0
    fi
    if [ "$animated" -eq 1 ]; then
      frame="${SPIN_FRAMES[$((i % frames))]}"
      printf '\r\033[K  %s%s%s %s %s%s%s' \
        "$C_ACCENT" "$frame" "$C_RESET" "$label" "$C_DIM" "$(format_duration "$((SECONDS - started))")" "$C_RESET"
    fi
    sleep 0.5
    i=$((i + 1))
  done

  if [ "$animated" -eq 1 ]; then
    printf '\r\033[K'
  fi
  step_fail "$label" "$((SECONDS - started))"
  return 1
}

summary_box() {
  title="$1"
  shift
  width=$(( ${#title} + 4 ))
  for row in "$@"; do
    key=${row%%|*}
    val=${row#*|}
    content=$(printf '  %-9s  %s' "$key" "$val")
    if [ "${#content}" -gt "$width" ]; then
      width=${#content}
    fi
  done
  width=$((width + 2))

  rule=$(repeat_char "$BOX_H" "$width")
  printf '\n'
  printf '  %s%s%s%s%s\n' "$C_DIM" "$BOX_TL" "$rule" "$BOX_TR" "$C_RESET"

  content="  ${title}"
  pad=$((width - ${#content}))
  printf '  %s%s%s' "$C_DIM" "$BOX_V" "$C_RESET"
  printf '%s%s%s' "$C_ACCENT" "$content" "$C_RESET"
  printf '%s' "$(repeat_char ' ' "$pad")"
  printf '%s%s%s\n' "$C_DIM" "$BOX_V" "$C_RESET"

  printf '  %s%s%s%s%s\n' "$C_DIM" "$BOX_ML" "$(repeat_char "$BOX_H" "$width")" "$BOX_MR" "$C_RESET"

  for row in "$@"; do
    key=${row%%|*}
    val=${row#*|}
    content=$(printf '  %-9s  %s' "$key" "$val")
    pad=$((width - ${#content}))
    printf '  %s%s%s' "$C_DIM" "$BOX_V" "$C_RESET"
    printf '%s' "$content"
    printf '%s' "$(repeat_char ' ' "$pad")"
    printf '%s%s%s\n' "$C_DIM" "$BOX_V" "$C_RESET"
  done

  printf '  %s%s%s%s%s\n' "$C_DIM" "$BOX_BL" "$rule" "$BOX_BR" "$C_RESET"
  printf '\n'
}

next_step() {
  printf '  %s%s%s  %s\n' "$C_ACCENT" "$1" "$C_RESET" "$2"
}

print_next_steps() {
  login_url="${1:-http://localhost:${PORT}/login}"
  printf '  %s%sprochaines étapes%s\n\n' "$C_ACCENT" "$C_BOLD" "$C_RESET"
  n=1
  if [ "$API_READY" != "1" ]; then
    next_step "$n" "Renseigner NEXT_PUBLIC_API_URL et IA_API_KEY dans .env.local"
    n=$((n + 1))
  fi
  next_step "$n" "Ouvrir ${login_url}"
  n=$((n + 1))
  next_step "$n" "Enregistrer votre passkey (elle protège l'accès à l'application)"
  printf '\n'
  printf '  %sguide : docs/self-hosting.md%s\n' "$C_DIM" "$C_RESET"
  printf '\n'
}

# ---- 1. Prérequis -----------------------------------------------------------
banner
section "1/5" "Prérequis"

command -v git >/dev/null 2>&1 || die "git est requis (https://git-scm.com)"

if ! command -v bun >/dev/null 2>&1; then
  printf '  %s%s%s Bun est requis pour générer les secrets locaux.\n' "$C_ERR" "$CROSS" "$C_RESET" >&2
  printf '     %sInstallez-le vous-même, rien n'"'"'est installé automatiquement :%s\n' "$C_DIM" "$C_RESET" >&2
  printf '     %scurl -fsSL https://bun.sh/install | bash%s\n' "$C_DIM" "$C_RESET" >&2
  printf '     %spuis relancez cette commande.%s\n' "$C_DIM" "$C_RESET" >&2
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

GIT_VERSION="$(git --version | awk '{print $3}')"
if [ "$MODE" = "docker" ]; then
  MODE_LABEL="Docker"
  detail "git ${GIT_VERSION} ${DOT} bun ${BUN_VERSION} ${DOT} ${COMPOSE_CMD} ${DOT} port ${PORT}"
else
  MODE_LABEL="Node.js"
  detail "git ${GIT_VERSION} ${DOT} bun ${BUN_VERSION} ${DOT} node $(node --version) ${DOT} port ${PORT}"
fi

# ---- 2. Code ----------------------------------------------------------------
section "2/5" "Code"

if [ -e "$TARGET_DIR" ] && [ ! -d "$TARGET_DIR" ]; then
  die "'$TARGET_DIR' existe et n'est pas un dossier. Choisissez un autre chemin avec --dir."
fi

if [ -d "$TARGET_DIR" ]; then
  if [ -f "$TARGET_DIR/package.json" ] && [ -f "$TARGET_DIR/compose.yaml" ]; then
    detail "dossier existant réutilisé : ${TARGET_DIR}"
  elif [ -z "$(ls -A "$TARGET_DIR" 2>/dev/null || true)" ]; then
    detail "dossier vide : ${TARGET_DIR}"
  else
    die "Le dossier '$TARGET_DIR' existe déjà et ne ressemble pas à BACKSTAGE.
     Choisissez un autre emplacement avec --dir, par exemple :
       BACKSTAGE_DIR=mon-backstage curl -fsSL https://backstage.mprnl.fr/install.sh | bash"
  fi
else
  if [ -n "$REF" ]; then
    run_step "Clonage du dépôt (${REF})" git clone --depth 1 --branch "$REF" "$REPO_URL" "$TARGET_DIR"
  else
    run_step "Clonage du dépôt" git clone --depth 1 "$REPO_URL" "$TARGET_DIR"
  fi
fi

cd "$TARGET_DIR"
INSTALL_DIR="$(pwd)"

if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  die "'$INSTALL_DIR' n'est pas un dépôt git valide."
fi

# ---- 3. Dépendances ---------------------------------------------------------
section "3/5" "Dépendances"
run_step "Installation des dépendances" bun install --frozen-lockfile

# ---- 4. Secrets -------------------------------------------------------------
section "4/5" "Secrets locaux"
run_step "Génération de .env.local" bun run setup

if [ "$PORT" != "3000" ] && [ -f .env.local ]; then
  if grep -q "^WEBAUTHN_ORIGIN=http://localhost:3000" .env.local; then
    sed -E "s|^(WEBAUTHN_ORIGIN=http://localhost:)3000|\1${PORT}|" .env.local > .env.local.tmp
    mv .env.local.tmp .env.local
    chmod 600 .env.local 2>/dev/null || true
    detail "origine WebAuthn ajustée au port ${PORT}"
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
API_URL="$(read_env NEXT_PUBLIC_API_URL | tr -d '[:space:]\r')"
API_KEY="$(read_env IA_API_KEY | tr -d '[:space:]\r')"
API_READY=0
if [ -n "$API_URL" ] && [ -n "$API_KEY" ]; then
  API_READY=1
fi

LOGIN_URL="http://localhost:${PORT}/login"
if [ -n "$SETUP_TOKEN" ]; then
  LOGIN_URL="${LOGIN_URL}?setupToken=${SETUP_TOKEN}"
fi

if [ -z "$SETUP_TOKEN" ]; then
  TOKEN_DISPLAY="voir .env.local"
else
  TOKEN_DISPLAY="$SETUP_TOKEN"
fi

# ---- 5. Démarrage -----------------------------------------------------------
section "5/5" "Démarrage"

if [ "$START" -eq 0 ]; then
  detail "ignoré (--no-start)"
  if [ "$MODE" = "docker" ]; then
    START_CMD="cd \"${INSTALL_DIR}\" && BACKSTAGE_PORT=${PORT} ${COMPOSE_CMD} up -d --build"
  else
    START_CMD="cd \"${INSTALL_DIR}\" && bun run build && PORT=${PORT} bun run start"
  fi
  summary_box "installation prête" \
    "Dossier|${INSTALL_DIR}" \
    "Adresse|http://localhost:${PORT}" \
    "Mode|${MODE_LABEL}" \
    "Token|${TOKEN_DISPLAY}"
  print_next_steps "$LOGIN_URL"
  printf '  %sdémarrage manuel :%s\n' "$C_DIM" "$C_RESET"
  printf '  %s%s%s\n\n' "$C_DIM" "$START_CMD" "$C_RESET"
  exit 0
fi

HAS_CURL=0
command -v curl >/dev/null 2>&1 && HAS_CURL=1

if [ "$MODE" = "docker" ]; then
  export BACKSTAGE_PORT="$PORT"
  run_step "Construction et démarrage du conteneur" compose up -d --build

  if [ "$HAS_CURL" -eq 1 ]; then
    if ! wait_for_http "http://127.0.0.1:${PORT}/login" 180 "Réponse du serveur"; then
      printf '\n     %sjournaux du conteneur :%s\n\n' "$C_DIM" "$C_RESET" >&2
      compose logs --tail=40 2>/dev/null | sed 's/^/     /' >&2 || true
      printf '\n' >&2
      die "Le conteneur démarre mais ne répond pas. Vérifiez : cd ${INSTALL_DIR} && ${COMPOSE_CMD} logs"
    fi
  else
    step_ok "Conteneur démarré"
  fi

  summary_box "installation terminée" \
    "Dossier|${INSTALL_DIR}" \
    "Adresse|http://localhost:${PORT}" \
    "Mode|${MODE_LABEL}" \
    "Token|${TOKEN_DISPLAY}"
  print_next_steps "$LOGIN_URL"
  printf '  %sjournaux : %s logs -f%s\n' "$C_DIM" "$COMPOSE_CMD" "$C_RESET"
  printf '  %sarrêt    : %s down%s\n\n' "$C_DIM" "$COMPOSE_CMD" "$C_RESET"
  exit 0
fi

port_in_use() {
  (exec 3<>"/dev/tcp/127.0.0.1/$1") >/dev/null 2>&1
}

if port_in_use "$PORT"; then
  die "Le port ${PORT} est déjà utilisé. Choisissez-en un autre avec --port."
fi

run_step "Build de production" bun run build

detail "démarrage du serveur (Ctrl-C pour arrêter)"
PORT="$PORT" bun run start &
SERVER_PID=$!

if [ "$HAS_CURL" -eq 1 ]; then
  if ! wait_for_http "http://127.0.0.1:${PORT}/login" 90 "Réponse du serveur" 0; then
    warn "Le serveur ne répond pas encore ; vérifiez les journaux ci-dessus."
  fi
else
  step_ok "Serveur démarré"
fi

summary_box "installation terminée" \
  "Dossier|${INSTALL_DIR}" \
  "Adresse|http://localhost:${PORT}" \
  "Mode|${MODE_LABEL}" \
  "Token|${TOKEN_DISPLAY}"
print_next_steps "$LOGIN_URL"
printf '  %sCtrl-C pour arrêter le serveur%s\n\n' "$C_DIM" "$C_RESET"

# Un arrêt normal du serveur (Ctrl-C, SIGTERM) ne doit pas ressembler à une
# erreur d'installation : on retire le trap ERR le temps d'attendre le processus.
trap - ERR
wait "$SERVER_PID"
exit_status=$?
trap on_error ERR
SERVER_PID=""
exit "$exit_status"
