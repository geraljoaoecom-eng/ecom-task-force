/**
 * Deep-scan scheduler — popula `library_ads` (ads individuais, days_active, duplicações,
 * media) periodicamente para alimentar analytics + copy vault.
 *
 * Transporte: `scrapeLibraryPagePhase` usa MOBILE quando ligado, senão PROXY residencial
 * (nunca o IP cru da VPS). Corre SEQUENCIAL com throttle para poupar banda do proxy.
 *
 * Frequência: env `COPY_DEEP_SCAN_HOURS` (default "3,15" = 2×/dia). Mais leve que o
 * refresh de contagem (esse continua 6×/dia em auto-scraper-scheduler.js).
 */
const { pool } = require('./db');
const { processLibraryCopyScan } = require('./copy-library-scanner');

const HOURS = (process.env.COPY_DEEP_SCAN_HOURS || '3,15')
  .split(',')
  .map((h) => parseInt(h, 10))
  .filter((h) => Number.isFinite(h) && h >= 0 && h <= 23);
const THROTTLE_MS = parseInt(process.env.COPY_DEEP_SCAN_THROTTLE_MS || '4000', 10) || 4000;

let started = false;
let running = false;

async function listScanTargets() {
  // Bibliotecas com URL Meta válida, prioridade às mais escaladas (active_ads desc).
  const { rows } = await pool.query(
    `SELECT id FROM libraries
     WHERE source_value IS NOT NULL AND source_value <> ''
     ORDER BY active_ads DESC NULLS LAST, updated_at ASC`
  );
  return rows.map((r) => r.id);
}

async function runDeepScanAll() {
  if (running) {
    console.log('📚 Deep scan já a correr — skip');
    return { skipped: true };
  }
  running = true;
  try {
    const ids = await listScanTargets();
    console.log(`📚 Deep scan a iniciar: ${ids.length} bibliotecas (sequencial, throttle ${THROTTLE_MS}ms)`);
    let ok = 0;
    for (const id of ids) {
      try {
        await processLibraryCopyScan(id);
        ok += 1;
      } catch (e) {
        console.warn(`⚠️ deep scan ${id}:`, e.message);
      }
      await new Promise((r) => setTimeout(r, THROTTLE_MS));
    }
    console.log(`📚 Deep scan concluído: ${ok}/${ids.length} bibliotecas`);
    return { total: ids.length, ok };
  } finally {
    running = false;
  }
}

function startCopyDeepScanScheduler() {
  if (started) return;
  started = true;
  let lastRunHour = -1;
  setInterval(() => {
    const now = new Date();
    const h = now.getHours();
    if (HOURS.includes(h) && now.getMinutes() < 2 && lastRunHour !== h) {
      lastRunHour = h;
      runDeepScanAll().catch((e) => console.error('❌ deep scan scheduler:', e.message));
    }
    // reset do guard quando muda de hora-alvo
    if (!HOURS.includes(h)) lastRunHour = -1;
  }, 60 * 1000);
  console.log(`📚 Copy deep-scan scheduler ativo (${HOURS.join('h, ')}h)`);
}

module.exports = { startCopyDeepScanScheduler, runDeepScanAll };
