/* global EcomSpyIpad */
(function (global) {
  const DEFAULT_API = 'https://ecoomtaskforce.site/api';
  const STORAGE_KEY = 'ecom_spy_ipad_agent';

  function loadCreds() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  function saveCreds(creds) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(creds));
  }

  function clearCreds() {
    localStorage.removeItem(STORAGE_KEY);
  }

  async function apiRequest(creds, method, path, body) {
    const base = (creds.apiUrl || DEFAULT_API).replace(/\/$/, '');
    const res = await fetch(`${base}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'X-Spy-Agent-Key': creds.agentKey,
      },
      body: body ? JSON.stringify(body) : undefined,
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
  }

  async function checkNetwork(apiBase) {
    const token = localStorage.getItem('authToken');
    const base = (apiBase || DEFAULT_API).replace(/\/$/, '');
    const res = await fetch(`${base}/spy/network-check`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) throw new Error('network-check failed');
    return res.json();
  }

  async function registerPairing(pairingToken, deviceName, apiUrl) {
    const base = (apiUrl || DEFAULT_API).replace(/\/$/, '');
    const net = await checkNetwork(base);
    const connectionCheck = {
      ok: !!net.mobile,
      ip: net.ip,
      isp: net.isp,
      org: net.org,
      mobile: net.mobile,
      reason: net.mobile
        ? `Dados móveis OK — ${net.isp || net.org || net.ip}`
        : 'Liga os dados móveis do iPhone (sem Wi-Fi fixa)',
    };
    const res = await fetch(`${base}/spy/mobile/register-pairing`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        pairingToken,
        deviceName: deviceName || 'iPad (Safari)',
        platform: 'ipad',
        connectionCheck,
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Registo falhou');
    const creds = {
      agentId: data.agentId,
      agentKey: data.agentKey,
      apiUrl: base,
      deviceName: deviceName || 'iPad (Safari)',
    };
    saveCreds(creds);
    return { ...data, creds, connectionCheck };
  }

  async function heartbeat(creds, opts = {}) {
    let connectionCheck;
    if (!opts.skipNetworkCheck) {
      const net = await checkNetwork(creds.apiUrl).catch(() => null);
      connectionCheck = net
        ? {
            ok: !!net.mobile,
            ip: net.ip,
            isp: net.isp,
            org: net.org,
            mobile: net.mobile,
            reason: net.mobile ? `Dados móveis OK — ${net.isp || net.org}` : 'Sem dados móveis',
          }
        : undefined;
    }
    return apiRequest(creds, 'POST', '/spy/mobile/heartbeat', {
      agentId: creds.agentId,
      platform: creds.platform || opts.platform || undefined,
      connectionCheck,
    });
  }

  async function claimJob(creds) {
    return apiRequest(
      creds,
      'GET',
      `/spy/mobile/jobs/claim?agentId=${encodeURIComponent(creds.agentId)}`
    );
  }

  async function getCurrentJob(creds) {
    return apiRequest(
      creds,
      'GET',
      `/spy/mobile/jobs/current?agentId=${encodeURIComponent(creds.agentId)}`
    );
  }

  async function postPartial(creds, jobId, ads) {
    return apiRequest(creds, 'POST', `/spy/mobile/jobs/${jobId}/partial`, {
      agentId: creds.agentId,
      ads,
    });
  }

  async function completeJob(creds, jobId, result, error) {
    return apiRequest(creds, 'POST', `/spy/mobile/jobs/${jobId}/complete`, {
      agentId: creds.agentId,
      result,
      error: error || undefined,
    });
  }

  global.EcomSpyIpad = {
    STORAGE_KEY,
    DEFAULT_API,
    loadCreds,
    saveCreds,
    clearCreds,
    registerPairing,
    heartbeat,
    claimJob,
    getCurrentJob,
    postPartial,
    completeJob,
    checkNetwork,
    apiRequest,
  };
})(typeof window !== 'undefined' ? window : globalThis);
