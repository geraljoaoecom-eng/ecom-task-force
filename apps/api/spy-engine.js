const { sendSpyCompletionEmail } = require('./spy-notify');

const {
  MIN_ACTIVE_ADS,
  getMinActiveAds,
  SESSION_MAX_HOURS,
  getSpySession,
  updateSessionStatus,
  addKeyword,
  getNextKeyword,
  markKeyword,
  saveAdCandidate,
  discoveryExistsInSession,
  saveDiscovery,
  incrementSessionStats,
  patchSessionStats,
  addLearnedTerm,
  countPendingManualKeywords,
  flushLearnedTermsToQueue,
  countManualDiscoveries,
  getRunningSessions,
  libraryExistsGlobally,
  countKeywordDiscoveries,
  applySweepCountryOrder,
} = require('./spy-db');
const { buildAdsLibrarySearchUrl, buildPageLibraryUrl, resolveSpyMarketCountry, withLibraryCountry } = require('./spy-url-builder');
const { countryLabelFromCode } = require('./meta-ads-library-options');
const { resolveTargetCountries } = require('./spy-language-markets');
const { scrapeKeywordSearch, quickCountLibraryAds, closeSharedBrowser, getSpyScraperMode } = require('./spy-search-scraper');
const {
  checkMetaScraperHealth,
  isMetaScraperConfigured,
} = require('./spy-meta-orchestrator');
const { getHealthyProxy, setActiveProxyUrl, clearActiveProxyUrl } = require('./browser-manager');
const { generateSeedKeywords, analyzeAdRelevance } = require('./spy-ad-analyzer');
const {
  classifyDrOffer,
  extractDrLearnablePhrases,
  isManualKeywordSource,
} = require('./spy-dr-guard');
const {
  resolveScrollCollectCap,
  formatDiscoveryTarget,
  shouldStopForDiscoveryTarget,
  resolveDiscoveryTarget,
} = require('./spy-ad-limits');
const { runDeepSearch } = require('./spy-deep-search');
const { analyzeLibraryFromUrl } = require('./library-analyzer-service');
const { applySessionToDraft } = require('./spy-taxonomy');
const {
  getNicheKeywords,
  upsertNicheKeyword,
  seedNicheKeywords,
  recordKeywordOutcome,
  applySessionKeywordPriorities,
} = require('./spy-niche-intel');
const { pushLiveStats, formatKeywordLive } = require('./spy-live-stats');

const HEAD_KEYWORD_TERMS = new Set([
  'emagrecer',
  'perder peso',
  'dieta',
  'emagrecimento',
  'weight loss',
  'diet',
  'lose weight',
]);

function sortKeywordsBySpecificity(keywords) {
  return [...keywords].sort((a, b) => {
    const aHead = HEAD_KEYWORD_TERMS.has(String(a).trim().toLowerCase()) ? 1 : 0;
    const bHead = HEAD_KEYWORD_TERMS.has(String(b).trim().toLowerCase()) ? 1 : 0;
    if (aHead !== bHead) return aHead - bHead;
    const aWords = String(a).trim().split(/\s+/).length;
    const bWords = String(b).trim().split(/\s+/).length;
    if (aWords !== bWords) return bWords - aWords;
    return String(b).length - String(a).length;
  });
}
const { adaptKeywordsForMarket } = require('./spy-keyword-adapt');
const { recordPageOutcome, GOLD_TIER } = require('./spy-page-intel');
const { closeResidentialBrowser, closeDirectBrowser } = require('./spy-meta-scraper');

const MAX_KEYWORDS_PER_SESSION = parseInt(process.env.SPY_MAX_KEYWORDS || '50', 10) || 50;
const MAX_LEARNED_KEYWORDS = parseInt(process.env.SPY_MAX_LEARNED_KEYWORDS || '15', 10) || 15;
const ENRICH_CONCURRENCY = Math.min(5, parseInt(process.env.SPY_ENRICH_CONCURRENCY || '3', 10) || 3);
const FAST_DISCOVERY = process.env.SPY_FAST_DISCOVERY !== 'false';

async function countSessionKeywords(sessionId) {
  const { pool } = require('./db');
  const { rows } = await pool.query(
    `SELECT count(*)::int AS total,
            count(*) FILTER (WHERE source = 'learned')::int AS learned
     FROM spy_keywords WHERE session_id = $1`,
    [sessionId]
  );
  return rows[0] || { total: 0, learned: 0 };
}

async function canQueueKeyword(sessionId, source) {
  const { total, learned } = await countSessionKeywords(sessionId);
  if (total >= MAX_KEYWORDS_PER_SESSION) return false;
  if (source === 'learned' && learned >= MAX_LEARNED_KEYWORDS) return false;
  return true;
}

function buildQuickDiscoveryDraft(ad, session, keyword, activeAds, country) {
  return {
    name: ad.pageName || `Anunciante ${ad.pageId}`,
    sourceType: 'URL',
    sourceValue: ad.libraryUrl,
    activeAdsEstimate: activeAds,
    nichos: session.nicho || '',
    produtos: session.produto || '',
    // país da PESQUISA (sweep: país da keyword) — não o default BR; mostra o nome
    paises: (() => {
      const cc = country || session.country || '';
      return cc ? (countryLabelFromCode(cc) || cc) : '';
    })(),
    idiomas: session.language || '',
    estrategias: '',
    notes: `SPY · keyword: ${keyword}`,
    pages: [ad.libraryUrl],
  };
}

/**
 * Grava um discovery ASSIM QUE a biblioteca passa o gate (Fase 3), sem esperar o fim
 * da keyword. Idempotente: o guard discoveryExistsInSession evita duplicar.
 */
async function saveIncrementalDiscovery(session, sessionId, keyword, enriched, keywordCountry = '') {
  const pageId = String(enriched.pageId || '').replace(/\D/g, '');
  const fd = enriched.fullDetails || {};
  const adText = fd.fullCopy || enriched.headline || '';
  const mobileVerified = ['dr_verified', 'mobile_library_verified'].includes(enriched.relevance?.reason);
  if (!mobileVerified) {
    const dr = classifyDrOffer(adText, fd.landingUrl || enriched.landingUrl, {
      ...session,
      keyword,
      pageName: fd.pageName || enriched.pageName,
    });
    if (!dr.isDr) {
      console.log(`   ↷ SPY skip discovery ${enriched.pageName || pageId}: ${dr.reason}`);
      return;
    }
  }

  const discoveryCountry = resolveSpyMarketCountry(
    keywordCountry,
    session.country,
    enriched.searchCountry
  );

  let libraryUrl = enriched.libraryUrl || null;
  libraryUrl = withLibraryCountry(libraryUrl, discoveryCountry)
    || (pageId ? buildPageLibraryUrl(pageId, discoveryCountry) : null);
  if (!libraryUrl) return;

  const activeAds = Number(
    enriched.activeAds ??
    enriched.fullDetails?.libraryAdsCollected ??
    enriched.rawMeta?.activeAds ??
    0
  );
  const minAds = session?.stats?.minActiveAds ?? getMinActiveAds();
  if (activeAds < minAds) {
    console.log(`   ↷ SPY skip discovery ${enriched.pageName || pageId}: ${activeAds} ads (< ${minAds})`);
    return;
  }

  if (await discoveryExistsInSession(sessionId, libraryUrl, pageId)) return;

  const adShape = {
    pageId,
    pageName: fd.pageName || enriched.pageName || null,
    libraryUrl,
    adText: fd.fullCopy || enriched.headline || '',
    landingUrl: fd.landingUrl || null,
    imageUrl: fd.imageUrl || enriched.imageUrl || enriched.thumbnailUrl || null,
    videoUrl: fd.videoUrl || enriched.videoUrl || null,
  };

  let draft;
  if (FAST_DISCOVERY) {
    draft = buildQuickDiscoveryDraft(adShape, session, keyword, activeAds, discoveryCountry);
  } else {
    draft = applySessionToDraft(await analyzeLibraryFromUrl(libraryUrl), session);
    draft.activeAdsEstimate = activeAds;
    if (discoveryCountry && !draft.paises) draft.paises = discoveryCountry;
  }

  const saved = await saveDiscovery(sessionId, draft, {
    pageId,
    keywordOrigin: keyword,
    relevanceScore: enriched.relevance?.score,
    adAssets: [
      {
        adText: adShape.adText,
        landingUrl: adShape.landingUrl,
        imageUrl: adShape.imageUrl,
        videoUrl: adShape.videoUrl,
        keyword,
        relevanceScore: enriched.relevance?.score,
        relevanceReason: enriched.relevance?.reason,
      },
    ],
  });
  if (!saved) return; // sessão desapareceu — descartar

  await incrementSessionStats(sessionId, { discoveriesCount: 1 });
  bumpKeywordDiscovery(sessionId, keyword);
  try { require('./spy-trends').markTrendsDirty(); } catch {}
  await pushLiveStats(sessionId, {
    phase: 'enrich',
    keyword,
    discoveries: getKeywordMetrics(sessionId, keyword).discoveriesCount,
    message: `✓ discovery: ${draft.name} — ${activeAds} ads activos`,
  });
  console.log(`✅ SPY discovery incremental: ${draft.name} (${activeAds} ads activos · keyword "${keyword}")`);

  await maybeLearnDrPhrases(session, sessionId, { source: 'deep', keyword }, adShape);
}

/**
 * Marca frases DR candidatas (spy_learned_terms) — só após keyword manual com bons sinais.
 * Pesquisa-as no fim da fila (flushLearnedTermsToQueue).
 */
async function maybeLearnDrPhrases(session, sessionId, kwRow, ad) {
  if (process.env.SPY_DISABLE_LEARNED_KEYWORDS === 'true') return;
  if (!isManualKeywordSource(kwRow?.source)) return;

  const km = getKeywordMetrics(sessionId, kwRow.keyword);
  if ((km.discoveriesCount || 0) < 1) return;

  const adText = ad.adText || ad.headline || enrichedHeadline(ad) || '';
  const dr = classifyDrOffer(adText, ad.landingUrl, {
    ...session,
    keyword: kwRow.keyword,
    pageName: ad.pageName,
  });
  if (!dr.isDr) return;

  const seedKws = session.stats?.marketIntel?.keywords || [];
  const phrases = extractDrLearnablePhrases(adText, seedKws, 3);
  for (const phrase of phrases) {
    if (!(await canQueueKeyword(sessionId, 'learned'))) break;
    await addLearnedTerm(sessionId, phrase, {
      fromKeyword: kwRow.keyword,
      drScore: dr.score,
      pending: true,
    }, dr.score);
  }
}

function enrichedHeadline(ad) {
  return ad.rawMeta?.headline || ad.headline || '';
}

const activeWorkers = new Map();
const enrichQueues = new Map();
const enrichWorkers = new Map();
const searchDoneFlags = new Map();
/** @type {Map<string, Map<string, { adsFound: number, relevantCount: number, discoveriesCount: number }>>} */
const keywordMetrics = new Map();
/** @type {Map<string, Set<string>>} */
const keywordRoiFinalized = new Map();

function markKeywordRoiDone(sessionId, keyword) {
  const kw = keyword.trim().toLowerCase();
  if (!keywordRoiFinalized.has(sessionId)) keywordRoiFinalized.set(sessionId, new Set());
  keywordRoiFinalized.get(sessionId).add(kw);
}

function isKeywordRoiDone(sessionId, keyword) {
  return keywordRoiFinalized.get(sessionId)?.has(keyword.trim().toLowerCase());
}

function getKeywordMetrics(sessionId, keyword) {
  if (!keywordMetrics.has(sessionId)) keywordMetrics.set(sessionId, new Map());
  const m = keywordMetrics.get(sessionId);
  const kw = keyword.trim().toLowerCase();
  if (!m.has(kw)) m.set(kw, { adsFound: 0, relevantCount: 0, discoveriesCount: 0 });
  return m.get(kw);
}

function bumpKeywordDiscovery(sessionId, keyword) {
  const stats = getKeywordMetrics(sessionId, keyword);
  stats.discoveriesCount += 1;
}

async function finalizeKeywordRoi(session, sessionId, keyword, adsFound, relevantCount, country = '') {
  const kw = keyword.trim().toLowerCase();

  // O estado da linha (done) tem de ser por país no Language Sweep, mesmo sem nicho.
  const mem = getKeywordMetrics(sessionId, kw);
  const dbDiscoveries = await countKeywordDiscoveries(sessionId, kw);
  const discoveriesCount = Math.max(mem.discoveriesCount, dbDiscoveries);

  await markKeyword(sessionId, kw, 'done', adsFound || mem.adsFound, {
    relevantCount: relevantCount || mem.relevantCount,
    discoveriesCount,
    country,
  });

  // Aprendizagem de ROI do nicho é agregada por keyword (sem país) — só quando há nicho.
  if (!session.nicho) return;
  await recordKeywordOutcome(session.nicho, session.country, kw, {
    adsFound: adsFound || mem.adsFound,
    relevantCount: relevantCount || mem.relevantCount,
    discoveriesCount,
  });
  markKeywordRoiDone(sessionId, kw);
}

async function flushAllKeywordRoi(sessionId, session) {
  if (!session?.nicho) return;
  const { pool } = require('./db');
  const { rows } = await pool.query(
    `SELECT keyword, ads_found, ads_relevant, discoveries_count, status
     FROM spy_keywords WHERE session_id = $1`,
    [sessionId]
  );
  for (const row of rows) {
    if (isKeywordRoiDone(sessionId, row.keyword)) continue;
    const dbDiscoveries = await countKeywordDiscoveries(sessionId, row.keyword);
    const discoveriesCount = Math.max(row.discoveries_count || 0, dbDiscoveries);
    await recordKeywordOutcome(session.nicho, session.country, row.keyword, {
      adsFound: row.ads_found || 0,
      relevantCount: row.ads_relevant || 0,
      discoveriesCount,
    });
    markKeywordRoiDone(sessionId, row.keyword);
  }
  keywordMetrics.delete(sessionId);
  keywordRoiFinalized.delete(sessionId);
}

function isSessionExpired(session) {
  if (!session.deadlineAt) return false;
  return Date.now() > new Date(session.deadlineAt).getTime();
}

function shouldStopSearch(session) {
  // Sessão null (apagada/indisponível) → parar o loop sem rebentar
  if (!session) return true;
  return (
    session.status === 'cancelled' ||
    session.status === 'completed' ||
    session.status === 'timeout' ||
    session.pauseSearch ||
    isSessionExpired(session)
  );
}

async function getSpySessionByIdOnly(sessionId) {
  const { pool } = require('./db');
  const { rows } = await pool.query('SELECT * FROM spy_sessions WHERE id = $1', [sessionId]);
  const { mapSession } = require('./spy-db');
  return mapSession(rows[0]);
}

function enqueueEnrich(sessionId, task) {
  if (!enrichQueues.has(sessionId)) enrichQueues.set(sessionId, []);
  enrichQueues.get(sessionId).push(task);
}

async function enrichLibraryCandidate(session, task) {
  const { ad, keyword } = task;
  const marketCountry = resolveSpyMarketCountry(task.keywordCountry, session.country);
  ad.libraryUrl =
    withLibraryCountry(ad.libraryUrl, marketCountry) ||
    (ad.pageId ? buildPageLibraryUrl(ad.pageId, marketCountry) : ad.libraryUrl);

  const dr = classifyDrOffer(ad.adText || ad.headline || '', ad.landingUrl, {
    ...session,
    keyword,
    pageName: ad.pageName,
  });
  const mobileVerified = ['dr_verified', 'mobile_library_verified'].includes(task.relevance?.reason);
  if (!mobileVerified && !dr.isDr) {
    console.log(`↷ SPY skip enrich ${ad.pageId}: ${dr.reason}`);
    return;
  }

  await incrementSessionStats(session.id, { librariesChecked: 1 });

  if (await discoveryExistsInSession(session.id, ad.libraryUrl, ad.pageId)) return;

  const existingLibId = await libraryExistsGlobally(ad.libraryUrl, {
    country: session.country,
  });
  if (existingLibId) {
    const { pool } = require('./db');
    const { rows } = await pool.query('SELECT * FROM libraries WHERE id = $1', [existingLibId]);
    const lib = rows[0];
    if (lib) {
      const pages = await pool.query('SELECT url FROM pages WHERE library_id = $1', [existingLibId]);
      const draft = applySessionToDraft(
        {
          name: lib.name,
          sourceType: lib.source_type,
          sourceValue: lib.source_value,
          activeAdsEstimate: lib.active_ads,
          nichos: lib.nichos,
          estrategias: lib.estrategias,
          produtos: lib.produtos,
          idiomas: lib.idiomas,
          paises: lib.paises,
          notes: lib.notes,
          pages: pages.rows.map((p) => p.url),
        },
        session
      );
      const savedExisting = await saveDiscovery(session.id, draft, {
        pageId: ad.pageId,
        keywordOrigin: keyword,
        relevanceScore: task.relevance?.score,
        adAssets: [{
          adText: ad.adText,
          imageUrl: ad.imageUrl,
          videoUrl: ad.videoUrl,
          videoTranscript: task.relevance?.videoTranscript,
        }],
      });
      // Sessão desapareceu durante o enrich — não contar discovery
      if (!savedExisting) return;
      await incrementSessionStats(session.id, { discoveriesCount: 1 });
      bumpKeywordDiscovery(session.id, keyword);
      await pushLiveStats(session.id, {
        phase: 'enrich',
        keyword,
        discoveries: (getKeywordMetrics(session.id, keyword).discoveriesCount),
        message: formatKeywordLive(
          keyword,
          null,
          null,
          null,
          null,
          getKeywordMetrics(session.id, keyword).discoveriesCount
        ),
      });
    }
    return;
  }

  const minAds = session?.stats?.minActiveAds ?? getMinActiveAds();
  const preCount = ad.activeAdsEstimate ?? ad.rawMeta?.activeAds ?? task.activeAds;
  let activeAds = typeof preCount === 'number' && preCount >= minAds ? preCount : null;

  if (activeAds == null) {
    activeAds = await quickCountLibraryAds(ad.libraryUrl);
  }
  if (activeAds < minAds) {
    console.log(`↷ SPY skip ${ad.pageId}: ${activeAds} ads (< ${minAds})`);
    return;
  }

  let draft;
  if (FAST_DISCOVERY) {
    draft = buildQuickDiscoveryDraft(ad, session, keyword, activeAds, marketCountry);
    console.log(`✅ SPY discovery rápido: ${draft.name} (${activeAds} ads)`);
  } else {
    console.log(`🔬 SPY analyze completo: ${ad.libraryUrl} (${activeAds} ads)`);
    draft = applySessionToDraft(await analyzeLibraryFromUrl(ad.libraryUrl), session);
    draft.activeAdsEstimate = activeAds;
  }

  const saved = await saveDiscovery(session.id, draft, {
    pageId: ad.pageId,
    keywordOrigin: keyword,
    relevanceScore: task.relevance?.score,
    adAssets: [
      {
        adText: ad.adText,
        imageUrl: ad.imageUrl,
        videoUrl: ad.videoUrl,
        landingUrl: ad.landingUrl,
        keyword,
        relevanceScore: task.relevance?.score,
        relevanceReason: task.relevance?.reason,
        videoTranscript: task.relevance?.videoTranscript,
      },
    ],
  });

  // Sessão desapareceu durante o enrich — não contar discovery
  if (!saved) return;

  if (session.nicho && ad.pageId) {
    await recordPageOutcome(session.nicho, session.country, ad.pageId, {
      tier: GOLD_TIER,
      relevanceScore: Math.max(task.relevance?.score ?? 0.85, 0.85),
      pageName: draft.name || ad.pageName,
      libraryUrl: ad.libraryUrl,
      keyword,
      reason: 'discovery: biblioteca validada',
      activeAds,
      cachedProfile: {
        adText: ad.adText,
        fullDetails: { fullCopy: ad.adText, landingUrl: ad.landingUrl },
        cardData: draft,
      },
    });
  }

  await incrementSessionStats(session.id, { discoveriesCount: 1 });
  bumpKeywordDiscovery(session.id, keyword);
  await pushLiveStats(session.id, {
    phase: 'enrich',
    keyword,
    discoveries: getKeywordMetrics(session.id, keyword).discoveriesCount,
    message: formatKeywordLive(
      keyword,
      null,
      null,
      null,
      null,
      getKeywordMetrics(session.id, keyword).discoveriesCount
    ),
  });
}

async function runEnrichWorker(sessionId) {
  if (enrichWorkers.has(sessionId)) return;
  enrichWorkers.set(sessionId, true);
  const inFlight = new Set();

  while (true) {
    const session = await getSpySessionByIdOnly(sessionId);
    if (!session || session.status === 'cancelled') break;
    if (shouldStopForDiscoveryTarget(session)) break;

    const queue = enrichQueues.get(sessionId) || [];

    while (inFlight.size < ENRICH_CONCURRENCY && queue.length) {
      const task = queue.shift();
      const job = enrichLibraryCandidate(session, task)
        .catch((err) => console.error(`❌ SPY enrich (${sessionId}):`, err.message))
        .finally(() => inFlight.delete(job));
      inFlight.add(job);
    }

    if (searchDoneFlags.get(sessionId) && !queue.length && inFlight.size === 0) break;

    if (inFlight.size > 0) {
      await Promise.race([...inFlight, new Promise((r) => setTimeout(r, 800))]);
    } else {
      await new Promise((r) => setTimeout(r, 600));
    }
  }

  await Promise.allSettled([...inFlight]);
  enrichWorkers.delete(sessionId);
}

async function ensureSpyScraperReady(session = null) {
  const mode = getSpyScraperMode();

  if (mode === 'apify') {
    const { checkApifyHealth, isApifyConfigured } = require('./spy-apify-scraper');
    if (!isApifyConfigured()) {
      return {
        ok: false,
        message: 'SPY Apify legado: APIFY_API_TOKEN não definido.',
      };
    }
    const { healthy } = await checkApifyHealth();
    if (!healthy) {
      return { ok: false, message: 'Apify legado indisponível.' };
    }
    return { ok: true, mode: 'apify' };
  }

  if (mode === 'meta') {
    const plat = String(session?.stats?.mobilePlatform || '').toLowerCase();
    const { isMobileBridgeRequired, isBridgeReady, isBridgeReadyForPlatform, getBridgeStatus } = require('./spy-mobile-bridge');
    if (isMobileBridgeRequired()) {
      const ready = plat ? isBridgeReadyForPlatform(plat) : isBridgeReady();
      if (!ready) {
        const label =
          plat === 'iphone' ? 'iPhone' : plat === 'ipad' ? 'iPad' : plat === 'windows' ? 'Windows' : 'Mac/móvel';
        return {
          ok: false,
          message:
            plat === 'iphone' || plat === 'ipad'
              ? `SPY ${label}: toca Activar no /spy (dados móveis) e mantém o ecrã aberto.`
              : plat === 'windows'
                ? 'SPY Windows: liga o PC ao hotspot do telemóvel, corre a ponte no PowerShell e clica Activar.'
                : 'SPY exige dados móveis — liga o iPhone ao Mac (USB), corre o agente SPY e testa a ligação.',
        };
      }
      const st = getBridgeStatus();
      const agent = (st.agents || []).find((a) => !plat || String(a.platform).toLowerCase() === plat) || st.agents[0];
      console.log(`✅ SPY Meta — ponte móvel (${agent?.isp || agent?.ip || plat || 'agent'})`);
      return { ok: true, mode: 'mobile', proxy: agent?.ip || 'mobile' };
    }
    if (isMetaScraperConfigured()) {
      const { healthy, ip, error } = await checkMetaScraperHealth();
      if (!healthy) {
        console.warn(`⚠️ Proxy residencial indisponível (${error}) — a continuar com IP directo`);
      } else {
        return { ok: true, mode: 'meta', proxy: ip || 'residential' };
      }
    }
    // Sem proxy configurado ou proxy em baixo — usar IP directo (hotspot dados móveis)
    return { ok: true, mode: 'direct', proxy: 'direct' };
  }

  const proxy = await getHealthyProxy();
  if (!proxy) {
    return {
      ok: false,
      message:
        'Proxy ISP bloqueado ou offline — SPY cancelado. Configura RESIDENTIAL_PROXY_URL ou SPY_PROXY_URL.',
    };
  }
  setActiveProxyUrl(proxy);
  return { ok: true, mode: 'puppeteer', proxy };
}

async function runSearchLoop(sessionId) {
  let session = await getSpySessionByIdOnly(sessionId);
  if (!session) return;

  const ready = await ensureSpyScraperReady(session);
  if (!ready.ok) {
    console.log(`❌ SPY cancelado: ${ready.message}`);
    await updateSessionStatus(sessionId, {
      status: 'failed',
      errorMessage: ready.message,
      endedAt: new Date(),
    });
    return;
  }

  if (ready.mode === 'meta' || ready.mode === 'mobile') {
    console.log(`✅ SPY Meta — tráfego Meta via ${ready.mode === 'mobile' ? 'telemóvel' : 'VPS/proxy'}`);
  } else if (ready.mode === 'direct') {
    console.log(`✅ SPY Meta — IP directo (dados móveis hotspot)`);
  } else {
    const mask = String(ready.proxy || '').replace(/:[^:@/]+@/, ':***@');
    console.log(`✅ Proxy saudável — iniciando SPY (${mask})`);
  }

  try {
    await runSearchLoopInner(sessionId);
  } finally {
    if (ready.mode === 'puppeteer') clearActiveProxyUrl();
    if (ready.mode === 'meta' || ready.mode === 'mobile' || ready.mode === 'direct') {
      await closeResidentialBrowser().catch(() => {});
      await closeDirectBrowser().catch(() => {});
    }
    await closeSharedBrowser().catch(() => {});
  }
}

async function runSearchLoopInner(sessionId) {
  let session = await getSpySessionByIdOnly(sessionId);
  if (!session) return;

  searchDoneFlags.set(sessionId, false);
  runEnrichWorker(sessionId);

  await updateSessionStatus(sessionId, {
    status: 'running',
    startedAt: session.startedAt || new Date(),
  });

  // Fase 0 — Deep Search ou keywords pré-aprovadas (modo consultor GPT)
  const preApproved =
    session.stats?.keywordsPreApproved && session.stats?.marketIntel?.keywords?.length;
  const { pais, idioma } = require('./spy-keyword-adapt').marketContext(session);
  let marketIntel = preApproved ? session.stats.marketIntel : null;

  const nicheIntelRows = session.nicho
    ? await getNicheKeywords(session.nicho, session.country, 40)
    : [];
  const existingNicheKw = nicheIntelRows.map((r) => r.keyword);
  if (existingNicheKw.length) {
    console.log(`📚 SPY niche intel: ${existingNicheKw.length} keywords guardadas (${session.nicho})`);
  }

  if (preApproved) {
    const isManual = marketIntel?.source === 'manual';
    console.log(
      `🧠 SPY ${isManual ? 'Manual' : 'Consultor'}: ${marketIntel.keywords.length} keywords pré-aprovadas — skip deep search` +
      (isManual ? ' · aprendizagem DR no fim da fila (só após keywords manuais)' : '')
    );
    await patchSessionStats(sessionId, { deepSearchStatus: 'done', marketIntel });
    if (session.nicho && marketIntel?.keywords?.length) {
      await seedNicheKeywords(session.nicho, session.country, marketIntel.keywords, isManual ? 'manual' : 'deep');
    }
    await pushLiveStats(sessionId, {
      phase: 'deep_search',
      message: isManual
        ? `${marketIntel.keywords.length} keywords manuais na fila — 0€ GPT deep search`
        : `Plano GPT aprovado — ${marketIntel.keywords.length} keywords na fila`,
    });
  } else {
    await patchSessionStats(sessionId, { deepSearchStatus: 'running' });
    await pushLiveStats(sessionId, {
      phase: 'deep_search',
      message: `Deep Search — IA a gerar keywords para ${idioma} (${pais})… ~30–60s`,
    });

    try {
      console.log(`🧠 SPY Deep Search: ${session.name}`);
      marketIntel = await runDeepSearch(session, existingNicheKw);
      await patchSessionStats(sessionId, {
        marketIntel,
        deepSearchStatus: 'done',
      });
      if (session.nicho && marketIntel?.keywords?.length) {
        await seedNicheKeywords(session.nicho, session.country, marketIntel.keywords, 'deep');
      }
      if (marketIntel?.keywordSeedAdapted && marketIntel?.localeNotes) {
        await pushLiveStats(sessionId, {
          phase: 'deep_search',
          message: marketIntel.localeNotes,
          keyword: marketIntel.keywordSeedAdapted,
        });
      }
    } catch (err) {
      console.error(`❌ SPY Deep Search (${sessionId}):`, err.message);
      const { fallbackMarketIntel } = require('./spy-deep-search');
      marketIntel = fallbackMarketIntel(session);
      await patchSessionStats(sessionId, {
        marketIntel,
        deepSearchStatus: 'failed',
        deepSearchError: err.message,
      });
    }
  }

  session = await getSpySessionByIdOnly(sessionId);
  session.stats = { ...session.stats, marketIntel };

  const keywordSet = new Set();
  const orderedKw = [];
  const pushKw = (kw) => {
    const norm = String(kw || '').trim();
    if (!norm) return;
    const key = norm.toLowerCase();
    if (keywordSet.has(key)) return;
    keywordSet.add(key);
    orderedKw.push(key);
  };

  for (const kw of marketIntel?.keywords || []) pushKw(kw);

  let nicheKwForQueue = existingNicheKw;
  if (existingNicheKw.length && (session.country || session.language)) {
    nicheKwForQueue = await adaptKeywordsForMarket(session, existingNicheKw.slice(0, 25), {
      reason: 'keywords históricas do nicho',
    });
  }
  if (!preApproved) {
    for (const kw of nicheKwForQueue) pushKw(kw);
  }

  // Só keywords heurísticas se deep search falhou ou deu poucas (não em modo consultor)
  const deepOk = marketIntel?.keywords?.length >= 5 && !marketIntel?.fallback;
  if (!preApproved && !deepOk) {
    const heur = generateSeedKeywords(session);
    const heurAdapted = await adaptKeywordsForMarket(session, heur, { reason: 'heurísticas' });
    for (const kw of heurAdapted) pushKw(kw);
  }

  const deepKw = new Set((marketIntel?.keywords || []).map((k) => k.trim().toLowerCase()));
  const nicheKwSet = new Set(existingNicheKw.map((k) => k.trim().toLowerCase()));
  const kwList = (preApproved ? orderedKw : sortKeywordsBySpecificity(orderedKw))
    .filter(Boolean)
    .slice(0, MAX_KEYWORDS_PER_SESSION);
  // Language Sweep: país definido → [país]; só idioma → países dessa língua por interesse DR; nada → ['ALL']
  const targetCountries = resolveTargetCountries(session);
  const isSweep = targetCountries.length > 1;
  if (isSweep) {
    const { countryLabelFromCode } = require('./meta-ads-library-options');
    const labels = targetCountries.map((c) => countryLabelFromCode(c) || c).join(', ');
    console.log(`   🌍 Language Sweep (${session.language}): ${targetCountries.length} países → ${labels}`);
  }

  // Keywords genéricas de CTA (mais cobertura, mais lixo) ficam no fim da fila
  const genericKwSet = new Set(
    (session.stats?.marketIntel?.keywordsGeneric || []).map((k) => String(k).trim().toLowerCase())
  );

  // Mapa de metadados por keyword — para log detalhado na execução
  const kwMeta = new Map(); // keyword → { generic, source, basePriority }

  let queued = 0;
  for (const kw of kwList) {
    const source = deepKw.has(kw) ? 'deep' : nicheKwSet.has(kw) ? 'niche_intel' : 'seed';
    const basePriority = genericKwSet.has(kw) ? -10 : 0;
    kwMeta.set(kw, { generic: genericKwSet.has(kw), source, basePriority });
    for (const cc of targetCountries) {
      const added = await addKeyword(sessionId, kw, source, basePriority, cc === 'ALL' ? '' : cc);
      if (added) queued++;
    }
  }
  await incrementSessionStats(sessionId, { keywordsQueued: queued });

  if (session.nicho && kwList.length) {
    const keywordsWithSource = kwList.map((kw) => ({
      keyword: kw,
      source: deepKw.has(kw) ? 'deep' : nicheKwSet.has(kw) ? 'niche_intel' : 'seed',
    }));
    await applySessionKeywordPriorities(sessionId, session.nicho, session.country, keywordsWithSource);
    console.log(`   📊 Fila SPY ordenada por ROI histórico do nicho (${keywordsWithSource.length} keywords)`);
  }

  // Cache de scores históricos da niche_intel — evita query por keyword na execução
  const nicheScoreCache = new Map();
  if (session.nicho && kwList.length) {
    try {
      const { pool: _pool } = require('./db');
      const { rows: nicheRows } = await _pool.query(
        `SELECT keyword, score, hit_count, discoveries_total
         FROM spy_niche_intel
         WHERE nicho = $1 AND keyword = ANY($2::text[])`,
        [session.nicho.trim().toUpperCase(), kwList]
      );
      for (const row of nicheRows) nicheScoreCache.set(row.keyword, row);
    } catch (_) {}
  }

  // Sweep: garante varredura mercado-a-mercado (país[0] esgota antes do país[1])
  if (isSweep) await applySweepCountryOrder(sessionId, targetCountries);

  await pushLiveStats(sessionId, {
    phase: 'keywords',
    keywordsQueued: queued,
    message: `${queued} keywords na fila (prioridade por histórico + deep search)`,
  });

  console.log(
    `🔎 SPY ${queued} keywords na fila (máx ${MAX_KEYWORDS_PER_SESSION}, ${deepKw.size} do deep search)`
  );
  console.log(`   📊 ${formatDiscoveryTarget(session)} · scroll até esgotar em cada keyword`);

  let idleRounds = 0;

  while (true) {
    // Obter sessão de forma resiliente — falha de BD não mata o worker
    try {
      session = await getSpySessionByIdOnly(sessionId);
    } catch (fetchErr) {
      console.error(`❌ SPY worker (obter sessão ${sessionId}):`, fetchErr.message);
      await new Promise((r) => setTimeout(r, 5000));
      continue;
    }
    if (!session) {
      console.warn(`⚠️ SPY sessão ${sessionId} não encontrada — a terminar worker`);
      break;
    }
    if (shouldStopSearch(session)) break;

    if (shouldStopForDiscoveryTarget(session)) {
      const target = require('./spy-ad-limits').resolveDiscoveryTarget(session);
      console.log(`⏹️ SPY: objectivo de ${target} discovery(s) atingido`);
      await pushLiveStats(sessionId, {
        phase: 'complete',
        message: `Objectivo atingido — ${target} discovery(s) encontrado(s)`,
      });
      break;
    }

    const collectCap = resolveScrollCollectCap();

    let kwRow;
    try {
      kwRow = await getNextKeyword(sessionId);
    } catch (kwErr) {
      console.error(`❌ SPY worker (obter keyword ${sessionId}):`, kwErr.message);
      await new Promise((r) => setTimeout(r, 5000));
      continue;
    }
    if (!kwRow) {
      const manualLeft = await countPendingManualKeywords(sessionId);
      if (manualLeft === 0) {
        const manualDisc = await countManualDiscoveries(sessionId);
        if (manualDisc >= 1) {
          const flushed = await flushLearnedTermsToQueue(
            sessionId,
            session.country || '',
            MAX_LEARNED_KEYWORDS
          );
          if (flushed > 0) {
            console.log(`   🧠 SPY: ${flushed} keywords DR aprendidas → fila (depois das manuais)`);
            await incrementSessionStats(sessionId, { keywordsQueued: flushed });
            idleRounds = 0;
            continue;
          }
        } else {
          console.log('   🧠 SPY: keywords aprendidas ignoradas — 0 discoveries nas manuais');
        }
      }
      idleRounds++;
      if (idleRounds >= 6) break;
      await new Promise((r) => setTimeout(r, 5000));
      continue;
    }
    idleRounds = 0;

    const keyword = kwRow.keyword;
    // País da linha (Language Sweep) tem prioridade sobre o país da sessão; fallback ALL.
    const kwCountry = kwRow.country || session.country || 'ALL';
    const searchUrl = buildAdsLibrarySearchUrl(keyword, kwCountry);

    {
      const m = kwMeta.get(keyword) || {};
      const intel = nicheScoreCache.get(keyword);
      const genericLabel = m.generic === true ? 'genérica' : m.generic === false ? 'específica' : '?';
      const basePrioStr = m.basePriority != null ? String(m.basePriority) : '?';
      const finalPrioStr = kwRow.priority != null ? String(kwRow.priority) : '?';
      const intelStr = intel
        ? ` histórico[score=${Number(intel.score).toFixed(1)} hits=${intel.hit_count} disc=${intel.discoveries_total}]`
        : '';
      console.log(
        `🔎 SPY keyword: "${keyword}"` +
        `${kwRow.country ? ` [${kwRow.country}]` : ''}` +
        ` | src:${kwRow.source || m.source || '?'} ${genericLabel}` +
        ` | basePrio:${basePrioStr} → finalPrio:${finalPrioStr}` +
        intelStr +
        ` | país URL: ${kwCountry}`
      );
    }

    try {
      await markKeyword(sessionId, keyword, 'running', 0, { country: kwRow.country || '' });
      await pushLiveStats(sessionId, {
        phase: 'keyword',
        keyword,
        message: `Keyword «${keyword}»${kwRow.country ? ` (${kwRow.country})` : ''} — a pesquisar Meta…`,
      });

      // Gravação INCREMENTAL: cada biblioteca DR com ≥ mín ads vira discovery na hora
      // (dentro da Fase 3), em vez de só no fim da keyword.
      const onDiscovery = async (enriched) => {
        try {
          await saveIncrementalDiscovery(session, sessionId, keyword, enriched, kwRow.country || '');
        } catch (e) {
          console.warn(`   ⚠️ SPY discovery incremental:`, e.message);
        }
      };

      // Objectivo de discoveries RESTANTE → o agente pára o scroll ao atingi-lo (parar ao 1º, etc.)
      const dTarget = resolveDiscoveryTarget(session);
      const remainingTarget = dTarget != null
        ? Math.max(1, dTarget - (session?.stats?.discoveriesCount ?? 0))
        : null;

      const scrapeResult = await scrapeKeywordSearch(searchUrl, {
        sessionId,
        keywordId: kwRow.id,
        session,
        collectCap,
        scrollToEnd: true,
        aiGuided: false,
        onDiscovery,
        minActiveAds: session?.stats?.minActiveAds ?? getMinActiveAds(),
        minDaysActive: session?.stats?.minDaysActive,
        maxDaysActive: session?.stats?.maxDaysActive,
        discoveryTarget: remainingTarget,
      });
      const { ads } = scrapeResult;
      const meta = scrapeResult.meta || {};
      const scanned = scrapeResult.rawCount ?? meta.scanned ?? ads.length;
      console.log(`   → ${scanned} scrollados · ${ads.length} bibliotecas na keyword "${keyword}" (${scrapeResult.source || 'unknown'})`);

      let relevantCount = 0;
      const km = getKeywordMetrics(sessionId, keyword);
      km.adsFound = scanned;

      await pushLiveStats(sessionId, {
        phase: 'keyword',
        keyword,
        pagesFound: ads.length,
        pagesGold: meta.cacheGold ?? meta.cacheProfile ?? 0,
        libraryVisits: meta.pages ? undefined : meta.relevant,
        message: formatKeywordLive(keyword, ads.length, null, meta.relevant, meta.cacheProfile),
      });

      await incrementSessionStats(sessionId, { adsScanned: scanned, keywordsDone: 1 });

      for (const ad of ads) {
        session = await getSpySessionByIdOnly(sessionId);
        if (shouldStopSearch(session)) break;

        // Pipeline Meta: usar score real do filtro móvel — não marcar tudo como relevante
        let relevance;
        if (scrapeResult.source === 'meta') {
          const score = ad.relevanceScore ?? null;
          if (score != null) {
            relevance = {
              relevant: score >= 0.5,
              score,
              reason: ad.relevanceReason || 'spy_meta_filter',
            };
          } else if (ad.activeAdsEstimate != null) {
            relevance = {
              relevant: ad.activeAdsEstimate >= (session?.stats?.minActiveAds ?? getMinActiveAds()),
              score: 0.85,
              reason: 'mobile_library_verified',
            };
          } else {
            relevance = await analyzeAdRelevance(ad, {
              ...session,
              keywordSeedAdapted: session.stats?.marketIntel?.keywordSeedAdapted,
              stats: { ...(session.stats || {}), marketIntel: session.stats?.marketIntel },
            });
          }
        } else {
          relevance = await analyzeAdRelevance(ad, {
            ...session,
            keywordSeedAdapted: session.stats?.marketIntel?.keywordSeedAdapted,
            stats: { ...(session.stats || {}), marketIntel: session.stats?.marketIntel },
          });
        }
        await saveAdCandidate({
          sessionId,
          keywordId: kwRow.id,
          libraryUrl: ad.libraryUrl,
          pageId: ad.pageId,
          adText: ad.adText,
          imageUrl: ad.imageUrl,
          videoUrl: ad.videoUrl,
          landingUrl: ad.landingUrl,
          relevanceScore: ad.relevanceScore ?? relevance.score,
          relevanceReason: ad.relevanceReason ?? relevance.reason,
          status: relevance.relevant ? 'relevant' : 'rejected',
          rawData: ad,
          metaAdId: ad.metaAdId || null,
          headline: ad.rawMeta?.headline || ad.adText?.slice(0, 150) || null,
          thumbnailUrl: ad.rawMeta?.thumbnailUrl || ad.imageUrl || null,
          scrapePhase: scrapeResult.source === 'meta' ? 'meta_pipeline' : null,
          metaDetails: ad.rawMeta || {},
        });

        if (!relevance.relevant) {
          continue;
        }
        await incrementSessionStats(sessionId, { adsRelevant: 1 });
        relevantCount += 1;
        km.relevantCount = relevantCount;

        const marketCountry = resolveSpyMarketCountry(kwRow.country, session.country);
        ad.libraryUrl =
          withLibraryCountry(ad.libraryUrl, marketCountry) ||
          (ad.pageId ? buildPageLibraryUrl(ad.pageId, marketCountry) : ad.libraryUrl);

        await maybeLearnDrPhrases(session, sessionId, kwRow, ad);

        enqueueEnrich(sessionId, {
          ad,
          keyword,
          relevance,
          keywordCountry: kwRow.country || session.country || '',
        });
      }

      km.relevantCount = relevantCount;
      await pushLiveStats(sessionId, {
        phase: 'keyword',
        keyword,
        pagesFound: ads.length,
        relevant: relevantCount,
        message: formatKeywordLive(keyword, ads.length, relevantCount),
      });

      await finalizeKeywordRoi(session, sessionId, keyword, scanned, relevantCount, kwRow.country || '');
      {
        const km2 = getKeywordMetrics(sessionId, keyword);
        const disc = km2.discoveriesCount || 0;
        console.log(
          `   ✅ "${keyword}" concluída — anúncios:${ads.length} relevantes:${relevantCount} discoveries:${disc}`
        );
      }
    } catch (err) {
      console.error(`❌ SPY keyword "${keyword}":`, err.message);
      await markKeyword(sessionId, keyword, 'failed', 0, { country: kwRow.country || '' });
      if (session.nicho && !isKeywordRoiDone(sessionId, keyword)) {
        await recordKeywordOutcome(session.nicho, session.country, keyword, {
          adsFound: 0,
          relevantCount: 0,
          discoveriesCount: 0,
        });
        markKeywordRoiDone(sessionId, keyword);
      }
      // Após erro mobile (timeout/browser crash), aguardar cooldown antes da próxima keyword
      // para dar tempo ao agente de reiniciar o browser
      const isMobileErr = /timeout|frame too early|bridge|móvel|mobile|agente/i.test(err.message);
      if (isMobileErr) {
        const cooldownMs = parseInt(process.env.SPY_MOBILE_COOLDOWN_MS || '20000', 10) || 20000;
        console.log(`   ⏳ SPY: aguardar ${cooldownMs / 1000}s para browser móvel recuperar…`);
        await new Promise((r) => setTimeout(r, cooldownMs));
      }
    }
  }

  searchDoneFlags.set(sessionId, true);

  for (let i = 0; i < 720; i++) {
    // Sem worker de enrich activo, nada drena a fila — não vale a pena esperar
    // (acontece quando o objectivo de discoveries é atingido e o worker pára).
    if (!enrichWorkers.has(sessionId)) break;
    await new Promise((r) => setTimeout(r, 5000));
  }
  // Limpar fila de enrich pendente (objectivo atingido → não precisamos de mais)
  enrichQueues.delete(sessionId);

  session = await getSpySessionByIdOnly(sessionId);
  // Sessão apagada durante a corrida — nada a finalizar
  if (!session) {
    console.warn(`⚠️ SPY sessão ${sessionId} desapareceu antes de finalizar`);
    await closeSharedBrowser().catch(() => {});
    return;
  }
  if (session.status === 'cancelled') return;

  await flushAllKeywordRoi(sessionId, session);
  await pushLiveStats(sessionId, {
    phase: 'done',
    message: 'Pesquisa SPY concluída — intel de keywords actualizada',
  });

  await closeSharedBrowser().catch(() => {});

  if (session.pauseSearch) {
    await updateSessionStatus(sessionId, { status: 'paused' });
    console.log(`⏸️ SPY sessão ${sessionId} pausada`);
    return;
  }

  const finalStatus = isSessionExpired(session) ? 'timeout' : 'completed';
  const updated = await updateSessionStatus(sessionId, {
    status: finalStatus,
    endedAt: new Date(),
  });

  try {
    await sendSpyCompletionEmail(updated, updated.stats || {});
  } catch (err) {
    console.warn(`⚠️ SPY email conclusão:`, err.message);
  }
  console.log(`✅ SPY sessão ${sessionId} terminou (${finalStatus})`);
}

async function startSpySession(sessionId) {
  if (activeWorkers.has(sessionId)) return;
  activeWorkers.set(sessionId, true);

  runSearchLoop(sessionId)
    .catch(async (err) => {
      console.error(`❌ SPY worker crash ${sessionId}:`, err);
      // Crash → marcar failed (NUNCA deixar running órfã)
      try {
        await updateSessionStatus(sessionId, {
          status: 'failed',
          errorMessage: err.message,
          endedAt: new Date(),
        });
      } catch (statusErr) {
        console.error(`❌ SPY worker crash ${sessionId} (falha a marcar failed):`, statusErr.message);
      }
    })
    .finally(() => {
      activeWorkers.delete(sessionId);
      enrichQueues.delete(sessionId);
      searchDoneFlags.delete(sessionId);
    });
}

async function resumeRunningSessions() {
  const sessions = await getRunningSessions();
  // Sessão `running` sem progresso há mais de 30 min = órfã (worker morreu noutro arranque).
  // Marcar failed em vez de retomar em loop de crash.
  const STALE_MS = parseInt(process.env.SPY_ORPHAN_STALE_MS || '1800000', 10) || 1800000;
  for (const s of sessions) {
    if (!['queued', 'running', 'paused'].includes(s.status) || s.pauseSearch) continue;

    if (s.status === 'running') {
      const lastProgress = new Date(s.updatedAt || s.createdAt || Date.now()).getTime();
      if (Date.now() - lastProgress > STALE_MS) {
        console.warn(`⚠️ SPY sessão órfã ${s.id} (sem progresso há > ${Math.round(STALE_MS / 60000)}min) — marcar failed`);
        try {
          await updateSessionStatus(s.id, {
            status: 'failed',
            errorMessage: 'Sessão órfã detectada no arranque',
            endedAt: new Date(),
          });
        } catch (err) {
          console.error(`❌ SPY marcar órfã ${s.id}:`, err.message);
        }
        continue;
      }
    }

    console.log(`🔄 SPY retomar: ${s.id}`);
    startSpySession(s.id);
  }
}

async function pauseSpySession(sessionId, userId) {
  const session = await getSpySession(sessionId, userId);
  if (!session) return null;
  return updateSessionStatus(sessionId, { pauseSearch: true, status: 'paused' });
}

async function cancelSpySession(sessionId, userId) {
  const session = await getSpySession(sessionId, userId);
  if (!session) return null;
  searchDoneFlags.set(sessionId, true);
  return updateSessionStatus(sessionId, {
    status: 'cancelled',
    pauseSearch: true,
    endedAt: new Date(),
  });
}

async function resumeSpySession(sessionId, userId) {
  const session = await getSpySession(sessionId, userId);
  if (!session) return null;
  await updateSessionStatus(sessionId, { pauseSearch: false, status: 'running' });
  if (!activeWorkers.has(sessionId)) startSpySession(sessionId);
  return getSpySession(sessionId, userId);
}

module.exports = {
  startSpySession,
  resumeRunningSessions,
  pauseSpySession,
  cancelSpySession,
  resumeSpySession,
  MIN_ACTIVE_ADS,
  SESSION_MAX_HOURS,
};
