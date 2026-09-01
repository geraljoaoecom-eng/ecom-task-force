const { pool } = require('./db');
const {
  computeDaysActive,
  parseMetaStartDate,
  isEligibleForCopy,
  computeRankScore,
} = require('./copy-eligibility');

async function ensureCopyTables() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS library_copy_jobs (
      id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      library_id TEXT NOT NULL REFERENCES libraries(id) ON DELETE CASCADE,
      status TEXT NOT NULL DEFAULT 'queued',
      error_message TEXT,
      ads_scanned INTEGER NOT NULL DEFAULT 0,
      ads_eligible INTEGER NOT NULL DEFAULT 0,
      copies_created INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      started_at TIMESTAMP WITH TIME ZONE,
      completed_at TIMESTAMP WITH TIME ZONE,
      UNIQUE (library_id)
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS library_ads (
      id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      library_id TEXT NOT NULL REFERENCES libraries(id) ON DELETE CASCADE,
      meta_ad_id TEXT NOT NULL,
      page_id TEXT,
      page_name TEXT,
      headline TEXT,
      body_text TEXT,
      media_type TEXT NOT NULL DEFAULT 'unknown',
      video_url TEXT,
      image_url TEXT,
      image_local_path TEXT,
      landing_url TEXT,
      library_url TEXT,
      started_at TIMESTAMP WITH TIME ZONE,
      ended_at TIMESTAMP WITH TIME ZONE,
      first_seen_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      last_seen_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      days_active INTEGER NOT NULL DEFAULT 0,
      duplicate_count INTEGER NOT NULL DEFAULT 1,
      is_active BOOLEAN NOT NULL DEFAULT true,
      creative_hash TEXT,
      eligible_for_copy BOOLEAN NOT NULL DEFAULT false,
      filter_reason TEXT,
      pipeline_status TEXT NOT NULL DEFAULT 'tracked',
      transcript TEXT,
      ai_analysis JSONB DEFAULT '{}',
      raw_metadata JSONB DEFAULT '{}',
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      UNIQUE (library_id, meta_ad_id)
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS copy_vault (
      id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      library_id TEXT NOT NULL REFERENCES libraries(id) ON DELETE CASCADE,
      library_ad_id TEXT NOT NULL REFERENCES library_ads(id) ON DELETE CASCADE,
      language TEXT NOT NULL DEFAULT '',
      nicho TEXT NOT NULL DEFAULT '',
      produto TEXT NOT NULL DEFAULT '',
      headline TEXT,
      body_text TEXT,
      transcript TEXT,
      media_type TEXT,
      image_path TEXT,
      video_url TEXT,
      landing_url TEXT,
      library_url TEXT,
      meta_ad_id TEXT,
      page_name TEXT,
      days_active INTEGER NOT NULL DEFAULT 0,
      duplicate_count INTEGER NOT NULL DEFAULT 0,
      rank_score REAL NOT NULL DEFAULT 0,
      active_ads_snapshot INTEGER NOT NULL DEFAULT 0,
      ai_analysis JSONB DEFAULT '{}',
      pipeline_status TEXT NOT NULL DEFAULT 'pending_ai',
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      UNIQUE (library_ad_id)
    )
  `);
  // started_at: data de início do anúncio (para filtros temporais / sazonalidade no swipe)
  await pool.query(`ALTER TABLE copy_vault ADD COLUMN IF NOT EXISTS started_at TIMESTAMP WITH TIME ZONE`).catch(() => {});
}

function mapLibraryRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    sourceValue: row.source_value,
    nichos: row.nichos,
    produtos: row.produtos,
    idiomas: row.idiomas,
    paises: row.paises,
    activeAds: row.active_ads,
  };
}

function taxonomyFromLibrary(lib) {
  const language = (lib.idiomas || lib.language || '').split(/[,;|]/)[0]?.trim() || '';
  const nicho = (lib.nichos || '').split(/[,;|]/)[0]?.trim().toUpperCase() || '';
  const produto = (lib.produtos || '').split(/[,;|]/)[0]?.trim().toUpperCase() || '';
  return {
    language: language || 'pt',
    nicho,
    produto,
  };
}

async function getLibraryForCopy(libraryId) {
  const { rows } = await pool.query('SELECT * FROM libraries WHERE id = $1', [libraryId]);
  return mapLibraryRow(rows[0]);
}

async function upsertCopyJob(libraryId, patch = {}) {
  await ensureCopyTables();
  const { rows } = await pool.query(
    `INSERT INTO library_copy_jobs (library_id, status)
     VALUES ($1, 'queued')
     ON CONFLICT (library_id) DO UPDATE SET
       status = CASE
         WHEN library_copy_jobs.status IN ('scanning', 'processing') THEN library_copy_jobs.status
         ELSE COALESCE($2, 'queued')
       END,
       error_message = COALESCE($3, library_copy_jobs.error_message),
       created_at = CASE
         WHEN library_copy_jobs.status = 'done' THEN NOW()
         ELSE library_copy_jobs.created_at
       END
     RETURNING *`,
    [libraryId, patch.status || 'queued', patch.errorMessage || null]
  );
  return rows[0];
}

async function updateCopyJob(libraryId, fields) {
  const sets = [];
  const vals = [libraryId];
  let i = 2;
  for (const [k, v] of Object.entries(fields)) {
    sets.push(`${k} = $${i++}`);
    vals.push(v);
  }
  if (!sets.length) return;
  await pool.query(`UPDATE library_copy_jobs SET ${sets.join(', ')} WHERE library_id = $1`, vals);
}

async function upsertLibraryAd(libraryId, ad, { duplicateCount, creativeHash }) {
  const startedAt = parseMetaStartDate(ad.startDate);
  const endedAt = ad.endDate ? parseMetaStartDate(ad.endDate) : null;
  const isActive = ad.isActive !== false;
  const daysActive = computeDaysActive(startedAt, isActive, endedAt);
  const { eligible, reason } = isEligibleForCopy(daysActive, duplicateCount);

  const mediaType = ad.videoUrl ? 'video' : ad.thumbnailUrl || ad.image_url ? 'image' : 'text';

  const { rows } = await pool.query(
    `INSERT INTO library_ads (
       library_id, meta_ad_id, page_id, page_name, headline, body_text, media_type,
       video_url, image_url, landing_url, library_url, started_at, last_seen_at,
       days_active, duplicate_count, is_active, creative_hash, eligible_for_copy,
       filter_reason, pipeline_status, raw_metadata
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,NOW(),$13,$14,$15,$16,$17,$18,$19,$20::jsonb)
     ON CONFLICT (library_id, meta_ad_id) DO UPDATE SET
       page_name = COALESCE(EXCLUDED.page_name, library_ads.page_name),
       headline = COALESCE(EXCLUDED.headline, library_ads.headline),
       body_text = COALESCE(EXCLUDED.body_text, library_ads.body_text),
       video_url = COALESCE(EXCLUDED.video_url, library_ads.video_url),
       image_url = COALESCE(EXCLUDED.image_url, library_ads.image_url),
       landing_url = COALESCE(EXCLUDED.landing_url, library_ads.landing_url),
       started_at = COALESCE(library_ads.started_at, EXCLUDED.started_at),
       last_seen_at = NOW(),
       days_active = EXCLUDED.days_active,
       duplicate_count = GREATEST(library_ads.duplicate_count, EXCLUDED.duplicate_count),
       is_active = EXCLUDED.is_active,
       ended_at = CASE WHEN EXCLUDED.is_active THEN NULL ELSE COALESCE(library_ads.ended_at, NOW()) END,
       eligible_for_copy = EXCLUDED.eligible_for_copy,
       filter_reason = EXCLUDED.filter_reason,
       pipeline_status = CASE
         WHEN EXCLUDED.eligible_for_copy THEN COALESCE(NULLIF(library_ads.pipeline_status, 'tracked'), 'eligible')
         ELSE library_ads.pipeline_status
       END,
       raw_metadata = EXCLUDED.raw_metadata,
       updated_at = NOW()
     RETURNING *`,
    [
      libraryId,
      ad.adId,
      ad.pageId || null,
      ad.pageName || null,
      ad.headline || null,
      ad.bodyText || ad.headline || null,
      mediaType,
      ad.videoUrl || null,
      ad.thumbnailUrl || ad.image_url || null,
      ad.landingUrl || null,
      ad.libraryUrl || null,
      startedAt,
      daysActive,
      duplicateCount,
      isActive,
      creativeHash,
      eligible,
      reason,
      eligible ? 'eligible' : 'tracked',
      JSON.stringify(ad.rawMetadata || {}),
    ]
  );
  return rows[0];
}

async function updateLibraryAdImagePath(libraryAdId, imageLocalPath) {
  await pool.query(
    `UPDATE library_ads SET image_local_path = $2, updated_at = NOW() WHERE id = $1`,
    [libraryAdId, imageLocalPath]
  );
}

/**
 * Marca como inativos os ads da biblioteca que NÃO apareceram no último scan
 * (deixaram de estar ativos na Meta). Congela days_active em started_at→ended_at.
 * @returns {number} nº de ads marcados inativos
 */
async function markMissingAdsInactive(libraryId, seenAdIds = []) {
  const seen = (seenAdIds || []).filter(Boolean);
  const { rows } = await pool.query(
    `UPDATE library_ads
       SET is_active = false,
           ended_at = COALESCE(ended_at, NOW()),
           days_active = CASE
             WHEN started_at IS NOT NULL
             THEN GREATEST(0, FLOOR(EXTRACT(EPOCH FROM (COALESCE(ended_at, NOW()) - started_at)) / 86400))
             ELSE days_active END,
           updated_at = NOW()
     WHERE library_id = $1
       AND is_active = true
       AND ($2::text[] IS NULL OR meta_ad_id <> ALL($2::text[]))
     RETURNING id`,
    [libraryId, seen.length ? seen : []]
  );
  return rows.length;
}

async function upsertCopyVaultFromLibraryAd(libraryAdRow, library) {
  if (!libraryAdRow.eligible_for_copy) return null;

  const tax = taxonomyFromLibrary(library);
  const rankScore = computeRankScore(
    libraryAdRow.days_active,
    libraryAdRow.duplicate_count,
    library.activeAds
  );

  const { rows } = await pool.query(
    `INSERT INTO copy_vault (
       library_id, library_ad_id, language, nicho, produto,
       headline, body_text, media_type, image_path, video_url, landing_url,
       library_url, meta_ad_id, page_name, days_active, duplicate_count,
       rank_score, active_ads_snapshot, started_at, pipeline_status
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,'pending_ai')
     ON CONFLICT (library_ad_id) DO UPDATE SET
       days_active = EXCLUDED.days_active,
       duplicate_count = EXCLUDED.duplicate_count,
       rank_score = EXCLUDED.rank_score,
       active_ads_snapshot = EXCLUDED.active_ads_snapshot,
       started_at = COALESCE(EXCLUDED.started_at, copy_vault.started_at),
       image_path = COALESCE(EXCLUDED.image_path, copy_vault.image_path),
       headline = COALESCE(EXCLUDED.headline, copy_vault.headline),
       body_text = COALESCE(EXCLUDED.body_text, copy_vault.body_text),
       updated_at = NOW()
     RETURNING *`,
    [
      library.id,
      libraryAdRow.id,
      tax.language,
      tax.nicho,
      tax.produto,
      libraryAdRow.headline,
      libraryAdRow.body_text,
      libraryAdRow.media_type,
      libraryAdRow.image_local_path,
      libraryAdRow.video_url,
      libraryAdRow.landing_url,
      library.sourceValue,
      libraryAdRow.meta_ad_id,
      libraryAdRow.page_name,
      libraryAdRow.days_active,
      libraryAdRow.duplicate_count,
      rankScore,
      library.activeAds || 0,
      libraryAdRow.started_at || null,
    ]
  );
  return rows[0];
}

async function listCopyVault(filters = {}) {
  await ensureCopyTables();
  const conditions = ['1=1'];
  const params = [];
  let idx = 1;

  if (filters.language) {
    conditions.push(`LOWER(language) = LOWER($${idx++})`);
    params.push(filters.language);
  }
  if (filters.nicho) {
    conditions.push(`UPPER(nicho) = UPPER($${idx++})`);
    params.push(filters.nicho);
  }
  if (filters.produto) {
    conditions.push(`UPPER(produto) = UPPER($${idx++})`);
    params.push(filters.produto);
  }
  if (filters.q?.trim()) {
    conditions.push(
      `(body_text ILIKE $${idx} OR headline ILIKE $${idx} OR page_name ILIKE $${idx})`
    );
    params.push(`%${filters.q.trim()}%`);
    idx++;
  }
  // Filtro temporal por started_at (data de início do anúncio) — sazonalidade no swipe.
  // range: 7d | 30d | 90d | year ; ou datas custom from/to (YYYY-MM-DD).
  const rangeDays = { '7d': 7, '30d': 30, '90d': 90, year: 365 }[filters.range];
  if (rangeDays) {
    conditions.push(`started_at >= NOW() - ($${idx++} || ' days')::interval`);
    params.push(String(rangeDays));
  }
  if (filters.from) {
    conditions.push(`started_at >= $${idx++}::date`);
    params.push(filters.from);
  }
  if (filters.to) {
    conditions.push(`started_at < ($${idx++}::date + interval '1 day')`);
    params.push(filters.to);
  }

  const sortMap = {
    rank: 'rank_score DESC, duplicate_count DESC, days_active DESC',
    duplicates: 'duplicate_count DESC, days_active DESC',
    days: 'days_active DESC, duplicate_count DESC',
    recent: 'created_at DESC',
  };
  const order = sortMap[filters.sort] || sortMap.rank;
  const limit = Math.min(parseInt(filters.limit || '100', 10) || 100, 500);
  const offset = parseInt(filters.offset || '0', 10) || 0;

  const { rows } = await pool.query(
    `SELECT * FROM copy_vault WHERE ${conditions.join(' AND ')}
     ORDER BY ${order}
     LIMIT $${idx++} OFFSET $${idx++}`,
    [...params, limit, offset]
  );

  const { rows: countRows } = await pool.query(
    `SELECT count(*)::int AS c FROM copy_vault WHERE ${conditions.join(' AND ')}`,
    params
  );

  return { items: rows, total: countRows[0]?.c || 0 };
}

async function getCopyTaxonomyTree() {
  await ensureCopyTables();
  const { rows } = await pool.query(
    `SELECT language, nicho, produto, count(*)::int AS cnt
     FROM copy_vault
     GROUP BY language, nicho, produto
     ORDER BY language, nicho, produto`
  );
  return rows;
}

async function getCopyRankings(type = 'hot', limit = 20) {
  await ensureCopyTables();
  const lim = Math.min(limit, 50);
  let order = 'rank_score DESC';
  if (type === 'duplicates') order = 'duplicate_count DESC, days_active DESC';
  if (type === 'days') order = 'days_active DESC, duplicate_count DESC';
  if (type === 'library_ads') order = 'active_ads_snapshot DESC, rank_score DESC';

  const { rows } = await pool.query(
    `SELECT * FROM copy_vault ORDER BY ${order} LIMIT $1`,
    [lim]
  );
  return rows;
}

async function getCopyJobStatus(libraryId) {
  const { rows } = await pool.query(
    `SELECT * FROM library_copy_jobs WHERE library_id = $1`,
    [libraryId]
  );
  return rows[0] || null;
}

module.exports = {
  ensureCopyTables,
  getLibraryForCopy,
  upsertCopyJob,
  updateCopyJob,
  upsertLibraryAd,
  updateLibraryAdImagePath,
  markMissingAdsInactive,
  upsertCopyVaultFromLibraryAd,
  listCopyVault,
  getCopyTaxonomyTree,
  getCopyRankings,
  getCopyJobStatus,
  taxonomyFromLibrary,
};
