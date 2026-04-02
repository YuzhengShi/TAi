# TAi EC2 Deployment Plan

## 1. Instance

**t3.xlarge** — 4 vCPU, 16 GB RAM, Ubuntu 22.04 LTS

5 concurrent agent containers x 2 GB = 10 GB RAM peak. t3.large (8 GB) OOMs under load.

Pricing: ~$120/month on-demand. Don't reserve — course ends Aug 2026 (~5 months at $120 = $600 vs 12 months reserved at $75 = $900).

---

## 2. Storage

Two EBS volumes:

**Root volume** — 30 GB gp3
- OS, Node.js, Docker engine, compiled code, Docker image cache (~4 GB)
- 100 GB is overkill for this — 30 GB is plenty

**Data volume** — 20 GB gp3, mounted at `/data`
- All persistent state lives here
- Survives instance replacement

```
/data/
├── store/
│   ├── auth/              ← WhatsApp credentials (CRITICAL — back up hourly)
│   └── messages.db        ← SQLite database + WAL files
├── groups/                ← Student COMPETENCY.md, CLAUDE.md, competency/ subdirs
│   ├── global/            ← Shared system prompt + reference files
│   ├── main/              ← Admin channel
│   ├── wu-hao/
│   ├── yuzheng/
│   └── ...
└── data/
    ├── ipc/               ← Per-group IPC (messages/, tasks/, media/)
    ├── sessions/          ← Per-group Claude session state (.claude/)
    └── audit/             ← Admin operations JSONL log
```

Symlinks so code finds everything at `process.cwd()`:

```bash
ln -s /data/store  /workspace/project/store
ln -s /data/groups /workspace/project/groups
ln -s /data/data   /workspace/project/data
```

Cost: root $2.40/mo + data $1.60/mo = **$4/mo** (vs $24/mo in the original plan).

---

## 3. Networking

**Elastic IP** — for stable SSH access. Free while instance runs.

**Security group inbound:**
- Port 22: SSH from your IP only
- No other inbound ports

**Cloudflare quick tunnel** — maps `https://{random}.trycloudflare.com` → `localhost:3001` for voice interviews. Required because `getUserMedia()` (mic access) hard-blocks on plain HTTP — no prompt, no override, browsers throw `DOMException`.

**WhatsApp** — outbound only via Baileys WebSocket. No inbound ports needed.

**Outbound access required:**
- `bedrock.us-west-2.amazonaws.com` (Bedrock — Claude, Nova Sonic, Polly, Transcribe)
- `northeastern.instructure.com` (Canvas LMS)
- `github.khoury.northeastern.edu` (Khoury GitHub)
- `*.trycloudflare.com` (tunnel)

---

## 4. Secrets

**`.env` file on disk** — the code reads secrets via `readEnvFile()` which parses the `.env` file directly (does NOT use `process.env`). Writing to `process.env` won't work for non-AWS secrets.

AWS credentials come from the **EC2 instance role** — no keys in `.env`. The code falls back to `process.env` for AWS keys specifically (`container-runner.ts:236-241`), which is where the instance role injects them.

```bash
# .env file permissions
chown nanoclaw:nanoclaw /workspace/project/.env
chmod 600 /workspace/project/.env
```

**EC2 instance role policies:**
- `bedrock:InvokeModel`, `bedrock:InvokeModelWithResponseStream` (Claude, Nova Sonic, Nova Canvas, Cohere)
- `transcribe:StartStreamTranscription` (voice note STT)
- `polly:SynthesizeSpeech` (voice note TTS)
- `s3:PutObject`, `s3:GetObject`, `s3:ListBucket` on your backup bucket
- `secretsmanager:GetSecretValue` on `nanoclaw/prod-*` (optional, for future migration)

### .env Template

```bash
# ── AWS ──────────────────────────────────────────────────────────
# No AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY — instance role provides these
AWS_REGION=us-west-2
AWS_DEFAULT_REGION=us-west-2

# ── Claude / Bedrock ─────────────────────────────────────────────
# CLAUDE_CODE_USE_BEDROCK=1 auto-set when AWS creds exist without Anthropic key
ANTHROPIC_MODEL=us.anthropic.claude-sonnet-4-6
ANTHROPIC_MODEL_LIGHT=us.anthropic.claude-haiku-4-5-20251001

# ── Canvas LMS ───────────────────────────────────────────────────
CANVAS_API_TOKEN=<your token>
CANVAS_BASE_URL=https://northeastern.instructure.com/api/v1
CANVAS_COURSE_ID=245693

# ── GitHub ───────────────────────────────────────────────────────
GITHUB_BASE_URL=https://github.khoury.northeastern.edu/api/v3
GITHUB_TOKEN=<your Khoury GHE token>
GITHUB_TOKEN_PUBLIC=<your github.com token>
# GITHUB_ALLOWED_ORGS=<org name>  ← set if students' repos live under a course org

# ── YouTube ──────────────────────────────────────────────────────
YOUTUBE_API_KEY=<your Google Cloud key>
YT_TRANSCRIPT_URL=http://yt-transcript:8000
YT_TRANSCRIPT_TOKEN=<your token>

# ── Voice Interview ──────────────────────────────────────────────
VOICE_INTERVIEW_SECRET=<your secret>
VOICE_BASE_URL=https://placeholder.trycloudflare.com
VOICE_PORT=3001

# ── App Config ───────────────────────────────────────────────────
ASSISTANT_NAME=TAi
ASSISTANT_HAS_OWN_NUMBER=false
ADMIN_PHONE_NUMBERS=<your phone, E.164 digits only>
TZ=America/Vancouver

# ── Container Config ─────────────────────────────────────────────
CONTAINER_IMAGE=nanoclaw-agent:latest
MAX_CONCURRENT_CONTAINERS=5
CONTAINER_MEMORY_LIMIT=2g
CONTAINER_CPU_LIMIT=1.0
CONTAINER_TIMEOUT=1800000
IDLE_TIMEOUT=1800000
```

`VOICE_BASE_URL` is auto-updated by the tunnel wrapper script on startup. Initial value doesn't matter.

---

## 5. Processes (systemd)

Four systemd services. Run order: docker → cloudflared (captures URL, restarts main) → nanoclaw-main → nanoclaw-voice.

### nanoclaw-main.service

```ini
[Unit]
Description=TAi Main Process
After=docker.service
Requires=docker.service

[Service]
Type=simple
User=nanoclaw
WorkingDirectory=/workspace/project
ExecStart=/usr/bin/node dist/index.js
Restart=on-failure
RestartSec=10
StandardOutput=append:/var/log/nanoclaw/main.log
StandardError=append:/var/log/nanoclaw/main.log
Environment=TZ=America/Vancouver

[Install]
WantedBy=multi-user.target
```

### nanoclaw-voice.service

**Note:** `voice/` is outside `tsconfig.json` (`rootDir: "./src"`), so `npm run build` does NOT compile it. The voice server imports from `../src/env.js`, making it hard to add a separate tsconfig. Use `tsx` to run it directly in production — same as `npm run voice` does in dev.

```ini
[Unit]
Description=TAi Voice Interview Server
After=nanoclaw-main.service

[Service]
Type=simple
User=nanoclaw
WorkingDirectory=/workspace/project
ExecStart=/usr/local/bin/npx tsx voice/server.ts
Restart=on-failure
RestartSec=10
StandardOutput=append:/var/log/nanoclaw/voice.log
StandardError=append:/var/log/nanoclaw/voice.log
Environment=TZ=America/Vancouver

[Install]
WantedBy=multi-user.target
```

### cloudflared.service

Wrapper script auto-captures the quick tunnel URL and updates `.env`:

```ini
[Unit]
Description=Cloudflare Quick Tunnel
After=network.target

[Service]
Type=simple
User=nanoclaw
ExecStart=/usr/local/bin/start-tunnel.sh
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
```

**/usr/local/bin/start-tunnel.sh:**

```bash
#!/bin/bash
# Captures the random trycloudflare.com URL, writes to .env, restarts main

ENV_FILE="/workspace/project/.env"

cloudflared tunnel --url http://localhost:3001 2>&1 | while IFS= read -r line; do
  URL=$(echo "$line" | grep -oP 'https://[a-z0-9-]+\.trycloudflare\.com')
  if [ -n "$URL" ]; then
    sed -i "s|^VOICE_BASE_URL=.*|VOICE_BASE_URL=$URL|" "$ENV_FILE"
    echo "[tunnel] Captured URL: $URL — restarting nanoclaw-main"
    systemctl restart nanoclaw-main
  fi
done
```

```bash
chmod +x /usr/local/bin/start-tunnel.sh
```

---

## 6. Docker Setup

```bash
# Create shared network
docker network create nanoclaw-net

# YouTube transcript service (match container name to .env YT_TRANSCRIPT_URL)
docker run -d \
  --name yt-transcript \
  --network nanoclaw-net \
  --restart unless-stopped \
  yt-transcript-api:latest

# Build agent image
docker build -t nanoclaw-agent:latest ./container
```

Agent containers are ephemeral (`--rm`), spawned per interaction. Max 5 concurrent, each capped at 2 GB RAM / 1.0 CPU / 256 PIDs.

**Important:** the Docker container name `yt-transcript` must match the hostname in `.env` (`YT_TRANSCRIPT_URL=http://yt-transcript:8000`). Docker DNS resolves by container name.

---

## 7. Backups

**Hourly S3 sync** of the critical `store/` directory (WhatsApp auth + SQLite DB):

```bash
# /etc/cron.d/nanoclaw-backup
0 * * * * nanoclaw aws s3 sync /data/store/ s3://your-bucket/store-backup/ --quiet
```

If WhatsApp session is lost, restore from S3 to avoid QR rescan. If DB is corrupted, restore `messages.db` from S3.

**Weekly EBS snapshot** of the data volume via AWS Data Lifecycle Manager — belt-and-suspenders for the full `/data/` volume including groups/ and sessions/.

---

## 8. Log Rotation

```
# /etc/logrotate.d/nanoclaw
/var/log/nanoclaw/*.log {
    daily
    rotate 14
    compress
    missingok
    notifempty
    copytruncate
}
```

---

## 9. Pre-Deploy Code Changes

Two changes in `src/channels/whatsapp.ts` before deploying to Linux:

**Line 96** — WhatsApp browser identifier:
```typescript
// Before:
browser: Browsers.macOS('Chrome'),
// After:
browser: Browsers.ubuntu('Chrome'),
```

**Lines 106-108** — QR auth notification (osascript is macOS-only):
```typescript
// Before:
exec(`osascript -e 'display notification "${msg}" with title "NanoClaw" sound name "Basso"'`);
// After:
// (remove — logger.error on line 105 already handles this)
```

---

## 10. First Deploy

```bash
# 1. Launch t3.xlarge, attach 20 GB data volume
#    - Ubuntu 22.04 LTS
#    - Elastic IP associated
#    - IAM instance role attached (Bedrock, Transcribe, Polly, S3)

# 2. Format + mount data volume
mkfs.ext4 /dev/xvdf                          # or nvme1n1 depending on instance
mkdir -p /data
echo '/dev/xvdf /data ext4 defaults,nofail 0 2' >> /etc/fstab
mount /data
mkdir -p /data/{store/auth,groups,data/{ipc,sessions,audit}}

# 3. Install Node 22 + build tools + Docker
curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
apt-get install -y nodejs build-essential python3 docker.io git
npm install -g tsx

# 4. Install cloudflared
curl -L https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64 \
  -o /usr/bin/cloudflared && chmod +x /usr/bin/cloudflared

# 5. Create service user
useradd -m -s /bin/bash nanoclaw
usermod -aG docker nanoclaw
chown -R nanoclaw:nanoclaw /data

# 6. Clone + build
git clone <YOUR_REPO> /workspace/project
chown -R nanoclaw:nanoclaw /workspace/project
cd /workspace/project

# 7. Symlink persistent data
ln -s /data/store  /workspace/project/store
ln -s /data/groups /workspace/project/groups
ln -s /data/data   /workspace/project/data

# 8. Copy existing data from dev machine (scp from Windows)
#    scp -r store/auth/ ec2:/data/store/auth/
#    scp store/messages.db ec2:/data/store/
#    scp -r groups/ ec2:/data/groups/
#    scp .env ec2:/workspace/project/.env

# 9. Install deps + compile
npm install
npm run build

# 10. Docker setup
docker network create nanoclaw-net
docker build -t nanoclaw-agent:latest ./container
# Start yt-transcript if needed:
# docker run -d --name yt-transcript --network nanoclaw-net --restart unless-stopped yt-transcript-api:latest

# 11. Set up logs + logrotate
mkdir -p /var/log/nanoclaw
chown nanoclaw:nanoclaw /var/log/nanoclaw
# Copy logrotate config to /etc/logrotate.d/nanoclaw

# 12. Install systemd services
# Copy .service files to /etc/systemd/system/
# Copy start-tunnel.sh to /usr/local/bin/
systemctl daemon-reload
systemctl enable cloudflared nanoclaw-main nanoclaw-voice

# 13. Start everything
systemctl start cloudflared          # captures tunnel URL, restarts main automatically
systemctl start nanoclaw-voice

# 14. First run: watch logs for WhatsApp QR code
journalctl -u nanoclaw-main -f       # scan QR from terminal

# 15. Set up backup cron
# Add /etc/cron.d/nanoclaw-backup
```

---

## 11. Updates

```bash
cd /workspace/project
git pull
npm install        # if deps changed
npm run build      # recompile src/

systemctl restart nanoclaw-main    # 2-3s WhatsApp reconnect gap (messages queue)
systemctl restart nanoclaw-voice   # if voice/ files changed

# Only rebuild Docker image if container/Dockerfile or container/scripts/ changed:
docker build -t nanoclaw-agent:latest ./container
```

Agent containers mount `container/agent-runner/src` read-only at runtime — source changes take effect on next container spawn without image rebuild.

---

## 12. Cost

| Item | Monthly |
|------|---------|
| t3.xlarge on-demand | $120 |
| EBS root 30 GB gp3 | $2.40 |
| EBS data 20 GB gp3 | $1.60 |
| S3 backup | ~$0.50 |
| Elastic IP | free (while running) |
| Cloudflare quick tunnel | free |
| Data transfer | ~$5 |
| **Total** | **~$130/mo** |

---

## 13. Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| WhatsApp QR loop on startup | Auth creds missing/corrupted | Restore from S3: `aws s3 sync s3://bucket/store-backup/auth/ /data/store/auth/` |
| Voice interview mic blocked | HTTP instead of HTTPS | Check tunnel is running: `systemctl status cloudflared` |
| `VOICE_BASE_URL` stale | Tunnel restarted, URL changed | Wrapper script handles this automatically. Manual: check `/var/log/nanoclaw/` for new URL |
| Container OOM | >5 concurrent or memory leak | Check `docker stats`. Lower `MAX_CONCURRENT_CONTAINERS` in `.env` |
| `npm run build` misses voice/ | tsconfig rootDir is src/ only | Voice runs via tsx, not compiled. This is expected |
| Agent can't reach yt-transcript | Container name ≠ .env hostname | Ensure `docker ps` name matches `YT_TRANSCRIPT_URL` hostname |
| better-sqlite3 install fails | Missing build tools | `apt-get install build-essential python3` |
| Docker permission denied | nanoclaw not in docker group | `usermod -aG docker nanoclaw`, then re-login |

---

## 14. Future Scale Path

| Threshold | Action |
|-----------|--------|
| 50+ students | Increase `MAX_CONCURRENT_CONTAINERS` to 10, upgrade to t3.2xlarge |
| 100+ students | Migrate SQLite → RDS PostgreSQL (~$15-25/mo) |
| Voice load spikes | Separate voice server to its own t3.small (~$15/mo) |
| Need stable URL | Buy domain (~$10/yr), switch to named Cloudflare tunnel |
