#!/bin/bash
# Arranque da ponte SPY — espera o volume do projecto (se externo) e corre em background.
set -e
PROJECT_DIR="${SPY_MAC_PROJECT_DIR:-/Volumes/Remote Nrl /Cursor/Projetos/TaskForce 2026/ECOOM TaskForce}"
LOG="$HOME/.ecom-spy-ponte.log"
PORT="${SPY_MOBILE_LOCAL_PORT:-9780}"

for i in $(seq 1 60); do
  if [ -f "$PROJECT_DIR/scripts/spy-mobile-bridge-local.js" ]; then
    break
  fi
  sleep 5
done

if [ ! -f "$PROJECT_DIR/scripts/spy-mobile-bridge-local.js" ]; then
  echo "$(date -u +%Y-%m-%dT%H:%M:%SZ) projecto SPY nao encontrado em $PROJECT_DIR" >> "$LOG"
  exit 1
fi

if curl -s --max-time 2 "http://127.0.0.1:${PORT}/health" >/dev/null 2>&1; then
  exit 0
fi

cd "$PROJECT_DIR" || exit 1
exec node scripts/spy-mobile-bridge-local.js >> "$LOG" 2>&1
