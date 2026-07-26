#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="${ROOT_DIR}/backend"
FRONTEND_DIR="${ROOT_DIR}/frontend"

BACKEND_PORT="${APP_PORT:-8080}"
FRONTEND_HOST="${FRONTEND_HOST:-127.0.0.1}"
FRONTEND_PORT="${FRONTEND_PORT:-5173}"

PIDS=()
CLEANED_UP=0

cleanup() {
  if [ "${CLEANED_UP:-0}" -eq 1 ]; then
    return
  fi

  CLEANED_UP=1

  if [ "${#PIDS[@]}" -gt 0 ]; then
    echo
    echo "Stopping PatenAndum dev servers..."
    kill "${PIDS[@]}" 2>/dev/null || true
    wait "${PIDS[@]}" 2>/dev/null || true
  fi
}

trap cleanup EXIT
trap 'cleanup; exit 130' INT TERM

if [ ! -d "${BACKEND_DIR}" ] || [ ! -d "${FRONTEND_DIR}" ]; then
  echo "run.sh must be executed from the PatenAndum project root."
  exit 1
fi

is_port_in_use() {
  local port="$1"

  if command -v lsof >/dev/null 2>&1; then
    lsof -nP -iTCP:"${port}" -sTCP:LISTEN >/dev/null 2>&1
    return "$?"
  fi

  return 1
}

REQUESTED_BACKEND_PORT="${BACKEND_PORT}"
while is_port_in_use "${BACKEND_PORT}"; do
  BACKEND_PORT="$((BACKEND_PORT + 1))"
done

if [ "${BACKEND_PORT}" != "${REQUESTED_BACKEND_PORT}" ]; then
  echo "Backend port ${REQUESTED_BACKEND_PORT} is in use; using ${BACKEND_PORT}."
fi

REQUESTED_FRONTEND_PORT="${FRONTEND_PORT}"
while is_port_in_use "${FRONTEND_PORT}"; do
  FRONTEND_PORT="$((FRONTEND_PORT + 1))"
done

if [ "${FRONTEND_PORT}" != "${REQUESTED_FRONTEND_PORT}" ]; then
  echo "Frontend port ${REQUESTED_FRONTEND_PORT} is in use; using ${FRONTEND_PORT}."
fi

echo "Starting backend on http://127.0.0.1:${BACKEND_PORT}"
(
  cd "${BACKEND_DIR}"
  APP_PORT="${BACKEND_PORT}" go run ./cmd/server
) &
PIDS+=("$!")

# Wait for backend to be ready
for i in {1..30}; do
  if is_port_in_use "${BACKEND_PORT}"; then
    break
  fi
  sleep 0.1
done

echo "Starting frontend on http://${FRONTEND_HOST}:${FRONTEND_PORT}"
(
  cd "${FRONTEND_DIR}"
  VITE_BACKEND_URL="http://127.0.0.1:${BACKEND_PORT}" npm run dev -- --host "${FRONTEND_HOST}" --port "${FRONTEND_PORT}" --strictPort
) &
PIDS+=("$!")

echo
echo "PatenAndum dev servers are running."
echo "Frontend: http://${FRONTEND_HOST}:${FRONTEND_PORT}"
echo "Backend:  http://127.0.0.1:${BACKEND_PORT}/healthz"
echo "Press Ctrl+C to stop both."
echo

while :; do
  RUNNING_JOBS="$(jobs -pr | wc -l | tr -d '[:space:]' || true)"
  RUNNING_JOBS="${RUNNING_JOBS:-0}"

  if [ "${RUNNING_JOBS}" -ne "${#PIDS[@]}" ]; then
    break
  fi

  sleep 1
done

exit 1
