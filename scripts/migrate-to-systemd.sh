#!/bin/bash
# migrate-to-systemd.sh — Migrate TAi from pm2 to systemd
#
# Run on EC2 as root (or with sudo):
#   sudo bash /home/nanoclaw/TAi/scripts/migrate-to-systemd.sh
#
# What this does:
#   1. Stops pm2 and removes it from startup
#   2. Installs systemd service files (main, voice, cloudflared)
#   3. Sets up log rotation + backup cron
#   4. Enables and starts all services
#   5. Installs cloudflared if not present
#   6. Grants nanoclaw passwordless sudo for service restarts (tunnel needs this)

set -euo pipefail

PROJECT_DIR="/home/nanoclaw/TAi"
SYSTEMD_SRC="$PROJECT_DIR/systemd"
LOG_DIR="/var/log/nanoclaw"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

info()  { echo -e "${GREEN}[OK]${NC} $1"; }
warn()  { echo -e "${YELLOW}[!!]${NC} $1"; }
fail()  { echo -e "${RED}[FAIL]${NC} $1"; exit 1; }

echo "============================================"
echo "  TAi: pm2 → systemd migration"
echo "============================================"
echo ""

# --- Preflight checks ---
[ "$(id -u)" -eq 0 ] || fail "Must run as root (sudo)"
[ -d "$PROJECT_DIR" ] || fail "Project not found at $PROJECT_DIR"
[ -f "$SYSTEMD_SRC/nanoclaw-main.service" ] || fail "Service files not found in $SYSTEMD_SRC"
[ -f "$PROJECT_DIR/dist/index.js" ] || fail "Project not built — run 'npm run build' first"

# --- Step 1: Stop pm2 ---
echo "--- Step 1: Stop pm2 ---"
if sudo -u nanoclaw bash -lc 'command -v pm2' &>/dev/null; then
  sudo -u nanoclaw bash -lc 'pm2 stop all 2>/dev/null || true'
  sudo -u nanoclaw bash -lc 'pm2 delete all 2>/dev/null || true'
  sudo -u nanoclaw bash -lc 'pm2 unstartup 2>/dev/null || true'
  # Don't uninstall pm2 — leave it available as fallback
  info "pm2 stopped and cleared"
else
  info "pm2 not found — skipping"
fi

# Wait for Node to fully exit
sleep 2
LEFTOVER=$(pgrep -f 'node.*dist/index.js' || true)
if [ -n "$LEFTOVER" ]; then
  warn "Lingering node process found (PID: $LEFTOVER) — killing"
  kill "$LEFTOVER" 2>/dev/null || true
  sleep 2
fi

# --- Step 2: Create log directory ---
echo ""
echo "--- Step 2: Create log directory ---"
mkdir -p "$LOG_DIR"
chown nanoclaw:nanoclaw "$LOG_DIR"
info "Log directory: $LOG_DIR"

# --- Step 3: Install cloudflared ---
echo ""
echo "--- Step 3: Install cloudflared ---"
if command -v cloudflared &>/dev/null; then
  info "cloudflared already installed: $(cloudflared --version 2>&1 | head -1)"
else
  warn "Installing cloudflared..."
  curl -fsSL https://pkg.cloudflare.com/cloudflare-main.gpg | tee /usr/share/keyrings/cloudflare-main.gpg >/dev/null
  echo "deb [signed-by=/usr/share/keyrings/cloudflare-main.gpg] https://pkg.cloudflare.com/cloudflared $(lsb_release -cs) main" \
    | tee /etc/apt/sources.list.d/cloudflared.list >/dev/null
  apt-get update -qq
  apt-get install -y -qq cloudflared
  info "cloudflared installed: $(cloudflared --version 2>&1 | head -1)"
fi

# --- Step 4: Install service files ---
echo ""
echo "--- Step 4: Install systemd services ---"

cp "$SYSTEMD_SRC/nanoclaw-main.service" /etc/systemd/system/
cp "$SYSTEMD_SRC/nanoclaw-voice.service" /etc/systemd/system/
cp "$SYSTEMD_SRC/cloudflared.service" /etc/systemd/system/
info "Service files copied to /etc/systemd/system/"

# Make tunnel script executable
chmod +x "$SYSTEMD_SRC/start-tunnel.sh"
info "Tunnel wrapper script: $SYSTEMD_SRC/start-tunnel.sh"

# --- Step 5: Sudoers for tunnel → service restart ---
echo ""
echo "--- Step 5: Configure sudoers ---"
SUDOERS_FILE="/etc/sudoers.d/nanoclaw-services"
cat > "$SUDOERS_FILE" << 'EOF'
# Allow nanoclaw to restart its own services (needed by tunnel wrapper)
nanoclaw ALL=(ALL) NOPASSWD: /bin/systemctl restart nanoclaw-main, /bin/systemctl restart nanoclaw-voice, /bin/systemctl restart nanoclaw-main.service, /bin/systemctl restart nanoclaw-voice.service
nanoclaw ALL=(ALL) NOPASSWD: /usr/bin/systemctl restart nanoclaw-main, /usr/bin/systemctl restart nanoclaw-voice, /usr/bin/systemctl restart nanoclaw-main.service, /usr/bin/systemctl restart nanoclaw-voice.service
EOF
chmod 440 "$SUDOERS_FILE"
visudo -cf "$SUDOERS_FILE" || fail "Sudoers syntax error — check $SUDOERS_FILE"
info "Sudoers configured for service restarts"

# --- Step 6: Log rotation ---
echo ""
echo "--- Step 6: Install log rotation ---"
cp "$SYSTEMD_SRC/nanoclaw-logrotate" /etc/logrotate.d/nanoclaw
info "Log rotation: daily, 14 days, compressed"

# --- Step 7: Backup cron ---
echo ""
echo "--- Step 7: Install backup cron ---"
cp "$SYSTEMD_SRC/nanoclaw-backup" /etc/cron.d/nanoclaw-backup
chmod 644 /etc/cron.d/nanoclaw-backup
info "Backup cron: hourly store/ + daily groups/ to S3"

# Check if S3 bucket exists (non-fatal)
if sudo -u nanoclaw bash -lc 'aws s3 ls s3://tai-backups-prod/ 2>/dev/null' >/dev/null; then
  info "S3 bucket tai-backups-prod is accessible"
else
  warn "S3 bucket 'tai-backups-prod' not accessible — create it or update bucket name in /etc/cron.d/nanoclaw-backup"
fi

# --- Step 8: Ensure Docker network exists ---
echo ""
echo "--- Step 8: Docker network ---"
if docker network inspect nanoclaw-net &>/dev/null; then
  info "nanoclaw-net network exists"
else
  docker network create nanoclaw-net
  info "Created nanoclaw-net network"
fi

# --- Step 9: Enable and start services ---
echo ""
echo "--- Step 9: Enable and start services ---"
systemctl daemon-reload

# Enable all (start on boot)
systemctl enable nanoclaw-main.service
systemctl enable nanoclaw-voice.service
systemctl enable cloudflared.service
info "Services enabled for boot"

# Start in order: tunnel first (captures URL), then main, then voice
echo "Starting cloudflared..."
systemctl start cloudflared.service
# Give tunnel 5s to capture URL
sleep 5

echo "Starting nanoclaw-main..."
systemctl start nanoclaw-main.service
sleep 3

echo "Starting nanoclaw-voice..."
systemctl start nanoclaw-voice.service
sleep 2

# --- Step 10: Verify ---
echo ""
echo "--- Step 10: Verify ---"
echo ""

for SVC in cloudflared nanoclaw-main nanoclaw-voice; do
  STATUS=$(systemctl is-active "$SVC" 2>/dev/null || echo "inactive")
  if [ "$STATUS" = "active" ]; then
    info "$SVC: running"
  else
    warn "$SVC: $STATUS — check with: journalctl -u $SVC -n 20 --no-pager"
  fi
done

echo ""

# Check if WhatsApp connected (look for connection log within 10s)
if grep -q 'WhatsApp' "$LOG_DIR/main.log" 2>/dev/null; then
  info "Main process is logging"
else
  warn "No log output yet — give it a few seconds, then: tail -f $LOG_DIR/main.log"
fi

# Show tunnel URL if captured
TUNNEL_URL=$(grep -oP 'https://[a-z0-9-]+\.trycloudflare\.com' "$LOG_DIR/tunnel.log" 2>/dev/null | tail -1 || true)
if [ -n "$TUNNEL_URL" ]; then
  info "Tunnel URL: $TUNNEL_URL"
else
  warn "Tunnel URL not captured yet — check: tail -f $LOG_DIR/tunnel.log"
fi

echo ""
echo "============================================"
echo "  Migration complete!"
echo ""
echo "  Manage services:"
echo "    sudo systemctl status nanoclaw-main"
echo "    sudo systemctl restart nanoclaw-main"
echo "    sudo systemctl stop nanoclaw-main"
echo ""
echo "  View logs:"
echo "    tail -f $LOG_DIR/main.log"
echo "    tail -f $LOG_DIR/voice.log"
echo "    tail -f $LOG_DIR/tunnel.log"
echo ""
echo "  Deploy updates:"
echo "    sudo -u nanoclaw bash -lc 'cd ~/TAi && git pull origin main && npm run build'"
echo "    sudo systemctl restart nanoclaw-main"
echo "============================================"
