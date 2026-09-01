/**
 * Pipeline SPY keyword — scroll + IA (nicho/DR) + visita biblioteca inline.
 * Não entra 2× na mesma biblioteca se já visitada (pulled ou < min ads).
 */
const { buildPageLibraryUrl } = require('./spy-url-builder');
const { interpretScrapeResult } = require('./ad-count-parser');
const { filterMetadataBatch, parseCriteriaFromSearchUrl } = require('./spy-meta-filter');
const { enrichFromRawMetadata } = require('./spy-meta-extractor');
const { pushLiveStats } = require('./spy-live-stats');
const {
  loadFilterIntel,
  partitionAdsByIntel,
  formatIntelForPrompt,
  recordPageOutcome,
  GOLD_TIER,
  REJECT_TIER,
  normPageId,
} = require('./spy-page-intel');
const { LibraryVisitRegistry, getMinActiveAds } = require('./spy-library-visit-registry');
const {
  daysActiveFilterFromSession,
  libraryHasAdInAgeRange,
  formatDaysActiveFilter,
} = require('./spy-ad-age-filter');
  const {
  scrapeMetadataOnPage,
  scrapeLibraryPagePhase,
  withDirectBrowser,
  withResidentialBrowser,
  getMetaConfig,
  randomDelay,
} = require('./spy-meta-scraper');
const { tryDelegateMobile } = require('./spy-mobile-delegator');
const { mapEnrichedToSpyAds } = require('./spy-meta-map-ads');

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

function getFlushSize() {
  const n = parseInt(process.env.SPY_LIVE_PIPELINE_FLUSH_SIZE || '12', 10);
  return Number.isFinite(n) && n >= 3 ? Math.min(n, 50) : 12;
}

function getLibraryScrapeMaxAds() {
  const n = parseInt(process.env.SPY_LIBRARY_AI_MAX_ADS || '800', 10);
  return Number.isFinite(n) && n > 0 ? n : 800;
}

function parseActiveAdsFromScrape(scrape) {
  const bodyText = scrape?.bodyText || '';
  const html = scrape?.html || '';
  const interpreted = interpretScrapeResult(bodyText, html, 0);
  if (interpreted.status === 'ok' && typeof interpreted.count === 'number') {
    return interpreted.count;
  }
  if (interpreted.status === 'zero_real') return 0;
  const collected = scrape?.ads?.length || scrape?.rawCount || 0;
  if (collected >= getMinActiveAds()) return collected;
  return interpreted.count ?? collected;
}

function pickBestAdText(scrape, fallbackAd) {
  let best = fallbackAd?.headline || '';
  for (const ad of scrape?.ads || []) {
    const t = ad.headline || ad.adText || '';
    if (t.length > best.length) best = t;
  }
  return best.slice(0, 800);
}

function buildPulledRecord(sourceAd, scrape, activeAds, relevance) {
  const enriched = enrichFromRawMetadata(sourceAd);
  const best = scrape?.ads?.[0];
  const fd = enriched.fullDetails || {};
  return {
    ...sourceAd,
    relevance,
    activeAds,
    fullDetails: {
      ...fd,
      fullCopy: fd.fullCopy || pickBestAdText(scrape, sourceAd),
      landingUrl: fd.landingUrl || best?.landingUrl || sourceAd.landingUrl,
      pageName: fd.pageName || sourceAd.pageName,
      libraryAdsCollected: scrape?.rawCount ?? scrape?.ads?.length ?? 0,
      pageScrapeNote: 'keyword_live_pipeline',
      extractedAt: new Date().toISOString(),
    },
  };
}

async function visitAndMaybePullLibrary(ad, ctx) {
  const pageId = normPageId(ad.pageId);
  if (!pageId) return null;

  const { registry, criteria, session, pulled, rejected, sessionId, minActiveAds, daysActiveFilter } = ctx;

  if (registry.shouldSkipLibraryVisit(pageId)) {
    const st = registry.getStatus(pageId);
    console.log(
      `   ↷ SPY biblioteca ${ad.pageName || pageId} — skip (${st?.status || 'já visitada'})`
    );
    return null;
  }

  const libraryUrl =
    ad.libraryUrl || buildPageLibraryUrl(pageId, criteria.country !== 'ALL' ? criteria.country : undefined);

  registry.bumpLibraryVisit();
  if (sessionId) {
    await pushLiveStats(sessionId, {
      phase: 'meta_library',
      libraryVisits: registry.stats.libraryVisits,
      message: `Biblioteca ${ad.pageName || pageId} — a verificar ads activos…`,
      pageName: ad.pageName || pageId,
    });
  }

  let scrape;
  try {
    scrape = await scrapeLibraryPagePhase(libraryUrl, {
      maxAds: getLibraryScrapeMaxAds(),
      aiGuided: true,
      scrollToEnd: true,
      skipMobileDelegate: !!ctx.skipMobileDelegate && !ctx.forceServerAuto,
      viaResidential: !!ctx.forceServerAuto,
      directScrape: !!ctx.skipMobileDelegate && !ctx.forceServerAuto,
    });
  } catch (err) {
    console.warn(`   ⚠️ SPY biblioteca ${pageId}: ${err.message}`);
    registry.markVisitError(pageId, err.message);
    return null;
  }

  const activeAds = parseActiveAdsFromScrape(scrape);
  const ageLabel = daysActiveFilter?.enabled ? ` · ${formatDaysActiveFilter(daysActiveFilter)}` : '';
  console.log(
    `   📚 SPY ${ad.pageName || pageId}: ~${activeAds ?? '?'} ads activos (mín. ${minActiveAds})${ageLabel}`
  );

  if (!activeAds || activeAds < minActiveAds) {
    registry.markLowAds(pageId, activeAds || 0);
    rejected.push({
      ...ad,
      relevance: {
        relevant: false,
        score: 0.15,
        reason: `biblioteca com ${activeAds ?? 0} ads (< ${minActiveAds})`,
      },
    });
    if (session.nicho) {
      await recordPageOutcome(session.nicho, session.country, pageId, {
        tier: REJECT_TIER,
        relevanceScore: 0.15,
        pageName: ad.pageName,
        libraryUrl,
        keyword: criteria.keyword,
        reason: `low_ads:${activeAds ?? 0}`,
        activeAds: activeAds || 0,
      });
    }
    return null;
  }

  const scrapedAds = scrape?.ads || [];
  if (daysActiveFilter?.enabled && !libraryHasAdInAgeRange(scrapedAds, daysActiveFilter)) {
    registry.markLowAds(pageId, activeAds || 0);
    rejected.push({
      ...ad,
      relevance: {
        relevant: false,
        score: 0.12,
        reason: `sem ads no intervalo ${formatDaysActiveFilter(daysActiveFilter)}`,
      },
    });
    if (session.nicho) {
      await recordPageOutcome(session.nicho, session.country, pageId, {
        tier: REJECT_TIER,
        relevanceScore: 0.12,
        pageName: ad.pageName,
        libraryUrl,
        keyword: criteria.keyword,
        reason: `age_filter:${formatDaysActiveFilter(daysActiveFilter)}`,
        activeAds: activeAds || 0,
      });
    }
    return null;
  }

  const record = buildPulledRecord(ad, scrape, activeAds, ad.relevance);
  registry.markPulled(pageId, activeAds);
  pulled.push(record);

  if (session.nicho) {
    await recordPageOutcome(session.nicho, session.country, pageId, {
      tier: GOLD_TIER,
      relevanceScore: ad.relevance?.score ?? 0.85,
      pageName: ad.pageName,
      libraryUrl,
      keyword: criteria.keyword,
      reason: ad.relevance?.reason || 'keyword_live: biblioteca puxada',
      activeAds,
      cachedProfile: {
        adText: record.fullDetails?.fullCopy,
        fullDetails: record.fullDetails,
        activeAds,
      },
    });
  }

  if (sessionId) {
    await pushLiveStats(sessionId, {
      phase: 'meta_library',
      libraryVisits: registry.stats.libraryVisits,
      pagesGold: pulled.length,
      message: `✓ ${ad.pageName || pageId} — ${activeAds} ads (puxada)`,
      pageName: ad.pageName || pageId,
    });
  }

  await new Promise((r) => setTimeout(r, randomDelay(getMetaConfig().delayMin, getMetaConfig().delayMax)));
  return record;
}

async function processNewAdsBatch(newAds, ctx) {
  if (!newAds.length) return;

  const { criteria, pageIntel, registry, sessionId, cfg, useAi, intelContext, pulled, rejected } =
    ctx;

  const { autoRelevant, autoRejected, needsAi } = partitionAdsByIntel(newAds, pageIntel);
  rejected.push(...autoRejected);

  let relevant = [...autoRelevant];

  if (needsAi.length) {
    const filtered = await filterMetadataBatch(needsAi, criteria, {
      batchSize: cfg.batchSize,
      useAi,
      intelContext,
      preClassified: { relevant: [], rejected: [] },
    });
    relevant = relevant.concat(filtered.relevant);
    rejected.push(...filtered.rejected);
  }

  if (sessionId) {
    await pushLiveStats(sessionId, {
      phase: 'meta_filter',
      pagesGold: relevant.length,
      pagesRejected: rejected.length,
      message: `+${newAds.length} ads · ${relevant.length} DR/nicho · a abrir bibliotecas…`,
    });
  }

  const seenPages = new Set();
  for (const ad of relevant) {
    const pid = normPageId(ad.pageId);
    if (!pid || seenPages.has(pid)) continue;
    seenPages.add(pid);

    const gold = ad._pageIntelGold;
    if (gold && gold.active_ads >= ctx.minActiveAds) {
      const profile = gold.cached_profile || {};
      const fd = profile.fullDetails || profile;
      const hasProfile = fd.fullCopy?.length > 40 || profile.adText?.length > 40;
      if (hasProfile) {
        registry.markGoldCache(pid, gold.active_ads);
        const cached = enrichFromRawMetadata(ad);
        cached.relevance = ad.relevance;
        cached.activeAds = gold.active_ads;
        pulled.push(cached);
        continue;
      }
    }

    if (registry.shouldSkipLibraryVisit(pid)) continue;
    await visitAndMaybePullLibrary(ad, ctx);
  }
}

async function runKeywordLivePipelineOnPage(page, searchUrl, options = {}) {
  const session = options.session || {};
  const criteria = parseCriteriaFromSearchUrl(searchUrl, session);
  const cfg = options.cfg || {};
  const collectCap = options.collectCap;
  const scrollToEnd = options.scrollToEnd !== false;
  const sessionId = options.sessionId;
  const minActiveAds = options.minActiveAds ?? getMinActiveAds();
  const daysActiveFilter = options.daysActiveFilter ?? daysActiveFilterFromSession(session);
  const flushSize = options.flushSize ?? getFlushSize();

  const pageIntel = options.pageIntel || (await loadFilterIntel(session.nicho, session.country));
  const intelContext = formatIntelForPrompt(pageIntel);
  const registry = new LibraryVisitRegistry(pageIntel, minActiveAds);

  const pulled = [];
  const rejected = [];
  let lastProcessed = 0;
  let allCollected = [];

  const ctx = {
    criteria,
    pageIntel,
    registry,
    session,
    sessionId,
    cfg,
    useAi: options.useAi !== false,
    intelContext,
    pulled,
    rejected,
    minActiveAds,
    daysActiveFilter,
    skipMobileDelegate: options.skipMobileDelegate,
    forceServerAuto: options.forceServerAuto === true,
  };

  const flush = async () => {
    if (allCollected.length <= lastProcessed) return;
    const batch = allCollected.slice(lastProcessed);
    lastProcessed = allCollected.length;
    await processNewAdsBatch(batch, ctx);
  };

  const result = await scrapeMetadataOnPage(page, searchUrl, {
    collectCap,
    scrollToEnd,
    viaProxy: options.forceServerAuto === true,
    label: 'keyword',
    livePipeline: {
      flushSize,
      onCollectionUpdate: async (collected) => {
        allCollected = collected;
        if (collected.length - lastProcessed >= flushSize) {
          await flush();
        }
      },
    },
  });

  allCollected = result.ads || [];
  await flush();

  const ads = mapEnrichedToSpyAds(pulled, criteria.country || session.country);

  console.log(
    `   🎯 SPY live pipeline: ${result.rawCount} scrollados → ${pulled.length} bibliotecas puxadas (${registry.stats.libraryVisits} visitas, ${registry.stats.skippedDuplicate} skips dup.)`
  );

  return {
    ads,
    bodyText: ads.map((a) => `${a.pageName || a.pageId}: ${a.adText || ''}`.trim()).join('\n').slice(0, 5000),
    source: 'meta',
    rawCount: result.rawCount,
    meta: {
      scanned: result.rawCount,
      relevant: pulled.length,
      rejected: rejected.length,
      pages: ads.length,
      libraryVisits: registry.stats.libraryVisits,
      pulled: registry.stats.pulled,
      skippedDuplicate: registry.stats.skippedDuplicate,
      pipeline: 'keyword_live',
    },
    _pipeline: { pulled, rejected, allCollected: result.ads },
  };
}

async function runKeywordLivePipeline(searchUrl, options = {}) {
  if (!options.forceServerAuto) {
    const delegated = await tryDelegateMobile(
      'keyword_live',
      {
        searchUrl,
        options: {
          collectCap: options.collectCap ?? options.maxAds,
          scrollToEnd: options.scrollToEnd !== false,
          sessionId: options.sessionId,
          session: options.session,
          useAi: options.useAi !== false,
        },
      },
      options.mobileTimeoutMs ?? parseInt(process.env.SPY_MOBILE_JOB_TIMEOUT_MS || '900000', 10)
    );
    if (delegated) return delegated;
  }

  return withDirectBrowser(async (browser) => {
    const page = await browser.newPage();
    await page.setUserAgent(USER_AGENT);
    await page.setViewport({ width: 1366, height: 900 });
    try {
      return await runKeywordLivePipelineOnPage(page, searchUrl, {
        ...options,
        skipMobileDelegate: true,
      });
    } finally {
      await page.close().catch(() => {});
    }
  });
}

module.exports = {
  runKeywordLivePipeline,
  runKeywordLivePipelineOnPage,
  parseActiveAdsFromScrape,
  getFlushSize,
  getMinActiveAds,
};
