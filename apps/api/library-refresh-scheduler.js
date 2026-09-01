/**
 * Refresh de contagem das Bibliotecas — CATCH-UP auto-curativo.
 *
 * Objectivo: cada biblioteca refrescada ~4×/dia (de 6 em 6h), AUTOMÁTICO, sem ninguém
 * fazer nada, e RESILIENTE a restarts da API (o scheduler antigo em memória perdia
 * execuções a cada reinício). Em vez de "às 8h/12h/...", verifica periodicamente quais
 * bibliotecas estão STALE (last_checked_at > 6h) e refresca-as. Mesmo após um restart,
 * apanha as atrasadas — nunca fica nada dias sem refresh.
 *
 * Transporte: IP DIRECTO DA CONTABO (`updateSingleLibrary` usa useProxy:false). É leitura
 * leve (só "~N resultados"), baixo volume, sem bloqueio. NÃO toca no SPY (que usa mobile).
 */
const { pool } = require('./db');
const { updateSingleLibrary } = require('./library-scraper-service');

const INTERVAL_HOURS = parseInt(process.env.LIBRARY_REFRESH_INTERVAL_HOURS || '6', 10) || 6; // 4×/dia
const CHECK_EVERY_MS = parseInt(process.env.LIBRARY_REFRESH_CHECK_MS || String(20 * 60 * 1000), 10) || 20 * 60 * 1000;
const BATCH = parseInt(process.env.LIBRARY_REFRESH_BATCH || '50', 10) || 50;
const ITEM_DELAY_MS = parseInt(process.env.LIBRARY_REFRESH_ITEM_DELAY_MS || '1500', 10) || 1500;

let running = false;
let started = false;

async function refreshStaleLibraries() {
  if (running) return { skipped: true };
  running = true;
  try {
    const { rows } = await pool.query(
      `SELECT id, name FROM libraries
       WHERE source_value IS NOT NULL AND source_value <> ''
         AND (last_checked_at IS NULL OR last_checked_at < NOW() - ($1 || ' hours')::interval)
       ORDER BY last_checked_at ASC NULLS FIRST
       LIMIT $2`,
      [String(INTERVAL_HOURS), BATCH]
    );
    if (!rows.length) return { stale: 0 };
    console.log(`🔄 Refresh catch-up: ${rows.length} bibliotecas stale (>${INTERVAL_HOURS}h) — IP Contabo`);
    let ok = 0;
    for (const lib of rows) {
      try { await updateSingleLibrary(lib.id); ok += 1; }
      catch (e) { console.warn(`⚠️ refresh ${lib.name}:`, e.message); }
      await new Promise((r) => setTimeout(r, ITEM_DELAY_MS));
    }
    console.log(`🔄 Refresh catch-up: ${ok}/${rows.length} actualizadas`);
    return { stale: rows.length, ok };
  } catch (e) {
    console.error('❌ Refresh catch-up:', e.message);
    return { error: e.message };
  } finally {
    running = false;
  }
}

function startLibraryRefreshScheduler() {
  if (started) return;
  started = true;
  setTimeout(() => refreshStaleLibraries().catch(() => {}), 30 * 1000); // 30s após arranque
  setInterval(() => refreshStaleLibraries().catch(() => {}), CHECK_EVERY_MS);
  console.log(`🔄 Library refresh scheduler (catch-up): cada ${Math.round(CHECK_EVERY_MS / 60000)}min · alvo ${INTERVAL_HOURS}h (~4×/dia) · IP Contabo`);
}

module.exports = { startLibraryRefreshScheduler, refreshStaleLibraries };
