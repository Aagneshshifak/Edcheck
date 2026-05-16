#!/usr/bin/env bash
# =============================================================================
# setup-ssl.sh — One-time server setup for Edcheck on Debian 12 / GCE
#
# What this script does:
#   1. Installs nginx, certbot, python3-certbot-nginx
#   2. Copies the nginx config into /etc/nginx/sites-available/default
#   3. Validates and restarts nginx
#   4. Obtains a Let's Encrypt SSL certificate for edcheck.pinmypic.online
#   5. Enables automatic SSL renewal via systemd timer
#
# Usage:
#   chmod +x deployment/setup-ssl.sh
#   sudo ./deployment/setup-ssl.sh
#
# Idempotent: safe to run multiple times.
# =============================================================================

set -euo pipefail

DOMAIN="edcheck.pinmypic.online"
EMAIL="aagneshshifak@gmail.com"          # ← change to your real email for cert alerts
NGINX_CONF_SRC="$(dirname "$0")/nginx/default.conf"
NGINX_CONF_DST="/etc/nginx/sites-available/default"

# ── Colour helpers ────────────────────────────────────────────────────────────
GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; NC='\033[0m'
info()    { echo -e "${GREEN}[INFO]${NC}  $*"; }
warn()    { echo -e "${YELLOW}[WARN]${NC}  $*"; }
error()   { echo -e "${RED}[ERROR]${NC} $*"; exit 1; }

# ── Must run as root ──────────────────────────────────────────────────────────
[[ $EUID -ne 0 ]] && error "Run this script with sudo: sudo ./setup-ssl.sh"

# ── 1. Update package list ────────────────────────────────────────────────────
info "Updating package list..."
apt-get update -qq

# ── 2. Install nginx ──────────────────────────────────────────────────────────
if ! command -v nginx &>/dev/null; then
    info "Installing nginx..."
    apt-get install -y nginx
else
    info "nginx already installed — skipping."
fi

# ── 3. Install certbot + nginx plugin ────────────────────────────────────────
if ! command -v certbot &>/dev/null; then
    info "Installing certbot and python3-certbot-nginx..."
    apt-get install -y certbot python3-certbot-nginx
else
    info "certbot already installed — skipping."
fi

# ── 4. Copy nginx config ──────────────────────────────────────────────────────
info "Copying nginx config to ${NGINX_CONF_DST}..."
[[ -f "$NGINX_CONF_SRC" ]] || error "nginx config not found at: ${NGINX_CONF_SRC}"
cp "$NGINX_CONF_SRC" "$NGINX_CONF_DST"

# Ensure sites-enabled symlink exists
if [[ ! -L /etc/nginx/sites-enabled/default ]]; then
    ln -s "$NGINX_CONF_DST" /etc/nginx/sites-enabled/default
fi

# ── 5. Validate nginx config ──────────────────────────────────────────────────
info "Validating nginx configuration..."
nginx -t || error "nginx config validation failed. Fix the config and re-run."

# ── 6. Start / reload nginx ───────────────────────────────────────────────────
info "Restarting nginx..."
systemctl enable nginx
systemctl restart nginx

# ── 7. Open firewall ports (GCE uses iptables / ufw) ─────────────────────────
if command -v ufw &>/dev/null; then
    info "Allowing ports 80 and 443 through ufw..."
    ufw allow 80/tcp  || true
    ufw allow 443/tcp || true
fi

# ── 8. Obtain SSL certificate ─────────────────────────────────────────────────
CERT_PATH="/etc/letsencrypt/live/${DOMAIN}/fullchain.pem"

if [[ -f "$CERT_PATH" ]]; then
    warn "SSL certificate already exists for ${DOMAIN} — skipping issuance."
    warn "To force renewal: sudo certbot renew --force-renewal"
else
    info "Obtaining SSL certificate for ${DOMAIN}..."
    certbot --nginx \
        -d "$DOMAIN" \
        --non-interactive \
        --agree-tos \
        --email "$EMAIL" \
        --redirect
fi

# ── 9. Enable automatic renewal ───────────────────────────────────────────────
info "Enabling certbot renewal timer..."
systemctl enable certbot.timer
systemctl start  certbot.timer

# Verify the renewal timer is active
systemctl is-active certbot.timer &>/dev/null \
    && info "Certbot renewal timer is active." \
    || warn "Certbot timer not active — check: systemctl status certbot.timer"

# ── 10. Final nginx reload with SSL config ────────────────────────────────────
info "Reloading nginx with SSL config..."
nginx -t && systemctl reload nginx

# ── Done ──────────────────────────────────────────────────────────────────────
echo ""
echo -e "${GREEN}============================================================${NC}"
echo -e "${GREEN} Setup complete!${NC}"
echo -e "${GREEN} Your backend is now accessible at: https://${DOMAIN}${NC}"
echo -e "${GREEN}============================================================${NC}"
