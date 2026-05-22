# TAi Active Context

## Current State: Fresh Deployment on New AWS Account (2026-05-16)

TAi redeployed to a new AWS account (931197777315) after the old account (889662168826) expired. All previous data (WhatsApp auth, student COMPETENCY files, SQLite DB) was lost — this is a fresh start.

### EC2 Instance
- **Instance ID**: i-03febb8df529c8049
- **IP**: 52.13.181.61 (Elastic IP)
- **Type**: t3.xlarge (4 vCPU, 16 GB RAM)
- **SSH**: `ssh -i ~/.ssh/tai-deploy ubuntu@52.13.181.61`
- **Deploy user**: nanoclaw (has SSH keys for GitHub — ed25519 key added as deploy key)
- **Process manager**: systemd
- **Code**: `/home/nanoclaw/TAi` (cloned from `tai-deploy` remote)
- **Data volume**: /data (20 GB EBS, nvme1n1) with symlinks: store→/data/store, groups→/data/groups, data→/data/data
- **Git remote on EC2**: `origin` (git@github.com:YuzhengShi/tai-deploy.git via SSH)
- **IAM role**: `tai-ec2-role` with Bedrock, Transcribe, Polly, S3, Marketplace permissions

### AWS Account Details
- **Account**: 931197777315 (SSO role: AWSReservedSSO_myisb_IsbUsersPS)
- **Bedrock models subscribed**: `anthropic.claude-haiku-4-5-20251001-v1:0`, `anthropic.claude-sonnet-4-6`
- **S3 bucket**: `tai-backups-prod` (created 2026-05-16)
- **Terraform state**: in `terraform/terraform.tfstate` (tracks VPC, subnet, SG, EC2, EBS, EIP, IAM)

### Systemd Services
| Service | Description | Logs |
|---------|-------------|------|
| `nanoclaw-main` | Main process (WhatsApp + agent orchestrator) | /var/log/nanoclaw/main.log |
| `nanoclaw-voice` | Voice interview server (Nova Sonic, port 3001) | /var/log/nanoclaw/voice.log |
| `cloudflared` | Cloudflare quick tunnel → localhost:3001 | /var/log/nanoclaw/tunnel.log |

Tunnel URL: `https://ppc-expects-paths-material.trycloudflare.com`

### Deploy Workflow
```bash
# Local:
git push deploy main
# EC2 (one-liner):
ssh -i ~/.ssh/tai-deploy ubuntu@52.13.181.61 "sudo -u nanoclaw bash -lc 'cd ~/TAi && git pull origin main && npm run build' && sudo systemctl restart nanoclaw-main"
# If container/Dockerfile or container/scripts/ changed, also rebuild Docker:
ssh -i ~/.ssh/tai-deploy ubuntu@52.13.181.61 "sudo docker build -t nanoclaw-agent:latest /home/nanoclaw/TAi/container"
```

### .env Configuration (on EC2)
```
AWS_REGION=us-west-2
ANTHROPIC_MODEL=us.anthropic.claude-sonnet-4-6
ANTHROPIC_MODEL_LIGHT=us.anthropic.claude-haiku-4-5-20251001-v1:0
CANVAS_API_TOKEN=14523~9NfP4CDLnfeyE36Yvahk6GAZv4XP6NFCDQ7Jc6kFBET8murEuRMvVVXahRaURPGR
CANVAS_BASE_URL=https://northeastern.instructure.com/api/v1
CANVAS_COURSE_ID=239676  (changed from 245693)
ADMIN_PHONE_NUMBERS=17786821394
MS_EMAIL=shi.yuzh@northeastern.edu
MS_PASSWORD=Aa404572524syz!
# Other tokens still PLACEHOLDER: GITHUB_TOKEN, YOUTUBE_API_KEY, etc.
```

### Registered Groups
Only admin/personal DM registered:
- `17786821394@s.whatsapp.net` → folder `main`, requires_trigger=0

All student groups were removed. Previously synced groups (from chat history): CS6650-Jassem, CS6650-Sihui, CS6650-Yimeng, CS6650-Kalhar, CS6650-Gideon, CS6650-Zhengyi, CS6650-admin, CS6650-Ajin, CS6650-Xiaofan.

### What Was Done (2026-05-16)

#### Infrastructure (Terraform)
1. Cleared stale terraform state from old account (889662168826)
2. `terraform apply` on new account: VPC, subnet, IGW, SG, key pair, EC2 t3.xlarge, 20GB EBS data volume, Elastic IP, IAM role+policy+instance profile
3. IAM role includes: Bedrock (InvokeModel, InvokeModelWithResponseStream), Transcribe, Polly, S3 (tai-backups-prod), Marketplace (ViewSubscriptions, Subscribe)

#### EC2 Setup
1. Formatted data volume (ext4), mounted at /data, added to fstab
2. Created nanoclaw user, added to docker group
3. Installed: Node 22.22.2, Docker 29.5, cloudflared, tsx, sqlite3, build-essential
4. Generated SSH key for nanoclaw, added as deploy key to tai-deploy repo
5. Cloned repo, symlinked groups/data/store to /data/
6. `npm ci && npm run build`
7. Built Docker agent image (nanoclaw-agent:latest, ~5.5GB)
8. Created Docker network (nanoclaw-net)
9. Installed systemd services, enabled logrotate, sudoers for nanoclaw

#### WhatsApp Authentication
- Used pairing code method (phone: 17786821394, code: PHJHMHF5)
- Auth saved to /data/store/auth/
- `ASSISTANT_HAS_OWN_NUMBER=false` (shared number setup — DMs to self)

#### Bedrock Model Access
- Models were listed but not subscribed in new account
- Used `aws bedrock create-foundation-model-agreement` with offer tokens to subscribe Haiku 4.5 and Sonnet 4.6
- Both models now working

#### Bug Fixes During Deployment
1. **ADMIN_PHONE_NUMBERS was PLACEHOLDER** — messages from admin DM were filtered out by `isAdminSender()`. Fixed to `17786821394`.
2. **Store symlink not mounted in container** — `store/` → `/data/store` wasn't in the symlink resolution loop in `container-runner.ts`. Added `STORE_DIR` alongside `GROUPS_DIR` and `DATA_DIR`. Agent container can now access `messages.db`.
3. **sqlite3 not in container** — added to Dockerfile apt packages.
4. **Canvas course ID wrong** — was 245693 (old term), changed to 239676 (returns 200).
5. **Bootstrap tasks flooding** — all 9 student bootstrap tasks fired immediately, consuming all 5 container slots. Marked all bootstrap+patrol tasks as `completed` in DB to stop them.

#### SharePoint/Microsoft Auth Feature ✅ COMPLETE
Full headless SharePoint authentication now working:

**Files changed:**
- `container/scripts/ms-auth-browse.mjs` — Puppeteer-core script handling full Microsoft login flow (email → password → Duo MFA → device trust → content)
- `container/Dockerfile` — added `puppeteer-core`, `@aws-sdk/client-s3` globally, symlinked node_modules to /opt/scripts/
- `src/container-runner.ts` — added `MS_EMAIL`, `MS_PASSWORD` to allowed secrets passthrough
- `groups/global/CLAUDE.md` — instructions for agent to use `node /opt/scripts/ms-auth-browse.mjs <url>`

**Working flow (2026-05-16):**
1. Email → password → Duo MFA code displayed in script stderr
2. User enters code in Duo Mobile app within ~90 seconds
3. Script detects approval, handles "Is this your device?" trust prompt (clicks "Yes")
4. Session cookies saved to S3 (`tai-backups-prod/ms-session.json`)
5. Future runs skip Duo entirely by loading cookies from S3

**Initial setup completed:**
- Ran script manually via SSH with Duo code 596
- Successfully authenticated and accessed Professor Coady's SharePoint lecture video
- Session persisted to S3 — TAi can now access SharePoint/OneDrive links without Duo prompts

**Usage:**
TAi agent can now browse any `northeastern.sharepoint.com` or `northeastern-my.sharepoint.com` URL. Script loads saved session from S3, only requires Duo re-approval if session expires (typically 30+ days).

**Manual testing/re-authentication command:**
```bash
ssh -i ~/.ssh/tai-deploy ubuntu@52.13.181.61

sudo docker run -it --rm \
  -e MS_EMAIL=shi.yuzh@northeastern.edu \
  -e "MS_PASSWORD=Aa404572524syz!" \
  -e AWS_REGION=us-west-2 \
  -e AWS_ACCESS_KEY_ID -e AWS_SECRET_ACCESS_KEY -e AWS_SESSION_TOKEN \
  --entrypoint node \
  nanoclaw-agent:latest \
  /opt/scripts/ms-auth-browse.mjs "https://northeastern.sharepoint.com/sites/CS6650-SP2026"
```

When Duo code appears in output (format `XXX`), enter it in Duo Mobile within 90 seconds. Session saves to S3 after successful auth.

### Open Issues
- ~~**SharePoint Duo MFA**~~ ✅ FIXED 2026-05-16
- ~~**SharePoint transcript extraction**~~ ✅ FIXED 2026-05-18
- ~~**GitHub tokens**~~ ✅ FIXED 2026-05-19 — Both Khoury GHE and public GitHub tokens configured
- ~~**Lecture transcripts**~~ ✅ DONE 2026-05-19 — All 11 lectures transcribed, polished, ready for LeanRAG
- ~~**YouTube transcript tool**~~ ✅ FIXED 2026-05-19 — yt-dlp + S3 cookies, no more residential proxy needed
- ~~**Piped messages silently dropped**~~ ✅ FIXED 2026-05-19 — `outputAfterPipe` tracking
- **Student groups not registered**: All removed for now. Need to re-register when ready.
- **PLACEHOLDER secrets**: YOUTUBE_API_KEY (for Data API metadata only — transcripts now use yt-dlp), VOICE_INTERVIEW_SECRET
- **LeanRAG not available**: Partial extraction cache (54/868 chunks). 66 files in cs6650-materials/ ready. Need manual `build_graph` run.
- **S3 backups**: Bucket exists but cron not configured on this instance yet
- **Evaluating Deepgram**: As replacement for Nova Sonic in voice interviews. MCP docs server added (`.mcp.json`)

### Next Work
- **Deepgram Voice Agent migration** — Replace Nova Sonic with Deepgram Voice Agent API for mock interviews. Deepgram docs MCP server added to `.mcp.json` (`deepgram-docs` → `https://api.dx.deepgram.com/kapa/mcp`). Motivation: Nova Sonic has unresolved content filter issues + no reconnect support + service-side timing sensitivity.
- Run LeanRAG `build_graph` manually to ingest all 66 course material files
- Re-register student groups when ready
- Add remaining .env secrets (YOUTUBE_API_KEY, voice interview secret)
- Configure backup cron
