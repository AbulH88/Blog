# Backups & restore

Nightly backup of `database.sqlite` + `uploads/` + `data/` (legacy
`config.json` & traffic analytics) into a timestamped archive, with
**local 14-day rotation** and **optional off-site sync** via rclone.

## Files

| File | What it does |
|---|---|
| `backup.sh` | Cron-friendly. Creates `cristina-YYYYMMDD-HHMMSS.tar.gz`, prunes old local + remote copies. |
| `restore.sh` | Interactive. Snapshots current state first, then restores. Supports `latest`, a file path, or an `rclone:remote/path`. |

Both scripts read overrides from `/etc/cristina-backup.env` if present.

## Install on the VPS

```bash
# 1. Make executable
chmod +x /var/www/cristina/server/scripts/backup.sh
chmod +x /var/www/cristina/server/scripts/restore.sh

# 2. Override defaults if needed
sudo tee /etc/cristina-backup.env <<'EOF'
SERVER_DIR=/var/www/cristina/server
BACKUP_DIR=/var/backups/cristina
KEEP_DAYS=14
# Off-site (optional) — empty disables sync
RCLONE_REMOTE=b2:cristina-backups
RCLONE_KEEP_DAYS=30
EOF
sudo chmod 600 /etc/cristina-backup.env

# 3. Make the local dir
sudo mkdir -p /var/backups/cristina
sudo chown $USER:$USER /var/backups/cristina

# 4. Test it once
/var/www/cristina/server/scripts/backup.sh

# 5. Schedule (3 AM UTC daily)
crontab -e
0 3 * * * /var/www/cristina/server/scripts/backup.sh >> /var/log/cristina-backup.log 2>&1
```

## Off-site storage (recommended)

If `RCLONE_REMOTE` is set the script uploads each archive to a remote and
prunes copies older than `RCLONE_KEEP_DAYS` (default 30).

### Backblaze B2 (cheapest — $0.006/GB-month)

```bash
# Install rclone
curl https://rclone.org/install.sh | sudo bash

# Get Application Key from https://secure.backblaze.com/app_keys.htm
rclone config
#   n)  new remote
#   name> b2
#   storage> 6   (Backblaze B2)
#   account> <Key ID>
#   key> <Application Key>
#   q)  quit

# Create the bucket
rclone mkdir b2:cristina-backups
```

Then set `RCLONE_REMOTE=b2:cristina-backups` in `/etc/cristina-backup.env`.

### Cloudflare R2 (no egress fees — $0.015/GB-month)

```bash
rclone config
#   storage> 4   (Amazon S3 Compliant)
#   provider> Cloudflare
#   access_key_id> <token>
#   secret_access_key> <token>
#   endpoint> https://<account-id>.r2.cloudflarestorage.com
```

## Restore

```bash
# Newest local archive
sudo ./restore.sh latest

# Specific local archive
sudo ./restore.sh /var/backups/cristina/cristina-20260520-030000.tar.gz

# From off-site
sudo ./restore.sh b2:cristina-backups/cristina-20260520-030000.tar.gz
```

The script will:
1. Snapshot the current DB + uploads to `pre-restore-<ts>.tar.gz` (you can undo)
2. `pm2 stop all`
3. Extract the archive over `$SERVER_DIR`
4. `pm2 start all`

## Verify it's working

```bash
# Most recent backup
ls -lh /var/backups/cristina/ | tail

# Cron log
tail -50 /var/log/cristina-backup.log

# Off-site copies
rclone ls b2:cristina-backups | tail
```

## Disaster recovery checklist

If the VPS dies entirely:
1. Spin up a new VPS, install Node + nginx + pm2
2. `git clone` this repo to `/var/www/cristina`
3. `cd server && npm ci`
4. Restore `.env` from your password manager
5. Pull the latest archive: `rclone copy b2:cristina-backups/$(rclone lsf b2:cristina-backups | sort | tail -n1) .`
6. `./restore.sh <that file>`
7. Restart nginx + pm2

Expected recovery time: **< 30 minutes**.
