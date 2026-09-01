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
