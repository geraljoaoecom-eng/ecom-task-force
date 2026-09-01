const { pool } = require('./db');
const { sendSpyExpiringEmail } = require('./spy-notify');

const WARN_DAYS = 7;

async function purgeExpiredDiscoveries() {
  const { rowCount } = await pool.query(
    `DELETE FROM spy_discoveries WHERE expires_at < NOW() AND already_imported = false`
  );
  if (rowCount > 0) console.log(`🗑️ SPY: ${rowCount} discoveries expirados apagados`);
  return rowCount;
}

async function warnExpiringDiscoveries() {
  const { rows } = await pool.query(
    `SELECT d.id, d.name, d.expires_at, s.name AS session_name, s.user_id
     FROM spy_discoveries d
     JOIN spy_sessions s ON s.id = d.session_id
     WHERE d.already_imported = false
       AND d.expires_at > NOW()
       AND d.expires_at < NOW() + interval '${WARN_DAYS} days'
       AND (d.card_data->>'expiryWarned' IS NULL OR d.card_data->>'expiryWarned' != 'true')`
  );

  for (const row of rows) {
    await sendSpyExpiringEmail(row);
    await pool.query(
      `UPDATE spy_discoveries SET card_data = card_data || '{"expiryWarned": true}'::jsonb WHERE id = $1`,
      [row.id]
    );
  }
  return rows.length;
}

function startSpyCleanupScheduler() {
  const run = async () => {
    try {
      await purgeExpiredDiscoveries();
      await warnExpiringDiscoveries();
    } catch (err) {
      console.error('❌ SPY cleanup:', err.message);
    }
  };

  run();
  setInterval(run, 6 * 60 * 60 * 1000);
  console.log('🧹 SPY cleanup scheduler ativo (6h)');

  // Spot de Tendências — recompute periódico (além do disparo debounced ao gravar discoveries).
  const { computeTrends } = require('./spy-trends');
  const trendsMs = parseInt(process.env.SPY_TRENDS_INTERVAL_MS || String(30 * 60 * 1000), 10) || 30 * 60 * 1000;
  const runTrends = () => computeTrends().catch((e) => console.error('❌ SPY trends:', e.message));
  setTimeout(runTrends, 60 * 1000); // primeira corrida 1 min após arranque
  setInterval(runTrends, trendsMs);
  console.log(`📊 SPY trends scheduler ativo (${Math.round(trendsMs / 60000)}min)`);
}

module.exports = { startSpyCleanupScheduler, purgeExpiredDiscoveries, warnExpiringDiscoveries };
