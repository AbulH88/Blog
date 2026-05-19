#!/usr/bin/env bash
# ────────────────────────────────────────────────────────────────────────────
# Cristina Platform — nightly backup
# ────────────────────────────────────────────────────────────────────────────
# Tars `database.sqlite` + `uploads/` into a timestamped archive, keeps the
# last N days locally, and (optionally) syncs them to off-site storage via
# rclone (Backblaze B2 / Cloudflare R2 / Google Drive / etc).
#
# Install on the VPS:
#   chmod +x /var/www/cristina/server/scripts/backup.sh
#   crontab -e
#     0 3 * * * /var/www/cristina/server/scripts/backup.sh >> /var/log/cristina-backup.log 2>&1
#
# Configure via env vars (defaults shown below). Easiest way: add them to
# /etc/cristina-backup.env and `source` it from the cron entry.
#
# ────────────────────────────────────────────────────────────────────────────

set -euo pipefail

# ── Config (override via env) ───────────────────────────────────────────────
SERVER_DIR="${SERVER_DIR:-/var/www/cristina/server}"
BACKUP_DIR="${BACKUP_DIR:-/var/backups/cristina}"
KEEP_DAYS="${KEEP_DAYS:-14}"
RCLONE_REMOTE="${RCLONE_REMOTE:-}"      # e.g. "b2:cristina-backups"  (empty = skip off-site)
RCLONE_KEEP_DAYS="${RCLONE_KEEP_DAYS:-30}"

# Optional env file (overrides anything above)
[ -f /etc/cristina-backup.env ] && source /etc/cristina-backup.env

# ── Pre-flight ──────────────────────────────────────────────────────────────
TIMESTAMP="$(date -u +%Y%m%d-%H%M%S)"
ARCHIVE="cristina-${TIMESTAMP}.tar.gz"

if [ ! -d "$SERVER_DIR" ]; then
  echo "[backup] ERROR: SERVER_DIR not found: $SERVER_DIR" >&2
  exit 1
fi

if [ ! -f "$SERVER_DIR/database.sqlite" ]; then
  echo "[backup] WARN: database.sqlite not found in $SERVER_DIR — backing up uploads only" >&2
fi

mkdir -p "$BACKUP_DIR"

# ── Create archive ──────────────────────────────────────────────────────────
echo "[backup] $(date -u +'%Y-%m-%dT%H:%M:%SZ') creating $ARCHIVE"
cd "$SERVER_DIR"

# Pieces to include — only existing ones
INCLUDE=()
[ -f database.sqlite ] && INCLUDE+=("database.sqlite")
[ -d uploads ]        && INCLUDE+=("uploads")
[ -d data ]           && INCLUDE+=("data")  # legacy config.json + analytics

if [ ${#INCLUDE[@]} -eq 0 ]; then
  echo "[backup] ERROR: nothing to back up" >&2
  exit 1
fi

tar -czf "$BACKUP_DIR/$ARCHIVE" "${INCLUDE[@]}"
SIZE_HUMAN=$(du -h "$BACKUP_DIR/$ARCHIVE" | cut -f1)
echo "[backup] wrote $BACKUP_DIR/$ARCHIVE ($SIZE_HUMAN)"

# ── Local rotation ──────────────────────────────────────────────────────────
echo "[backup] pruning local backups older than ${KEEP_DAYS}d"
find "$BACKUP_DIR" -maxdepth 1 -name 'cristina-*.tar.gz' -mtime "+${KEEP_DAYS}" -print -delete || true

# ── Off-site sync (optional) ────────────────────────────────────────────────
if [ -n "$RCLONE_REMOTE" ]; then
  if ! command -v rclone >/dev/null 2>&1; then
    echo "[backup] WARN: rclone not installed — skipping off-site sync" >&2
  else
    echo "[backup] uploading to $RCLONE_REMOTE"
    rclone copy "$BACKUP_DIR/$ARCHIVE" "$RCLONE_REMOTE" --quiet
    echo "[backup] pruning off-site backups older than ${RCLONE_KEEP_DAYS}d"
    rclone delete "$RCLONE_REMOTE" \
      --min-age "${RCLONE_KEEP_DAYS}d" \
      --include 'cristina-*.tar.gz' --quiet || true
  fi
else
  echo "[backup] off-site sync disabled (RCLONE_REMOTE empty)"
fi

echo "[backup] done."
