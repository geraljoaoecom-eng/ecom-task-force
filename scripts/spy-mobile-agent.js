#!/usr/bin/env node
/**
 * Agente SPY — corre no Mac com iPhone (hotspot/USB/dados móveis).
 *
 * Pipeline completo no Mac:
 *   1. Scrolla keyword page no Meta
 *   2. A cada 20 ads → filtra DR localmente (chama VPS /spy/filter-batch)
 *   3. Para cada relevante → abre biblioteca directamente (dados móveis)
 *   4. Se ≥ minActiveAds → envia discovery confirmado para VPS
 *   5. Scroll continua em paralelo com verificação das bibliotecas
 */
const os   = require('os');
const path = require('path');

const API_DIR = path.join(__dirname, '../apps/api');
process.chdir(API_DIR);

const { detectMobileConnection }  = require(path.join(API_DIR, 'spy-mobile-connect'));
const {
  scrapeKeywordSearchPhase,
  quickCountLibraryPage,
  probeLibraryPage,
  closeDirectBrowser,
} = require(path.join(API_DIR, 'spy-meta-scraper'));
const { buildPageLibraryUrl, resolveSpyMarketCountry, withLibraryCountry } = require(path.join(API_DIR, 'spy-url-builder'));
const {
  parseDaysActiveFilter,
  formatDaysActiveFilter,
} = require(path.join(API_DIR, 'spy-ad-age-filter'));
const { normPageId }                 = require(path.join(API_DIR, 'spy-page-intel'));
const { parseCriteriaFromSearchUrl } = require(path.join(API_DIR, 'spy-meta-filter'));

const CREDS_FILE = path.join(os.homedir(), '.ecom-spy-mobile-agent.json');
const AGENT_ID_FILE = path.join(os.homedir(), '.ecom-spy-mobile-agent-id');

// Carregar credenciais guardadas (agentId + agentKey do registo anterior)
function loadStoredCreds() {
  try {
    const fs = require('fs');
    if (fs.existsSync(CREDS_FILE)) return JSON.parse(fs.readFileSync(CREDS_FILE, 'utf8'));
  } catch {}
  return {};
}
function saveStoredCreds(obj) {
  try { require('fs').writeFileSync(CREDS_FILE, JSON.stringify(obj, null, 2)); } catch {}
}

const storedCreds = loadStoredCreds();
const API     = (process.env.SPY_API_URL || storedCreds.apiUrl || 'https://ecoomtaskforce.site/api').replace(/\/$/, '');
const SECRET  = process.env.SPY_MOBILE_AGENT_SECRET || '';
const POLL_MS = parseInt(process.env.SPY_MOBILE_POLL_MS || '2000', 10) || 2000;
const DEVICE  = process.env.SPY_MOBILE_DEVICE_NAME || `${os.hostname()} (Mac)`;

let agentId   = process.env.SPY_MOBILE_AGENT_ID || storedCreds.agentId || null;
let agentKey  = storedCreds.agentKey || null;

function loadAgentId() {
  if (agentId) return agentId;
  try {
    const fs = require('fs');
    if (fs.existsSync(AGENT_ID_FILE)) agentId = fs.readFileSync(AGENT_ID_FILE, 'utf8').trim();
  } catch {}
  return agentId;
}

function saveAgentId(id) {
  agentId = id;
  try { require('fs').writeFileSync(AGENT_ID_FILE, id); } catch {}
}

function buildAuthHeaders() {
  // Preferir agentId+agentKey (sem necessidade de SECRET); fallback para SECRET
  if (agentId && agentKey) {
    return { 'X-Spy-Agent-Key': agentKey, 'x-spy-agent-id': agentId };
  }
  return { 'X-Spy-Mobile-Secret': SECRET };
}

async function api(method, pathSuffix, body) {
  const res = await fetch(`${API}${pathSuffix}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...buildAuthHeaders() },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(120000),
  });
  const text = await res.text();
  let data = {};
  try { data = text ? JSON.parse(text) : {}; } catch { data = { raw: text }; }
  if (!res.ok) throw new Error(data.error || data.message || `HTTP ${res.status}`);
  return data;
}

// Filtro DR — chama VPS com fallback heurístico local
async function filterBatch(ads, criteria) {
  try {
    const res = await api('POST', '/spy/filter-batch', { ads, criteria });
    return res.relevant || [];
  } catch {
    // Fallback: heurística simples se VPS falhar
    const kw = String(criteria?.keyword || '').toLowerCase();
    const INST = /\b(banco|telecom|governo|ong|câmara|município|ministerio|fnac|continente|worten|vodafone)\b/i;
    return ads.filter(ad => {
      const text = `${ad.headline || ''} ${ad.body || ''} ${ad.pageName || ''}`.toLowerCase();
      if (INST.test(text)) return false;
      return (kw && text.includes(kw)) ||
        /curso|método|ebook|desconto|oferta|resultado|compra|grátis|desafio|infoproduto|afilia/i.test(text);
    });
  }
}

// Verifica biblioteca de um anunciante relevante
async function checkLibrary(ad, minAds, country, daysActiveFilter, marketCountry) {
  const pid = normPageId(ad.pageId);
  if (!pid) return null;

  // País da pesquisa → CONSTRÓI SEMPRE o URL com este país (ignora ad.libraryUrl, que
  // pode vir com o default BR do scraper). Conta ads no mercado certo e o discovery
  // fica com o link correcto.
  const libCountry = resolveSpyMarketCountry(country, marketCountry);
  const libraryUrl = buildPageLibraryUrl(pid, libCountry);

  try {
    const probeOpts = { directScrape: true, daysActiveFilter: daysActiveFilter || null };
    const probe = daysActiveFilter?.enabled
      ? await probeLibraryPage(libraryUrl, probeOpts)
      : { activeAds: await quickCountLibraryPage(libraryUrl, probeOpts), ageMatch: true, sampledAds: 0 };
    const activeAds = probe.activeAds;
    const ageLabel = daysActiveFilter?.enabled ? ` · ${formatDaysActiveFilter(daysActiveFilter)}` : '';
    console.log(`   📚 ${ad.pageName || pid}: ${activeAds ?? '?'} ads activos (mín ${minAds})${ageLabel}`);

    if (activeAds == null || activeAds < minAds) return null;
    if (daysActiveFilter?.enabled && !probe.ageMatch) {
      console.log(`   ↷ ${ad.pageName || pid}: sem ads no intervalo ${formatDaysActiveFilter(daysActiveFilter)} (${probe.sampledAds} amostrados)`);
      return null;
    }

    const adText = ad.headline || ad.adText || ad.body || '';
    const { classifyDrOffer } = require(path.join(API_DIR, 'spy-dr-guard'));
    const dr = classifyDrOffer(adText, ad.landingUrl, {
      keyword: criteria?.keyword,
      nicho: criteria?.nicho,
      produto: criteria?.produto,
      language: criteria?.language,
      pageName: ad.pageName,
    });
    if (!dr.isDr) {
      console.log(`   ↷ ${ad.pageName || pid}: ${dr.reason} (não DR)`);
      return null;
    }

    // Enriquecer com dados da biblioteca
    const enriched = enrichFromRawMetadata(ad);
    enriched.activeAds  = activeAds;
    // URL da biblioteca com o PAÍS da pesquisa (não o default BR) — para o discovery
    // apontar e mostrar o mercado correcto.
    enriched.libraryUrl = libraryUrl;
    if (country && country !== 'ALL') enriched.searchCountry = country;
    enriched.relevance  = ad.relevance || { relevant: true, score: 0.8, reason: 'dr_verified' };
    // Usar SEMPRE o ad original do scroll móvel para copy/image/video.
    // O scrape VPS (datacenter IP) devolve ads diferentes dos vistos no iPhone —
    // não o usar para conteúdo, só para contar ads activos.
    enriched.fullDetails = {
      ...(enriched.fullDetails || {}),
      fullCopy:   ad.headline || ad.adText || '',
      landingUrl: ad.landingUrl || '',
      imageUrl:   ad.imageUrl || ad.thumbnailUrl || null,
      videoUrl:   ad.videoUrl || null,
      pageName:   ad.pageName || null,
      libraryAdsCollected: activeAds ?? 0,
    };
    return enriched;
  } catch (e) {
    console.warn(`   ⚠️ Biblioteca ${pid}: ${e.message}`);
    return null;
  }
}

// Watchdog: se não chega nenhum batch novo durante STALL_MS, aborta a keyword
const STALL_MS = 10 * 60 * 1000; // 10 minutos sem progresso = stuck

// Job principal: scroll + filtro + biblioteca — tudo no Mac
async function runKeywordSearchJob(job, sendDiscovery) {
  const { searchUrl, options } = job.payload;
  const criteria   = parseCriteriaFromSearchUrl(searchUrl, options.criteria || options.session || {});
  const marketCountry = resolveSpyMarketCountry(criteria.country, options.session?.country);
  console.log(`   🌍 Mercado: ${marketCountry}${searchUrl.includes('country=') ? '' : ' (URL sem país — corrigido)'}`);
  const minAds     = options.minActiveAds ?? getMinActiveAds();
  const daysActiveFilter = parseDaysActiveFilter(options.minDaysActive, options.maxDaysActive);
  if (daysActiveFilter?.enabled) {
    console.log(`   📅 Filtro dias activos: ${formatDaysActiveFilter(daysActiveFilter)}`);
  }
  // Objectivo de discoveries para ESTE job (restante da sessão). null = sem limite.
  const stopTarget = (typeof options.discoveryTarget === 'number' && options.discoveryTarget > 0)
    ? options.discoveryTarget : null;
  const visitedIds = new Set();
  let   totalDiscoveries = 0;
  let   totalScrolled    = 0;
  let   reachedTarget    = false;
  let   abortedByWatchdog = false;

  const targetReached = () => {
    if (stopTarget != null && totalDiscoveries >= stopTarget) reachedTarget = true;
    return reachedTarget || abortedByWatchdog;
  };

  // Watchdog: reinicia a cada batch recebido; dispara se ficar STALL_MS sem actividade
  let lastActivityAt = Date.now();
  const watchdogTimer = setInterval(() => {
    if (Date.now() - lastActivityAt > STALL_MS) {
      console.warn(`   ⚠️ Watchdog: sem progresso há ${Math.round(STALL_MS / 60000)}min — a abortar keyword`);
      abortedByWatchdog = true;
      clearInterval(watchdogTimer);
    }
  }, 30_000);

  // Pool de verificações de biblioteca (5 em simultâneo para processar em paralelo com o scroll)
  const libraryQueue = [];
  let   runningLibrary = 0;
  const MAX_LIB = 5;

  const flushLibraryQueue = async () => {
    while (libraryQueue.length > 0 && runningLibrary < MAX_LIB && !reachedTarget) {
      const ad = libraryQueue.shift();
      runningLibrary++;
      checkLibrary(ad, minAds, criteria.country, daysActiveFilter, marketCountry)
        .then(async (discovery) => {
          lastActivityAt = Date.now(); // biblioteca activa = progresso
          if (discovery && !reachedTarget) {
            totalDiscoveries++;
            console.log(`   🎯 Discovery #${totalDiscoveries}: ${discovery.pageName || discovery.pageId}`);
            await sendDiscovery(discovery).catch(e => console.warn('⚠️ sendDiscovery:', e.message));
            if (targetReached()) {
              libraryQueue.length = 0;
              console.log(`   ⏹️ Objectivo de ${stopTarget} discovery(s) atingido — a parar`);
            }
          }
        })
        .catch(e => console.warn('⚠️ checkLibrary:', e.message))
        .finally(() => {
          runningLibrary--;
          flushLibraryQueue();
        });
    }
  };

  const onBatch = async (ads) => {
    if (reachedTarget) return;
    lastActivityAt = Date.now(); // novo batch = progresso
    totalScrolled += ads.length;
    console.log(`   🔄 ${totalScrolled} ads scrollados, a filtrar batch de ${ads.length}…`);

    const relevant = await filterBatch(ads, criteria);
    if (!relevant.length) return;

    console.log(`   ✅ ${relevant.length}/${ads.length} DR relevantes`);

    for (const ad of relevant) {
      const pid = normPageId(ad.pageId);
      if (!pid || visitedIds.has(pid)) continue;
      visitedIds.add(pid);
      libraryQueue.push(ad);
    }

    flushLibraryQueue();
  };

  try {
    // Scroll sem timeout — corre até esgotar a página ou watchdog disparar
    await scrapeKeywordSearchPhase(searchUrl, {
      ...options,
      criteria,
      marketCountry,
      mobileTimeoutMs: 0,
      livePipeline: {
        onCollectionUpdate: onBatch,
        shouldStop: targetReached,
      },
    });
  } finally {
    clearInterval(watchdogTimer);
  }

  if (abortedByWatchdog) {
    throw new Error(`Keyword abortada por watchdog — sem progresso durante ${Math.round(STALL_MS / 60000)} minutos`);
  }

  // Aguardar biblioteca queue terminar
  if (libraryQueue.length > 0 || runningLibrary > 0) {
    console.log(`   ⏳ A terminar ${libraryQueue.length + runningLibrary} verificações de biblioteca…`);
    await new Promise(resolve => {
      const check = setInterval(() => {
        if (libraryQueue.length === 0 && runningLibrary === 0) {
          clearInterval(check);
          resolve();
        }
      }, 500);
    });
  }

  return { rawCount: totalScrolled, discoveries: totalDiscoveries };
}

// Registo e heartbeat
async function register() {
  console.log('🔍 A testar ligação (deve ser dados móveis do iPhone)…');
  const check = await detectMobileConnection();
  console.log(`   IP: ${check.ip || '?'} — ${check.ok ? '✅ ' + check.reason : '❌ ' + check.reason}`);
  if (!check.ok) { console.error('\n❌ Liga o iPhone (hotspot ou USB).\n'); process.exit(1); }

  const data = await api('POST', '/spy/mobile/register', {
    agentId: loadAgentId(), deviceName: DEVICE, connectionCheck: check,
  });
  saveAgentId(data.agentId);
  if (data.agentKey) {
    agentKey = data.agentKey;
    saveStoredCreds({ agentId: data.agentId, agentKey: data.agentKey, apiUrl: API });
  }
  console.log(`\n✅ Agente registado — ${data.agentId.slice(0, 8)}…\n`);
  return data.agentId;
}

async function heartbeat(id) {
  try {
    const check = await detectMobileConnection();
    await api('POST', '/spy/mobile/heartbeat', { agentId: id, connectionCheck: check });
  } catch (e) { console.warn('⚠️ Heartbeat:', e.message); }
}

// Job de biblioteca (deep-scan de Bibliotecas): scrape local de TODOS os ads da página
// → devolve ao VPS para popular library_ads (analytics + copy vault). Corre via dados
// móveis (a Meta serve dados vazios a IPs de datacenter/proxy).
async function runLibraryPageJob(job) {
  const { libraryUrl, options } = job.payload;
  const maxAds = options?.collectCap || options?.maxAds || 80;
  const scrape = await scrapeLibraryPagePhase(libraryUrl, {
    directScrape: true,
    scrollToEnd: options?.scrollToEnd !== false,
    maxAds,
    aiGuided: false,
  });
  console.log(`   📚 library_page: ${scrape?.ads?.length ?? 0} ads recolhidos`);
  return scrape;
}

// Pool de jobs activos (suporta keyword_search + verificações de biblioteca em simultâneo)
const runningJobs = new Map();

async function pollJobs(id) {
  if (runningJobs.size >= 2) return; // máx 2 jobs simultâneos
  const data = await api('GET', `/spy/mobile/jobs/claim?agentId=${encodeURIComponent(id)}`);
  if (!data.job) return;
  const job = data.job;
  if (runningJobs.has(job.id)) return;

  console.log(`📱 Job ${job.type} (${job.id.slice(0, 8)}…)`);

  const sendDiscovery = async (discovery) => {
    await api('POST', `/spy/mobile/jobs/${job.id}/partial`, { agentId: id, ads: [discovery] });
  };

  const p = (async () => {
    if (job.type === 'keyword_search') {
      return await runKeywordSearchJob(job, sendDiscovery);
    }
    if (job.type === 'library_page') {
      return await runLibraryPageJob(job);
    }
    throw new Error(`Tipo de job desconhecido: ${job.type}`);
  })()
  .then(async (result) => {
    await api('POST', `/spy/mobile/jobs/${job.id}/complete`, { agentId: id, result });
    console.log(`   ✅ Job completo — ${result?.discoveries ?? 0} discoveries, ${result?.rawCount ?? 0} ads`);
  })
  .catch(async (err) => {
    await api('POST', `/spy/mobile/jobs/${job.id}/complete`, { agentId: id, error: err.message }).catch(() => {});
    console.error(`   ❌ ${job.type}: ${err.message}`);
  })
  .finally(async () => {
    runningJobs.delete(job.id);
    await closeDirectBrowser().catch(() => {});
  });

  runningJobs.set(job.id, p);
}

async function main() {
  // SECRET opcional — usa agentId+agentKey guardados se existirem
  if (!SECRET && !agentKey) {
    console.error('❌ Sem credenciais (SPY_MOBILE_AGENT_SECRET ou agentKey guardado)');
    process.exit(1);
  }

  console.log(`\n📱 ECOM SPY — Agente móvel`);
  console.log(`   API: ${API}`);
  console.log(`   Dispositivo: ${DEVICE}\n`);

  const id = await register();
  let beat = 0;

  process.on('SIGINT', () => { console.log('\n👋 Agente parado'); process.exit(0); });
  console.log('⏳ À espera de pesquisas SPY…\n');

  while (true) {
    try {
      if (beat % 5 === 0) await heartbeat(id);
      beat++;
      await pollJobs(id);
    } catch (e) { console.warn('⚠️', e.message); }
    await new Promise(r => setTimeout(r, POLL_MS));
  }
}

main().catch(e => { console.error('❌', e.message); process.exit(1); });
