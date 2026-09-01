/**
 * Meta Ads Library — recolha GraphQL (sem imagens/vídeo).
 * Pesquisa por keyword: IP VPS (zero GB proxy).
 * Biblioteca page_id: proxy residencial (único consumo de banda paga).
 */
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const { launchBrowser } = require('./browser-manager');
const { buildPageLibraryUrl, isKeywordLibraryUrl } = require('./spy-url-builder');
const { runAiGuidedScrollLoop, isLibraryAiEnabled } = require('./spy-library-ai-scraper');

puppeteer.use(StealthPlugin());

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

function getMetaConfig() {
  const maxAds = parseInt(process.env.SPY_META_MAX_ADS_DEFAULT || '10000', 10);
  const delayMin = parseInt(process.env.SPY_META_DELAY_MIN || '400', 10);
  const delayMax = parseInt(process.env.SPY_META_DELAY_MAX || '1200', 10);
  const maxStagnant = parseInt(process.env.SPY_META_MAX_STAGNANT || '8', 10);
  const scrollToEndStagnant = parseInt(process.env.SPY_META_SCROLL_TO_END_STAGNANT || '50', 10);
  const maxScrollRounds = parseInt(process.env.SPY_META_MAX_SCROLL_ROUNDS || '500', 10);
  return {
    proxyUrl: process.env.RESIDENTIAL_PROXY_URL?.trim() || null,
    maxAds: Number.isFinite(maxAds) && maxAds > 0 ? Math.min(maxAds, 100000) : 10000,
    delayMin: Number.isFinite(delayMin) ? delayMin : 400,
    delayMax: Number.isFinite(delayMax) ? delayMax : 1200,
    maxStagnant: Number.isFinite(maxStagnant) && maxStagnant >= 3 ? maxStagnant : 8,
    scrollToEndStagnant:
      Number.isFinite(scrollToEndStagnant) && scrollToEndStagnant >= 8 ? scrollToEndStagnant : 40,
    maxScrollRounds:
      Number.isFinite(maxScrollRounds) && maxScrollRounds >= 20 ? maxScrollRounds : 200,
  };
}

/** Bloqueia assets pesados — mantém document + xhr/fetch (GraphQL Meta). */
async function configureMetaBandwidthSaver(page) {
  await page.setRequestInterception(true);
  page.on('request', (req) => {
    const type = req.resourceType();
    const url = req.url();
    // Bloquear só MÍDIA pesada (imagens/vídeo/fontes) para poupar banda. NÃO bloquear
    // stylesheet/websocket/manifest — a Meta deteta esse bloqueio como "ad blocker" e
    // degrada/oculta os ads (sobretudo via proxy), resultando em 0 anúncios extraídos.
    if (['image', 'media', 'font'].includes(type)) {
      req.abort();
      return;
    }
    if (/\.(png|jpe?g|webp|gif|mp4|webm|m3u8|woff2?|ttf)(\?|$)/i.test(url)) {
      req.abort();
      return;
    }
    req.continue();
  });
}

function isResidentialProxyConfigured() {
  return !!getMetaConfig().proxyUrl;
}

function isMetaScraperConfigured() {
  const { isMobileBridgeRequired } = require('./spy-mobile-bridge');
  if (isMobileBridgeRequired()) return true;
  return isResidentialProxyConfigured();
}

function randomDelay(min, max) {
  const lo = Math.min(min, max);
  const hi = Math.max(min, max);
  return lo + Math.floor(Math.random() * (hi - lo + 1));
}

function parseProxyUrl(raw) {
  try {
    const parsed = new URL(raw);
    const protocol = parsed.protocol.replace(':', '');
    const host = parsed.hostname;
    const port = parsed.port || (protocol.startsWith('socks') ? '1080' : '80');
    const username = parsed.username ? decodeURIComponent(parsed.username) : null;
    const password = parsed.password ? decodeURIComponent(parsed.password) : null;
    return {
      server: `${protocol}://${host}:${port}`,
      username,
      password,
    };
  } catch {
    return null;
  }
}

async function launchResidentialBrowser() {
  const { proxyUrl } = getMetaConfig();
  if (!proxyUrl) {
    throw new Error('RESIDENTIAL_PROXY_URL não configurado');
  }

  const proxy = parseProxyUrl(proxyUrl);
  const args = [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage',
    '--disable-blink-features=AutomationControlled',
    '--lang=en-US,pt-BR',
  ];
  if (proxy?.server) args.push(`--proxy-server=${proxy.server}`);

  const browser = await puppeteer.launch({
    headless: 'new',
    args,
  });

  const originalNewPage = browser.newPage.bind(browser);
  browser.newPage = async () => {
    const page = await originalNewPage();
    await page.setUserAgent(USER_AGENT);
    await page.setViewport({ width: 1366, height: 900 });
    if (proxy?.username && proxy?.password) {
      await page.authenticate({ username: proxy.username, password: proxy.password });
    }
    return page;
  };

  console.log(`🌐 SPY Meta browser (proxy residencial rotating): ${proxy?.server || proxyUrl}`);
  return browser;
}

function truncate(text, max = 150) {
  const t = String(text || '').replace(/\s+/g, ' ').trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}

function pickThumbnail(snapshot = {}) {
  const card = Array.isArray(snapshot.cards) && snapshot.cards[0] ? snapshot.cards[0] : {};
  return (
    card.resizedImageUrl ||
    card.originalImageUrl ||
    (Array.isArray(snapshot.images) && snapshot.images[0]?.resizedImageUrl) ||
    (Array.isArray(snapshot.images) && snapshot.images[0]?.originalImageUrl) ||
    null
  );
}

function pickHeadline(snapshot = {}, fallback = '') {
  const card = Array.isArray(snapshot.cards) && snapshot.cards[0] ? snapshot.cards[0] : {};
  const text = snapshot.body?.text || card.body || card.title || snapshot.title || fallback || '';
  return truncate(text, 150);
}

function normalizeAdRecord(partial, marketCountry) {
  const adId = String(partial.adId || partial.ad_archive_id || '').replace(/\D/g, '');
  const pageId = String(partial.pageId || partial.page_id || '').replace(/\D/g, '');
  if (!adId) return null;

  const snapshot = partial.snapshot || partial.raw?.snapshot || {};
  const headline = partial.headline || pickHeadline(snapshot, partial.adText);
  const pageName = partial.pageName || snapshot.pageName || partial.page_name || null;
  const cc = marketCountry || partial.searchCountry || partial.marketCountry || 'ALL';

  return {
    adId,
    pageId: pageId || null,
    pageName,
    headline,
    thumbnailUrl: partial.thumbnailUrl || pickThumbnail(snapshot),
    startDate: partial.startDate || partial.start_date || snapshot.startDate || null,
    isActive:
      partial.isActive !== undefined
        ? !!partial.isActive
        : partial.is_active !== false && partial.is_active !== 'INACTIVE',
    adStatus: partial.isActive === false || partial.is_active === 'INACTIVE' ? 'inactive' : 'active',
    libraryUrl: pageId ? buildPageLibraryUrl(pageId, cc) : null,
    landingUrl: partial.landingUrl || snapshot.linkUrl || null,
    rawMetadata: partial.raw || partial,
  };
}

/** Resposta leve Mac→VPS (evita PayloadTooLarge com 50+ ads). */
function slimAdsForTransport(ads) {
  return (ads || []).map((ad) => ({
    adId: ad.adId,
    pageId: ad.pageId,
    pageName: ad.pageName,
    headline: ad.headline,
    thumbnailUrl: ad.thumbnailUrl,
    videoUrl: ad.videoUrl || null,
    startDate: ad.startDate,
    isActive: ad.isActive,
    adStatus: ad.adStatus,
    libraryUrl: ad.libraryUrl,
    landingUrl: ad.landingUrl,
  }));
}

function slimScrapePayload(result) {
  if (!result) return result;
  return {
    ...result,
    ads: slimAdsForTransport(result.ads),
    bodyText: String(result.bodyText || '').slice(0, 3000),
  };
}

function extractAdsFromJsonValue(node, out, seen) {
  if (node === null || node === undefined) return;

  if (Array.isArray(node)) {
    for (const item of node) extractAdsFromJsonValue(item, out, seen);
    return;
  }

  if (typeof node !== 'object') return;

  const adId =
    node.ad_archive_id ||
    node.adArchiveID ||
    node.adArchiveId ||
    node.archive_id ||
    node.collation_id;

  if (adId && (node.snapshot || node.page_id || node.pageId || node.page_name)) {
    const key = String(adId);
    if (!seen.has(key)) {
      seen.add(key);
      const rec = normalizeAdRecord({
        adId: key,
        pageId: node.page_id || node.pageId,
        pageName: node.page_name || node.pageName,
        snapshot: node.snapshot,
        startDate: node.start_date || node.startDate,
        isActive: node.is_active,
        raw: node,
      });
      if (rec) out.push(rec);
    }
  }

  for (const value of Object.values(node)) {
    extractAdsFromJsonValue(value, out, seen);
  }
}

function extractAdsFromHtml(html, out, seen) {
  if (!html) return;

  const archiveRegex = /"ad_archive_id"\s*:\s*"(\d+)"/g;
  const pageRegex = /"page_id"\s*:\s*"(\d+)"/g;
  const archives = [];
  const pages = [];
  let m;
  while ((m = archiveRegex.exec(html)) !== null) archives.push(m[1]);
  while ((m = pageRegex.exec(html)) !== null) pages.push(m[1]);

  archives.forEach((adId, idx) => {
    if (seen.has(adId)) return;
    seen.add(adId);
    const pageId = pages[idx] || pages[0] || null;
    const rec = normalizeAdRecord({
      adId,
      pageId,
      headline: '',
      raw: { source: 'html_regex' },
    });
    if (rec) out.push(rec);
  });

  const bodyRegex = /"body"\s*:\s*\{\s*"text"\s*:\s*"((?:\\.|[^"\\])*)"/g;
  while ((m = bodyRegex.exec(html)) !== null) {
    try {
      const text = JSON.parse(`"${m[1]}"`);
      const last = out[out.length - 1];
      if (last && !last.headline) last.headline = truncate(text, 150);
    } catch {
      // ignore
    }
  }
}

function extractCursorFromText(text) {
  const m = String(text || '').match(/"end_cursor"\s*:\s*"([^"]+)"/);
  return m ? m[1] : null;
}

async function dismissCookies(page) {
  try {
    await page.evaluate(() => {
      const labels = [
        'Allow all cookies',
        'Permitir todos os cookies',
        'Accept all',
        'Aceitar tudo',
      ];
      for (const btn of document.querySelectorAll('button, [role="button"]')) {
        const t = (btn.textContent || '').trim();
        if (labels.some((l) => t.includes(l))) {
          btn.click();
          return;
        }
      }
    });
    await new Promise((r) => setTimeout(r, 800));
  } catch {
    // ignore
  }
}

/**
 * Fase 1 — recolhe metadados leves até maxAds.
 * @returns {{ ads: object[], rawCount: number, cursors: string[], bodyText: string }}
 */
let sharedResidentialBrowser = null;
let residentialBrowserLock = Promise.resolve();
let sharedDirectBrowser = null;
let directBrowserLaunchLock = Promise.resolve();

// Serializa APENAS o arranque do browser (evita lançar vários). O fn corre depois
// SEM mutex, para que o scroll da keyword e as verificações de biblioteca usem abas
// separadas do mesmo browser EM PARALELO (era isto que o mutex antigo impedia).
async function ensureDirectBrowser() {
  const prev = directBrowserLaunchLock;
  let release;
  directBrowserLaunchLock = new Promise((resolve) => {
    release = resolve;
  });
  await prev;
  try {
    if (!sharedDirectBrowser || !sharedDirectBrowser.isConnected()) {
      const localProxy = process.env.SPY_MOBILE_LOCAL_PROXY?.trim();
      if (localProxy) {
        sharedDirectBrowser = await launchBrowser({ useProxy: true, proxyUrl: localProxy });
        console.log(`🌐 SPY keyword browser (USB iPhone via ${localProxy})`);
      } else {
        sharedDirectBrowser = await launchBrowser({ useProxy: false });
        console.log('🌐 SPY keyword browser (VPS directo — sem proxy residencial)');
      }
    }
    return sharedDirectBrowser;
  } finally {
    release();
  }
}

async function withDirectBrowser(fn) {
  const browser = await ensureDirectBrowser();
  return await fn(browser);
}

async function closeDirectBrowser() {
  if (sharedDirectBrowser) {
    try {
      if (sharedDirectBrowser.isConnected()) await sharedDirectBrowser.close();
    } catch {
      // ignore
    }
    sharedDirectBrowser = null;
  }
}

async function withResidentialBrowser(fn) {
  const prev = residentialBrowserLock;
  let release;
  residentialBrowserLock = new Promise((resolve) => {
    release = resolve;
  });
  await prev;
  try {
    if (!sharedResidentialBrowser || !sharedResidentialBrowser.isConnected()) {
      sharedResidentialBrowser = await launchResidentialBrowser();
    }
    return await fn(sharedResidentialBrowser);
  } finally {
    release();
  }
}

async function closeResidentialBrowser() {
  if (sharedResidentialBrowser) {
    try {
      if (sharedResidentialBrowser.isConnected()) await sharedResidentialBrowser.close();
    } catch {
      // ignore
    }
    sharedResidentialBrowser = null;
  }
}

/** Pesquisa por keyword — sempre via ponte móvel quando SPY_REQUIRE_MOBILE_BRIDGE=true. */
async function scrapeKeywordSearchPhase(searchUrl, options = {}) {
  // directScrape=true: estamos a correr DENTRO do agente do Mac. Não re-delegar para
  // a ponte (evita loop de auto-delegação) — vai direto ao browser local.
  if (options.directScrape === true) {
    return withDirectBrowser(async (browser) => {
      const page = await browser.newPage();
      await page.setUserAgent(USER_AGENT);
      await page.setViewport({ width: 1366, height: 900 });
      try {
        return await scrapeMetadataOnPage(page, searchUrl, {
          ...options,
          viaProxy: false,
          label: 'keyword',
        });
      } finally {
        await page.close().catch(() => {});
      }
    });
  }

  const { isMobileBridgeRequired, isBridgeReady, isBridgeReadyForPlatform } = require('./spy-mobile-bridge');
  const { tryDelegateMobile } = require('./spy-mobile-delegator');
  // 0 = sem timeout — o agente tem watchdog próprio e marca failed se parar sem progresso
  const mobileTimeoutMs = options.mobileTimeoutMs ?? 0;
  const { parseCriteriaFromSearchUrl } = require('./spy-meta-filter');
  const criteria = options.criteria || parseCriteriaFromSearchUrl(searchUrl, options.session || {});

  const payload = {
    searchUrl,
    options: {
      collectCap:    options.collectCap ?? options.maxAds,
      maxAds:        options.collectCap ?? options.maxAds,
      aiGuided:      options.aiGuided === true,
      scrollToEnd:   options.scrollToEnd !== false,
      criteria,
      minActiveAds:  options.minActiveAds ?? null,
      minDaysActive: options.minDaysActive ?? null,
      maxDaysActive: options.maxDaysActive ?? null,
      discoveryTarget: options.discoveryTarget ?? null,
    },
  };

  // Se já estamos DENTRO do agente móvel (livePipeline fornecido), ignorar o bridge
  // e correr directamente — caso contrário o Mac tentaria delegar para si próprio.
  const runningInsideAgent = !!(options.livePipeline?.onCollectionUpdate);

  const targetPlatform = options.session?.stats?.mobilePlatform || options.mobilePlatform || null;

  if (!runningInsideAgent && isMobileBridgeRequired()) {
    // Retry até 30s à espera que o agente envie heartbeat
    let bridgeReady = targetPlatform
      ? isBridgeReadyForPlatform(targetPlatform)
      : isBridgeReady();
    if (!bridgeReady) {
      console.log('⏳ Agente não detectado — a aguardar heartbeat (máx 30s)…');
      for (let i = 0; i < 6; i++) {
        await new Promise(r => setTimeout(r, 5000));
        bridgeReady = targetPlatform
          ? isBridgeReadyForPlatform(targetPlatform)
          : isBridgeReady();
        if (bridgeReady) break;
      }
    }
    if (!bridgeReady) {
      const label =
        targetPlatform === 'mac'
          ? 'Mac'
          : targetPlatform === 'windows'
            ? 'Windows'
            : targetPlatform === 'ipad'
              ? 'iPad'
              : targetPlatform === 'iphone'
                ? 'iPhone'
                : 'móvel';
      throw new Error(`Agente ${label} offline — toca Activar e mantém o /spy aberto`);
    }
    const delegated = await tryDelegateMobile('keyword_search', payload, mobileTimeoutMs, {
      onPartial: options.onPartial || null,
      targetPlatform,
    });
    if (!delegated) {
      throw new Error('Agente não respondeu ao job keyword_search');
    }
    return delegated;
  }

  if (!runningInsideAgent) {
    const delegated = await tryDelegateMobile('keyword_search', payload, mobileTimeoutMs, {
      onPartial: options.onPartial || null,
      targetPlatform,
    });
    if (delegated) return delegated;
  }

  // iPhone/iPad sem agente: falha clara (NÃO usar Proxy-Cheap)
  if (targetPlatform === 'iphone' || targetPlatform === 'ipad') {
    const label = targetPlatform === 'iphone' ? 'iPhone' : 'iPad';
    throw new Error(
      `Agente ${label} sem scroll — toca Activar, lança a pesquisa, «Abrir Meta» e o favorito «SPY Meta»`
    );
  }

  return withDirectBrowser(async (browser) => {
    const page = await browser.newPage();
    await page.setUserAgent(USER_AGENT);
    await page.setViewport({ width: 1366, height: 900 });
    try {
      return await scrapeMetadataOnPage(page, searchUrl, {
        ...options,
        viaProxy: false,
        label: 'keyword',
      });
    } finally {
      await page.close().catch(() => {});
    }
  });
}

/**
 * Conta ads activos e (opcional) verifica se há algum ad no intervalo de dias activos.
 * Retorna { activeAds, ageMatch, sampledAds }.
 */
async function probeLibraryPage(libraryUrl, options = {}) {
  const {
    libraryHasAdInAgeRange,
    mergeDomAds,
  } = require('./spy-ad-age-filter');
  const ageFilter = options.daysActiveFilter || null;
  const needAgeCheck = ageFilter?.enabled === true;
  const direct = options.directScrape === true;
  const runOnBrowser = direct ? withDirectBrowser : withResidentialBrowser;

  return runOnBrowser(async (browser) => {
    const page = await browser.newPage();
    await page.setUserAgent(USER_AGENT);
    await page.setViewport({ width: 1366, height: 900 });
    try {
      await configureMetaBandwidthSaver(page);
      await page.goto(libraryUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
      await dismissCookies(page);

      try {
        await page.waitForFunction(
          () => /[\d.,]+\s*(resultados?|results?|anúncios|ads)/i.test(document.body?.innerText || ''),
          { timeout: 15000 }
        );
      } catch { /* continua */ }

      const bodyText = await page.evaluate(() => document.body?.innerText || '');
      const { interpretScrapeResult } = require('./ad-count-parser');
      let result = interpretScrapeResult(bodyText, '', 0);
      if (result.status !== 'ok' || result.count == null) {
        const html = await page.content();
        result = interpretScrapeResult(bodyText, html, 0);
      }

      let activeAds = null;
      if (result.status === 'ok' && result.count != null) activeAds = result.count;
      else if (result.status === 'zero_real') activeAds = 0;

      if (!needAgeCheck) {
        return { activeAds, ageMatch: true, sampledAds: 0 };
      }

      let domAds = await extractAdsFromDomPage(page);
      const scrollRounds = parseInt(process.env.SPY_LIBRARY_AGE_PROBE_SCROLLS || '3', 10) || 3;
      for (let i = 0; i < scrollRounds && !libraryHasAdInAgeRange(domAds, ageFilter); i++) {
        await page.evaluate(() => window.scrollBy(0, Math.round(window.innerHeight * 1.8)));
        await new Promise((r) => setTimeout(r, 700));
        domAds = mergeDomAds(domAds, await extractAdsFromDomPage(page));
      }

      const ageMatch = libraryHasAdInAgeRange(domAds, ageFilter);
      return { activeAds, ageMatch, sampledAds: domAds.length };
    } finally {
      await page.close().catch(() => {});
    }
  });
}

/**
 * Conta rapidamente os ads activos duma biblioteca Meta — SEM scrollar.
 * Carrega a página, lê o "~1.600 resultados" do cabeçalho e devolve o número.
 * Muito mais rápido do que um scrape completo; útil para verificar o threshold.
 * Retorna null se não conseguir ler o número (CAPTCHA, bloqueio, etc.).
 */
async function quickCountLibraryPage(libraryUrl, options = {}) {
  if (options.daysActiveFilter?.enabled) {
    const probe = await probeLibraryPage(libraryUrl, options);
    return probe.activeAds;
  }

  const direct = options.directScrape === true;
  const runOnBrowser = direct ? withDirectBrowser : withResidentialBrowser;

  return runOnBrowser(async (browser) => {
    const page = await browser.newPage();
    await page.setUserAgent(USER_AGENT);
    await page.setViewport({ width: 1366, height: 900 });
    try {
      await configureMetaBandwidthSaver(page);
      await page.goto(libraryUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
      await dismissCookies(page);

      // Aguardar o count aparecer na página (max 15s)
      try {
        await page.waitForFunction(
          () => /[\d.,]+\s*(resultados?|results?|anúncios|ads)/i.test(document.body?.innerText || ''),
          { timeout: 15000 }
        );
      } catch { /* continua — pode não aparecer em alguns IPs */ }

      const bodyText = await page.evaluate(() => document.body?.innerText || '');
      const { interpretScrapeResult } = require('./ad-count-parser');
      const result = interpretScrapeResult(bodyText, '', 0);

      if (result.status === 'ok' && result.count != null) return result.count;
      if (result.status === 'zero_real') return 0;
      // Fallback: tentar ler directamente do HTML da página
      const html = await page.content();
      const result2 = interpretScrapeResult(bodyText, html, 0);
      if (result2.status === 'ok' && result2.count != null) return result2.count;
      if (result2.status === 'zero_real') return 0;
      return null; // não conseguiu ler
    } finally {
      await page.close().catch(() => {});
    }
  });
}

/** Biblioteca page_id — Mac móvel (preferido) ou proxy residencial. */
async function scrapeLibraryPagePhase(libraryUrl, options = {}) {
  // directScrape=true (agente do Mac) → browser local directo (dados móveis), sem proxy.
  // viaResidential=true → SALTA a delegação móvel (o agente só faz keyword_search, não
  //   library_page) e vai directo ao proxy residencial. Usado pelo deep-scan na VPS.
  const direct = options.skipMobileDelegate === true || options.directScrape === true;
  const viaResidential = options.viaResidential === true;
  const skipDelegate = direct || viaResidential;

  if (!skipDelegate) {
    const { tryDelegateMobile } = require('./spy-mobile-delegator');
    const delegated = await tryDelegateMobile(
      'library_page',
      {
        libraryUrl,
        options: {
          collectCap: options.collectCap ?? options.maxAds,
          maxAds: options.collectCap ?? options.maxAds,
          aiGuided: options.aiGuided !== false,
          scrollToEnd: options.scrollToEnd !== false,
        },
      },
      options.mobileTimeoutMs
    );
    if (delegated) return delegated;
  }

  // Proxy residencial necessário sempre que NÃO é browser directo local
  if (!direct && !isResidentialProxyConfigured()) {
    throw new Error('RESIDENTIAL_PROXY_URL necessário para abrir bibliotecas Meta (ou liga ponte móvel)');
  }

  const runOnBrowser = direct ? withDirectBrowser : withResidentialBrowser;

  return runOnBrowser(async (browser) => {
    const page = await browser.newPage();
    await page.setUserAgent(USER_AGENT);
    await page.setViewport({ width: 1366, height: 900 });
    try {
      return await scrapeMetadataOnPage(page, libraryUrl, {
        ...options,
        viaProxy: !direct,
        label: 'library',
        aiGuided: options.aiGuided !== false,
      });
    } finally {
      await page.close().catch(() => {});
    }
  });
}

/** @deprecated Use scrapeKeywordSearchPhase ou scrapeLibraryPagePhase */
async function scrapeMetadataPhase(searchUrl, options = {}) {
  if (isKeywordLibraryUrl(searchUrl)) {
    return scrapeKeywordSearchPhase(searchUrl, options);
  }
  return scrapeLibraryPagePhase(searchUrl, options);
}

/**
 * Extrai ads do DOM/HTML da página (não do GraphQL). Essencial para o IP da Contabo,
 * onde a Meta renderiza os cards no HTML mas NÃO serve o GraphQL de paginação.
 * Lê: Library ID (adId), data "Started running on" (days_active), copy, landing, media.
 */
async function extractAdsFromDomPage(page) {
  try {
    return await page.evaluate(() => {
      // Mapa adId → video_sd_url a partir do JSON embebido no HTML (o IP Contabo
      // renderiza os ads no HTML, incluindo os URLs de vídeo — sem os descarregar).
      const videoMap = {};
      try {
        const html = document.documentElement.innerHTML;
        let pos = 0;
        while (true) {
          const vIdx = html.indexOf('video_sd_url', pos);
          if (vIdx < 0) break;
          pos = vIdx + 12;
          const colon = html.indexOf('"', vIdx + 12);
          if (colon < 0) continue;
          const urlStart = colon + 2; // saltar :"
          const urlEnd = html.indexOf('"', urlStart);
          if (urlEnd < 0) continue;
          const url = html.slice(urlStart, urlEnd).replace(/\\\//g, '/');
          if (!/fbcdn|\.mp4/i.test(url)) continue;
          const back = html.slice(Math.max(0, vIdx - 4000), vIdx);
          const aIdx = back.lastIndexOf('ad_archive_id');
          if (aIdx < 0) continue;
          const m = back.slice(aIdx).match(/ad_archive_id\D+(\d+)/);
          if (m && m[1] && !videoMap[m[1]]) videoMap[m[1]] = url;
        }
      } catch (e) { /* ignore */ }

      const out = [];
      const seenCards = new Set();
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null);
      const libNodes = [];
      let tn;
      while ((tn = walker.nextNode())) {
        if (/Library ID/i.test(tn.nodeValue || '')) libNodes.push(tn);
      }
      for (const node of libNodes) {
        // Subir até ao ancestral mais apertado que contém UM só "Library ID" (= 1 card)
        let card = node.parentElement;
        while (card && card.parentElement) {
          const parentCount = (card.parentElement.innerText.match(/Library ID/gi) || []).length;
          if (parentCount > 1) break;
          card = card.parentElement;
        }
        if (!card || seenCards.has(card)) continue;
        seenCards.add(card);
        const txt = card.innerText || '';
        const idM = txt.match(/Library ID:?\s*(\d+)/i);
        if (!idM) continue;
        const startM = txt.match(
          /(?:Started|Began|Começou(?:\s+a\s+veicular)?(?:\s+em)?)\s+(?:running on\s+)?(.+?)(?:\n|·|$)/i
        );
        const hrefs = Array.from(card.querySelectorAll('a[href]')).map((a) => a.href).filter(Boolean);
        const landing = hrefs.find((h) => !/facebook\.com|fb\.com|fb\.me|\/ads\/library|l\.facebook/i.test(h)) || null;
        const hasVideoEl = !!card.querySelector('video');
        const videoUrl = videoMap[idM[1]] || null;
        const imgEl = card.querySelector('img[src*="scontent"]') || card.querySelector('img');
        const imageUrl = imgEl ? imgEl.src : null;
        out.push({
          adId: idM[1],
          startDateRaw: startM ? startM[1].trim() : null,
          bodyText: txt.replace(/\s+/g, ' ').trim().slice(0, 1200),
          landingUrl: landing,
          imageUrl,
          videoUrl,
        });
      }
      return out;
    });
  } catch {
    return [];
  }
}

async function scrapeMetadataOnPage(page, searchUrl, options = {}) {
  const cfg = getMetaConfig();
  const { UNLIMITED_CAP } = require('./spy-ad-limits');
  const scrollToEnd = options.scrollToEnd !== false;
  /** Com scroll-fim: só estagnação para — collectCap é tecto de segurança (100k por defeito). */
  const collectCap = scrollToEnd
    ? (options.collectCap ?? options.maxAds ?? UNLIMITED_CAP)
    : (options.maxAds ?? options.collectCap ?? cfg.maxAds);
  const collected = [];
  const seen = new Set();
  const cursors = [];
  let lastCursor = null;
  let stagnantRounds = 0;
  // Bibliotecas (1 anunciante) têm poucos ads e carregam rápido — parar cedo após N
  // rondas sem ads novos evita ~40 scrolls inúteis. Keyword continua exaustivo.
  const isLibraryScrape = options.label === 'library';
  const libraryStagnant =
    parseInt(process.env.SPY_LIBRARY_SCROLL_STAGNANT || '5', 10) || 5;
  // Delays mais curtos para bibliotecas — keyword precisa de mais pausa para evitar rate limit
  const libDelayMin = parseInt(process.env.SPY_LIBRARY_DELAY_MIN || '150', 10) || 150;
  const libDelayMax = parseInt(process.env.SPY_LIBRARY_DELAY_MAX || '400', 10) || 400;
  const effectiveDelayMin = isLibraryScrape ? libDelayMin : cfg.delayMin;
  const effectiveDelayMax = isLibraryScrape ? libDelayMax : cfg.delayMax;
  const maxStagnant = isLibraryScrape
    ? Math.min(libraryStagnant, cfg.scrollToEndStagnant)
    : scrollToEnd
      ? cfg.scrollToEndStagnant
      : cfg.maxStagnant;
  // Biblioteca: scroll até esgotar (stagnant para naturalmente) — tecto alto apenas como segurança
  const maxScrollRounds = isLibraryScrape
    ? Math.max(maxStagnant * 20, 100)
    : scrollToEnd
      ? cfg.maxScrollRounds
      : maxStagnant * 4;
  let scrollRounds = 0;
  const viaProxy = options.viaProxy !== false;

  try {
    await configureMetaBandwidthSaver(page);

    page.on('response', async (response) => {
      try {
        const url = response.url();
        if (!/graphql|\/api\//i.test(url)) return;
        const headers = response.headers();
        const len = parseInt(headers['content-length'] || '0', 10);
        if (len > 3_000_000) return;
        const text = await response.text();
        if (text.length < 50 || text.length > 3_000_000) return;
        const before = collected.length;
        try {
          extractAdsFromJsonValue(JSON.parse(text), collected, seen);
        } catch {
          extractAdsFromHtml(text, collected, seen);
        }
        if (collected.length > before) stagnantRounds = 0;
        const cursor = extractCursorFromText(text);
        if (cursor && cursor !== lastCursor) {
          lastCursor = cursor;
          cursors.push(cursor);
        }
      } catch {
        // ignore — resposta pode estar fechada
      }
    });

    await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 90000 });
    await dismissCookies(page);

    try {
      await page.waitForFunction(
        () =>
          /Library ID|ID da biblioteca|resultados|results/i.test(document.body?.innerText || ''),
        { timeout: 25000 }
      );
    } catch {
      // continua
    }

    await new Promise((r) => setTimeout(r, randomDelay(effectiveDelayMin, effectiveDelayMax)));

    const useAiScroll =
      options.aiGuided === true &&
      scrollToEnd &&
      options.label === 'library' &&
      isLibraryAiEnabled();

    if (useAiScroll) {
      const aiResult = await runAiGuidedScrollLoop(page, {
        collected,
        maxAds: collectCap,
        maxStagnant,
        maxScrollRounds,
        scrollToEnd,
        cfg,
        label: options.label,
        onProgress: options.onScrollProgress,
      });
      scrollRounds = aiResult.scrollRounds;
      console.log(
        `   🧠 SPY scroll IA (${options.label || 'meta'}): ${aiResult.scrollRounds} scrolls, ${aiResult.aiCalls} decisões`
      );
    } else {
      const live = options.livePipeline;
      let liveLastFlushAt = collected.length;

      while (stagnantRounds < maxStagnant && scrollRounds < maxScrollRounds) {
        if (!scrollToEnd && collected.length >= collectCap) break;
        if (scrollToEnd && collectCap < 100000 && collected.length >= collectCap) break;
        // Paragem antecipada: objectivo de discoveries atingido (parar ao 1º, etc.)
        if (live?.shouldStop && live.shouldStop()) {
          console.log('   ⏹️ Scroll interrompido — objectivo de discoveries atingido');
          break;
        }

        const before = collected.length;
        scrollRounds += 1;

        try {
          await page.evaluate(() => window.scrollBy(0, window.innerHeight * 2.8));
        } catch (scrollErr) {
          if (/detached|Target closed|Session closed/i.test(scrollErr.message)) {
            console.warn('⚠️ Frame detached durante scroll — a terminar loop');
            break;
          }
          throw scrollErr;
        }
        await new Promise((r) => setTimeout(r, randomDelay(effectiveDelayMin, effectiveDelayMax)));

        if (collected.length === before) stagnantRounds += 1;
        else stagnantRounds = 0;

        if (live?.onCollectionUpdate && collected.length > liveLastFlushAt) {
          const delta = collected.slice(liveLastFlushAt);
          liveLastFlushAt = collected.length;
          await live.onCollectionUpdate(delta);
        }
      }

      if (live?.onCollectionUpdate && collected.length > liveLastFlushAt) {
        await live.onCollectionUpdate(collected.slice(liveLastFlushAt));
      }
    }

    // Bibliotecas: dar tempo ao JSON lazy dos vídeos (video_sd_url) carregar — o scroll
    // rápido perde-o. Espera + re-scroll, e aguarda até o HTML ter URLs de vídeo (ou 8s).
    if (options.label === 'library') {
      for (let i = 0; i < 3; i++) {
        try { await page.evaluate(() => window.scrollBy(0, window.innerHeight * 4)); } catch {}
        await new Promise((r) => setTimeout(r, 1200));
      }
      try {
        await page.waitForFunction(
          () => /video_sd_url|\.mp4/i.test(document.documentElement.innerHTML),
          { timeout: 6000 }
        );
      } catch { /* lib sem vídeo — ok */ }
    }

    const bodyText = await page.evaluate(() => document.body?.innerText || '');

    // Fallback/merge DOM: no IP Contabo a Meta renderiza os ads no HTML (não no GraphQL).
    // Se o GraphQL trouxe pouco, ler os cards directamente do DOM.
    if (options.label === 'library') {
      try {
        const domAds = await extractAdsFromDomPage(page);
        let added = 0;
        for (const d of domAds) {
          if (!d.adId || seen.has(d.adId)) continue;
          seen.add(d.adId);
          // Limpar o cabeçalho do card (Active / Library ID / Started running / Platforms / EU transparency)
          const copy = String(d.bodyText || '')
            .replace(/\b(Active|Inactive)\b/gi, ' ')
            .replace(/Library ID:?\s*\d+/i, ' ')
            .replace(/(?:Started|Began) running on\s+\d{1,2}\s+\w+\s+\d{4}/i, ' ')
            .replace(/(?:Started|Began) running on\s+\w+\s+\d{1,2},?\s+\d{4}/i, ' ')
            .replace(/\bPlatforms\b/gi, ' ')
            .replace(/\bEU transparency\b/gi, ' ')
            .replace(/Open Drop-?down menu|See ad details|See summary details|This ad has multiple versions/gi, ' ')
            .replace(/\s+/g, ' ')
            .trim();
          collected.push({
            adId: d.adId,
            pageId: null,
            pageName: null,
            headline: copy.slice(0, 600),
            thumbnailUrl: d.imageUrl || null,
            startDate: d.startDateRaw,
            isActive: true,
            adStatus: 'active',
            libraryUrl: searchUrl,
            landingUrl: d.landingUrl || null,
            videoUrl: d.videoUrl || null,
            rawMetadata: { domExtracted: true, videoUrl: d.videoUrl || null },
          });
          added += 1;
        }
        if (added) console.log(`   🧩 DOM extractor: +${added} ads do HTML (IP directo)`);
      } catch (e) {
        console.warn('   ⚠️ DOM extractor:', e.message);
      }
    }

    // Fallback para keywords (e qualquer scrape com poucos resultados GraphQL):
    // Meta em certos IPs usa SSR — os ads estão nos <script> tags de hydration,
    // não em respostas GraphQL. Extrair pares (ad_archive_id, page_id) directamente
    // dos script tags onde os dados estruturados (JSON) vivem — muito mais fiável do
    // que procurar no DOM renderizado onde os dois campos ficam distantes.
    try {
      const beforeFallback = collected.length;

      // Estratégia primária: page.evaluate() — procura nos <script> tags (dados de hydration FB)
      // onde ad_archive_id e page_id estão no mesmo objecto JSON.
      // ad_archive_id pode ser string ("123") ou número (123) na serialização FB.
      // page_id idem. Janela ±2000 chars dentro de cada script tag.
      let scriptPairs = [];
      try {
        scriptPairs = await page.evaluate(() => {
          const pairs = new Map();
          const scripts = Array.from(document.querySelectorAll('script:not([src])'));
          const ARCH_RX = /"ad_archive_id"\s*:\s*"?(\d{8,})"?/g;
          const PAGE_RX = /"page_id"\s*:\s*"?(\d{6,})"?/;
          for (const s of scripts) {
            const text = s.textContent || '';
            if (!text.includes('ad_archive_id')) continue;
            ARCH_RX.lastIndex = 0;
            let m;
            while ((m = ARCH_RX.exec(text)) !== null) {
              const adId = m[1];
              if (pairs.has(adId)) continue;
              // Janela ±2000 chars dentro deste script tag
              const start = Math.max(0, m.index - 2000);
              const end   = Math.min(text.length, m.index + 2000);
              const win   = text.slice(start, end);
              const pgM   = PAGE_RX.exec(win);
              pairs.set(adId, pgM ? pgM[1] : null);
            }
          }
          return Array.from(pairs.entries()).map(([adId, pageId]) => ({ adId, pageId }));
        });
      } catch (evErr) {
        console.warn('   ⚠️ SPY script-tag eval:', evErr.message);
      }

      // Estratégia de fallback: fullHtml com janela ±2000 chars
      // (cobre casos onde os dados ficam no HTML renderizado, não em script tags)
      const fullHtml = await page.content();
      const fullPairsMap = new Map(scriptPairs.map(p => [p.adId, p.pageId]));
      const ARCH_FULL = /"ad_archive_id"\s*:\s*"?(\d{8,})"?/g;
      const PAGE_FULL = /"page_id"\s*:\s*"?(\d{6,})"?/;
      let mf;
      while ((mf = ARCH_FULL.exec(fullHtml)) !== null) {
        const adId = mf[1];
        if (fullPairsMap.has(adId)) continue; // já temos (com ou sem pageId) dos scripts
        const start = Math.max(0, mf.index - 2000);
        const end   = Math.min(fullHtml.length, mf.index + 2000);
        const win   = fullHtml.slice(start, end);
        const pgM   = PAGE_FULL.exec(win);
        fullPairsMap.set(adId, pgM ? pgM[1] : null);
      }

      // Merge: script pairs + html pairs
      const allPairs = Array.from(fullPairsMap.entries()).map(([adId, pageId]) => ({ adId, pageId }));

      // Criar registos para IDs ainda não vistos
      for (const { adId, pageId } of allPairs) {
        if (!adId || seen.has(adId)) continue;
        seen.add(adId);
        const rec = normalizeAdRecord({ adId, pageId, headline: '', raw: { source: 'html_fallback' } });
        if (rec) collected.push(rec);
      }

      const htmlFallbackAds = collected.slice(beforeFallback);
      const withPageId = htmlFallbackAds.filter(a => a.pageId).length;
      if (htmlFallbackAds.length > 0) {
        console.log(`   🌐 SPY HTML fallback: +${htmlFallbackAds.length} ads (${withPageId} com page_id)`);
        // Enviar estes ads pelo mesmo canal que o scroll — para o pipeline Mac os processar
        const live = options.livePipeline;
        if (live?.onCollectionUpdate) {
          await live.onCollectionUpdate(htmlFallbackAds);
        }
      }
    } catch (htmlErr) {
      console.warn('   ⚠️ SPY HTML fallback:', htmlErr.message);
    }

    const ads = collected.slice(0, collectCap);

    const route = viaProxy ? 'biblioteca' : 'keyword';
    const mode = scrollToEnd ? 'scroll-fim' : 'scroll-limitado';
    console.log(
      `   📦 SPY ${options.label || 'meta'} (${route}, ${mode}): ${ads.length} anúncios, ${scrollRounds} scrolls`
    );

    return slimScrapePayload({
      ads,
      rawCount: ads.length,
      cursors,
      bodyText: bodyText.slice(0, 5000),
    });
  } catch (err) {
    throw err;
  }
}

module.exports = {
  getMetaConfig,
  isResidentialProxyConfigured,
  isMetaScraperConfigured,
  launchResidentialBrowser,
  withResidentialBrowser,
  closeResidentialBrowser,
  withDirectBrowser,
  closeDirectBrowser,
  configureMetaBandwidthSaver,
  scrapeKeywordSearchPhase,
  quickCountLibraryPage,
  probeLibraryPage,
  scrapeLibraryPagePhase,
  scrapeMetadataPhase,
  scrapeMetadataOnPage,
  normalizeAdRecord,
  slimAdsForTransport,
  slimScrapePayload,
  extractAdsFromJsonValue,
  randomDelay,
};
