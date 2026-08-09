#!/usr/bin/env sh
# Runs the migrations against the local development database.
# The real runner is scripts/migrate.sh; this just picks the local target.
set -eu

cd "$(dirname "$0")/.."
DB_NAME="${DB_NAME:-db_patenandum}" exec sh scripts/migrate.sh
