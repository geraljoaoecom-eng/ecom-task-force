#!/usr/bin/env node
/**
 * Ponte local SPY — servidor em localhost:9780 para a ferramenta web activar a ligação móvel.
 */
const http = require('http');
const os = require('os');
const path = require('path');
const { URL } = require('url');

const API_DIR = path.join(__dirname, '../apps/api');
process.chdir(API_DIR);

const PORT = parseInt(process.env.SPY_MOBILE_LOCAL_PORT || '9780', 10) || 9780;
const ALLOWED_ORIGINS = new Set([
  'https://ecoomtaskforce.site',
  'http://localhost:3000',
  'http://127.0.0.1:3000',
]);

const { detectMobileConnection } = require(path.join(API_DIR, 'spy-mobile-connect'));
const {
  scrapeKeywordSearchPhase,
  scrapeLibraryPagePhase,
  closeDirectBrowser,
} = require(path.join(API_DIR, 'spy-meta-scraper'));
const { normalizeApiBase } = require(path.join(API_DIR, 'spy-public-url'));
const {
  buildApiClient,
  registerWithPairing,
  reconnectStoredAgent,
  syncAgentWithVps,
  fetchVpsLiveness,
  loadCredentials,
  saveCredentials,
  runAgentLoop,
} = require(path.join(__dirname, 'spy-mobile-agent-core'));

const DEVICE_LABEL = os.platform() === 'win32' ? 'Windows' : os.platform() === 'linux' ? 'Linux' : 'Mac';
const DEVICE = `${os.hostname()} (${DEVICE_LABEL})`;
const AGENT_PLATFORM = os.platform() === 'win32' ? 'windows' : os.platform() === 'linux' ? 'linux' : 'mac';
const SYNC_MS = parseInt(process.env.SPY_MOBILE_VPS_SYNC_MS || '30000', 10) || 30000;
const { ensureMobileBoundProxy } = require('./spy-mobile-bound-proxy');
let mobilePathMode = 'hotspot';
let mobilePathInitialized = false;

async function initMobilePath() {
  if (mobilePathInitialized) return mobilePathMode;
  mobilePathInitialized = true;
  // Windows: hotspot / USB tether partilha o IP móvel com o PC — sem proxy USB Mac.
  if (os.platform() === 'win32' || process.env.SPY_MOBILE_PATH === 'hotspot') {
    mobilePathMode = 'hotspot';
    console.log('   📱 Modo hotspot — PC deve estar nos dados móveis (hotspot/USB tether)');
    return mobilePathMode;
  }
  const proxy = await ensureMobileBoundProxy();
  if (proxy.ok) {
    process.env.SPY_MOBILE_LOCAL_PROXY = proxy.proxyUrl;
    mobilePathMode = 'usb';
    console.log(`   📱 Modo USB — Mac em Wi-Fi OK, Meta via ${proxy.bindAddress}`);
    return mobilePathMode;
  }
  mobilePathMode = 'hotspot';
  if (process.env.SPY_MOBILE_PATH === 'usb') {
    console.warn(`   ⚠️ USB indisponível: ${proxy.reason}`);
  }
  return mobilePathMode;
}

async function detectMobileForAgent(options = {}) {
  await initMobilePath();
  if (process.env.SPY_MOBILE_LOCAL_PROXY) {
    const usb = await detectMobileConnection({
      ...options,
      proxyUrl: process.env.SPY_MOBILE_LOCAL_PROXY,
    });
    if (usb.ok || process.env.SPY_MOBILE_PATH === 'usb') return usb;
  }
  return detectMobileConnection(options);
}

let vpsSyncTimer = null;
let lastVpsSyncAt = 0;

let agentRunning = false;
let lastStatus = { phase: 'idle', message: 'Ponte local pronta' };
let stopAgent = false;
let agentPromise = null;

function setStatus(patch) {
  lastStatus = { ...lastStatus, ...patch, updatedAt: Date.now() };
}

function corsHeaders(origin, req) {
  const h = {
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Private-Network': 'true',
  };
  if (origin && ALLOWED_ORIGINS.has(origin)) {
    h['Access-Control-Allow-Origin'] = origin;
  } else {
    h['Access-Control-Allow-Origin'] = 'https://ecoomtaskforce.site';
  }
  if (req?.headers['access-control-request-private-network'] === 'true') {
    h['Access-Control-Allow-Private-Network'] = 'true';
  }
  return h;
}

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString('utf8');
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

async function startAgentFromPairing(pairingToken, apiUrl) {
  const apiBase = normalizeApiBase(apiUrl);
  const api = buildApiClient(apiBase);

  // Agente já a correr — religar à VPS com token novo
  if (agentRunning) {
    setStatus({ phase: 'registering', message: 'A sincronizar com a ferramenta…' });
    try {
      const check = await detectMobileForAgent();
      const data = await registerWithPairing(
        api,
        pairingToken,
        detectMobileForAgent,
        DEVICE,
        apiBase,
        AGENT_PLATFORM
      );
      setStatus({
        phase: data.mobileValidated ? 'ready' : 'warning',
        message: data.message || check.reason || 'Ponte móvel activa',
        mobileCheck: check,
        agentId: data.agentId,
        agentRunning: true,
      });
      return lastStatus;
    } catch (err) {
      setStatus({ phase: 'error', message: err.message, agentRunning: true });
      throw err;
    }
  }

  setStatus({ phase: 'testing', message: 'A testar dados móveis…' });

  const check = await detectMobileForAgent();
  if (!check.ok) {
    setStatus({
      phase: 'error',
      message: check.reason,
      mobileCheck: check,
      agentRunning: false,
    });
    return lastStatus;
  }

  setStatus({ phase: 'registering', message: 'A ligar à ferramenta…', mobileCheck: check });
  const data = await registerWithPairing(
    api,
    pairingToken,
    detectMobileForAgent,
    DEVICE,
    apiBase,
    AGENT_PLATFORM
  );

  if (!data.mobileValidated) {
    setStatus({
      phase: 'error',
      message: data.message || 'Ligação móvel rejeitada',
      mobileCheck: check,
    });
    return lastStatus;
  }

  saveCredentials({
    agentId: data.agentId,
    agentKey: data.agentKey,
    apiUrl: apiBase,
  });

  agentRunning = true;
  stopAgent = false;
  setStatus({
    phase: 'ready',
    message: data.message || 'Ponte móvel activa',
    mobileCheck: check,
    agentId: data.agentId,
    agentRunning: true,
    vpsSynced: true,
  });

  launchAgentLoop(apiBase, { agentId: data.agentId, agentKey: data.agentKey });
  startVpsAutoSync();
  return lastStatus;
}

function startVpsAutoSync() {
  if (vpsSyncTimer) return;
  vpsSyncTimer = setInterval(() => {
    backgroundVpsSync().catch(() => {});
  }, SYNC_MS);
}

async function backgroundVpsSync() {
  const creds = loadCredentials();
  if (!creds.agentId || !creds.agentKey || !creds.apiUrl) return;

  if (!agentRunning) {
    await resumeAgentIfCredentials();
    return;
  }

  const sync = await syncAgentWithVps(creds.apiUrl, detectMobileForAgent, DEVICE, AGENT_PLATFORM);
  lastVpsSyncAt = Date.now();

  if (sync.synced) {
    const liveness = await fetchVpsLiveness(creds.apiUrl);
    setStatus({
      vpsSynced: true,
      vpsLive: liveness.live !== false,
      agentRunning: true,
      phase: sync.check?.ok ? 'ready' : 'warning',
      message: sync.via === 'reconnect' ? `Religado à VPS (${sync.check?.reason || 'OK'})` : sync.check?.reason || lastStatus.message,
      mobileCheck: sync.check,
      agentId: creds.agentId,
    });
    if (sync.via === 'reconnect') {
      console.log(`   🔄 SPY ponte: auto-reconnect VPS (${sync.check?.isp || 'MEO'})`);
    }
  } else if (sync.reason) {
    setStatus({
      vpsSynced: false,
      phase: 'warning',
      message: `VPS sync: ${sync.reason}`,
      mobileCheck: sync.check || lastStatus.mobileCheck,
    });
  }
}

function launchAgentLoop(apiBase, auth) {
  agentPromise = runAgentLoop({
    apiBase,
    auth,
    detectMobileForAgent,
    scrapeKeywordSearchPhase,
    scrapeLibraryPagePhase,
    closeDirectBrowser,
    onStatus: (ev) => {
      if (ev.type === 'heartbeat') {
        setStatus({
          mobileCheck: ev.check,
          agentRunning: true,
          vpsSynced: true,
          message: ev.check?.ok ? ev.check.reason : ev.check?.reason,
          phase: ev.check?.ok ? 'ready' : 'warning',
        });
      }
      if (ev.type === 'job_start') {
        setStatus({ phase: 'working', message: `SPY a correr (${ev.job.type})…`, vpsSynced: true });
      }
      if (ev.type === 'job_done') {
        setStatus({ phase: 'ready', message: 'Ponte móvel activa — pronta para SPY', vpsSynced: true });
      }
      if (ev.type === 'error') {
        setStatus({ phase: 'warning', message: ev.error, agentRunning: true });
      }
    },
    shouldStop: () => stopAgent,
  }).catch((err) => {
    agentRunning = false;
    setStatus({ phase: 'error', message: err.message, agentRunning: false });
    console.warn(`   ⚠️ SPY agente parou: ${err.message} — auto-resume em ${SYNC_MS / 1000}s`);
  });
}

async function resumeAgentIfCredentials() {
  const creds = loadCredentials();
  if (!creds.agentId || !creds.agentKey || !creds.apiUrl || agentRunning) return lastStatus;
  const apiBase = normalizeApiBase(creds.apiUrl);
  try {
    await syncAgentWithVps(apiBase, detectMobileForAgent, DEVICE, AGENT_PLATFORM);
  } catch {
    return lastStatus;
  }
  agentRunning = true;
  stopAgent = false;
  const check = await detectMobileForAgent({ useCache: true });
  setStatus({
    phase: check.ok ? 'ready' : 'warning',
    message: check.reason,
    mobileCheck: check,
    agentId: creds.agentId,
    agentRunning: true,
    vpsSynced: true,
  });
  launchAgentLoop(apiBase, { agentId: creds.agentId, agentKey: creds.agentKey });
  startVpsAutoSync();
  console.log(`   🔄 SPY ponte: agente retomado (${creds.agentId.slice(0, 8)}…)`);
  return lastStatus;
}

const server = http.createServer(async (req, res) => {
  const origin = req.headers.origin || '';
  const headers = { ...corsHeaders(origin, req) };

  if (req.method === 'OPTIONS') {
    res.writeHead(204, headers);
    res.end();
    return;
  }

  try {
    const url = new URL(req.url || '/', `http://127.0.0.1:${PORT}`);

    if (req.method === 'GET' && url.pathname === '/health') {
      res.writeHead(200, { ...headers, 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true, port: PORT, version: '1.1' }));
      return;
    }

    if (req.method === 'GET' && url.pathname === '/status') {
      const check = await detectMobileForAgent({ useCache: true });
      const creds = loadCredentials();
      let vpsSynced = lastStatus.vpsSynced || false;
      if (creds.agentId && creds.agentKey && creds.apiUrl) {
        if (!agentRunning) {
          resumeAgentIfCredentials().catch(() => {});
        } else if (Date.now() - lastVpsSyncAt > SYNC_MS * 0.8) {
          backgroundVpsSync().catch(() => {});
        }
        try {
          const sync = await syncAgentWithVps(creds.apiUrl, detectMobileForAgent, DEVICE, AGENT_PLATFORM);
          vpsSynced = sync.synced;
        } catch {
          vpsSynced = false;
        }
      }
      res.writeHead(200, { ...headers, 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          ...lastStatus,
          localOnline: true,
          mobileCheck: check,
          agentRunning,
          vpsSynced,
          credentials: !!creds.agentId,
        })
      );
      return;
    }

    // Navegação directa (evita bloqueio CORS do browser em ecoomtaskforce.site)
    if (req.method === 'GET' && url.pathname === '/activate') {
      const pairingToken = url.searchParams.get('pairingToken');
      const apiUrl = normalizeApiBase(url.searchParams.get('apiUrl') || 'https://ecoomtaskforce.site/api');
      if (!pairingToken) {
        res.writeHead(400, { ...headers, 'Content-Type': 'text/html; charset=utf-8' });
        res.end('<h1>Token em falta</h1><p>Volta ao SPY e clica Activar ponte móvel.</p>');
        return;
      }
      let status;
      try {
        status = await startAgentFromPairing(pairingToken, apiUrl);
      } catch (err) {
        status = { phase: 'error', message: err.message };
      }
      const ok = status.phase === 'ready' || status.phase === 'working';
      res.writeHead(ok ? 200 : 422, { ...headers, 'Content-Type': 'text/html; charset=utf-8' });
      res.end(`<!DOCTYPE html><html lang="pt"><head><meta charset="utf-8"><title>Ecoom Task Force SPY</title>
<style>body{font-family:system-ui;background:#0c0f14;color:#e8edf2;padding:2rem;text-align:center}
.ok{color:#34d399}.err{color:#f87171}a{color:#F5D26C}</style></head><body>
<h1 class="${ok ? 'ok' : 'err'}">${ok ? '✅ Ponte móvel activa' : '❌ Erro'}</h1>
<p>${status.message || ''}</p>
<p><a href="https://ecoomtaskforce.site/spy">← Voltar ao SPY</a></p>
<script>if(window.opener){try{window.opener.postMessage({type:'ecom-spy-bridge',ok:${ok},message:${JSON.stringify(status.message || '')}},'https://ecoomtaskforce.site')}catch(e){}}if(window.parent&&window.parent!==window){try{window.parent.postMessage({type:'ecom-spy-bridge',ok:${ok},message:${JSON.stringify(status.message || '')}},'https://ecoomtaskforce.site')}catch(e){}}setTimeout(function(){window.close()},${ok ? 2500 : 8000})</script>
</body></html>`);
      return;
    }

    if (req.method === 'POST' && url.pathname === '/activate') {
      const body = await readBody(req);
      const pairingToken = body.pairingToken || url.searchParams.get('pairingToken');
      const apiUrl = normalizeApiBase(body.apiUrl || 'https://ecoomtaskforce.site/api');
      if (!pairingToken) {
        res.writeHead(400, { ...headers, 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'pairingToken em falta' }));
        return;
      }
      let status;
      try {
        status = await startAgentFromPairing(pairingToken, apiUrl);
      } catch (err) {
        status = { phase: 'error', message: err.message };
      }
      res.writeHead(status.phase === 'error' ? 422 : 200, { ...headers, 'Content-Type': 'application/json' });
      res.end(JSON.stringify(status));
      return;
    }

    if (req.method === 'POST' && url.pathname === '/reconnect') {
      const creds = loadCredentials();
      if (!creds.agentId || !creds.agentKey || !creds.apiUrl) {
        res.writeHead(400, { ...headers, 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Sem credenciais — activa a ponte primeiro' }));
        return;
      }
      const apiBase = normalizeApiBase(creds.apiUrl);
      try {
        const data = await reconnectStoredAgent(apiBase, detectMobileForAgent, DEVICE, AGENT_PLATFORM);
        const check = await detectMobileForAgent();
        setStatus({
          phase: check.ok ? 'ready' : 'warning',
          message: check.reason,
          mobileCheck: check,
          agentId: creds.agentId,
          agentRunning: true,
        });
        res.writeHead(200, { ...headers, 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ...lastStatus, reconnect: data }));
      } catch (err) {
        res.writeHead(422, { ...headers, 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
      return;
    }

    if (req.method === 'POST' && url.pathname === '/test') {
      const check = await detectMobileForAgent();
      setStatus({
        phase: check.ok ? 'ready' : 'error',
        message: check.reason,
        mobileCheck: check,
      });
      res.writeHead(200, { ...headers, 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ...lastStatus, mobileCheck: check }));
      return;
    }

    res.writeHead(404, { ...headers, 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not found' }));
  } catch (err) {
    res.writeHead(500, { ...headers, 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: err.message }));
  }
});

function parseCliArgs() {
  const args = process.argv.slice(2);
  const out = {};
  for (const arg of args) {
    if (arg.startsWith('--pairing=')) out.pairingToken = arg.slice('--pairing='.length);
    if (arg.startsWith('--api=')) out.apiUrl = arg.slice('--api='.length);
  }
  return out;
}

server.listen(PORT, '127.0.0.1', async () => {
  console.log(`📱 Ponte SPY local — http://127.0.0.1:${PORT} (auto-sync VPS a cada ${SYNC_MS / 1000}s)`);
  await initMobilePath();
  startVpsAutoSync();
  const cli = parseCliArgs();
  if (cli.pairingToken) {
    await startAgentFromPairing(cli.pairingToken, cli.apiUrl || 'https://ecoomtaskforce.site/api');
  } else {
    await resumeAgentIfCredentials();
  }
});

process.on('SIGINT', () => {
  stopAgent = true;
  server.close();
  process.exit(0);
});
