const { pool } = require('./db');
const { parseDiscoveryTargetInput } = require('./spy-ad-limits');
const { withLibraryCountry } = require('./spy-url-builder');

function getMinActiveAds() {
  const n = parseInt(process.env.SPY_MIN_ACTIVE_ADS || '25', 10);
  return Number.isFinite(n) && n >= 1 ? n : 25;
}
const MIN_ACTIVE_ADS = getMinActiveAds();
const SESSION_MAX_HOURS = 8;
const DISCOVERY_TTL_DAYS = 30;

function mapSession(row) {
  if (!row) return null;
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    status: row.status,
    country: row.country,
    language: row.language,
    keywordSeed: row.keyword_seed,
    nicho: row.nicho,
    produto: row.produto,
    pauseSearch: row.pause_search,
    stats: row.stats || {},
    marketIntel: row.stats?.marketIntel || null,
    deepSearchStatus: row.stats?.deepSearchStatus || null,
    errorMessage: row.error_message,
    startedAt: row.started_at,
    endedAt: row.ended_at,
    deadlineAt: row.deadline_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapDiscovery(row) {
  if (!row) return null;
  const card = row.card_data || {};
  return {
    id: row.id,
    sessionId: row.session_id,
    sourceValue: row.source_value,
    pageId: row.page_id,
    name: row.name,
    activeAds: row.active_ads,
    cardData: card,
    adAssets: row.ad_assets || [],
    keywordOrigin: row.keyword_origin,
    relevanceScore: row.relevance_score,
    alreadyImported: row.already_imported,
    importedLibraryId: row.imported_library_id,
    expiresAt: row.expires_at,
    createdAt: row.created_at,
    ...card,
  };
}

function buildAutoSessionName({ country, language, nicho, keywordSeed, produto }) {
  const parts = [country, language, nicho, keywordSeed, produto].filter(Boolean);
  const label = parts.length ? parts.join(' · ') : 'Pesquisa SPY';
  const date = new Date().toLocaleDateString('pt-PT');
  return `${label} — ${date}`;
}

async function createSpySession(userId, params) {
  const name = params.name?.trim() || buildAutoSessionName(params);
  const maxHours = parseInt(params.maxHours, 10);
  const sessionHours = Number.isFinite(maxHours) && maxHours >= 1 && maxHours <= 24 ? maxHours : SESSION_MAX_HOURS;
  const deadline = new Date(Date.now() + sessionHours * 60 * 60 * 1000);
  const discoveryTarget = parseDiscoveryTargetInput(
    params.discoveryTarget ?? params.maxAdsLimit
  );

  const stats = {
    adsScanned: 0,
    adsRelevant: 0,
    librariesChecked: 0,
    discoveriesCount: 0,
    keywordsQueued: 0,
    keywordsDone: 0,
    discoveryTarget:
      params.discoveryTarget === 'unlimited' ||
      params.maxAdsLimit === 'unlimited' ||
      discoveryTarget === null
        ? 'unlimited'
        : discoveryTarget,
  };

  const minActiveAds = parseInt(params.minActiveAds, 10);
  if (Number.isFinite(minActiveAds) && minActiveAds >= 1) {
    stats.minActiveAds = minActiveAds;
  }

  const minDaysActive = parseInt(params.minDaysActive, 10);
  const maxDaysActive = parseInt(params.maxDaysActive, 10);
  if (Number.isFinite(minDaysActive) && minDaysActive >= 0) {
    stats.minDaysActive = minDaysActive;
  }
  if (Number.isFinite(maxDaysActive) && maxDaysActive >= 0) {
    stats.maxDaysActive = maxDaysActive;
  }

  if (params.marketIntel?.keywords?.length) {
    stats.marketIntel = params.marketIntel;
    stats.deepSearchStatus = 'done';
    stats.keywordsPreApproved = true;
    if (params.consultantBrief?.trim()) stats.consultantBrief = params.consultantBrief.trim();
  }

  const mobilePlatform = String(params.mobilePlatform || '').toLowerCase();
  if (
    mobilePlatform === 'mac' ||
    mobilePlatform === 'windows' ||
    mobilePlatform === 'ipad' ||
    mobilePlatform === 'iphone'
  ) {
    stats.mobilePlatform = mobilePlatform;
  }

  const { rows } = await pool.query(
    `INSERT INTO spy_sessions (
      user_id, name, status, country, language, keyword_seed, nicho, produto, deadline_at, stats
    ) VALUES ($1,$2,'queued',$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
    [
      userId,
      name,
      params.country || null,
      params.language || null,
      params.keywordSeed || null,
      params.nicho || null,
      params.produto || null,
      deadline,
      JSON.stringify(stats),
    ]
  );
  return mapSession(rows[0]);
}

async function listSpySessions(userId) {
  const { rows } = await pool.query(
    `SELECT s.*,
      (SELECT COUNT(*)::int FROM spy_discoveries d WHERE d.session_id = s.id) AS discoveries_count
     FROM spy_sessions s
     WHERE s.user_id = $1
     ORDER BY s.created_at DESC`,
    [userId]
  );
  return rows.map((r) => ({
    ...mapSession(r),
    discoveriesCount: r.discoveries_count,
  }));
}

async function getSpySession(sessionId, userId) {
  const { rows } = await pool.query(
    'SELECT * FROM spy_sessions WHERE id = $1 AND user_id = $2',
    [sessionId, userId]
  );
  return mapSession(rows[0]);
}

async function updateSessionStatus(sessionId, patch) {
  const fields = [];
  const values = [];
  let i = 1;

  for (const [key, col] of [
    ['status', 'status'],
    ['pauseSearch', 'pause_search'],
    ['stats', 'stats'],
    ['errorMessage', 'error_message'],
    ['startedAt', 'started_at'],
    ['endedAt', 'ended_at'],
  ]) {
    if (patch[key] !== undefined) {
      fields.push(`${col} = $${i++}`);
      values.push(key === 'stats' ? JSON.stringify(patch[key]) : patch[key]);
    }
  }

  if (!fields.length) return null;
  values.push(sessionId);

  const { rows } = await pool.query(
    `UPDATE spy_sessions SET ${fields.join(', ')} WHERE id = $${i} RETURNING *`,
    values
  );
  return mapSession(rows[0]);
}

async function deleteSpySession(sessionId, userId) {
  const { rowCount } = await pool.query(
    'DELETE FROM spy_sessions WHERE id = $1 AND user_id = $2',
    [sessionId, userId]
  );
  return rowCount > 0;
}

let _keywordSchemaReady = false;
async function ensureKeywordSchema() {
  if (_keywordSchemaReady) return;
  // Migração idempotente: priority + country, e índice único (session, keyword, country)
  // a substituir o antigo UNIQUE(session_id, keyword) — permite fan-out keyword×país (Language Sweep).
  await pool.query(`
    ALTER TABLE spy_keywords ADD COLUMN IF NOT EXISTS priority REAL NOT NULL DEFAULT 0
  `).catch(() => {});
  await pool.query(`
    ALTER TABLE spy_keywords ADD COLUMN IF NOT EXISTS country TEXT NOT NULL DEFAULT ''
  `).catch(() => {});
  await pool.query(`
    ALTER TABLE spy_keywords DROP CONSTRAINT IF EXISTS spy_keywords_session_id_keyword_key
  `).catch(() => {});
  await pool.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_spy_keywords_session_kw_country
      ON spy_keywords (session_id, keyword, country)
  `).catch(() => {});
  _keywordSchemaReady = true;
}

async function addKeyword(sessionId, keyword, source = 'seed', priority = 0, country = '') {
  const kw = keyword.trim().toLowerCase();
  if (!kw) return null;
  await ensureKeywordSchema();
  const cc = String(country || '').trim().toUpperCase();
  const { rows } = await pool.query(
    `INSERT INTO spy_keywords (session_id, keyword, source, priority, country)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (session_id, keyword, country) DO NOTHING
     RETURNING *`,
    [sessionId, kw, source, priority, cc]
  );
  return rows[0] || null;
}

async function getNextKeyword(sessionId) {
  const { rows } = await pool.query(
    `SELECT * FROM spy_keywords
     WHERE session_id = $1 AND status = 'pending' AND priority > -500
     ORDER BY priority DESC, created_at ASC
     LIMIT 1`,
    [sessionId]
  );
  return rows[0] || null;
}

async function markKeyword(sessionId, keyword, status, adsFound = 0, extra = {}) {
  const relevant = extra.relevantCount ?? extra.adsRelevant ?? 0;
  const discoveries = extra.discoveriesCount ?? 0;
  // country opcional: com Language Sweep a mesma keyword existe por vários países,
  // por isso a transição de estado deve afectar só a linha do país em causa.
  const country = extra.country != null ? String(extra.country).trim().toUpperCase() : null;
  await pool.query(
    `UPDATE spy_keywords SET
       status = $3,
       ads_found = $4,
       ads_relevant = COALESCE($5, ads_relevant),
       discoveries_count = COALESCE($6, discoveries_count)
     WHERE session_id = $1 AND keyword = $2
       AND ($7::text IS NULL OR country = $7)`,
    [sessionId, keyword, status, adsFound, relevant, discoveries, country]
  );
}

/**
 * Language Sweep — impõe ordem country-major na fila: todas as keywords do país[0]
 * são pesquisadas antes do país[1], etc. Soma um offset grande à priority por país,
 * preservando a ordem DR (priority) dentro de cada país. Keywords pausadas
 * (priority <= -500) ficam intactas para não serem reativadas.
 */
async function applySweepCountryOrder(sessionId, orderedCountries) {
  if (!sessionId || !Array.isArray(orderedCountries) || orderedCountries.length < 2) return;
  const STEP = 100000;
  for (let i = 0; i < orderedCountries.length; i++) {
    const cc = orderedCountries[i] === 'ALL' ? '' : String(orderedCountries[i]).toUpperCase();
    const offset = (orderedCountries.length - i) * STEP;
    await pool.query(
      `UPDATE spy_keywords SET priority = priority + $3
       WHERE session_id = $1 AND country = $2 AND status = 'pending' AND priority > -500`,
      [sessionId, cc, offset]
    ).catch(() => {});
  }
}

async function countKeywordDiscoveries(sessionId, keyword) {
  const { rows } = await pool.query(
    `SELECT count(*)::int AS n FROM spy_discoveries
     WHERE session_id = $1 AND lower(keyword_origin) = lower($2)`,
    [sessionId, keyword]
  );
  return rows[0]?.n || 0;
}

async function saveAdCandidate(data) {
  const { rows } = await pool.query(
    `INSERT INTO spy_ad_candidates (
      session_id, keyword_id, library_url, page_id, ad_text, image_url, video_url,
      landing_url, relevance_score, relevance_reason, status, raw_data,
      meta_ad_id, headline, thumbnail_url, ad_started_at, ad_status, scrape_phase, meta_details
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)
    RETURNING *`,
    [
      data.sessionId,
      data.keywordId || null,
      data.libraryUrl || null,
      data.pageId || null,
      data.adText || null,
      data.imageUrl || null,
      data.videoUrl || null,
      data.landingUrl || null,
      data.relevanceScore ?? null,
      data.relevanceReason || null,
      data.status || 'pending',
      JSON.stringify(data.rawData || {}),
      data.metaAdId || null,
      data.headline || null,
      data.thumbnailUrl || null,
      data.adStartedAt || null,
      data.adStatus || null,
      data.scrapePhase || null,
      JSON.stringify(data.metaDetails || {}),
    ]
  );
  return rows[0];
}

async function libraryExistsGlobally(sourceValue, hints = {}) {
  const { findExistingLibrary } = require('./library-source-key');
  const hit = await findExistingLibrary(pool, sourceValue, hints);
  return hit?.library?.id || null;
}

async function discoveryExistsInSession(sessionId, sourceValue, pageId = null) {
  // Dedup por source_value (URL) OU page_id — evita duplicados mesmo quando a URL
  // vem com parâmetros ligeiramente diferentes (ex: country=BR vs country=ALL).
  const cleanPageId = pageId ? String(pageId).replace(/\D/g, '') : null;
  if (cleanPageId) {
    const { rows } = await pool.query(
      `SELECT id FROM spy_discoveries
       WHERE session_id = $1 AND (source_value = $2 OR page_id = $3)
       LIMIT 1`,
      [sessionId, sourceValue, cleanPageId]
    );
    return !!rows[0];
  }
  const { rows } = await pool.query(
    'SELECT id FROM spy_discoveries WHERE session_id = $1 AND source_value = $2 LIMIT 1',
    [sessionId, sourceValue]
  );
  return !!rows[0];
}

async function saveDiscovery(sessionId, draft, meta = {}) {
  const expiresAt = new Date(Date.now() + DISCOVERY_TTL_DAYS * 24 * 60 * 60 * 1000);

  // O enrich é assíncrono — a sessão pode ter sido apagada/cancelada entretanto.
  // Validar existência antes do insert evita o erro de foreign key (23503).
  const sessionRow = await pool.query('SELECT country FROM spy_sessions WHERE id = $1', [sessionId]);
  if (!sessionRow.rows.length) {
    console.warn(`⚠️ SPY saveDiscovery: sessão ${sessionId} já não existe — discovery descartado`);
    return null;
  }

  const sessionCountry = sessionRow.rows[0]?.country;
  if (sessionCountry && draft.sourceValue) {
    draft.sourceValue = withLibraryCountry(draft.sourceValue, sessionCountry);
    if (Array.isArray(draft.pages) && draft.pages.length) {
      draft.pages = draft.pages.map((u) => withLibraryCountry(u, sessionCountry));
    }
  }

  const existingLibId = await libraryExistsGlobally(draft.sourceValue, {
    country: sessionCountry,
  });
  const newAssets = JSON.stringify(meta.adAssets || []);

  try {
    const { rows } = await pool.query(
      `INSERT INTO spy_discoveries (
        session_id, source_value, page_id, name, active_ads, card_data, ad_assets,
        keyword_origin, relevance_score, already_imported, imported_library_id, expires_at
      ) VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8,$9,$10,$11,$12)
      ON CONFLICT (session_id, source_value) DO UPDATE SET
        name = EXCLUDED.name,
        active_ads = GREATEST(spy_discoveries.active_ads, EXCLUDED.active_ads),
        card_data = EXCLUDED.card_data,
        ad_assets = (
          SELECT COALESCE(jsonb_agg(DISTINCT elem), '[]'::jsonb)
          FROM (
            SELECT jsonb_array_elements(COALESCE(spy_discoveries.ad_assets, '[]'::jsonb)) AS elem
            UNION ALL
            SELECT jsonb_array_elements(COALESCE(EXCLUDED.ad_assets, '[]'::jsonb)) AS elem
          ) merged
        ),
        relevance_score = GREATEST(COALESCE(spy_discoveries.relevance_score, 0), COALESCE(EXCLUDED.relevance_score, 0)),
        keyword_origin = COALESCE(spy_discoveries.keyword_origin, EXCLUDED.keyword_origin)
      RETURNING *`,
      [
        sessionId,
        draft.sourceValue,
        meta.pageId || draft.analysis?.pageId || null,
        draft.name,
        draft.activeAdsEstimate || draft.activeAds || 0,
        JSON.stringify(draft),
        newAssets,
        meta.keywordOrigin || null,
        meta.relevanceScore ?? null,
        !!existingLibId,
        existingLibId,
        expiresAt,
      ]
    );
    return mapDiscovery(rows[0]);
  } catch (err) {
    // 23503 = foreign_key_violation (sessão desapareceu entre a verificação e o insert)
    if (err.code === '23503') {
      console.warn(`⚠️ SPY saveDiscovery FK: sessão ${sessionId} não existe — discovery descartado`);
      return null;
    }
    throw err;
  }
}

async function markDiscoveryImported(discoveryId, libraryId) {
  await pool.query(
    `UPDATE spy_discoveries
     SET already_imported = true, imported_library_id = $2
     WHERE id = $1`,
    [discoveryId, libraryId]
  );
}

async function listCopyBank(sessionId, filters = {}) {
  const conditions = ['session_id = $1'];
  const params = [sessionId];
  let idx = 2;

  if (filters.q?.trim()) {
    conditions.push(`(name ILIKE $${idx} OR ad_assets::text ILIKE $${idx})`);
    params.push(`%${filters.q.trim()}%`);
    idx++;
  }

  const { rows } = await pool.query(
    `SELECT id, name, source_value, keyword_origin, ad_assets, created_at
     FROM spy_discoveries
     WHERE ${conditions.join(' AND ')}
     ORDER BY created_at DESC`,
    params
  );

  const items = [];
  for (const row of rows) {
    const assets = row.ad_assets || [];
    assets.forEach((asset, assetIdx) => {
      if (!asset?.adText && !asset?.imageUrl && !asset?.videoUrl) return;
      items.push({
        id: `${row.id}-${assetIdx}`,
        discoveryId: row.id,
        libraryName: row.name,
        sourceValue: row.source_value,
        keywordOrigin: row.keyword_origin,
        createdAt: row.created_at,
        ...asset,
      });
    });
  }
  return items;
}

function getSpyIntegrationsStatus() {
  const openRouter = !!(process.env.OPENROUTER_API_KEY || process.env.SPY_AI_API_KEY);
  return {
    smtp: !!process.env.SMTP_HOST && !!process.env.SMTP_USER && !!process.env.SMTP_PASS,
    ai: openRouter,
    openRouter,
    notifyEmail: process.env.SPY_NOTIFY_EMAIL || 'geral.joaoecoom@gmail.com',
    aiModel: process.env.SPY_ANALYSIS_MODEL || 'google/gemini-2.0-flash-001',
    whisperModel: process.env.SPY_WHISPER_MODEL || 'openai/whisper-1',
    ffmpeg: true,
  };
}

async function listDiscoveries(sessionId, filters = {}) {
  const conditions = ['session_id = $1'];
  const params = [sessionId];
  let idx = 2;

  if (filters.alreadyImported === 'true') {
    conditions.push('already_imported = true');
  } else if (filters.alreadyImported === 'false') {
    conditions.push('already_imported = false');
  }
  if (filters.minAds) {
    conditions.push(`active_ads >= $${idx++}`);
    params.push(parseInt(filters.minAds, 10));
  }
  if (filters.q?.trim() && filters.q !== 'undefined') {
    conditions.push(`name ILIKE $${idx++}`);
    params.push(`%${filters.q.trim()}%`);
  }
  if (filters.nicho?.trim() && filters.nicho !== 'undefined') {
    conditions.push(`(card_data->>'nichos' ILIKE $${idx} OR name ILIKE $${idx})`);
    params.push(`%${filters.nicho.trim()}%`);
    idx++;
  }
  if (filters.produto?.trim() && filters.produto !== 'undefined') {
    conditions.push(`(card_data->>'produtos' ILIKE $${idx} OR card_data->>'produto' ILIKE $${idx})`);
    params.push(`%${filters.produto.trim()}%`);
    idx++;
  }

  const order = filters.order === 'ads_asc' ? 'active_ads ASC' : 'active_ads DESC';

  const { rows } = await pool.query(
    `SELECT * FROM spy_discoveries WHERE ${conditions.join(' AND ')} ORDER BY ${order}`,
    params
  );
  return rows.map(mapDiscovery);
}

async function getDiscovery(discoveryId, userId) {
  const { rows } = await pool.query(
    `SELECT d.* FROM spy_discoveries d
     JOIN spy_sessions s ON s.id = d.session_id
     WHERE d.id = $1 AND s.user_id = $2`,
    [discoveryId, userId]
  );
  return mapDiscovery(rows[0]);
}

async function deleteDiscovery(discoveryId, userId) {
  const { rowCount } = await pool.query(
    `DELETE FROM spy_discoveries d
     USING spy_sessions s
     WHERE d.id = $1 AND d.session_id = s.id AND s.user_id = $2`,
    [discoveryId, userId]
  );
  return rowCount > 0;
}

async function deleteDiscoveryInSession(sessionId, discoveryId, userId) {
  const { rowCount } = await pool.query(
    `DELETE FROM spy_discoveries d
     USING spy_sessions s
     WHERE d.id = $1 AND d.session_id = $2 AND s.id = d.session_id AND s.user_id = $3`,
    [discoveryId, sessionId, userId]
  );
  return rowCount > 0;
}

async function incrementSessionStats(sessionId, delta) {
  const { rows } = await pool.query('SELECT stats FROM spy_sessions WHERE id = $1', [sessionId]);
  const stats = { ...(rows[0]?.stats || {}) };
  for (const [k, v] of Object.entries(delta)) {
    stats[k] = (stats[k] || 0) + v;
  }
  return updateSessionStatus(sessionId, { stats });
}

async function patchSessionStats(sessionId, patch) {
  const { rows } = await pool.query('SELECT stats FROM spy_sessions WHERE id = $1', [sessionId]);
  const stats = { ...(rows[0]?.stats || {}), ...patch };
  return updateSessionStatus(sessionId, { stats });
}

async function addLearnedTerm(sessionId, term, context = {}, score = 1) {
  const t = term.trim().toLowerCase();
  if (!t || t.length < 3) return false;
  const { rowCount } = await pool.query(
    `UPDATE spy_learned_terms SET score = GREATEST(score, $4), context = $3::jsonb
     WHERE session_id = $1 AND term = $2`,
    [sessionId, t, JSON.stringify(context), score]
  );
  if (rowCount) return true;
  await pool.query(
    `INSERT INTO spy_learned_terms (session_id, term, context, score) VALUES ($1,$2,$3::jsonb,$4)`,
    [sessionId, t, JSON.stringify(context), score]
  );
  return true;
}

async function countPendingManualKeywords(sessionId) {
  const { rows } = await pool.query(
    `SELECT count(*)::int AS n FROM spy_keywords
     WHERE session_id = $1 AND status = 'pending'
       AND source <> 'learned' AND priority > -500`,
    [sessionId]
  );
  return rows[0]?.n || 0;
}

async function countManualDiscoveries(sessionId) {
  const { rows } = await pool.query(
    `SELECT COALESCE(SUM(discoveries_count), 0)::int AS n
     FROM spy_keywords
     WHERE session_id = $1 AND source <> 'learned'`,
    [sessionId]
  );
  return rows[0]?.n || 0;
}

/** Depois das keywords manuais/deep — mete candidatas DR na fila com prioridade baixa. */
async function flushLearnedTermsToQueue(sessionId, country = '', max = 15) {
  const cc = String(country || '').trim().toUpperCase();
  const { rows } = await pool.query(
    `SELECT term, score FROM spy_learned_terms
     WHERE session_id = $1
     ORDER BY score DESC
     LIMIT $2`,
    [sessionId, max]
  );
  if (!rows.length) return 0;
  let queued = 0;
  for (const row of rows) {
    const added = await addKeyword(sessionId, row.term, 'learned', -100, cc);
    if (added) queued++;
  }
  if (queued) {
    await pool.query(`DELETE FROM spy_learned_terms WHERE session_id = $1`, [sessionId]);
  }
  return queued;
}

async function getRunningSessions() {
  const { rows } = await pool.query(
    `SELECT * FROM spy_sessions WHERE status IN ('queued', 'running') ORDER BY created_at ASC`
  );
  return rows.map(mapSession);
}

module.exports = {
  MIN_ACTIVE_ADS,
  getMinActiveAds,
  SESSION_MAX_HOURS,
  DISCOVERY_TTL_DAYS,
  createSpySession,
  listSpySessions,
  getSpySession,
  updateSessionStatus,
  deleteSpySession,
  addKeyword,
  getNextKeyword,
  markKeyword,
  countKeywordDiscoveries,
  applySweepCountryOrder,
  saveAdCandidate,
  libraryExistsGlobally,
  discoveryExistsInSession,
  saveDiscovery,
  listDiscoveries,
  getDiscovery,
  deleteDiscovery,
  deleteDiscoveryInSession,
  markDiscoveryImported,
  listCopyBank,
  getSpyIntegrationsStatus,
  incrementSessionStats,
  patchSessionStats,
  addLearnedTerm,
  countPendingManualKeywords,
  countManualDiscoveries,
  flushLearnedTermsToQueue,
  getRunningSessions,
  mapSession,
  mapDiscovery,
};
