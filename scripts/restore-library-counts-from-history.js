#!/usr/bin/env node
/**
 * Restaura active_ads a partir do último registo ad_history > 0
 * anterior ao pico de zeros (após refresh em massa com Meta bloqueada).
 *
 * Uso na VPS:
 *   cd /var/www/ecom-taskforce/apps/api
 *   node ../../scripts/restore-library-counts-from-history.js
 *   node ../../scripts/restore-library-counts-from-history.js --dry-run
 */
const path = require('path');
const apiDir = path.join(__dirname, '../apps/api');
require('dotenv').config({ path: path.join(__dirname, '../env-config') });
const { pool } = require(path.join(apiDir, 'db'));

const ZERO_FLOOD_AFTER = '2026-06-01 13:00:00+02';
const dryRun = process.argv.includes('--dry-run');

async function main() {
  const { rows } = await pool.query(
    `SELECT l.id, l.name, l.active_ads,
            (
              SELECT h.ads_count
              FROM ad_history h
              WHERE h.library_id = l.id
                AND h.ads_count > 0
                AND h.date < $1::timestamptz
              ORDER BY h.date DESC
              LIMIT 1
            ) AS restore_count
     FROM libraries l
     WHERE l.active_ads = 0`,
    [ZERO_FLOOD_AFTER]
  );

  let updated = 0;
  for (const row of rows) {
    if (!row.restore_count) continue;
    console.log(`${dryRun ? '[dry] ' : ''}${row.name}: 0 → ${row.restore_count}`);
    if (!dryRun) {
      await pool.query('UPDATE libraries SET active_ads = $1, updated_at = NOW() WHERE id = $2', [
        row.restore_count,
        row.id,
      ]);
    }
    updated += 1;
  }

  console.log(`\n${dryRun ? 'Seriam restauradas' : 'Restauradas'}: ${updated} bibliotecas`);
  await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
