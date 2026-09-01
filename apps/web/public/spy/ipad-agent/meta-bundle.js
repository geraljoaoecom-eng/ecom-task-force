/* Ecoom SPY meta-bundle v1.5.2 — scraper + bootstrap (inline bookmarklet; relay via opener) */
/* global EcomSpyIpadScraper */
(function (global) {
  function randomDelay(min, max) {
    const lo = Math.min(min, max);
    const hi = Math.max(min, max);
    return lo + Math.floor(Math.random() * (hi - lo + 1));
  }

  function sleep(ms) {
    return new Promise((r) => setTimeout(r, ms));
  }

  function slimAds(ads) {
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

  function normalizeAd(partial) {
    if (!partial?.adId) return null;
    return {
      adId: String(partial.adId),
      pageId: partial.pageId ? String(partial.pageId) : null,
      pageName: partial.pageName || null,
      headline: String(partial.headline || '').slice(0, 600),
      thumbnailUrl: partial.thumbnailUrl || null,
      videoUrl: partial.videoUrl || null,
      startDate: partial.startDate || partial.startDateRaw || null,
      isActive: partial.isActive !== false,
      adStatus: partial.isActive === false ? 'inactive' : 'active',
      libraryUrl: partial.libraryUrl || null,
      landingUrl: partial.landingUrl || null,
    };
  }

  function extractFromJson(node, out, seen) {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) {
      for (const item of node) extractFromJson(item, out, seen);
      return;
    }
    const adId =
      node.ad_archive_id || node.adArchiveID || node.adArchiveId || node.archive_id;
    if (adId && (node.snapshot || node.page_id || node.pageId || node.page_name)) {
      const key = String(adId);
      if (!seen.has(key)) {
        seen.add(key);
        const rec = normalizeAd({
          adId: key,
          pageId: node.page_id || node.pageId,
          pageName: node.page_name || node.pageName,
          headline: node.snapshot?.body?.text || node.snapshot?.title || '',
          thumbnailUrl: node.snapshot?.images?.[0]?.url || null,
          startDate: node.start_date || node.startDate,
          isActive: node.is_active !== 'INACTIVE' && node.is_active !== false,
        });
        if (rec) out.push(rec);
      }
    }
    for (const v of Object.values(node)) extractFromJson(v, out, seen);
  }

  function extractFromDom() {
    const out = [];
    const seenCards = new Set();
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null);
    const libNodes = [];
    let tn;
    while ((tn = walker.nextNode())) {
      if (/Library ID/i.test(tn.nodeValue || '')) libNodes.push(tn);
    }
    for (const node of libNodes) {
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
      const imgEl = card.querySelector('img[src*="scontent"]') || card.querySelector('img');
      out.push(
        normalizeAd({
          adId: idM[1],
          startDate: startM ? startM[1].trim() : null,
          headline: txt.replace(/\s+/g, ' ').trim().slice(0, 600),
          landingUrl: landing,
          thumbnailUrl: imgEl ? imgEl.src : null,
        })
      );
    }
    return out.filter(Boolean);
  }

  function extractScriptPairs() {
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
        const start = Math.max(0, m.index - 2000);
        const end = Math.min(text.length, m.index + 2000);
        const pgM = PAGE_RX.exec(text.slice(start, end));
        pairs.set(adId, pgM ? pgM[1] : null);
      }
    }
    return Array.from(pairs.entries()).map(([adId, pageId]) => ({ adId, pageId }));
  }

  async function dismissCookies() {
    const labels = ['Allow all cookies', 'Permitir todos os cookies', 'Accept All', 'Aceitar tudo', 'Allow essential'];
    for (const label of labels) {
      const btn = Array.from(document.querySelectorAll('button, [role="button"]')).find((el) =>
        (el.innerText || '').trim().toLowerCase().includes(label.toLowerCase().slice(0, 12))
      );
      if (btn) {
        btn.click();
        await sleep(800);
        break;
      }
    }
  }

  async function runMetaScrape(searchUrl, options, hooks) {
    const collected = [];
    const seen = new Set();
    let stagnantRounds = 0;
    let scrollRounds = 0;
    const maxStagnant = options.maxStagnant || 50;
    const maxScrollRounds = options.maxScrollRounds || 500;
    const delayMin = options.delayMin || 400;
    const delayMax = options.delayMax || 1200;
    const flushSize = options.flushSize || 20;
    let lastFlush = 0;

    const onGraphqlText = (text) => {
      if (!text || text.length < 50) return;
      const before = collected.length;
      try {
        extractFromJson(JSON.parse(text), collected, seen);
      } catch {
        extractFromJson({ html: text }, collected, seen);
      }
      if (collected.length > before) stagnantRounds = 0;
    };

    const origFetch = window.fetch;
    window.fetch = async function patchedFetch(...args) {
      const res = await origFetch.apply(this, args);
      try {
        const url = typeof args[0] === 'string' ? args[0] : args[0]?.url || '';
        if (/graphql|\/api\//i.test(url)) {
          res.clone().text().then(onGraphqlText).catch(() => {});
        }
      } catch {
        // ignore
      }
      return res;
    };

    if (location.href.split('#')[0] !== searchUrl.split('#')[0]) {
      location.href = searchUrl + (location.hash.includes('ecom_agent') ? location.hash : '');
      await sleep(5000);
    }

    await dismissCookies();
    await sleep(randomDelay(delayMin, delayMax));

    while (stagnantRounds < maxStagnant && scrollRounds < maxScrollRounds) {
      const before = collected.length;
      scrollRounds += 1;
      window.scrollBy(0, window.innerHeight * 2.8);
      await sleep(randomDelay(delayMin, delayMax));

      if (collected.length === before) {
        stagnantRounds += 1;
        const domAds = extractFromDom();
        for (const ad of domAds) {
          if (!ad?.adId || seen.has(ad.adId)) continue;
          seen.add(ad.adId);
          ad.libraryUrl = searchUrl;
          collected.push(ad);
        }
        const pairs = extractScriptPairs();
        for (const { adId, pageId } of pairs) {
          if (seen.has(adId)) continue;
          seen.add(adId);
          collected.push(
            normalizeAd({ adId, pageId, headline: '', libraryUrl: searchUrl }) || null
          );
        }
        collected.splice(0, collected.length, ...collected.filter(Boolean));
        if (collected.length === before) stagnantRounds += 0;
        else stagnantRounds = 0;
      } else {
        stagnantRounds = 0;
      }

      if (hooks?.onProgress) hooks.onProgress({ scrollRounds, ads: collected.length });

      if (collected.length - lastFlush >= flushSize && hooks?.onPartial) {
        const delta = collected.slice(lastFlush);
        lastFlush = collected.length;
        await hooks.onPartial(slimAds(delta));
      }
    }

    if (collected.length > lastFlush && hooks?.onPartial) {
      await hooks.onPartial(slimAds(collected.slice(lastFlush)));
    }

    window.fetch = origFetch;

    return {
      ads: slimAds(collected),
      scrollRounds,
      bodyText: String(document.body?.innerText || '').slice(0, 3000),
    };
  }

  global.EcomSpyIpadScraper = {
    runMetaScrape,
    slimAds,
    extractFromDom,
  };
})(typeof window !== 'undefined' ? window : globalThis);

/* Ecoom SPY — corre na Meta; API via postMessage → separador /spy (CSP bloqueia fetch) */
(function () {
  if (window.__ecomSpyBootstrapRunning) return;
  window.__ecomSpyBootstrapRunning = true;
  window.__ecomSpyBootstrap = true;

  const STORAGE = 'ecom_spy_ipad_agent';
  const MSG = 'ecom-spy-meta';
  const SPY_ORIGIN = 'https://ecoomtaskforce.site';
  let creds = null;
  let runningJobId = null;
  let loopStarted = false;
  let msgSeq = 0;
  const pending = new Map();

  function showBanner(text, color) {
    let el = document.getElementById('ecom-spy-meta-banner');
    if (!el) {
      el = document.createElement('div');
      el.id = 'ecom-spy-meta-banner';
      el.style.cssText =
        'position:fixed;bottom:0;left:0;right:0;z-index:2147483647;padding:12px 14px;font:600 14px/1.4 -apple-system,sans-serif;text-align:center;color:#0c0f14;box-shadow:0 -4px 20px rgba(0,0,0,.35);';
      document.documentElement.appendChild(el);
    }
    el.style.background = color || '#F5D26C';
    el.textContent = text;
  }

  function parseHashCreds() {
    const m = location.hash.match(/ecom_agent=([^&]+)/);
    if (!m) return null;
    try {
      const parts = atob(decodeURIComponent(m[1])).split('|');
      return {
        agentId: parts[0],
        agentKey: parts[1],
        apiUrl: parts[2] || 'https://ecoomtaskforce.site/api',
        deviceName: parts[3] || 'iPhone (Safari)',
      };
    } catch {
      return null;
    }
  }

  function parseHashJob() {
    const m = location.hash.match(/ecom_job=([^&]+)/);
    if (!m) return null;
    try {
      return JSON.parse(decodeURIComponent(escape(atob(decodeURIComponent(m[1])))));
    } catch {
      try {
        return JSON.parse(atob(decodeURIComponent(m[1])));
      } catch {
        return null;
      }
    }
  }

  function loadCreds() {
    if (window.__ecomSpyInlineCreds && window.__ecomSpyInlineCreds.agentId) {
      return window.__ecomSpyInlineCreds;
    }
    const hashCreds = parseHashCreds();
    if (hashCreds) {
      try {
        sessionStorage.setItem(STORAGE, JSON.stringify(hashCreds));
      } catch {
        // ignore
      }
      return hashCreds;
    }
    try {
      const raw = sessionStorage.getItem(STORAGE) || localStorage.getItem(STORAGE);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  function hasOpener() {
    try {
      return !!(window.opener && !window.opener.closed);
    } catch {
      return false;
    }
  }

  function relaySend(payload, timeoutMs) {
    return new Promise((resolve, reject) => {
      if (!hasOpener()) {
        reject(new Error('Sem separador SPY — usa «Abrir Meta» e mantém /spy aberto'));
        return;
      }
      const id = ++msgSeq;
      const timer = setTimeout(() => {
        pending.delete(id);
        reject(new Error('Timeout a falar com o separador SPY'));
      }, timeoutMs || 20000);
      pending.set(id, { resolve, reject, timer });
      try {
        window.opener.postMessage({ source: MSG, id, ...payload }, SPY_ORIGIN);
      } catch (err) {
        clearTimeout(timer);
        pending.delete(id);
        reject(err);
      }
    });
  }

  window.addEventListener('message', (event) => {
    const data = event.data;
    if (!data || data.source !== MSG || data.id == null) return;
    if (event.origin !== SPY_ORIGIN && event.origin !== window.location.origin) return;
    const wait = pending.get(data.id);
    if (!wait) return;
    clearTimeout(wait.timer);
    pending.delete(data.id);
    if (data.type === 'error') wait.reject(new Error(data.error || 'Erro relay'));
    else wait.resolve(data);
  });

  async function requestJob() {
    const fromHash = parseHashJob();
    if (fromHash?.id) return fromHash;
    const res = await relaySend({ type: 'requestJob' });
    return res.job || null;
  }

  async function postPartial(jobId, ads) {
    await relaySend({ type: 'partial', jobId, ads });
  }

  async function postComplete(jobId, result, error) {
    await relaySend({ type: 'complete', jobId, result: result || null, error: error || null });
  }

  function jobSearchUrl(job) {
    if (job.type === 'keyword_search') return job.payload.searchUrl;
    if (job.type === 'library_page') return job.payload.libraryUrl;
    return null;
  }

  async function executeJob(job) {
    const url = jobSearchUrl(job) || location.href.split('#')[0];
    if (!url) throw new Error(`Job desconhecido: ${job.type}`);
    runningJobId = job.id;
    showBanner('SPY a scrollar a Meta… mantém este separador e o /spy abertos', '#34d399');

    if (!window.EcomSpyIpadScraper?.runMetaScrape) {
      throw new Error('Scraper SPY em falta');
    }

    const opts = job.payload?.options || {};
    const result = await window.EcomSpyIpadScraper.runMetaScrape(
      url,
      {
        maxStagnant: opts.scrollToEnd === false ? 8 : 50,
        maxScrollRounds: 500,
        flushSize: 20,
      },
      {
        onPartial: async (ads) => {
          if (!ads?.length) return;
          await postPartial(job.id, ads);
        },
        onProgress: ({ ads }) => {
          showBanner(`SPY Meta — ${ads} anúncios recolhidos…`, '#F5D26C');
        },
      }
    );

    await postComplete(job.id, result, null);
    runningJobId = null;
    showBanner('Keyword concluída — podes voltar ao SPY', '#34d399');
    setTimeout(() => {
      const el = document.getElementById('ecom-spy-meta-banner');
      if (el) el.remove();
    }, 8000);
  }

  async function tick() {
    creds = loadCreds();
    if (runningJobId) return;

    if (!hasOpener() && !parseHashJob()) {
      showBanner(
        'Abre a Meta com o botão «Abrir Meta» no SPY (e mantém o /spy aberto)',
        '#f87171'
      );
      return;
    }

    try {
      showBanner('SPY Meta ligado — a pedir keyword…', '#F5D26C');
      const job = await requestJob();
      if (!job) {
        showBanner('SPY Meta activo — à espera de pesquisa…', '#94a3b8');
        return;
      }
      await executeJob(job);
    } catch (err) {
      if (runningJobId) {
        await postComplete(runningJobId, null, err.message || String(err)).catch(() => {});
        runningJobId = null;
      }
      showBanner(`Erro SPY: ${err.message || err}`, '#f87171');
    }
  }

  const BUNDLE_VER = '1.5.2';

  function startLoop() {
    if (loopStarted) return;
    loopStarted = true;
    showBanner(`SPY v${BUNDLE_VER} — ligado (sem rede)`, '#F5D26C');
    setInterval(() => tick().catch(() => {}), 4000);
    tick().catch(() => {});
  }

  if (/facebook\.com\/ads\/library/i.test(location.href)) {
    startLoop();
  } else {
    showBanner('Abre a Ads Library da Meta e toca de novo no favorito SPY Meta', '#f87171');
  }
})();
