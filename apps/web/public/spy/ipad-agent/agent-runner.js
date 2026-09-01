/* Ecoom SPY — runner (claim) em /spy — relay postMessage ↔ Meta (CSP bloqueia fetch na FB) */
(function (global) {
  let pollTimer = null;
  let runningJobId = null;
  let activeCreds = null;
  let activeHooks = null;
  let lastJob = null;
  let relayBound = false;

  const SPY_ORIGIN = 'https://ecoomtaskforce.site';
  const MSG = 'ecom-spy-meta';

  function credsHash(creds) {
    const token = btoa(
      `${creds.agentId}|${creds.agentKey}|${creds.apiUrl}|${creds.deviceName || 'iPad'}`
    );
    return `#ecom_agent=${encodeURIComponent(token)}`;
  }

  function jobHash(job) {
    try {
      const slim = {
        id: job.id,
        type: job.type,
        payload: job.payload,
      };
      return `&ecom_job=${encodeURIComponent(btoa(unescape(encodeURIComponent(JSON.stringify(slim)))))}`;
    } catch {
      return '';
    }
  }

  function jobSearchUrl(job) {
    if (job.type === 'keyword_search') return job.payload.searchUrl;
    if (job.type === 'library_page') return job.payload.libraryUrl;
    return null;
  }

  function openMetaTab(url) {
    // NÃO usar noopener — a Meta precisa de window.opener para o relay postMessage
    try {
      const w = window.open(url, '_blank');
      if (w) return w;
    } catch {
      // fall through
    }
    const a = document.createElement('a');
    a.href = url;
    a.target = '_blank';
    document.body.appendChild(a);
    a.click();
    a.remove();
    return null;
  }

  async function waitJobFinished(creds, jobId, hooks) {
    for (let i = 0; i < 3600; i++) {
      await new Promise((r) => setTimeout(r, 2000));
      try {
        const cur = await global.EcomSpyIpad.getCurrentJob(creds);
        if (!cur.job || cur.job.id !== jobId) {
          runningJobId = null;
          lastJob = null;
          hooks?.onJobDone?.();
          return;
        }
      } catch {
        // ignore transient errors
      }
    }
    runningJobId = null;
  }

  function bindRelay() {
    if (relayBound) return;
    relayBound = true;
    window.addEventListener('message', async (event) => {
      const data = event.data;
      if (!data || data.source !== MSG) return;
      // Só aceitar da Meta (ou same-origin testes)
      const okOrigin =
        !event.origin ||
        /facebook\.com$/i.test(new URL(event.origin).hostname) ||
        event.origin === SPY_ORIGIN ||
        event.origin === window.location.origin;
      if (!okOrigin) return;

      const reply = (payload) => {
        try {
          event.source?.postMessage(
            { source: MSG, id: data.id, ...payload },
            event.origin || '*'
          );
        } catch {
          // ignore
        }
      };

      try {
        if (data.type === 'ping') {
          reply({ type: 'pong' });
          return;
        }
        if (data.type === 'requestJob') {
          if (lastJob) {
            reply({ type: 'job', job: lastJob });
          } else if (activeCreds && global.EcomSpyIpad) {
            const cur = await global.EcomSpyIpad.getCurrentJob(activeCreds);
            reply({ type: 'job', job: cur.job || null });
          } else {
            reply({ type: 'job', job: null });
          }
          return;
        }
        if (!activeCreds || !global.EcomSpyIpad) {
          reply({ type: 'error', error: 'Agente SPY offline no separador /spy' });
          return;
        }
        if (data.type === 'partial' && data.jobId) {
          await global.EcomSpyIpad.postPartial(activeCreds, data.jobId, data.ads || []);
          reply({ type: 'ack', for: 'partial' });
          return;
        }
        if (data.type === 'complete' && data.jobId) {
          await global.EcomSpyIpad.completeJob(
            activeCreds,
            data.jobId,
            data.result || null,
            data.error || null
          );
          runningJobId = null;
          lastJob = null;
          activeHooks?.onJobDone?.();
          reply({ type: 'ack', for: 'complete' });
          return;
        }
      } catch (err) {
        reply({ type: 'error', error: err.message || String(err) });
      }
    });
  }

  async function tick(creds, hooks) {
    if (runningJobId || !creds?.agentId) return;

    const claim = await global.EcomSpyIpad.claimJob(creds);
    const job = claim.job;
    if (!job) return;

    const url = jobSearchUrl(job);
    if (!url) return;

    runningJobId = job.id;
    lastJob = job;
    try {
      localStorage.setItem('ecom_spy_bookmark_hint', String(Date.now()));
    } catch {
      // ignore
    }

    const metaUrl = url + credsHash(creds) + jobHash(job);
    hooks?.onJobReady?.(job, metaUrl);
    if (hooks?.autoOpen !== false) {
      openMetaTab(metaUrl);
    }
    hooks?.onJobOpened?.(job, metaUrl);
    waitJobFinished(creds, job.id, hooks).catch(() => {
      runningJobId = null;
    });
  }

  global.EcomSpyAgentRunner = {
    start(creds, hooks) {
      this.stop();
      if (!global.EcomSpyIpad) {
        hooks?.onError?.('Módulos SPY não carregados');
        return;
      }
      activeCreds = creds;
      activeHooks = hooks || null;
      bindRelay();
      pollTimer = setInterval(() => {
        tick(creds, hooks).catch((err) => hooks?.onError?.(err.message));
      }, 4000);
      tick(creds, hooks).catch((err) => hooks?.onError?.(err.message));
    },
    stop() {
      if (pollTimer) clearInterval(pollTimer);
      pollTimer = null;
    },
    openMeta(url) {
      return openMetaTab(url);
    },
    clearRunningJob() {
      runningJobId = null;
      lastJob = null;
    },
  };
})(typeof window !== 'undefined' ? window : globalThis);
