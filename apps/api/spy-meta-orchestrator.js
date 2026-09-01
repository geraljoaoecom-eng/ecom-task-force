/**
 * Orquestrador SPY — pipeline móvel.
 * Fase 1: Mac scrolla keyword (dados móveis) → envia partials
 * Fase 2: VPS filtra DR em streaming → abre bibliotecas em paralelo
 * Fase 3: Mac abre biblioteca (dados móveis) → discovery se ≥ min ads
 */
const { pool } = require('./db');
const {
  getMetaConfig,
  isMetaScraperConfigured: scraperMetaConfigured,
  closeResidentialBrowser,
  scrapeKeywordSearchPhase,
} = require('./spy-meta-scraper');
const { filterMetadataBatch, parseCriteriaFromSearchUrl } = require('./spy-meta-filter');
const { pushLiveStats } = require('./spy-live-stats');
const { mapEnrichedToSpyAds } = require('./spy-meta-map-ads');
const { pullLibrariesForRelevant } = require('./spy-library-pull');
const {
  loadFilterIntel,
  partitionAdsByIntel,
  formatIntelForPrompt,
  recordBatchOutcomes,
  normPageId,
} = require('./spy-page-intel');
const { LibraryVisitRegistry } = require('./spy-library-visit-registry');

class Semaphore {
  constructor(max) {
    this.max = Math.max(1, max);
    this.current = 0;
    this.queue = [];
  }
  async acquire() {
    if (this.current < this.max) { this.current++; return; }
    await new Promise(r => this.queue.push(r));
    this.current++;
  }
  release() {
    this.current--;
    const next = this.queue.shift();
    if (next) next();
  }
  async run(fn) {
    await this.acquire();
    try { return await fn(); } finally { this.release(); }
  }
}

const globalMetaSemaphore = new Semaphore(
  parseInt(process.env.SPY_META_MAX_PARALLEL || '2', 10) || 2
);

function getConfig() {
  return {
    ...getMetaConfig(),
    batchSize: parseInt(process.env.SPY_META_BATCH_SIZE || '50', 10) || 50,
  };
}

function isMetaScraperConfigured() { return scraperMetaConfigured(); }
function isApifyConfigured()       { return scraperMetaConfigured(); }

async function checkMetaScraperHealth() {
  if (!isMetaScraperConfigured()) return { healthy: false, error: 'Ponte móvel não configurada' };
  const { isMobileBridgeRequired, getBridgeStatus } = require('./spy-mobile-bridge');
  if (isMobileBridgeRequired()) {
    const st = getBridgeStatus();
    if (st.ready) return { healthy: true, mode: 'mobile', ip: st.agents[0]?.ip || 'mobile' };
    return { healthy: false, mode: 'mobile', error: st.message };
  }
  return { healthy: true, mode: 'meta', ip: 'local' };
}

async function checkApifyHealth()        { return checkMetaScraperHealth(); }
async function checkApifyAvailability()  { const { healthy } = await checkApifyHealth(); return healthy; }

function sanitizeJsonValue(value) {
  if (value === undefined) return null;
  if (typeof value === 'string') return value.replace(/\u0000/g, '');
  if (typeof value === 'bigint') return Number(value);
  if (Array.isArray(value)) return value.map(sanitizeJsonValue);
  if (value && typeof value === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(value)) {
      if (v === undefined) continue;
      out[k] = sanitizeJsonValue(v);
    }
    return out;
  }
  return value;
}

function safeJsonStringify(value, fallback = '{}') {
  try {
    const clean = sanitizeJsonValue(value);
    const s = JSON.stringify(clean);
    if (!s) return fallback;
    JSON.parse(s);
    return s;
  } catch {
    return fallback;
  }
}

async function persistMetaStaging(sessionId, keywordId, searchUrl, phase, rows) {
  if (!sessionId || !rows?.length) return;
  const check = await pool.query('SELECT id FROM spy_sessions WHERE id = $1', [sessionId]);
  if (!check.rows.length) return;
  for (const row of rows) {
    try {
      await pool.query(
        `INSERT INTO spy_meta_staging (
          session_id, keyword_id, search_url, meta_ad_id, page_id, page_name,
          headline, thumbnail_url, ad_started_at, ad_status, relevance, scrape_phase,
          raw_metadata, full_details
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13::jsonb,$14::jsonb)
        ON CONFLICT (session_id, meta_ad_id) DO UPDATE SET
          scrape_phase   = EXCLUDED.scrape_phase,
          relevance      = COALESCE(EXCLUDED.relevance, spy_meta_staging.relevance),
          raw_metadata   = CASE WHEN EXCLUDED.scrape_phase = 'metadata' THEN EXCLUDED.raw_metadata ELSE spy_meta_staging.raw_metadata END,
          full_details   = CASE WHEN EXCLUDED.scrape_phase = 'full'     THEN EXCLUDED.full_details  ELSE spy_meta_staging.full_details  END,
          updated_at     = NOW()`,
        [
          sessionId, keywordId || null, searchUrl,
          row.adId, row.pageId || null, row.pageName || null,
          row.headline || null, row.thumbnailUrl || null,
          row.startDate || null, row.adStatus || 'active',
          row.relevance?.relevant ? 'relevant' : row.relevance ? 'rejected' : 'pending',
          phase,
          safeJsonStringify(row.rawMetadata || row),
          safeJsonStringify(row.fullDetails || {}),
        ]
      );
    } catch (err) {
      if (err.code === '23503') break;
      console.warn(`   ⚠️ spy_meta_staging skip ${row.adId}:`, err.message);
    }
  }
}

async function collectKeywordAds(searchUrl, options, collectCap, scrollToEnd) {
  const { isBridgeReady, isBridgeReadyForPlatform, isMobileBridgeRequired } = require('./spy-mobile-bridge');
  const plat = String(options.session?.stats?.mobilePlatform || options.mobilePlatform || '').toLowerCase();

  if (isMobileBridgeRequired()) {
    let ready = plat ? isBridgeReadyForPlatform(plat) : isBridgeReady();
    if (!ready) {
      console.log('⏳ Agente móvel não detectado — a aguardar (máx 30s)…');
      for (let i = 0; i < 6; i++) {
        await new Promise(r => setTimeout(r, 5000));
        ready = plat ? isBridgeReadyForPlatform(plat) : isBridgeReady();
        if (ready) break;
      }
    }
    if (!ready) {
      const label =
        plat === 'iphone'
          ? 'iPhone'
          : plat === 'ipad'
            ? 'iPad'
            : plat === 'mac'
              ? 'Mac'
              : plat === 'windows'
                ? 'Windows'
                : 'móvel';
      throw new Error(`Agente ${label} offline — toca Activar e mantém o /spy aberto`);
    }
  }

  const mobileTimeoutMs = parseInt(process.env.SPY_MOBILE_KEYWORD_TIMEOUT_MS || '900000', 10) || 900000;
  console.log(`   📱 SPY Fase 1 — scroll Meta via dados móveis (${plat || 'auto'})`);

  const phase1 = await scrapeKeywordSearchPhase(searchUrl, {
    collectCap,
    scrollToEnd,
    aiGuided:     false,
    mobileTimeoutMs,
    session:      options.session || null,
    mobilePlatform: plat || options.mobilePlatform || null,
    criteria:     options.criteria,
    minActiveAds: options.minActiveAds,
    minDaysActive: options.minDaysActive,
    maxDaysActive: options.maxDaysActive,
    discoveryTarget: options.discoveryTarget,
    onPartial:    options._onPartial || null,
  });

  return {
    ads:          phase1.ads || [],
    rawCount:     phase1.rawCount ?? phase1.ads?.length ?? 0,
    collectLabel: 'telemóvel',
    collectSource:'meta',
  };
}

async function scrapeKeywordSearchViaMeta(searchUrl, options = {}) {
  if (!isMetaScraperConfigured()) {
    throw new Error('SPY Meta não configurado — activa ponte móvel (SPY_REQUIRE_MOBILE_BRIDGE)');
  }

  const cfg       = getConfig();
  const session   = options.session || {};
  const criteria  = parseCriteriaFromSearchUrl(searchUrl, session);
  const collectCap  = options.collectCap ?? options.maxAds ?? cfg.maxAds;
  const scrollToEnd = options.scrollToEnd !== false;
  const sessionId   = options.sessionId;

  return globalMetaSemaphore.run(async () => {
    console.log(`🔎 SPY pipeline: ${searchUrl.slice(0, 90)}…`);

    if (sessionId) {
      await pushLiveStats(sessionId, { phase: 'meta_collect', message: 'Keyword — scroll Meta (telemóvel)…' });
    }

    const pageIntel    = await loadFilterIntel(session.nicho, session.country);
    const intelContext = formatIntelForPrompt(pageIntel);

    const visitedPageIds = new Set();
    const streamRelevant = [];
    const streamRejected = [];

    const processPartialBatch = async (data) => {
      const discoveries = Array.isArray(data) ? data : (data?.ads || []);
      if (!discoveries.length) return;

      for (const discovery of discoveries) {
        if (!discovery.pageId || visitedPageIds.has(discovery.pageId)) continue;
        visitedPageIds.add(discovery.pageId);
        streamRelevant.push(discovery);

        if (typeof options.onDiscovery === 'function') {
          await options.onDiscovery(discovery).catch(e => console.warn('⚠️ onDiscovery:', e.message));
        }

        if (sessionId) {
          await pushLiveStats(sessionId, {
            phase:     'meta_library',
            pagesGold: streamRelevant.length,
            message:   `${streamRelevant.length} discoveries encontrados…`,
          }).catch(() => {});
        }

        console.log(`   ✅ Discovery: ${discovery.pageName || discovery.pageId} (${discovery.activeAds} ads)`);
      }
    };

    const phase1 = await collectKeywordAds(
      searchUrl,
      { ...options, session, criteria, _onPartial: processPartialBatch },
      collectCap,
      scrollToEnd
    );

    await persistMetaStaging(options.sessionId, options.keywordId, searchUrl, 'metadata', phase1.ads);

    if (session.nicho && streamRelevant.length > 0) {
      await recordBatchOutcomes(
        session.nicho, session.country,
        { relevant: streamRelevant, rejected: [] },
        criteria.keyword
      );
    }

    const ads = mapEnrichedToSpyAds(streamRelevant, criteria.country || session.country);
    const bodyText = ads.map(a => `${a.pageName || a.pageId}: ${a.adText || ''}`.trim()).join('\n').slice(0, 5000);

    console.log(`   🎯 SPY: ${phase1.rawCount} recolhidos → ${visitedPageIds.size} bibliotecas → ${streamRelevant.length} discoveries`);

    return {
      ads,
      bodyText,
      source:   'meta',
      rawCount: phase1.rawCount,
      meta: {
        scanned:       phase1.rawCount,
        libraryVisits: visitedPageIds.size,
        discoveries:   streamRelevant.length,
        rejected:      streamRejected.length,
        pipeline:      'meta_mobile',
      },
    };
  });
}

async function scrapeKeywordSearchViaApify(searchUrl, options = {}) {
  return scrapeKeywordSearchViaMeta(searchUrl, options);
}

module.exports = {
  Semaphore,
  getConfig,
  isMetaScraperConfigured,
  isApifyConfigured,
  checkMetaScraperHealth,
  checkApifyHealth,
  checkApifyAvailability,
  scrapeKeywordSearchViaMeta,
  scrapeKeywordSearchViaApify,
  mapEnrichedToSpyAds,
  persistMetaStaging,
  globalMetaSemaphore,
  closeResidentialBrowser,
};
