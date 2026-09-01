/**
 * Fase 3 — visita bibliotecas Meta (móvel) só para relevantes, 1× por page_id, gate ≥ min ads.
 */
const { buildPageLibraryUrl } = require('./spy-url-builder');
const { interpretScrapeResult } = require('./ad-count-parser');
const { enrichFromRawMetadata } = require('./spy-meta-extractor');
const { scrapeLibraryPagePhase, getMetaConfig, randomDelay } = require('./spy-meta-scraper');
const { pushLiveStats } = require('./spy-live-stats');
const { recordPageOutcome, GOLD_TIER, REJECT_TIER, normPageId } = require('./spy-page-intel');
const { LibraryVisitRegistry, getMinActiveAds } = require('./spy-library-visit-registry');
const {
  daysActiveFilterFromSession,
  libraryHasAdInAgeRange,
  formatDaysActiveFilter,
} = require('./spy-ad-age-filter');

function getLibraryScrapeMaxAds() {
  const n = parseInt(process.env.SPY_LIBRARY_AI_MAX_ADS || '800', 10);
  return Number.isFinite(n) && n > 0 ? n : 800;
}

function parseActiveAdsFromScrape(scrape) {
  const bodyText = scrape?.bodyText || '';
  const html = scrape?.html || '';
  const interpreted = interpretScrapeResult(bodyText, html, 0);
  if (interpreted.status === 'ok' && typeof interpreted.count === 'number') return interpreted.count;
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

async function pullLibrariesForRelevant(relevantAds, options = {}) {
  const session = options.session || {};
  const criteria = options.criteria || {};
  const sessionId = options.sessionId;
  const minActiveAds = options.minActiveAds ?? getMinActiveAds();
  const daysActiveFilter = options.daysActiveFilter ?? daysActiveFilterFromSession(session);
  const maxVisits =
    options.maxLibraryVisits ??
    (parseInt(process.env.SPY_LIBRARY_MAX_DETAIL_FETCHES || '25', 10) || 25);

  const registry = options.registry || new LibraryVisitRegistry(options.pageIntel, minActiveAds);
  const pulled = [];
  const rejected = [...(options.alreadyRejected || [])];
  let visits = 0;

  const seenPages = new Set();
  for (const ad of relevantAds) {
    const pid = normPageId(ad.pageId);
    if (!pid || seenPages.has(pid)) continue;
    seenPages.add(pid);

    if (registry.shouldSkipLibraryVisit(pid)) continue;
    if (visits >= maxVisits) break;

    const gold = ad._pageIntelGold;
    if (gold && gold.active_ads >= minActiveAds) {
      const profile = gold.cached_profile || {};
      const fd = profile.fullDetails || profile;
      if (fd.fullCopy?.length > 40 || profile.adText?.length > 40) {
        registry.markGoldCache(pid, gold.active_ads);
        const cached = enrichFromRawMetadata(ad);
        cached.relevance = ad.relevance;
        cached.activeAds = gold.active_ads;
        pulled.push(cached);
        continue;
      }
    }

    const libraryUrl =
      ad.libraryUrl || buildPageLibraryUrl(pid, criteria.country !== 'ALL' ? criteria.country : undefined);

    registry.bumpLibraryVisit();
    visits += 1;

    if (sessionId) {
      await pushLiveStats(sessionId, {
        phase: 'meta_library',
        libraryVisits: visits,
        message: `Biblioteca ${ad.pageName || pid} — a verificar…`,
        pageName: ad.pageName || pid,
      });
    }

    let scrape;
    try {
      scrape = await scrapeLibraryPagePhase(libraryUrl, {
        maxAds: getLibraryScrapeMaxAds(),
        aiGuided: true,
        scrollToEnd: true,
      });
    } catch (err) {
      console.warn(`   ⚠️ SPY biblioteca ${pid}: ${err.message}`);
      registry.markVisitError(pid, err.message);
      continue;
    }

    const activeAds = parseActiveAdsFromScrape(scrape);
    const ageLabel = daysActiveFilter?.enabled ? ` · ${formatDaysActiveFilter(daysActiveFilter)}` : '';
    console.log(`   📚 SPY ${ad.pageName || pid}: ~${activeAds ?? '?'} ads (mín. ${minActiveAds})${ageLabel}`);

    if (!activeAds || activeAds < minActiveAds) {
      registry.markLowAds(pid, activeAds || 0);
      rejected.push({
        ...ad,
        relevance: { relevant: false, score: 0.15, reason: `biblioteca ${activeAds ?? 0} ads (< ${minActiveAds})` },
      });
      if (session.nicho) {
        await recordPageOutcome(session.nicho, session.country, pid, {
          tier: REJECT_TIER,
          relevanceScore: 0.15,
          pageName: ad.pageName,
          libraryUrl,
          keyword: criteria.keyword,
          reason: `low_ads:${activeAds ?? 0}`,
          activeAds: activeAds || 0,
        });
      }
      continue;
    }

    if (daysActiveFilter?.enabled && !libraryHasAdInAgeRange(scrape?.ads || [], daysActiveFilter)) {
      registry.markLowAds(pid, activeAds || 0);
      rejected.push({
        ...ad,
        relevance: {
          relevant: false,
          score: 0.12,
          reason: `sem ads no intervalo ${formatDaysActiveFilter(daysActiveFilter)}`,
        },
      });
      if (session.nicho) {
        await recordPageOutcome(session.nicho, session.country, pid, {
          tier: REJECT_TIER,
          relevanceScore: 0.12,
          pageName: ad.pageName,
          libraryUrl,
          keyword: criteria.keyword,
          reason: `age_filter:${formatDaysActiveFilter(daysActiveFilter)}`,
          activeAds: activeAds || 0,
        });
      }
      continue;
    }

    const enriched = enrichFromRawMetadata(ad);
    const best = scrape?.ads?.[0];
    enriched.relevance = ad.relevance;
    enriched.activeAds = activeAds;
    enriched.fullDetails = {
      ...(enriched.fullDetails || {}),
      fullCopy: enriched.fullDetails?.fullCopy || pickBestAdText(scrape, ad),
      landingUrl: enriched.fullDetails?.landingUrl || best?.landingUrl || ad.landingUrl,
      libraryAdsCollected: scrape?.rawCount ?? scrape?.ads?.length ?? 0,
      pageScrapeNote: 'library_pull',
    };
    registry.markPulled(pid, activeAds);
    pulled.push(enriched);

    // Gravação INCREMENTAL — biblioteca passou o gate (≥ mín ads activos) → discovery na hora
    if (typeof options.onDiscovery === 'function') {
      await options.onDiscovery(enriched);
    }

    if (session.nicho) {
      await recordPageOutcome(session.nicho, session.country, pid, {
        tier: GOLD_TIER,
        relevanceScore: ad.relevance?.score ?? 0.85,
        pageName: ad.pageName,
        libraryUrl,
        keyword: criteria.keyword,
        reason: ad.relevance?.reason || 'biblioteca puxada',
        activeAds,
        cachedProfile: { adText: enriched.fullDetails?.fullCopy, fullDetails: enriched.fullDetails, activeAds },
      });
    }

    if (sessionId) {
      await pushLiveStats(sessionId, {
        phase: 'meta_library',
        libraryVisits: visits,
        pagesGold: pulled.length,
        message: `✓ ${ad.pageName || pid} — ${activeAds} ads`,
      });
    }

    // Delay entre bibliotecas — mais curto que keyword para não bloquear o pipeline
    const libDelayMin = parseInt(process.env.SPY_LIBRARY_DELAY_MIN || '150', 10) || 150;
    const libDelayMax = parseInt(process.env.SPY_LIBRARY_DELAY_MAX || '400', 10) || 400;
    await new Promise((r) => setTimeout(r, randomDelay(libDelayMin, libDelayMax)));
  }

  return { pulled, rejected, registry };
}

module.exports = {
  pullLibrariesForRelevant,
  parseActiveAdsFromScrape,
  getMinActiveAds,
};
