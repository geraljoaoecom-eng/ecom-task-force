/**
 * Detecta se a ligação actual parece dados móveis (não datacenter / Wi‑Fi fixo).
 */
const http = require('http');

let lastGoodCheck = null;
let lastGoodAt = 0;
const CACHE_MS = parseInt(process.env.SPY_MOBILE_CHECK_CACHE_MS || '90000', 10) || 90000;

function fetchJsonViaHttpProxy(proxyUrl, targetUrl, timeoutMs = 12000) {
  return new Promise((resolve, reject) => {
    let proxy;
    let target;
    try {
      proxy = new URL(proxyUrl);
      target = new URL(targetUrl);
    } catch (err) {
      reject(err);
      return;
    }
    const req = http.request(
      {
        host: proxy.hostname,
        port: proxy.port || 80,
        method: 'GET',
        path: target.href,
        headers: { Host: target.host, Connection: 'close' },
        timeout: timeoutMs,
      },
      (res) => {
        let body = '';
        res.on('data', (chunk) => {
          body += chunk;
        });
        res.on('end', () => {
          try {
            resolve(JSON.parse(body));
          } catch (err) {
            reject(err);
          }
        });
      }
    );
    req.on('timeout', () => req.destroy(new Error('timeout')));
    req.on('error', reject);
    req.end();
  });
}

function evaluateMobileIpData(data, viaLabel) {
  if (data.status !== 'success') {
    return {
      ok: false,
      ip: null,
      reason: data.message || 'Não foi possível verificar o IP',
    };
  }

  const org = String(data.org || data.isp || '').toLowerCase();
  const asn = String(data.as || '').toLowerCase();
  const looksDatacenter =
    data.hosting === true ||
    /hosting|cloud|contabo|amazon|google|digitalocean|hetzner|ovh|microsoft azure|linode|vultr/i.test(
      org + asn
    );

  const mobileFlag = data.mobile === true;
  const valid = mobileFlag && !looksDatacenter;

  let reason;
  if (valid) {
    reason = viaLabel
      ? `${viaLabel} — ${data.isp || data.org}`
      : `Dados móveis OK — ${data.isp || data.org}`;
  } else if (looksDatacenter) {
    reason = 'IP de datacenter/servidor — liga o telemóvel por hotspot/USB tether';
  } else if (!mobileFlag) {
    reason = viaLabel
      ? `${viaLabel} — IP ainda parece Wi‑Fi/fibra`
      : 'Parece Wi‑Fi/fibra fixa — no Windows liga o PC ao hotspot do telemóvel; no Mac usa USB ou hotspot';
  } else {
    reason = 'Ligação não validada como móvel';
  }

  return {
    ok: valid,
    ip: data.query,
    isp: data.isp,
    org: data.org,
    mobile: mobileFlag,
    hosting: looksDatacenter,
    reason,
    via: viaLabel || null,
  };
}

async function detectMobileConnection(options = {}) {
  const cacheKey = options.proxyUrl ? `proxy:${options.proxyUrl}` : 'direct';
  if (
    options.useCache !== false &&
    lastGoodCheck &&
    lastGoodCheck._cacheKey === cacheKey &&
    Date.now() - lastGoodAt < CACHE_MS
  ) {
    return lastGoodCheck;
  }

  try {
    const ipApi =
      'http://ip-api.com/json/?fields=status,message,query,mobile,isp,org,as,hosting,proxy';
    const data = options.proxyUrl
      ? await fetchJsonViaHttpProxy(options.proxyUrl, ipApi)
      : await fetch(ipApi, { signal: AbortSignal.timeout(12000) }).then((r) => r.json());
    const viaLabel = options.proxyUrl ? 'Dados móveis via USB iPhone' : null;
    const result = { ...evaluateMobileIpData(data, viaLabel), _cacheKey: cacheKey };
    if (result.ok) {
      lastGoodCheck = result;
      lastGoodAt = Date.now();
    }
    return result;
  } catch (err) {
    if (options.useCache !== false && lastGoodCheck) {
      return { ...lastGoodCheck, reason: `${lastGoodCheck.reason} (cache — ip-api timeout)` };
    }
    return { ok: false, ip: null, reason: err.message || 'Erro ao testar IP' };
  }
}

module.exports = { detectMobileConnection };
