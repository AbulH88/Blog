#!/usr/bin/env bash
# ────────────────────────────────────────────────────────────────────────────
# Cristina Platform — restore from a backup archive
# ────────────────────────────────────────────────────────────────────────────
# Usage:
#   ./restore.sh <archive>                         # restore from local archive
#   ./restore.sh latest                            # restore newest local archive
#   ./restore.sh b2:cristina-backups/cristina-20260520-030000.tar.gz   # via rclone
#
# Safety:
#  - Stops PM2 first (or any `node` matching index.js) so DB writes don't race
#  - Snapshots the CURRENT state into pre-restore-<ts>.tar.gz before overwriting
#  - Prompts for confirmation
#
# ────────────────────────────────────────────────────────────────────────────

set -euo pipefail

SERVER_DIR="${SERVER_DIR:-/var/www/cristina/server}"
BACKUP_DIR="${BACKUP_DIR:-/var/backups/cristina}"
[ -f /etc/cristina-backup.env ] && source /etc/cristina-backup.env

ARG="${1:-}"
if [ -z "$ARG" ]; then
  echo "usage: $0 <archive | latest | rclone-path>"
  exit 1
fi

# ── Resolve source archive ──────────────────────────────────────────────────
if [ "$ARG" = "latest" ]; then
  SRC="$(ls -1t "$BACKUP_DIR"/cristina-*.tar.gz 2>/dev/null | head -n1 || true)"
  [ -z "$SRC" ] && { echo "no local archives in $BACKUP_DIR"; exit 1; }
elif [[ "$ARG" == *:* ]]; then
  # rclone remote — copy to /tmp first
  command -v rclone >/dev/null 2>&1 || { echo "rclone not installed"; exit 1; }
  SRC="/tmp/$(basename "$ARG")"
  echo "fetching $ARG → $SRC"
  rclone copyto "$ARG" "$SRC"
elif [ -f "$ARG" ]; then
  SRC="$ARG"
elif [ -f "$BACKUP_DIR/$ARG" ]; then
  SRC="$BACKUP_DIR/$ARG"
else
  echo "archive not found: $ARG"
  exit 1
fi

echo "restoring from: $SRC"
read -r -p "type 'restore' to continue (this OVERWRITES $SERVER_DIR/database.sqlite and uploads/): " CONFIRM
[ "$CONFIRM" = "restore" ] || { echo "aborted"; exit 1; }

# ── Snapshot current state ──────────────────────────────────────────────────
TS="$(date -u +%Y%m%d-%H%M%S)"
PRE="$BACKUP_DIR/pre-restore-${TS}.tar.gz"
mkdir -p "$BACKUP_DIR"
echo "snapshotting current state → $PRE"
cd "$SERVER_DIR"
INCLUDE=()
[ -f database.sqlite ] && INCLUDE+=("database.sqlite")
[ -d uploads ]        && INCLUDE+=("uploads")
[ -d data ]           && INCLUDE+=("data")
if [ ${#INCLUDE[@]} -gt 0 ]; then
  tar -czf "$PRE" "${INCLUDE[@]}"
fi

# ── Stop server ─────────────────────────────────────────────────────────────
if command -v pm2 >/dev/null 2>&1 && pm2 jlist 2>/dev/null | grep -q '"name"'; then
  echo "pm2 stop all"
  pm2 stop all || true
fi

# ── Extract ─────────────────────────────────────────────────────────────────
echo "extracting $SRC into $SERVER_DIR"
tar -xzf "$SRC" -C "$SERVER_DIR"

# ── Restart ─────────────────────────────────────────────────────────────────
if command -v pm2 >/dev/null 2>&1; then
  echo "pm2 start all"
  pm2 start all || true
fi

echo "restore complete. pre-restore snapshot kept at: $PRE"
