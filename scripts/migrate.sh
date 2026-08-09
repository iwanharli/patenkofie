#!/usr/bin/env sh
# Applies pending .up.sql migrations and records each one in schema_migrations.
#
# Connection:
#   DATABASE_URL=postgres://user:pass@host:5432/db   (used as-is when set)
#   DB_NAME=db_patenandum                            (local fallback; created if missing)
set -eu

MIGRATIONS_DIR="${MIGRATIONS_DIR:-backend/migrations}"

if [ -n "${DATABASE_URL:-}" ]; then
  TARGET="${DATABASE_URL}"
  LABEL="${DATABASE_URL##*/}"   # database name...
  LABEL="${LABEL%%\?*}"         # ...without the connection options
else
  DB_NAME="${DB_NAME:-db_patenandum}"
  if ! psql -d postgres -Atqc "SELECT 1 FROM pg_database WHERE datname = '${DB_NAME}'" | grep -q 1; then
    echo "  creating database ${DB_NAME}"
    createdb "${DB_NAME}"
  fi
  TARGET="${DB_NAME}"
  LABEL="${DB_NAME}"
fi

# 000001 also creates this table, but a fresh database needs it to exist before
# the first "has this run?" check.
psql -v ON_ERROR_STOP=1 -d "${TARGET}" -qc "
  SET client_min_messages TO warning;
  CREATE TABLE IF NOT EXISTS schema_migrations (
    version BIGINT PRIMARY KEY,
    name TEXT NOT NULL,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
  );
"

applied=0
for migration in "${MIGRATIONS_DIR}"/*.up.sql; do
  [ -e "${migration}" ] || continue

  base="$(basename "${migration}")"
  version="$(echo "${base}" | cut -d_ -f1 | sed 's/^0*//')"
  [ -n "${version}" ] || version="0"
  name="$(echo "${base}" | sed 's/^[0-9]*_//; s/\.up\.sql$//')"

  if psql -d "${TARGET}" -Atqc "SELECT 1 FROM schema_migrations WHERE version = ${version}" | grep -q 1; then
    continue
  fi

  echo "  applying ${base}"
  psql -v ON_ERROR_STOP=1 -d "${TARGET}" -qf "${migration}"

  # Record it here rather than inside each .sql file: only 000001 does that on
  # its own, and migrations that ran without being recorded get retried forever.
  psql -v ON_ERROR_STOP=1 -d "${TARGET}" -qc \
    "INSERT INTO schema_migrations (version, name) VALUES (${version}, '${name}') ON CONFLICT (version) DO NOTHING;"

  applied=$((applied + 1))
done

if [ "${applied}" -eq 0 ]; then
  echo "  no pending migrations"
else
  echo "  applied ${applied} migration(s)"
fi

psql -d "${TARGET}" -Atqc \
  "SELECT '${LABEL}: ' || count(*) || ' migration(s) recorded' FROM schema_migrations;"
