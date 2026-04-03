#!/bin/bash
# Runs cloudflared quick tunnel, captures the random URL, updates .env,
# and restarts the voice server so it picks up the new VOICE_BASE_URL.

set -uo pipefail

ENV_FILE="/home/nanoclaw/TAi/.env"
CAPTURED=false

cloudflared tunnel --url http://localhost:3001 2>&1 | while IFS= read -r line; do
  echo "$line"
  if [ "$CAPTURED" = false ]; then
    URL=$(echo "$line" | grep -oP 'https://[a-z0-9-]+\.trycloudflare\.com')
    if [ -n "$URL" ]; then
      CAPTURED=true
      echo "[tunnel] Captured URL: $URL"

      # Update .env with new tunnel URL
      if grep -q '^VOICE_BASE_URL=' "$ENV_FILE"; then
        sed -i "s|^VOICE_BASE_URL=.*|VOICE_BASE_URL=$URL|" "$ENV_FILE"
      else
        echo "VOICE_BASE_URL=$URL" >> "$ENV_FILE"
      fi

      # Restart voice server to pick up new URL (main reads .env per-request so no restart needed)
      # Use systemctl --user or sudo depending on setup
      if systemctl is-active --quiet nanoclaw-voice 2>/dev/null; then
        sudo systemctl restart nanoclaw-voice
        echo "[tunnel] Restarted nanoclaw-voice with URL: $URL"
      fi
    fi
  fi
done
