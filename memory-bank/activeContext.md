# TAi Active Context

## Current State: Deployed and Running (2026-04-02)

TAi is live on EC2, serving students via WhatsApp. LeanRAG auto-syncs with Canvas.

### EC2 Instance
- **IP**: 52.12.72.115 (Elastic IP)
- **Type**: t3.xlarge (4 vCPU, 16 GB RAM)
- **SSH**: `ssh -i ~/.ssh/tai-deploy ubuntu@52.12.72.115`
- **Deploy user**: nanoclaw (has SSH keys for GitHub)
- **Process manager**: systemd (migrated from pm2 — see systemd/ directory)
- **Code**: `/home/nanoclaw/TAi` (cloned from `tai-deploy` remote)
- **Data volume**: /data (20 GB EBS) with symlinks: store→/data/store, groups→/data/groups, data→/data/data
- **Git remote for deploy**: `deploy` (https://github.com/YuzhengShi/tai-deploy.git)

### Systemd Services
| Service | Description | Logs |
|---------|-------------|------|
| `nanoclaw-main` | Main process (WhatsApp + agent orchestrator) | /var/log/nanoclaw/main.log |
| `nanoclaw-voice` | Voice interview server (Nova Sonic, port 3001) | /var/log/nanoclaw/voice.log |
| `cloudflared` | Cloudflare quick tunnel → localhost:3001 | /var/log/nanoclaw/tunnel.log |

```bash
# Manage services
sudo systemctl status nanoclaw-main
sudo systemctl restart nanoclaw-main
tail -f /var/log/nanoclaw/main.log
```

### Deploy Workflow
```bash
# Local:
git push deploy main
# EC2 (one-liner):
ssh -i ~/.ssh/tai-deploy ubuntu@52.12.72.115 "sudo -u nanoclaw bash -lc 'cd ~/TAi && git pull origin main && npm run build' && sudo systemctl restart nanoclaw-main"
```
Note: EC2 remote is `origin` (not `deploy`) — it was cloned from tai-deploy.git as origin.

### Active Students (from /data/groups/)
admin, ajin, gideon, jassem, kalhar, sihui, xiaofan, yuzheng, zhengyi

### Recent Changes (2026-04-02)
1. **systemd migration** — pm2 replaced with 3 systemd services (nanoclaw-main, nanoclaw-voice, cloudflared). Files in `systemd/` dir. Migration script: `scripts/migrate-to-systemd.sh`
2. **Cloudflare tunnel** — systemd service + wrapper script auto-captures URL, writes to .env, restarts voice server
3. **Backup cron** — hourly S3 sync of store/, daily sync of groups/. Cron file: `systemd/nanoclaw-backup`
4. **Log rotation** — daily, 14 days, compressed. Config: `systemd/nanoclaw-logrotate`
5. **Document downloads** — .md files now save with proper extension, original filename preserved
6. **LeanRAG incremental builds** — per-chunk content-hash cache, no full rebuilds
7. **Canvas auto-sync** — leanrag-sync.ts polls for new lectures, triggers incremental builds
8. **PDF/DOCX in container** — pymupdf added to Dockerfile

### Open Issues
- **Ajin group**: Was unresponsive, now responding as of 4:21pm — monitor
- **Backup S3 bucket**: Need to create `tai-backups-prod` bucket (or update name in /etc/cron.d/nanoclaw-backup)
- **systemd migration**: Not yet run on EC2 — push code then run `scripts/migrate-to-systemd.sh`

### Next Work
- Run systemd migration on EC2 (`sudo bash scripts/migrate-to-systemd.sh`)
- Create S3 backup bucket
- 2D. Graph-Informed Teaching (graph-driven mock questions, prerequisite gap detection)
