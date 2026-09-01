/**
 * Memória persistente de páginas Meta (ouro / rejeitadas) — entre sessões SPY.
 */
const { pool } = require('./db');

const IMPORTED_TIER = 'imported';
const GOLD_TIER = 'gold';
const REJECT_TIER = 'rejected';
const IMPORTED_SCORE = 0.99;
const GOLD_MIN_SCORE = 0.55;
const IMPORTED_MIN_SCORE = 0.9;
const CACHE_MAX_AGE_DAYS = parseInt(process.env.SPY_PAGE_CACHE_DAYS || '30', 10) || 30;
const IMPORTED_CACHE_DAYS = parseInt(process.env.SPY_IMPORTED_CACHE_DAYS || '90', 10) || 90;

function extractPageIdFromUrl(url) {
  if (!url) return null;
  try {
    const u = new URL(url);
    const id = u.searchParams.get('view_all_page_id') || u.searchParams.get('page_id');
    return id ? normPageId(id) : null;
  } catch {
    return null;
  }
}

function tierRank(tier) {
  if (tier === IMPORTED_TIER) return 0;
  if (tier === GOLD_TIER) return 1;
  if (tier === REJECT_TIER) return 3;
  return 2;
}

function normNicho(nicho) {
  return nicho?.trim().toUpperCase() || '';
}

function normCountry(country) {
  return country?.trim().toUpperCase() || '';
}

function normPageId(pageId) {
  return String(pageId || '').replace(/\D/g, '');
}

async function ensurePageIntelTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS spy_page_intel (
      id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      page_id TEXT NOT NULL,
      nicho TEXT NOT NULL DEFAULT '',
      country TEXT NOT NULL DEFAULT '',
      page_name TEXT,
      library_url TEXT,
      tier TEXT NOT NULL DEFAULT 'neutral',
      relevance_score REAL NOT NULL DEFAULT 0.5,
      active_ads INTEGER NOT NULL DEFAULT 0,
      hit_count INTEGER NOT NULL DEFAULT 1,
      last_keyword TEXT,
      last_reason TEXT,
      cached_profile JSONB NOT NULL DEFAULT '{}',
      last_seen_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      UNIQUE (nicho, country, page_id)
    )
  `);
  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_spy_page_intel_lookup
      ON spy_page_intel (nicho, country, tier, relevance_score DESC, hit_count DESC)
  `);
  await pool.query(`
    GRANT ALL PRIVILEGES ON TABLE spy_page_intel TO taskforce
  `).catch(() => {});
}

async function seedImportedPages(nicho, country) {
  const nichoKey = normNicho(nicho);
  if (!nichoKey) return 0;
  const countryKey = normCountry(country);

  const fromDiscoveries = await pool.query(
    `INSERT INTO spy_page_intel (
       page_id, nicho, country, page_name, library_url, tier, relevance_score,
       active_ads, hit_count, last_reason, cached_profile, last_seen_at
     )
     SELECT DISTINCT ON (d.page_id)
       d.page_id,
       $1,
       $2,
       d.name,
       d.source_value,
       $3,
       $4,
       d.active_ads,
       3,
       'seed:importada para biblioteca (SPY)',
       COALESCE(d.card_data, '{}'::jsonb) || jsonb_build_object('importedLibraryId', d.imported_library_id),
       NOW()
     FROM spy_discoveries d
     JOIN spy_sessions s ON s.id = d.session_id
     WHERE s.nicho = $1
       AND d.already_imported = true
       AND d.page_id IS NOT NULL
       AND d.page_id <> ''
     ORDER BY d.page_id, d.active_ads DESC NULLS LAST
     ON CONFLICT (nicho, country, page_id) DO UPDATE SET
       tier = $3,
       relevance_score = $4,
       hit_count = GREATEST(spy_page_intel.hit_count, 3),
       library_url = COALESCE(EXCLUDED.library_url, spy_page_intel.library_url),
       last_reason = EXCLUDED.last_reason,
       last_seen_at = NOW(),
       cached_profile = CASE
         WHEN EXCLUDED.cached_profile::text != '{}'::text THEN EXCLUDED.cached_profile
         ELSE spy_page_intel.cached_profile
       END`,
    [nichoKey, countryKey, IMPORTED_TIER, IMPORTED_SCORE]
  );

  const fromLibraries = await pool.query(
    `INSERT INTO spy_page_intel (
       page_id, nicho, country, page_name, library_url, tier, relevance_score,
       active_ads, hit_count, last_reason, cached_profile, last_seen_at
     )
     SELECT DISTINCT ON (sub.page_id)
       sub.page_id,
       $1,
       $2,
       sub.name,
       sub.source_value,
       $3,
       $4,
       COALESCE(sub.active_ads, 0),
       2,
       'seed:biblioteca monitorizada',
       jsonb_build_object('libraryId', sub.library_id, 'imported', true),
       NOW()
     FROM (
       SELECT l.id AS library_id, l.name, l.source_value, l.active_ads,
         COALESCE(
           (regexp_match(l.source_value, 'view_all_page_id=([0-9]+)'))[1],
           (regexp_match(l.source_value, 'page_id=([0-9]+)'))[1],
           ''
         ) AS page_id
       FROM libraries l
       WHERE l.nichos ILIKE '%' || $1 || '%'
         AND l.source_value ILIKE '%facebook.com%ads/library%'
     ) sub
     WHERE length(sub.page_id) >= 8
     ORDER BY sub.page_id, sub.active_ads DESC NULLS LAST
     ON CONFLICT (nicho, country, page_id) DO UPDATE SET
       tier = $3,
       relevance_score = $4,
       hit_count = GREATEST(spy_page_intel.hit_count, spy_page_intel.hit_count + 1),
       last_reason = EXCLUDED.last_reason,
       last_seen_at = NOW()`,
    [nichoKey, countryKey, IMPORTED_TIER, IMPORTED_SCORE]
  );

  return (fromDiscoveries.rowCount || 0) + (fromLibraries.rowCount || 0);
}

async function seedPageIntelFromHistory(nicho, country) {
  const nichoKey = normNicho(nicho);
  if (!nichoKey) return 0;
  const countryKey = normCountry(country);

  await seedImportedPages(nichoKey, countryKey);

  const { rows: existing } = await pool.query(
    `SELECT count(*)::int AS c FROM spy_page_intel WHERE nicho = $1 AND country = $2 AND tier IN ($3, $4)`,
    [nichoKey, countryKey, GOLD_TIER, IMPORTED_TIER]
  );
  if (existing[0]?.c >= 5) return 0;

  const { rowCount } = await pool.query(
    `INSERT INTO spy_page_intel (
       page_id, nicho, country, page_name, library_url, tier, relevance_score,
       active_ads, hit_count, last_reason, cached_profile, last_seen_at
     )
     SELECT DISTINCT ON (d.page_id)
       d.page_id,
       $1,
       $2,
       d.name,
       d.source_value,
       $3,
       GREATEST(COALESCE(d.relevance_score, 0.7), 0.7),
       d.active_ads,
       1,
       'seed:spy_discoveries',
       COALESCE(d.card_data, '{}'::jsonb),
       d.created_at
     FROM spy_discoveries d
     JOIN spy_sessions s ON s.id = d.session_id
     WHERE s.nicho = $1
       AND d.page_id IS NOT NULL
       AND d.page_id <> ''
       AND d.active_ads >= 25
       AND COALESCE(d.relevance_score, 0) >= 0.5
     ORDER BY d.page_id, d.relevance_score DESC NULLS LAST, d.active_ads DESC
     ON CONFLICT (nicho, country, page_id) DO UPDATE SET
       tier = CASE
         WHEN spy_page_intel.tier = $3 THEN spy_page_intel.tier
         WHEN EXCLUDED.relevance_score > spy_page_intel.relevance_score THEN $3
         ELSE spy_page_intel.tier
       END,
       relevance_score = GREATEST(spy_page_intel.relevance_score, EXCLUDED.relevance_score),
       active_ads = GREATEST(spy_page_intel.active_ads, EXCLUDED.active_ads),
       last_seen_at = GREATEST(spy_page_intel.last_seen_at, EXCLUDED.last_seen_at)`,
    [nichoKey, countryKey, GOLD_TIER]
  );
  return rowCount || 0;
}

/**
 * Contexto para Fase 2 (prompt + short-circuit).
 */
async function loadFilterIntel(nicho, country, options = {}) {
  const goldLimit = options.goldLimit ?? 25;
  const rejectLimit = options.rejectLimit ?? 40;
  const nichoKey = normNicho(nicho);
  const countryKey = normCountry(country);

  if (!nichoKey) {
    return { goldPages: [], rejectedPages: [], goldByPageId: new Map(), rejectedPageIds: new Set() };
  }

  await ensurePageIntelTable();
  await seedPageIntelFromHistory(nichoKey, countryKey);

  const params = [nichoKey, countryKey];
  const importedLimit = options.importedLimit ?? 40;

  const { rows: importedPages } = await pool.query(
    `SELECT page_id, page_name, library_url, tier, relevance_score, hit_count,
            last_reason, last_keyword, cached_profile, last_seen_at, active_ads
     FROM spy_page_intel
     WHERE nicho = $1 AND country = $2 AND tier = $3
     ORDER BY hit_count DESC, last_seen_at DESC
     LIMIT $4`,
    [...params, IMPORTED_TIER, importedLimit]
  );

  const { rows: goldPages } = await pool.query(
    `SELECT page_id, page_name, library_url, tier, relevance_score, hit_count,
            last_reason, last_keyword, cached_profile, last_seen_at, active_ads
     FROM spy_page_intel
     WHERE nicho = $1 AND country = $2 AND tier = $3
     ORDER BY relevance_score DESC, hit_count DESC, last_seen_at DESC
     LIMIT $4`,
    [...params, GOLD_TIER, goldLimit]
  );

  const { rows: rejectedPages } = await pool.query(
    `SELECT page_id, page_name, relevance_score, hit_count, last_reason
     FROM spy_page_intel
     WHERE nicho = $1 AND country = $2 AND tier = $4
       AND (hit_count >= 2 OR relevance_score <= 0.35)
     ORDER BY hit_count DESC, last_seen_at DESC
     LIMIT $3`,
    [nichoKey, countryKey, rejectLimit, REJECT_TIER]
  );

  const goldByPageId = new Map();
  for (const r of goldPages) goldByPageId.set(r.page_id, r);
  for (const r of importedPages) goldByPageId.set(r.page_id, r);

  const rejectedPageIds = new Set(rejectedPages.map((r) => r.page_id));

  return {
    importedPages,
    goldPages,
    rejectedPages,
    goldByPageId,
    rejectedPageIds,
  };
}

function isCacheFresh(row) {
  if (!row?.last_seen_at) return false;
  const maxDays = row.tier === IMPORTED_TIER ? IMPORTED_CACHE_DAYS : CACHE_MAX_AGE_DAYS;
  const ageMs = Date.now() - new Date(row.last_seen_at).getTime();
  return ageMs < maxDays * 24 * 60 * 60 * 1000;
}

function partitionAdsByIntel(ads, intel) {
  const autoRelevant = [];
  const autoRejected = [];
  const needsAi = [];

  for (const ad of ads) {
    const pageId = normPageId(ad.pageId);
    if (!pageId) {
      needsAi.push(ad);
      continue;
    }

    const gold = intel.goldByPageId.get(pageId);
    const minScore = gold?.tier === IMPORTED_TIER ? IMPORTED_MIN_SCORE : GOLD_MIN_SCORE;
    if (gold && gold.relevance_score >= minScore) {
      const isImported = gold.tier === IMPORTED_TIER;
      autoRelevant.push({
        ...ad,
        pageId,
        relevance: {
          relevant: true,
          score: isImported ? IMPORTED_SCORE : Math.max(gold.relevance_score, 0.75),
          reason: isImported
            ? `⭐ importada para biblioteca (${gold.hit_count}×) — ouro máximo`
            : `cache ouro (${gold.hit_count}× nicho, score ${gold.relevance_score.toFixed(2)})`,
        },
        _pageIntelGold: gold,
      });
      continue;
    }

    if (intel.rejectedPageIds.has(pageId)) {
      autoRejected.push({
        ...ad,
        pageId,
        relevance: {
          relevant: false,
          score: 0.12,
          reason: 'cache: página rejeitada em pesquisas anteriores',
        },
      });
      continue;
    }

    needsAi.push(ad);
  }

  return { autoRelevant, autoRejected, needsAi };
}

function enrichFromCachedGold(ad, goldRow) {
  const profile = goldRow.cached_profile || {};
  const fd = profile.fullDetails || profile;
  return {
    ...ad,
    pageId: ad.pageId || goldRow.page_id,
    pageName: ad.pageName || goldRow.page_name || fd.pageName,
    libraryUrl: ad.libraryUrl || goldRow.library_url,
    fullDetails: {
      ...fd,
      adId: ad.adId,
      pageId: ad.pageId || goldRow.page_id,
      pageName: ad.pageName || goldRow.page_name,
      scrapePhase: 'cached_gold',
      cachedAt: goldRow.last_seen_at,
    },
  };
}

/**
 * Separa relevantes: perfil em cache (skip visitas Fase 3) vs precisam scrape completo.
 */
function splitRelevantForPhase3(relevantAds, intel) {
  const fromCache = [];
  const toEnrich = [];

  for (const ad of relevantAds) {
    const gold = ad._pageIntelGold || intel.goldByPageId.get(normPageId(ad.pageId));
    const profile = gold?.cached_profile;
    const hasProfile =
      profile &&
      (profile.fullDetails?.fullCopy?.length > 40 ||
        profile.fullCopy?.length > 40 ||
        profile.adText?.length > 40);

    const isImported = gold?.tier === IMPORTED_TIER;
    if (gold && isImported && isCacheFresh(gold)) {
      fromCache.push(enrichFromCachedGold(ad, gold));
    } else if (gold && isCacheFresh(gold) && hasProfile) {
      fromCache.push(enrichFromCachedGold(ad, gold));
    } else {
      toEnrich.push(ad);
    }
  }

  return { fromCache, toEnrich };
}

async function recordPageOutcome(nicho, country, pageId, data = {}) {
  const nichoKey = normNicho(nicho);
  const pid = normPageId(pageId);
  if (!nichoKey || !pid) return null;

  await ensurePageIntelTable();
  const countryKey = normCountry(country);
  const tier =
    data.tier === IMPORTED_TIER
      ? IMPORTED_TIER
      : data.tier === REJECT_TIER
        ? REJECT_TIER
        : data.tier === GOLD_TIER
          ? GOLD_TIER
          : 'neutral';
  const score =
    typeof data.relevanceScore === 'number'
      ? data.relevanceScore
      : tier === IMPORTED_TIER
        ? IMPORTED_SCORE
        : tier === GOLD_TIER
          ? 0.75
          : 0.25;
  const scoreBoost =
    tier === IMPORTED_TIER ? 0 : tier === GOLD_TIER ? 0.08 : tier === REJECT_TIER ? -0.05 : 0;

  const cachedProfile = data.cachedProfile ? JSON.stringify(data.cachedProfile) : '{}';

  const { rows } = await pool.query(
    `INSERT INTO spy_page_intel (
       page_id, nicho, country, page_name, library_url, tier, relevance_score,
       active_ads, hit_count, last_keyword, last_reason, cached_profile, last_seen_at
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,1,$9,$10,$11::jsonb,NOW())
     ON CONFLICT (nicho, country, page_id) DO UPDATE SET
       page_name = COALESCE(EXCLUDED.page_name, spy_page_intel.page_name),
       library_url = COALESCE(EXCLUDED.library_url, spy_page_intel.library_url),
       hit_count = spy_page_intel.hit_count + 1,
       last_keyword = COALESCE(EXCLUDED.last_keyword, spy_page_intel.last_keyword),
       last_reason = COALESCE(EXCLUDED.last_reason, spy_page_intel.last_reason),
       active_ads = GREATEST(spy_page_intel.active_ads, EXCLUDED.active_ads),
       last_seen_at = NOW(),
       relevance_score = CASE
         WHEN EXCLUDED.tier = 'imported' THEN EXCLUDED.relevance_score
         WHEN spy_page_intel.tier = 'imported' THEN spy_page_intel.relevance_score
         ELSE LEAST(1, GREATEST(0, spy_page_intel.relevance_score + $12))
       END,
       tier = CASE
         WHEN EXCLUDED.tier = 'imported' THEN 'imported'
         WHEN spy_page_intel.tier = 'imported' THEN 'imported'
         WHEN EXCLUDED.tier = 'gold' THEN 'gold'
         WHEN EXCLUDED.tier = 'rejected' AND spy_page_intel.tier IN ('gold', 'imported') THEN spy_page_intel.tier
         WHEN EXCLUDED.tier = 'rejected' THEN 'rejected'
         ELSE spy_page_intel.tier
       END,
       cached_profile = CASE
         WHEN EXCLUDED.tier IN ('gold', 'imported') AND EXCLUDED.cached_profile::text != '{}'
         THEN EXCLUDED.cached_profile
         ELSE spy_page_intel.cached_profile
       END
     RETURNING *`,
    [
      pid,
      nichoKey,
      countryKey,
      data.pageName || null,
      data.libraryUrl || null,
      tier,
      Math.max(0, Math.min(1, score)),
      data.activeAds ?? 0,
      data.keyword || null,
      (data.reason || '').slice(0, 200),
      cachedProfile,
      scoreBoost,
    ]
  );
  return rows[0];
}

async function recordBatchOutcomes(nicho, country, { relevant = [], rejected = [] }, keyword = '') {
  for (const ad of relevant) {
    const fd = ad.fullDetails || ad.rawMeta?.fullDetails;
    await recordPageOutcome(nicho, country, ad.pageId, {
      tier: GOLD_TIER,
      relevanceScore: ad.relevance?.score ?? 0.8,
      pageName: ad.pageName,
      libraryUrl: ad.libraryUrl,
      keyword,
      reason: ad.relevance?.reason,
      activeAds: ad.rawMeta?.activeAds,
      cachedProfile: {
        fullDetails: fd,
        adText: ad.adText,
        headline: ad.headline,
        thumbnailUrl: ad.thumbnailUrl,
        imageUrl: ad.imageUrl,
        videoUrl: ad.videoUrl,
        landingUrl: ad.landingUrl,
        savedAt: new Date().toISOString(),
      },
    });
  }
  for (const ad of rejected) {
    if ((ad.relevance?.score ?? 1) > 0.4) continue;
    await recordPageOutcome(nicho, country, ad.pageId, {
      tier: REJECT_TIER,
      relevanceScore: ad.relevance?.score ?? 0.2,
      pageName: ad.pageName,
      keyword,
      reason: ad.relevance?.reason,
    });
  }
}

async function recordImportedFromDiscovery(discoveryId, libraryId) {
  const { rows } = await pool.query(
    `SELECT d.page_id, d.name, d.source_value, d.active_ads, d.card_data, d.ad_assets,
            s.nicho, s.country, s.language
     FROM spy_discoveries d
     JOIN spy_sessions s ON s.id = d.session_id
     WHERE d.id = $1`,
    [discoveryId]
  );
  const row = rows[0];
  if (!row?.nicho) return null;

  const pageId = normPageId(row.page_id) || extractPageIdFromUrl(row.source_value);
  if (!pageId) return null;

  const assets = row.ad_assets || [];
  const firstAsset = assets[0] || {};

  return recordPageOutcome(row.nicho, row.country, pageId, {
    tier: IMPORTED_TIER,
    relevanceScore: IMPORTED_SCORE,
    pageName: row.name,
    libraryUrl: row.source_value,
    reason: '⭐ importada para biblioteca — validação humana',
    activeAds: row.active_ads,
    cachedProfile: {
      imported: true,
      libraryId,
      discoveryId,
      cardData: row.card_data,
      adText: firstAsset.adText,
      fullDetails: { fullCopy: firstAsset.adText, landingUrl: firstAsset.landingUrl },
    },
  });
}

async function recordImportedFromLibraryDraft(draft, libraryId) {
  const nichoRaw = draft.nichos || draft.nicho;
  const nicho = Array.isArray(nichoRaw) ? nichoRaw[0] : nichoRaw;
  if (!nicho) return null;

  const pageId =
    extractPageIdFromUrl(draft.sourceValue || draft.source_value) ||
    normPageId(draft.pageId || draft.page_id);
  if (!pageId) return null;

  const paises = draft.paises || draft.country;
  const country = Array.isArray(paises) ? paises[0] : paises || '';

  return recordPageOutcome(nicho, country, pageId, {
    tier: IMPORTED_TIER,
    relevanceScore: IMPORTED_SCORE,
    pageName: draft.name,
    libraryUrl: draft.sourceValue || draft.source_value,
    reason: '⭐ biblioteca importada manualmente',
    activeAds: draft.activeAdsEstimate || draft.active_ads || 0,
    cachedProfile: { imported: true, libraryId, draft },
  });
}

function formatIntelForPrompt(intel) {
  if (!intel?.importedPages?.length && !intel?.goldPages?.length && !intel?.rejectedPages?.length) {
    return '';
  }

  const importedLines = (intel.importedPages || []).slice(0, 20).map((p) => {
    return `- page_id=${p.page_id} | ${p.page_name || '?'} | ⭐ IMPORTADA`;
  });
  const goldLines = (intel.goldPages || [])
    .filter((p) => !intel.importedPages?.some((i) => i.page_id === p.page_id))
    .slice(0, 12)
    .map((p) => {
      return `- page_id=${p.page_id} | ${p.page_name || '?'} | score=${p.relevance_score}`;
    });
  const rejLines = (intel.rejectedPages || []).slice(0, 12).map((p) => {
    return `- page_id=${p.page_id} | ${p.page_name || '?'} | rejeitada`;
  });

  return `
HISTÓRICO DO NICHO (base de dados):
⭐ OURO DO OURO — já importadas para bibliotecas (SEMPRE RELEVANTES se o page_id coincidir):
${importedLines.length ? importedLines.join('\n') : '(nenhuma)'}

PÁGINAS OURO (validadas em pesquisas anteriores):
${goldLines.length ? goldLines.join('\n') : '(nenhuma)'}

PÁGINAS REJEITADAS (tende IRRELEVANTE):
${rejLines.length ? rejLines.join('\n') : '(nenhuma)'}`;
}

module.exports = {
  ensurePageIntelTable,
  seedImportedPages,
  loadFilterIntel,
  partitionAdsByIntel,
  splitRelevantForPhase3,
  enrichFromCachedGold,
  recordPageOutcome,
  recordBatchOutcomes,
  recordImportedFromDiscovery,
  recordImportedFromLibraryDraft,
  formatIntelForPrompt,
  extractPageIdFromUrl,
  normPageId,
  IMPORTED_TIER,
  GOLD_TIER,
  REJECT_TIER,
  IMPORTED_SCORE,
};
