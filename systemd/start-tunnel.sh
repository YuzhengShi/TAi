#!/bin/bash
# Runs cloudflared quick tunnel, captures the random URL, and updates .env
# + groups/global/tunnel-url.txt (mounted into containers for live reads).

set -uo pipefail

ENV_FILE="/home/nanoclaw/TAi/.env"
URL_FILE="/home/nanoclaw/TAi/groups/global/tunnel-url.txt"
CAPTURED=false

cloudflared tunnel --url http://localhost:3001 2>&1 | while IFS= read -r line; do
  echo "$line"
  if [ "$CAPTURED" = false ]; then
    URL=$(echo "$line" | grep -oP 'https://[a-z0-9-]+\.trycloudflare\.com')
    if [ -n "$URL" ]; then
      CAPTURED=true
      echo "[tunnel] Captured URL: $URL"

      # Write URL to shared file (containers read this at link-generation time)
      echo "$URL" > "$URL_FILE"

      # Update .env with new tunnel URL
      if grep -q '^VOICE_BASE_URL=' "$ENV_FILE"; then
        sed -i "s|^VOICE_BASE_URL=.*|VOICE_BASE_URL=$URL|" "$ENV_FILE"
      else
        echo "VOICE_BASE_URL=$URL" >> "$ENV_FILE"
      fi

      echo "[tunnel] Updated .env + tunnel-url.txt"

      # Restart main so new containers pick up the URL from .env
      if systemctl is-active --quiet nanoclaw-main 2>/dev/null; then
        sudo systemctl restart nanoclaw-main
        echo "[tunnel] Restarted nanoclaw-main with URL: $URL"
      fi
    fi
  fi
done
