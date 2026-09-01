const { pool } = require('./db');

const PAUSE_AFTER_ZERO_YIELDS = parseInt(process.env.SPY_KEYWORD_PAUSE_STREAK || '4', 10) || 4;

async function ensureNicheIntelTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS spy_niche_intel (
      id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      nicho TEXT NOT NULL,
      country TEXT NOT NULL DEFAULT '',
      keyword TEXT NOT NULL,
      source TEXT NOT NULL DEFAULT 'ad_text',
      score REAL NOT NULL DEFAULT 1,
      hit_count INTEGER NOT NULL DEFAULT 1,
      sessions_used INTEGER NOT NULL DEFAULT 0,
      discoveries_total INTEGER NOT NULL DEFAULT 0,
      ads_found_total INTEGER NOT NULL DEFAULT 0,
      relevant_ads_total INTEGER NOT NULL DEFAULT 0,
      zero_yield_streak INTEGER NOT NULL DEFAULT 0,
      last_seen_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      UNIQUE (nicho, country, keyword)
    )
  `);
  await pool.query(`
    ALTER TABLE spy_niche_intel ADD COLUMN IF NOT EXISTS sessions_used INTEGER NOT NULL DEFAULT 0
  `).catch(() => {});
  await pool.query(`
    ALTER TABLE spy_niche_intel ADD COLUMN IF NOT EXISTS discoveries_total INTEGER NOT NULL DEFAULT 0
  `).catch(() => {});
  await pool.query(`
    ALTER TABLE spy_niche_intel ADD COLUMN IF NOT EXISTS ads_found_total INTEGER NOT NULL DEFAULT 0
  `).catch(() => {});
  await pool.query(`
    ALTER TABLE spy_niche_intel ADD COLUMN IF NOT EXISTS relevant_ads_total INTEGER NOT NULL DEFAULT 0
  `).catch(() => {});
  await pool.query(`
    ALTER TABLE spy_niche_intel ADD COLUMN IF NOT EXISTS zero_yield_streak INTEGER NOT NULL DEFAULT 0
  `).catch(() => {});
}

function normCountry(country) {
  return country?.trim().toUpperCase() || '';
}

function normKw(keyword) {
  return keyword?.trim().toLowerCase() || '';
}

async function getNicheKeywords(nicho, country, limit = 40) {
  if (!nicho) return [];
  await ensureNicheIntelTable();
  const nichoKey = nicho.trim().toUpperCase();
  const countryKey = normCountry(country);

  const { rows } = await pool.query(
    `SELECT keyword, score, hit_count, source, country,
            sessions_used, discoveries_total, zero_yield_streak
     FROM spy_niche_intel
     WHERE nicho = $1 AND (country = '' OR country = $2)
       AND zero_yield_streak < $4
     ORDER BY score DESC, discoveries_total DESC, hit_count DESC, last_seen_at DESC
     LIMIT $3`,
    [nichoKey, countryKey, limit, PAUSE_AFTER_ZERO_YIELDS + 2]
  );
  return rows;
}

async function getKeywordIntelMap(nicho, country) {
  const rows = await getNicheKeywords(nicho, country, 200);
  const map = new Map();
  for (const row of rows) {
    map.set(normKw(row.keyword), row);
  }
  return map;
}

function buildKeywordPriority(keyword, source, intelRow) {
  if (intelRow?.zero_yield_streak >= PAUSE_AFTER_ZERO_YIELDS) return -1000;

  let priority = (intelRow?.score || 0) * 10;
  priority += (intelRow?.discoveries_total || 0) * 8;
  priority += Math.min(intelRow?.relevant_ads_total || 0, 500) * 0.05;

  if (source === 'deep' && !intelRow) priority += 45;
  else if (source === 'deep') priority += 12;
  if (source === 'niche_intel' && intelRow) priority += 6;
  if (source === 'learned') priority += 3;

  return Math.round(priority * 100) / 100;
}

async function applySessionKeywordPriorities(sessionId, nicho, country, keywordsWithSource) {
  if (!sessionId || !keywordsWithSource?.length) return;
  const map = nicho ? await getKeywordIntelMap(nicho, country) : new Map();

  for (const { keyword, source } of keywordsWithSource) {
    const kw = normKw(keyword);
    if (!kw) continue;
    const priority = buildKeywordPriority(kw, source, map.get(kw));
    await pool.query(
      `UPDATE spy_keywords SET priority = $3
       WHERE session_id = $1 AND keyword = $2 AND status = 'pending'`,
      [sessionId, kw, priority]
    );
  }
}

async function upsertNicheKeyword(nicho, country, keyword, source = 'ad_text', scoreBoost = 1) {
  const nichoKey = nicho?.trim().toUpperCase();
  const kw = normKw(keyword);
  if (!nichoKey || !kw || kw.length < 4) return null;

  await ensureNicheIntelTable();
  const countryKey = normCountry(country);

  const { rows } = await pool.query(
    `INSERT INTO spy_niche_intel (nicho, country, keyword, source, score, hit_count)
     VALUES ($1, $2, $3, $4, $5, 1)
     ON CONFLICT (nicho, country, keyword)
     DO UPDATE SET
       score = spy_niche_intel.score + EXCLUDED.score,
       hit_count = spy_niche_intel.hit_count + 1,
       last_seen_at = NOW(),
       source = CASE
         WHEN EXCLUDED.source = 'ad_text_relevant' THEN EXCLUDED.source
         WHEN EXCLUDED.source = 'deep' AND spy_niche_intel.source NOT IN ('ad_text_relevant') THEN EXCLUDED.source
         ELSE spy_niche_intel.source
       END
     RETURNING *`,
    [nichoKey, countryKey, kw, source, scoreBoost]
  );
  return rows[0];
}

/**
 * Fecha o ciclo ROI: discoveries importáveis sobem score; zero yield desce / pausa.
 */
async function recordKeywordOutcome(nicho, country, keyword, outcome = {}) {
  const nichoKey = nicho?.trim().toUpperCase();
  const kw = normKw(keyword);
  if (!nichoKey || !kw) return null;

  await ensureNicheIntelTable();
  const countryKey = normCountry(country);

  const adsFound = Math.max(0, parseInt(outcome.adsFound, 10) || 0);
  const relevantCount = Math.max(0, parseInt(outcome.relevantCount, 10) || 0);
  const discoveriesCount = Math.max(0, parseInt(outcome.discoveriesCount, 10) || 0);

  const hasYield = discoveriesCount > 0 || relevantCount > 0;
  const yieldBoost =
    discoveriesCount * 4 + relevantCount * 0.6 + Math.min(adsFound, 800) * 0.015;
  const penalty = hasYield ? 0 : 2.5;

  const scoreDelta = hasYield ? yieldBoost : -penalty;

  const { rows } = await pool.query(
    `INSERT INTO spy_niche_intel (
       nicho, country, keyword, source, score, hit_count,
       sessions_used, discoveries_total, ads_found_total, relevant_ads_total, zero_yield_streak
     ) VALUES ($1, $2, $3, 'session_roi', $4, 1, 1, $5, $6, $7, $8)
     ON CONFLICT (nicho, country, keyword)
     DO UPDATE SET
       sessions_used = spy_niche_intel.sessions_used + 1,
       discoveries_total = spy_niche_intel.discoveries_total + $5,
       ads_found_total = spy_niche_intel.ads_found_total + $6,
       relevant_ads_total = spy_niche_intel.relevant_ads_total + $7,
       zero_yield_streak = CASE WHEN $9 THEN 0 ELSE spy_niche_intel.zero_yield_streak + 1 END,
       score = GREATEST(0.1, spy_niche_intel.score + $10),
       last_seen_at = NOW()
     RETURNING *`,
    [
      nichoKey,
      countryKey,
      kw,
      Math.max(0.1, scoreDelta),
      discoveriesCount,
      adsFound,
      relevantCount,
      hasYield ? 0 : 1,
      hasYield,
      scoreDelta,
    ]
  );

  const row = rows[0];
  if (row) {
    console.log(
      `   📈 Keyword ROI «${kw}»: score ${Number(row.score).toFixed(1)} · discoveries +${discoveriesCount} · streak zero ${row.zero_yield_streak}`
    );
  }
  return row;
}

async function seedNicheKeywords(nicho, country, keywords, source = 'deep') {
  const results = [];
  for (const kw of keywords || []) {
    const row = await upsertNicheKeyword(nicho, country, kw, source, 0.5);
    if (row) results.push(row);
  }
  return results;
}

module.exports = {
  getNicheKeywords,
  getKeywordIntelMap,
  buildKeywordPriority,
  applySessionKeywordPriorities,
  upsertNicheKeyword,
  recordKeywordOutcome,
  seedNicheKeywords,
  ensureNicheIntelTable,
  PAUSE_AFTER_ZERO_YIELDS,
};
