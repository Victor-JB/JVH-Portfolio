#!/usr/bin/env bash
###############################################################################
# setup_https_dev.sh
#
# One-shot HTTPS launcher for a FastAPI project during local development.
#
# What it does
# ------------
# 1. Ensures `mkcert` is installed (Homebrew ▸ brew, Debian/Ubuntu ▸ apt,
#    Windows ▸ choco).  Fails fast if no supported package manager exists.
# 2. Creates & trusts a local Certificate Authority on first run
#    (`mkcert -install`).
# 3. Detects your primary LAN IPv4 and issues a certificate for:
#       • localhost
#       • <detected-LAN-IP>
#    Certificates are stored in ./dev-cert/{localhost.pem, localhost-key.pem}.
# 4. Starts Uvicorn **with TLS enabled**, binding to 0.0.0.0:<port>.
#
# Flags
# -----
#   --app dotted.path:obj   Importable ASGI target (default: api.main:app)
#   --port N                Port to bind (default: 8000)
#   --uninstall             Remove the local CA *and* ./dev-cert then exit
#   -h, --help              Show this help and exit
#
# Example
# -------
#   # first run – installs mkcert, generates cert, launches FastAPI
#   ./run-dev.sh
#
#   # use a custom module & port
#   ./run-dev.sh --app server.main:create_app --port 8443
#
#   # nuke everything it touched
#   ./run-dev.sh --uninstall
#
###############################################################################

set -euo pipefail

# ───────────────────────────── Default variables ─────────────────────────────
BASE_DIR=$(pwd) # Get the current working directory
CERT_DIR="$BASE_DIR/dev-cert"
CERT_FILE="$CERT_DIR/localhost.pem"
KEY_FILE="$CERT_DIR/localhost-key.pem"
PORT=8000
APP_MODULE="${APP_MODULE:-api.main:app}"   # overridable via --app

export CERT_FILE
export KEY_FILE
export PORT
export APP_MODE=dev
export FORCE_HTTPS=1  # needed for dev camera permissions

# ───────────────────────────── Helper functions ──────────────────────────────
msg()  { printf "\e[1;34m%s\e[0m\n" "$*"; }      # changes color of text
warn() { printf "\e[1;33m%s\e[0m\n" "$*"; }
die()  { printf "\e[1;31mERROR: %s\e[0m\n" "$*" >&2; exit 1; }

print_help() { grep -E '^#( |$)' "$0" | sed 's/^# //'; exit 0; }

# ──────────────────────────── Parse CLI arguments ────────────────────────────
while [[ $# -gt 0 ]]; do
  case $1 in
    --uninstall) DO_UNINSTALL=1 ;;
    --app)       shift; APP_MODULE=$1 ;;
    --port)      shift; PORT=$1 ;;
    -h|--help)   print_help ;;
    *) die "Unknown flag: $1  (use --help for usage)" ;;
  esac
  shift
done

# ───────────────────────────── Un-install routine ────────────────────────────
if [[ ${DO_UNINSTALL:-0} == 1 ]]; then
  msg "Removing mkcert root CA (system trust stores)…"
  mkcert -uninstall || true
  rm -rf "$CERT_DIR"
  msg "Done.  HTTPS dev environment cleaned up."
  exit 0
fi

# ───────────────────────────── Ensure mkcert ────────────────────────────────
if ! command -v mkcert >/dev/null 2>&1; then
  warn "mkcert not found – installing…"
  if command -v brew >/dev/null 2>&1; then
      brew install mkcert nss || die "brew install failed"
  elif command -v apt-get >/dev/null 2>&1; then
      sudo apt-get update -qq
      sudo apt-get install -y libnss3-tools mkcert || die "apt install failed"
  elif command -v choco >/dev/null 2>&1; then
      choco install mkcert -y || die "choco install failed"
  else
      die "No supported package manager (brew / apt / choco) found."
  fi
else
  msg "mkcert already installed ✔︎"
fi

# ─────────────────────── Initialise CA (one-time) ────────────────────────────
if [ ! -d "$(mkcert -CAROOT)" ]; then
  msg "Creating & trusting local CA…"
  mkcert -install
fi

# ───────────────────────── Detect primary LAN IP ─────────────────────────────
if command -v ip >/dev/null 2>&1; then
  LAN_IP=$(ip route get 1.1.1.1 | awk '/src/ {print $7; exit}')
elif [[ "$OSTYPE" == "darwin"* ]]; then
  LAN_IP=$(ipconfig getifaddr "$(route get default | awk '/interface: / {print $2}')") \
           || LAN_IP="127.0.0.1"
else
  LAN_IP="127.0.0.1"
fi
msg "Detected LAN IP: $LAN_IP"

mkdir -p "$CERT_DIR"

# ───────────────────────── Generate cert if missing ──────────────────────────
if [[ -f "$CERT_FILE" && -f "$KEY_FILE" ]]; then
  msg "Using existing certificate in $CERT_DIR"
else
  msg "Generating certificate for:  localhost  $LAN_IP"
  mkcert -cert-file "$CERT_FILE" -key-file "$KEY_FILE" \
         localhost "$LAN_IP"
fi

# ─────────────────────────────── Launch app ─────────────────────────────────
msg "Launching FastAPI at https://$LAN_IP:$PORT   (module: $APP_MODULE)"
echo 

exec python3 -m api.main
