#!/usr/bin/env bash
# =============================================================================
# deploy.sh — Deploy latest backend changes for Edcheck
#
# What this script does:
#   1. Pulls latest code from git
#   2. Installs / updates npm dependencies
#   3. Restarts the PM2 backend process
#   4. Shows PM2 status
#   5. Verifies the backend health endpoint
#
# Usage (from the repo root on the VM):
#   chmod +x deployment/deploy.sh
#   ./deployment/deploy.sh
#
# No sudo required — PM2 runs as the current user.
# =============================================================================

set -euo pipefail

# ── Config ────────────────────────────────────────────────────────────────────
BACKEND_DIR="$(cd "$(dirname "$0")/../backend" && pwd)"
HEALTH_URL="http://localhost:5001/"
PM2_APP_NAME="edcheck-backend"

# ── Colour helpers ────────────────────────────────────────────────────────────
GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; NC='\033[0m'
info()  { echo -e "${GREEN}[INFO]${NC}  $*"; }
warn()  { echo -e "${YELLOW}[WARN]${NC}  $*"; }
error() { echo -e "${RED}[ERROR]${NC} $*"; exit 1; }

# ── 1. Pull latest code ───────────────────────────────────────────────────────
info "Pulling latest changes from git..."
git pull origin "$(git rev-parse --abbrev-ref HEAD)"

# ── 2. Install dependencies ───────────────────────────────────────────────────
info "Installing backend dependencies..."
cd "$BACKEND_DIR"
npm install --omit=dev

# ── 3. Restart PM2 ───────────────────────────────────────────────────────────
info "Restarting PM2 process: ${PM2_APP_NAME}..."

# If the app is already registered with PM2, reload it (zero-downtime)
# Otherwise start it fresh using the ecosystem config
if pm2 describe "$PM2_APP_NAME" &>/dev/null; then
    pm2 reload "$PM2_APP_NAME" --update-env
else
    warn "PM2 process '${PM2_APP_NAME}' not found — starting from ecosystem config..."
    cd "$(dirname "$0")/.."
    pm2 start ecosystem.config.js --env production
fi

# Save PM2 process list so it survives reboots
pm2 save

# ── 4. Show PM2 status ────────────────────────────────────────────────────────
info "PM2 status:"
pm2 list

# ── 5. Health check ───────────────────────────────────────────────────────────
info "Waiting for backend to be ready..."
sleep 3

HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$HEALTH_URL" || echo "000")

if [[ "$HTTP_STATUS" == "200" ]]; then
    echo ""
    echo -e "${GREEN}============================================================${NC}"
    echo -e "${GREEN} Deploy successful! Backend is healthy (HTTP ${HTTP_STATUS})${NC}"
    echo -e "${GREEN}============================================================${NC}"
else
    warn "Health check returned HTTP ${HTTP_STATUS} — check logs:"
    warn "  pm2 logs ${PM2_APP_NAME}"
    warn "  pm2 describe ${PM2_APP_NAME}"
fi
