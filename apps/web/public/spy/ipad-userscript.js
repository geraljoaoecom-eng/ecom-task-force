// ==UserScript==
// @name         Ecoom Task Force SPY — Agente iPad
// @namespace    https://ecoomtaskforce.site
// @version      1.0.1
// @description  Agente SPY móvel para iPad — scroll na Meta Ads Library
// @match        https://www.facebook.com/ads/library*
// @match        https://ecoomtaskforce.site/spy/ipad-agent*
// @match        https://*.ecoomtaskforce.site/spy/ipad-agent*
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(function () {
  const SCRIPT_BASE = 'https://ecoomtaskforce.site/spy/ipad-agent';
  const STORAGE = 'ecom_spy_ipad_agent';
  const POLL_MS = 2500;
  let creds = null;
  let runningJobId = null;
  let loopStarted = false;
  let modulesReady = null;

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      if (document.querySelector(`script[data-ecom-spy="${src}"]`)) {
        return resolve();
      }
      const s = document.createElement('script');
      s.src = src;
      s.dataset.ecomSpy = src;
      s.onload = () => resolve();
      s.onerror = () => reject(new Error(`Falha a carregar ${src}`));
      (document.head || document.documentElement).appendChild(s);
    });
  }

  function loadModules() {
    if (modulesReady) return modulesReady;
    modulesReady = (async () => {
      await loadScript(`${SCRIPT_BASE}/agent-api.js?v=1.0.1`);
      await loadScript(`${SCRIPT_BASE}/scraper-browser.js?v=1.0.1`);
    })();
    return modulesReady;
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
        deviceName: parts[3] || 'iPad (Safari)',
      };
    } catch {
      return null;
    }
  }

  function loadCreds() {
    const hashCreds = parseHashCreds();
    if (hashCreds) {
      sessionStorage.setItem(STORAGE, JSON.stringify(hashCreds));
      history.replaceState(null, '', location.pathname + location.search);
    }
    try {
      const raw =
        sessionStorage.getItem(STORAGE) ||
        localStorage.getItem(STORAGE);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  async function api(method, path, body) {
    await loadModules();
    return window.EcomSpyIpad.apiRequest(creds, method, path, body);
  }

  async function heartbeatSafe() {
    await loadModules();
    return window.EcomSpyIpad.heartbeat(creds, {
      skipNetworkCheck: !location.hostname.includes('ecoomtaskforce'),
    });
  }

  function jobSearchUrl(job) {
    if (job.type === 'keyword_search') return job.payload.searchUrl;
    if (job.type === 'library_page') return job.payload.libraryUrl;
    return null;
  }

  function credsHash() {
    const token = btoa(
      `${creds.agentId}|${creds.agentKey}|${creds.apiUrl}|${creds.deviceName || 'iPad'}`
    );
    return `#ecom_agent=${encodeURIComponent(token)}`;
  }

  async function executeJob(job) {
    const url = jobSearchUrl(job);
    if (!url) throw new Error(`Job desconhecido: ${job.type}`);
    runningJobId = job.id;
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
          await api('POST', `/spy/mobile/jobs/${job.id}/partial`, {
            agentId: creds.agentId,
            ads,
          });
        },
      }
    );
    await api('POST', `/spy/mobile/jobs/${job.id}/complete`, {
      agentId: creds.agentId,
      result,
    });
    runningJobId = null;
  }

  async function tick() {
    creds = loadCreds();
    if (!creds?.agentId || !creds?.agentKey) return;
    if (runningJobId) return;

    try {
      await heartbeatSafe();
    } catch {
      // ignore
    }

    const onMeta = /facebook\.com\/ads\/library/i.test(location.href);
    let job = null;

    if (onMeta) {
      const cur = await api(
        'GET',
        `/spy/mobile/jobs/current?agentId=${encodeURIComponent(creds.agentId)}`
      );
      job = cur.job;
    } else if (location.hostname.includes('ecoomtaskforce')) {
      const claim = await api(
        'GET',
        `/spy/mobile/jobs/claim?agentId=${encodeURIComponent(creds.agentId)}`
      );
      job = claim.job;
      if (job) {
        const url = jobSearchUrl(job);
        if (url) window.open(url + credsHash(), '_blank');
      }
    }

    if (onMeta && job) {
      try {
        await executeJob(job);
      } catch (err) {
        await api('POST', `/spy/mobile/jobs/${job.id}/complete`, {
          agentId: creds.agentId,
          error: err.message || String(err),
        }).catch(() => {});
        runningJobId = null;
      }
    }
  }

  function startLoop() {
    if (loopStarted) return;
    loopStarted = true;
    setInterval(() => tick().catch(() => {}), POLL_MS);
    tick().catch(() => {});
  }

  if (/facebook\.com\/ads\/library/i.test(location.href)) {
    startLoop();
  } else if (/\/spy\/ipad-agent/i.test(location.pathname)) {
    startLoop();
  }
})();
