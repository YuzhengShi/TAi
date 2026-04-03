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

Three systemd services (docker.service is system-provided). Service files live in `systemd/` in the repo. Migration script: `scripts/migrate-to-systemd.sh`.

Service files are in `systemd/` in the repo. See:
- `systemd/nanoclaw-main.service` — main process (WhatsApp + agent orchestrator)
- `systemd/nanoclaw-voice.service` — voice interview server (binds to nanoclaw-main)
- `systemd/cloudflared.service` — Cloudflare quick tunnel
- `systemd/start-tunnel.sh` — wrapper that captures tunnel URL, updates .env, restarts voice
- `systemd/nanoclaw-logrotate` — log rotation config
- `systemd/nanoclaw-backup` — S3 backup cron

**Note:** `voice/` is outside `tsconfig.json` (`rootDir: "./src"`), so `npm run build` does NOT compile it. The voice server imports from `../src/env.js`, making it hard to add a separate tsconfig. Use `tsx` to run it directly in production — same as `npm run voice` does in dev.

Tunnel wrapper needs passwordless sudo for service restarts. The migration script sets up `/etc/sudoers.d/nanoclaw-services` to allow this.

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

## 10. First Deploy (Planned)

See below for what was actually executed.

## 10a. Actual Deployment (2026-04-02)

Instance: i-09d4c55b1ee1d96ce, t3.xlarge, us-west-2a
Elastic IP: 52.12.72.115
Data volume: /dev/nvme1n1 → /data (20 GB, pre-existing from prior instance)

The instance came pre-configured (AMI or user-data) with:
- Node 22.22.2, npm 10.9.7, Docker 28.2.2, git 2.34.1
- nanoclaw user (with SSH keys at /home/nanoclaw/.ssh/, in docker group)
- Data volume mounted at /data with existing store/, groups/, data/

What was done manually:
```bash
# SSH as ubuntu, then sudo to nanoclaw
ssh -i ~/.ssh/tai-deploy ubuntu@52.12.72.115

# Install pm2 globally
sudo npm install -g pm2

# Clone as nanoclaw (has GitHub SSH keys)
sudo -u nanoclaw bash -lc 'git clone git@github.com:YuzhengShi/tai-deploy.git ~/TAi'

# Symlink runtime dirs to /data volume
# NOTE: groups/ dir exists in repo (has global/ and main/), so must rm -rf first
sudo -u nanoclaw bash -lc 'cd ~/TAi && rm -rf groups && ln -s /data/groups groups && ln -s /data/data data && ln -s /data/store store'

# Install deps + build
sudo -u nanoclaw bash -lc 'cd ~/TAi && npm ci && npm run build'

# Create .env (no AWS keys — instance role provides them)
sudo -u nanoclaw bash -lc 'cat > ~/TAi/.env << EOF
ASSISTANT_NAME="TAi"
AWS_REGION=us-west-2
ANTHROPIC_MODEL="us.anthropic.claude-sonnet-4-6"
ANTHROPIC_MODEL_LIGHT="us.anthropic.claude-haiku-4-5-20251001-v1:0"
CANVAS_API_TOKEN=...
CANVAS_BASE_URL=https://northeastern.instructure.com/api/v1
CANVAS_COURSE_ID=245693
GITHUB_BASE_URL=https://github.khoury.northeastern.edu/api/v3
GITHUB_TOKEN=...
GITHUB_TOKEN_PUBLIC=...
YOUTUBE_API_KEY=...
YT_TRANSCRIPT_URL=http://yt-transcript-api:8000
YT_TRANSCRIPT_TOKEN=...
VOICE_INTERVIEW_SECRET=...
VOICE_BASE_URL=https://placeholder.trycloudflare.com
EOF'

# Start with pm2
sudo -u nanoclaw bash -lc 'cd ~/TAi && pm2 start dist/index.js --name tai'
```

Docker image (nanoclaw-agent:latest, 3.14 GB) and network (nanoclaw-net) were already present from prior setup.

### Important: Only One Host Process
Never run `npm run dev` and pm2 simultaneously. Both will connect to WhatsApp and respond to every message twice. Use pm2 only:
```bash
sudo -u nanoclaw bash -lc 'pm2 restart tai'    # restart
sudo -u nanoclaw bash -lc 'pm2 logs tai'       # view logs
sudo -u nanoclaw bash -lc 'pm2 stop tai'       # stop
```
If duplicate responses appear, check: `ps aux | grep 'node.*index' | grep -v grep` — should show only one `dist/index.js` process (pm2's).

### Gotchas Encountered
- `ubuntu` user can SSH but nanoclaw owns the code/data
- `nanoclaw` user had EACCES on pm2 daemon spawn initially — resolved after `sudo npm install -g pm2`
- The repo's `groups/` dir has committed subdirs (global/, main/) — must `rm -rf groups` before symlinking to /data/groups (which has those + all student folders)
- HTTPS clone fails on EC2 (no TTY for username prompt) — use nanoclaw's SSH keys instead
- Old EC2 IPs in known_hosts are stale — new instance got new Elastic IP

---

## 11. Updates

```bash
# SSH in and pull
sudo -u nanoclaw bash -lc 'cd ~/TAi && git pull origin main && npm run build'

# Restart services
sudo systemctl restart nanoclaw-main    # 2-3s WhatsApp reconnect gap (messages queue)
sudo systemctl restart nanoclaw-voice   # if voice/ files changed

# Only rebuild Docker image if container/Dockerfile or container/scripts/ changed:
sudo -u nanoclaw bash -lc 'cd ~/TAi && docker build -t nanoclaw-agent:latest ./container'
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
