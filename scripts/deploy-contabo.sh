#!/bin/bash
set -e

APP_DIR="/var/www/ecom-taskforce"
SRC="/Volumes/Remote Nrl /Cursor/Projetos/TaskForce 2026/ECOOM TaskForce"
SSH_KEY="$HOME/.ssh/contabo-taskforce/id_ed25519"
SSH="ssh -i $SSH_KEY -o StrictHostKeyChecking=no root@173.249.32.180"

echo "Syncing code..."
rsync -avz --delete \
  -e "ssh -i $SSH_KEY -o StrictHostKeyChecking=no" \
  --exclude node_modules \
  --exclude .next \
  --exclude .git \
  --exclude 'Original' \
  --exclude '*.rar' \
  --exclude atlas.db \
  --exclude env-config \
  --exclude .env \
  --exclude 'data/' \
  "$SRC/" \
  root@173.249.32.180:$APP_DIR/

echo "Running remote setup..."
$SSH bash -s << 'REMOTE'
set -e
APP_DIR="/var/www/ecom-taskforce"
cd $APP_DIR

# NÃO sobrescrever env-config — credenciais em secrets/CREDENCIAIS-PRODUCAO.env (local)
if [ ! -f env-config ]; then
  echo "AVISO: env-config em falta na VPS. Copia secrets/CREDENCIAIS-PRODUCAO.env manualmente."
else
  echo "env-config preservado (OpenRouter, proxy, etc.)"
fi

cp env-config .env 2>/dev/null || true
cp env-config apps/web/.env.local 2>/dev/null || true

for f in "$APP_DIR"/scripts/migrations/*.sql; do
  [ -f "$f" ] && cat "$f" | sudo -u postgres psql -d taskforce 2>/dev/null || true
done

npm install --prefix apps/api
npm install --prefix apps/web

node --check apps/api/spy-deep-search.js
node --check apps/api/spy-niche-intel.js
node --check apps/api/spy-live-stats.js
node --check apps/api/spy-library-ai-scraper.js
node --check apps/api/spy-openrouter-shared.js
node --check apps/api/spy-openrouter.js
node --check apps/api/spy-search-scraper.js
node --check apps/api/spy-library-pull.js
node --check apps/api/spy-keyword-live-pipeline.js
node --check apps/api/spy-library-visit-registry.js
node --check apps/api/spy-meta-map-ads.js
node --check apps/api/spy-meta-orchestrator.js
node --check apps/api/spy-engine.js
node --check apps/api/spy-db.js
node --check apps/api/library-taxonomy-service.js
node --check apps/api/spy-taxonomy.js
node --check apps/api/spy-import-jobs.js
node --check apps/api/spy-mobile-pairing.js
node --check apps/api/spy-mobile-bridge.js
node --check apps/api/spy-mobile-connect.js
node --check apps/api/spy-mobile-delegator.js
node --check apps/api/server.js

set -a
# shellcheck disable=SC1091
. env-config 2>/dev/null || true
set +a
(cd apps/api && node ../../scripts/seed-db.js) 2>/dev/null || echo "seed-db skipped"

cd apps/web && npm run build

pm2 delete ecom-api 2>/dev/null || true
pm2 delete ecom-web 2>/dev/null || true
pm2 start server.js --name ecom-api --cwd $APP_DIR/apps/api
pm2 start npm --name ecom-web --cwd $APP_DIR/apps/web -- start
pm2 save

pm2 list
REMOTE

echo "Testing health..."
curl -s https://ecoomtaskforce.site/api/health
