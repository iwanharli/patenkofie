#!/usr/bin/env bash
# Deploys the current main branch to the server this script runs on.
#
#   ./deploy.sh
#
# Overridable:
#   PM2_NAME=demo-patenandum-8085  BACKUP_DIR=/root/backups  HEALTH_URL=...
#
# Backs the database and the running binary up first, applies pending
# migrations, builds both halves, then swaps the binary in. If the app fails
# its health check afterwards the previous binary is put back automatically.
set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PM2_NAME="${PM2_NAME:-demo-patenandum-8085}"
BACKUP_DIR="${BACKUP_DIR:-/root/backups}"
HEALTH_URL="${HEALTH_URL:-http://127.0.0.1:8085/healthz}"
KEEP_BACKUPS="${KEEP_BACKUPS:-10}"

cd "$PROJECT_DIR"
STAMP="$(date +%Y%m%d-%H%M%S)"

# The backend reads its config from backend/.env; migrations need the same DB.
if [ -f backend/.env ]; then
  DATABASE_URL="$(grep -E '^DATABASE_URL=' backend/.env | head -1 | cut -d= -f2-)"
fi
: "${DATABASE_URL:?DATABASE_URL not found in backend/.env}"
DB_NAME="${DATABASE_URL##*/}"
DB_NAME="${DB_NAME%%\?*}"

echo "=== Patenote deploy — $(date '+%Y-%m-%d %H:%M:%S') ==="
echo "    dir: $PROJECT_DIR    db: $DB_NAME    pm2: $PM2_NAME"
echo

echo "[1/7] Backup"
mkdir -p "$BACKUP_DIR"
pg_dump "$DATABASE_URL" > "$BACKUP_DIR/${DB_NAME}_${STAMP}.sql"
echo "      db     -> $BACKUP_DIR/${DB_NAME}_${STAMP}.sql ($(du -h "$BACKUP_DIR/${DB_NAME}_${STAMP}.sql" | cut -f1))"
if [ -f backend/server ]; then
  cp backend/server "$BACKUP_DIR/server_${STAMP}"
  echo "      binary -> $BACKUP_DIR/server_${STAMP}"
fi
# Keep the backup dir from growing without bound.
ls -1t "$BACKUP_DIR"/${DB_NAME}_*.sql 2>/dev/null | tail -n +$((KEEP_BACKUPS + 1)) | xargs -r rm -f
ls -1t "$BACKUP_DIR"/server_* 2>/dev/null | tail -n +$((KEEP_BACKUPS + 1)) | xargs -r rm -f

echo "[2/7] Pull"
git pull --ff-only origin main
echo "      now at: $(git log --oneline -1)"

echo "[3/7] Migrations"
DATABASE_URL="$DATABASE_URL" sh scripts/migrate.sh

echo "[4/7] Build backend"
# Built beside the running binary first so the service keeps serving until the
# swap; go.mod may request a newer toolchain than the system Go, which the go
# command downloads on demand.
(cd backend && go build -o server.new ./cmd/server)
echo "      $(du -h backend/server.new | cut -f1) binary"

echo "[5/7] Build frontend"
(cd frontend && npm ci --silent && npm run build >/dev/null)
echo "      dist ready"

echo "[6/7] Swap binary and restart"
mv backend/server.new backend/server
pm2 restart "$PM2_NAME" --update-env >/dev/null

echo "[7/7] Health check"
ok=""
for _ in $(seq 1 15); do
  sleep 1
  if [ "$(curl -s -o /dev/null -w '%{http_code}' "$HEALTH_URL" || true)" = "200" ]; then
    ok=1
    break
  fi
done

if [ -z "$ok" ]; then
  echo "      FAILED — rolling back to the previous binary"
  if [ -f "$BACKUP_DIR/server_${STAMP}" ]; then
    cp "$BACKUP_DIR/server_${STAMP}" backend/server
    pm2 restart "$PM2_NAME" --update-env >/dev/null
    echo "      previous binary restored. Database backup: $BACKUP_DIR/${DB_NAME}_${STAMP}.sql"
  fi
  echo "      recent logs:"
  pm2 logs "$PM2_NAME" --lines 20 --nostream 2>/dev/null | tail -20
  exit 1
fi

echo "      healthy ($HEALTH_URL)"
echo
echo "=== Deploy complete: $(git log --oneline -1) ==="
