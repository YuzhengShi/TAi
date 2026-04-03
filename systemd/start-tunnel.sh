#!/bin/bash
# Runs cloudflared quick tunnel, captures the random URL, and updates .env.
# No service restarts needed — container-runner.ts reads .env fresh per invocation.

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

      echo "[tunnel] Updated .env"

      # Restart main so in-flight containers don't use stale URL
      if systemctl is-active --quiet nanoclaw-main 2>/dev/null; then
        sudo systemctl restart nanoclaw-main
        echo "[tunnel] Restarted nanoclaw-main with URL: $URL"
      fi
    fi
  fi
done
