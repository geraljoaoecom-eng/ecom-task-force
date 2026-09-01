/**
 * Lógica partilhada do agente SPY móvel (CLI + ponte local).
 */
const os = require('os');
const fs = require('fs');
const path = require('path');

const CREDENTIALS_FILE = path.join(os.homedir(), '.ecom-spy-mobile-agent.json');
const LEGACY_ID_FILE = path.join(os.homedir(), '.ecom-spy-mobile-agent-id');

function loadCredentials() {
  try {
    if (fs.existsSync(CREDENTIALS_FILE)) {
      return JSON.parse(fs.readFileSync(CREDENTIALS_FILE, 'utf8'));
    }
  } catch {
    // ignore
  }
  const legacyId = (() => {
    try {
      if (fs.existsSync(LEGACY_ID_FILE)) return fs.readFileSync(LEGACY_ID_FILE, 'utf8').trim();
    } catch {
      // ignore
    }
    return null;
  })();
  return legacyId ? { agentId: legacyId } : {};
}

function saveCredentials(creds) {
  fs.writeFileSync(CREDENTIALS_FILE, JSON.stringify(creds, null, 2));
  if (creds.agentId) {
    try {
      fs.writeFileSync(LEGACY_ID_FILE, creds.agentId);
    } catch {
      // ignore
    }
  }
}

function buildApiClient(apiBase, auth = {}) {
  const { normalizeApiBase } = require(path.join(__dirname, '../apps/api/spy-public-url'));
  const API = normalizeApiBase(apiBase);
  const headers = { 'Content-Type': 'application/json' };
  if (auth.agentKey && auth.agentId) {
    headers['X-Spy-Agent-Key'] = auth.agentKey;
  } else if (auth.secret) {
    headers['X-Spy-Mobile-Secret'] = auth.secret;
  }

  return async function apiRequest(method, pathSuffix, body) {
    const res = await fetch(`${API}${pathSuffix}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(120000),
    });
    const text = await res.text();
    let data = {};
    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      data = { raw: text };
    }
    if (!res.ok) throw new Error(data.error || data.message || `HTTP ${res.status}`);
    return data;
  };
}

async function registerWithPairing(api, pairingToken, detectMobileConnection, deviceName, apiUrl, platform) {
  const { normalizeApiBase } = require(path.join(__dirname, '../apps/api/spy-public-url'));
  const check = await detectMobileConnection();
  const creds = loadCredentials();
  const data = await api('POST', '/spy/mobile/register-pairing', {
    pairingToken,
    agentId: creds.agentId,
    deviceName: deviceName || `${os.hostname()} (${os.platform() === 'win32' ? 'Windows' : 'Mac'})`,
    platform: platform || (os.platform() === 'win32' ? 'windows' : 'mac'),
    connectionCheck: check,
  });
  saveCredentials({
    agentId: data.agentId,
    agentKey: data.agentKey,
    apiUrl: normalizeApiBase(apiUrl),
  });
  return { ...data, check };
}

async function reconnectStoredAgent(apiBase, detectMobileConnection, deviceName, platform) {
  const creds = loadCredentials();
  if (!creds.agentId || !creds.agentKey) return null;
  const api = buildApiClient(apiBase, creds);
  const check = await detectMobileConnection({ useCache: true });
  const data = await api('POST', '/spy/mobile/reconnect', {
    agentId: creds.agentId,
    deviceName: deviceName || `${os.hostname()} (${os.platform() === 'win32' ? 'Windows' : 'Mac'})`,
    platform: platform || (os.platform() === 'win32' ? 'windows' : 'mac'),
    connectionCheck: check,
  });
  return { ...data, check, creds };
}

/** Re-regista na VPS após deploy/restart — heartbeat primeiro, reconnect se falhar. */
async function syncAgentWithVps(apiBase, detectMobileConnection, deviceName, platform) {
  const { normalizeApiBase } = require(path.join(__dirname, '../apps/api/spy-public-url'));
  const creds = loadCredentials();
  const base = normalizeApiBase(apiBase || creds.apiUrl);
  if (!creds.agentId || !creds.agentKey || !base) {
    return { synced: false, reason: 'sem_credenciais' };
  }

  const api = buildApiClient(base, creds);
  const check = await detectMobileConnection({ useCache: true });
  const plat = platform || (os.platform() === 'win32' ? 'windows' : 'mac');

  try {
    await api('POST', '/spy/mobile/heartbeat', {
      agentId: creds.agentId,
      platform: plat,
      connectionCheck: check,
    });
    return { synced: true, via: 'heartbeat', check, agentId: creds.agentId };
  } catch (hbErr) {
    const msg = String(hbErr.message || '');
    const needsReconnect = /não registado|404|desconhecido|401|403|agente/i.test(msg);
    if (!needsReconnect) {
      return { synced: false, reason: msg, check };
    }
    try {
      await reconnectStoredAgent(base, detectMobileConnection, deviceName, plat);
      await api('POST', '/spy/mobile/heartbeat', {
        agentId: creds.agentId,
        platform: plat,
        connectionCheck: check,
      });
      return { synced: true, via: 'reconnect', check, agentId: creds.agentId };
    } catch (reErr) {
      return { synced: false, reason: reErr.message || msg, check };
    }
  }
}

async function fetchVpsLiveness(apiBase) {
  const { normalizeApiBase } = require(path.join(__dirname, '../apps/api/spy-public-url'));
  const creds = loadCredentials();
  const base = normalizeApiBase(apiBase || creds.apiUrl);
  if (!creds.agentId || !creds.agentKey || !base) return { live: false };
  const api = buildApiClient(base, creds);
  try {
    return await api(
      'GET',
      `/spy/mobile/agent/liveness?agentId=${encodeURIComponent(creds.agentId)}`
    );
  } catch {
    return { live: false };
  }
}

async function registerWithSecret(api, secret, detectMobileConnection, deviceName, platform) {
  const check = await detectMobileConnection();
  if (!check.ok) {
    const err = new Error(check.reason || 'Ligação móvel não validada');
    err.check = check;
    throw err;
  }
  const creds = loadCredentials();
  const data = await api('POST', '/spy/mobile/register', {
    agentId: creds.agentId,
    deviceName: deviceName || `${os.hostname()} (${os.platform() === 'win32' ? 'Windows' : 'Mac'})`,
    platform: platform || (os.platform() === 'win32' ? 'windows' : 'mac'),
    connectionCheck: check,
  });
  saveCredentials({
    agentId: data.agentId,
    agentKey: data.agentKey,
  });
  return { ...data, check };
}

async function runAgentLoop({
  apiBase,
  auth,
  detectMobileConnection,
  scrapeKeywordSearchPhase,
  scrapeLibraryPagePhase,
  closeDirectBrowser,
  pollMs = 2000,
  onStatus,
  shouldStop,
}) {
  const creds = {
    agentId: auth.agentId || loadCredentials().agentId,
    agentKey: auth.agentKey || loadCredentials().agentKey,
  };
  if (!creds.agentId || !creds.agentKey) throw new Error('Agente não registado');

  const { normalizeApiBase } = require(path.join(__dirname, '../apps/api/spy-public-url'));
  const { slimScrapePayload } = require(path.join(__dirname, '../apps/api/spy-meta-scraper'));

  const api = buildApiClient(apiBase, creds);
  let beat = 0;
  let reconnectAttempt = 0;

  const sendHeartbeat = async () => {
    const check = await detectMobileConnection({ useCache: true });
    await api('POST', '/spy/mobile/heartbeat', {
      agentId: creds.agentId,
      connectionCheck: check,
    });
    return check;
  };

  const tryReconnect = async () => {
    const base = normalizeApiBase(apiBase || loadCredentials().apiUrl);
    await reconnectStoredAgent(base, detectMobileConnection, `${os.hostname()} (Mac)`);
  };

  while (!shouldStop?.()) {
    try {
      if (beat % 5 === 0) {
        try {
          const check = await sendHeartbeat();
          reconnectAttempt = 0;
          onStatus?.({ type: 'heartbeat', check, agentId: creds.agentId });
        } catch (hbErr) {
          const msg = hbErr.message || '';
          if (reconnectAttempt < 5) {
            reconnectAttempt += 1;
            try {
              await tryReconnect();
              const check = await sendHeartbeat();
              reconnectAttempt = 0;
              onStatus?.({ type: 'heartbeat', check, agentId: creds.agentId });
            } catch {
              if (reconnectAttempt >= 5) onStatus?.({ type: 'error', error: msg });
            }
          } else {
            onStatus?.({ type: 'error', error: msg });
          }
        }
      }
      beat += 1;

      const claim = await api('GET', `/spy/mobile/jobs/claim?agentId=${encodeURIComponent(creds.agentId)}`);
      if (claim.job) {
        const job = claim.job;
        onStatus?.({ type: 'job_start', job });
        const hbDuringJob = setInterval(() => {
          sendHeartbeat().catch(() => {});
        }, 15000);
        try {
          let result;
          if (job.type === 'keyword_search') {
            const { searchUrl, options } = job.payload;
            const flushSize = parseInt(process.env.SPY_BATCH_FLUSH_SIZE || '20', 10) || 20;
            // directScrape: o Mac executa o scrape no browser local, sem re-delegar à ponte
            result = await scrapeKeywordSearchPhase(searchUrl, {
              ...options,
              mobileTimeoutMs: 0,
              directScrape: true,
              livePipeline: {
                flushSize,
                onCollectionUpdate: async (delta) => {
                  if (!delta?.length) return;
                  try {
                    const slim = slimScrapePayload({ ads: delta });
                    await api('POST', `/spy/mobile/jobs/${job.id}/partial`, {
                      agentId: creds.agentId,
                      ads: slim.ads || [],
                    });
                  } catch (partialErr) {
                    // Ignorar falhas de partial — o complete final garante consistência
                    console.warn(`   ⚠️ SPY partial (${job.id.slice(0, 8)}):`, partialErr.message);
                  }
                },
              },
            });
          } else if (job.type === 'library_page') {
            const { libraryUrl, options } = job.payload;
            // directScrape: idem — biblioteca aberta no browser local com dados móveis
            result = await scrapeLibraryPagePhase(libraryUrl, {
              ...options,
              mobileTimeoutMs: 0,
              directScrape: true,
            });
          } else {
            throw new Error(`Tipo de job desconhecido: ${job.type}`);
          }
          await api('POST', `/spy/mobile/jobs/${job.id}/complete`, {
            agentId: creds.agentId,
            result: slimScrapePayload(result),
          });
          onStatus?.({ type: 'job_done', job, result });
        } catch (err) {
          await api('POST', `/spy/mobile/jobs/${job.id}/complete`, {
            agentId: creds.agentId,
            error: err.message,
          });
          onStatus?.({ type: 'job_error', job, error: err.message });
        } finally {
          clearInterval(hbDuringJob);
          await closeDirectBrowser?.().catch(() => {});
        }
      }
    } catch (err) {
      onStatus?.({ type: 'error', error: err.message });
    }
    await new Promise((r) => setTimeout(r, pollMs));
  }
}

module.exports = {
  CREDENTIALS_FILE,
  loadCredentials,
  saveCredentials,
  buildApiClient,
  registerWithPairing,
  reconnectStoredAgent,
  syncAgentWithVps,
  fetchVpsLiveness,
  registerWithSecret,
  runAgentLoop,
};
