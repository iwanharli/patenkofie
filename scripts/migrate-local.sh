#!/usr/bin/env sh
set -eu

DB_NAME="${DB_NAME:-db_patenandum}"
MIGRATIONS_DIR="${MIGRATIONS_DIR:-backend/migrations}"

if ! psql -d postgres -Atqc "SELECT 1 FROM pg_database WHERE datname = '${DB_NAME}'" | grep -q 1; then
  createdb "${DB_NAME}"
fi

for migration in "${MIGRATIONS_DIR}"/*.up.sql; do
  version="$(basename "${migration}" | cut -d_ -f1 | sed 's/^0*//')"
  if [ -z "${version}" ]; then
    version="0"
  fi

  psql -v ON_ERROR_STOP=1 -d "${DB_NAME}" -qc "
    SET client_min_messages TO warning;
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version BIGINT PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  "

  if psql -d "${DB_NAME}" -Atqc "SELECT 1 FROM schema_migrations WHERE version = ${version}" | grep -q 1; then
    continue
  fi

  psql -v ON_ERROR_STOP=1 -d "${DB_NAME}" -f "${migration}"
done

psql -d "${DB_NAME}" -Atqc "SELECT '${DB_NAME}' AS database, COUNT(*) AS applied_migrations FROM schema_migrations;"
