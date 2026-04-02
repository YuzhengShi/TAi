# TAi Active Context

## Current Focus: EC2 Deployment

Full deployment plan at `memory-bank/ec2-deployment.md`.

### Key Decisions
- t3.xlarge, Ubuntu 22.04, on-demand pricing (~$130/mo)
- 3 symlinks from /data/ → store/, groups/, data/ (code uses 3 dirs relative to cwd)
- .env on disk (code uses readEnvFile(), NOT process.env for non-AWS secrets)
- Cloudflare quick tunnel for voice HTTPS (getUserMedia hard-blocks on HTTP)
- Tunnel wrapper script auto-captures URL, writes to .env, restarts main
- Voice server runs via tsx (tsconfig rootDir=src/, voice/ not compiled by tsc)
- Instance role for AWS creds (no keys in .env)

### Pre-Deploy Code Changes
1. whatsapp.ts:96 — `Browsers.macOS('Chrome')` → `Browsers.ubuntu('Chrome')`
2. whatsapp.ts:106-108 — remove osascript notification

### Pre-Deploy Infra Setup
- Node 22 via NodeSource, build-essential, tsx globally
- nanoclaw user in docker group
- 3 symlinks, logrotate, backup cron
- Docker: nanoclaw-net + yt-transcript container (name must match .env)

## Active Students
- wu-hao, student-17786821394, yuzheng (all have COMPETENCY.md)
