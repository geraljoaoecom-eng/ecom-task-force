// Instagram Talks — motor de sessão via WEB private API (www.instagram.com/api/v1/).
// Usa a sessão web (cookie sessionid do browser do utilizador) com os MESMOS endpoints
// que o browser usa. Sessão web + API web + IP móvel (via IG_PROXY_URL) = consistente,
// evita o checkpoint_required que aparecia ao misturar sessão web com a API móvel.
const crypto = require('crypto');
const request = require('request-promise');
const igDb = require('./ig-db');
const { launchBrowser, closeBrowser } = require('./browser-manager');

const IG_APP_ID = '936619743392459';
const WEB_BASE = 'https://www.instagram.com';
const HOME_URL = 'https://www.instagram.com/';
const WEB_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

function uuid() { return crypto.randomUUID(); }

// Proxy: IP móvel via túnel para o Mac (ver scripts/ig-mobile-proxy.js). Sem proxy = IP da VPS.
function getProxyUrl() {
  return process.env.IG_PROXY_URL || null;
}

// Cookies que importam para autenticação + routing (rur é crítico para writes).
const COOKIE_KEYS = ['sessionid', 'ds_user_id', 'csrftoken', 'rur', 'mid', 'ig_did', 'datr', 'shbid', 'shbts'];

function parseCookieString(raw) {
  let str = String(raw);
  // Se vier de "Copy as cURL" ou da linha de header, isola a parte dos cookies.
  const m = str.match(/cookie:\s*([^'"\n]+)/i) || str.match(/-b\s+['"]([^'"]+)['"]/i);
  if (m) str = m[1];
  const out = {};
  str.split(';').forEach((part) => {
    const i = part.indexOf('=');
    if (i < 0) return;
    const k = part.slice(0, i).trim();
    const v = part.slice(i + 1).trim();
    if (k && v && /^[A-Za-z0-9_]+$/.test(k)) out[k] = v;
  });
  return out;
}

function buildJar(session) {
  const jar = request.jar();
  const cookies = session.cookies || {};
  for (const [k, v] of Object.entries(cookies)) {
    if (!v) continue;
    jar.setCookie(request.cookie(`${k}=${v}; Domain=.instagram.com; Path=/; Secure`), WEB_BASE);
  }
  return jar;
}

function getCsrfFromSession(session) {
  return session.cookies?.csrftoken || null;
}

async function webRequest(session, pathUrl, { method = 'GET', form = null, extraHeaders = {} } = {}) {
  const jar = buildJar(session);
  const headers = {
    'User-Agent': session.userAgent || WEB_UA,
    'X-IG-App-ID': IG_APP_ID,
    'X-Requested-With': 'XMLHttpRequest',
    'Referer': WEB_BASE + '/',
    'Accept': '*/*',
    'Accept-Language': 'pt-PT,pt;q=0.9,en;q=0.8',
    ...extraHeaders,
  };
  if (method !== 'GET') {
    const csrf = getCsrfFromSession(session);
    if (csrf) headers['X-CSRFToken'] = csrf;
    headers['Origin'] = WEB_BASE;
    headers['X-IG-WWW-Claim'] = '0';
    headers['X-Instagram-AJAX'] = '1010';
    headers['Content-Type'] = 'application/x-www-form-urlencoded';
  }
  const opts = {
    uri: WEB_BASE + pathUrl,
    method,
    jar,
    headers,
    proxy: getProxyUrl() || undefined,
    resolveWithFullResponse: true,
    simple: false,
    timeout: 25000,
    gzip: true,
  };
  if (form) opts.form = form;
  const res = await request(opts);
  let body = null;
  try { body = JSON.parse(res.body); } catch { /* não-JSON */ }
  return { status: res.statusCode, body, raw: body ? null : String(res.body).slice(0, 300) };
}

/**
 * Importa uma sessão a partir da string COMPLETA de cookies do browser.
 * Precisa de sessionid + rur (routing) para os writes funcionarem.
 * Aceita também só o sessionid (menos fiável — writes podem falhar sem rur).
 */
async function loginWithSessionId({ username, sessionid }) {
  const account = await igDb.upsertAccount(username);
  try {
    const raw = String(sessionid).trim();
    let cookies;
    if (raw.includes('=')) {
      // string de cookies (ex: "sessionid=...; rur=...; csrftoken=...")
      const all = parseCookieString(raw);
      cookies = {};
      for (const k of COOKIE_KEYS) if (all[k]) cookies[k] = all[k];
    } else {
      // valor cru do sessionid apenas
      cookies = { sessionid: raw };
    }

    if (!cookies.sessionid) {
      return { status: 'error', accountId: account.id, message: 'Não encontrei o sessionid. Cola a string COMPLETA de cookies do separador Network.' };
    }
    // Para enviar DMs são precisos rur (routing) + csrftoken. Sem eles, não vale a pena ligar.
    if (!cookies.rur || !cookies.csrftoken) {
      const faltam = [!cookies.csrftoken && 'csrftoken', !cookies.rur && 'rur'].filter(Boolean).join(' e ');
      return { status: 'error', accountId: account.id, message: `Faltam cookies (${faltam}). Colaste só o sessionid — precisas da linha "cookie:" COMPLETA do separador Network (F12 → Network → pedido instagram.com → Request Headers → cookie).` };
    }

    // ds_user_id: do cookie, ou do prefixo do sessionid
    let dsUserId = cookies.ds_user_id;
    if (!dsUserId) {
      const dec = decodeURIComponent(cookies.sessionid);
      dsUserId = (dec.split(':')[0] || '').trim();
      if (/^\d+$/.test(dsUserId)) cookies.ds_user_id = dsUserId;
    }
    if (!dsUserId || !/^\d+$/.test(dsUserId)) {
      return { status: 'error', accountId: account.id, message: 'sessionid inválido.' };
    }

    const session = { v: 'web2', cookies, dsUserId, userAgent: WEB_UA, savedAt: Date.now() };

    // Valida com endpoint autenticado (inbox).
    const r = await webRequest(session, '/api/v1/direct_v2/inbox/?limit=1');
    if (r.status === 200 && r.body && (r.body.status === 'ok' || r.body.inbox)) {
      const me = await webRequest(session, `/api/v1/users/web_profile_info/?username=${encodeURIComponent(username.replace(/^@/, ''))}`).catch(() => null);
      const resolvedUsername = me?.body?.data?.user?.username || account.username;
      const warn = cookies.rur ? '' : ' (atenção: sem cookie rur — envios podem falhar; cola a string completa de cookies)';
      await igDb.saveAccountSession(account.id, session, dsUserId);
      return { status: 'connected', accountId: account.id, username: resolvedUsername, warn: warn || undefined };
    }
    if (r.status === 403 || (r.body && /login_required|checkpoint/i.test(JSON.stringify(r.body)))) {
      return { status: 'error', accountId: account.id, message: 'Sessão não validou (login_required/checkpoint). Faz logout+login no Instagram e copia cookies frescos.' };
    }
    return { status: 'error', accountId: account.id, message: `Sessão não validou (HTTP ${r.status}).` };
  } catch (e) {
    await igDb.setAccountStatus(account.id, 'error', e.message);
    return { status: 'error', accountId: account.id, message: e.message };
  }
}

// ============================================================
// LOGIN REAL via Puppeteer + IP móvel.
// A sessão nasce neste browser (datr próprio, fingerprint, IP móvel) → IG aceita escrita.
// ============================================================
const LOGIN_URL = 'https://www.instagram.com/accounts/login/';
const _pending = new Map(); // pendingId -> { browser, page, accountId, username, ts }
const PENDING_TTL_MS = 5 * 60 * 1000;
setInterval(() => {
  const now = Date.now();
  for (const [id, p] of _pending.entries()) {
    if (now - p.ts > PENDING_TTL_MS) { closeBrowser(p.browser).catch(() => {}); _pending.delete(id); }
  }
}, 60 * 1000).unref?.();

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

async function readCookieMap(page) {
  const ck = await page.cookies('https://www.instagram.com');
  const map = {};
  for (const c of ck) map[c.name] = c.value;
  return map;
}

async function dismissCookieBanner(page) {
  try {
    await page.evaluate(() => {
      const want = ['allow all cookies', 'permitir todos', 'aceitar todos', 'allow all'];
      const b = Array.from(document.querySelectorAll('button')).find((x) =>
        want.some((w) => (x.textContent || '').trim().toLowerCase().includes(w)));
      if (b) b.click();
    });
    await sleep(700);
  } catch { /* ignore */ }
}

// Faz polling ao estado pós-submit.
async function detectOutcome(page, maxMs = 22000) {
  const start = Date.now();
  while (Date.now() - start < maxMs) {
    const url = page.url();
    const ck = await readCookieMap(page);
    if (ck.sessionid && ck.sessionid !== '""') return { outcome: 'ok' };
    if (/two_factor|2fa/i.test(url)) return { outcome: '2fa' };
    if (/challenge/i.test(url)) return { outcome: 'checkpoint' };
    const st = await page.evaluate(() => {
      const has2fa = !!document.querySelector('input[name="verificationCode"], input[autocomplete="one-time-code"]');
      const alert = document.querySelector('#slfErrorAlert, div[role="alert"]');
      return { has2fa, err: alert ? (alert.textContent || '').trim() : '' };
    });
    if (st.has2fa) return { outcome: '2fa' };
    if (st.err && /incorrect|incorret|senha|palavra-passe|password was/i.test(st.err)) {
      return { outcome: 'bad_credentials', message: st.err };
    }
    await sleep(1000);
  }
  return { outcome: 'timeout' };
}

async function captureAndSave(page, account) {
  const cookies = await readCookieMap(page);
  const ua = await page.evaluate(() => navigator.userAgent).catch(() => WEB_UA);
  const dsUserId = cookies.ds_user_id || '';
  const session = { v: 'web2', cookies, dsUserId, userAgent: ua, savedAt: Date.now() };
  await igDb.saveAccountSession(account.id, session, dsUserId || null);
  return session;
}

async function loginWithCredentials({ username, password }) {
  const account = await igDb.upsertAccount(username);
  let browser, page;
  try {
    browser = await launchBrowser({ useProxy: true, proxyUrl: getProxyUrl() || undefined });
    page = await browser.newPage();
    await page.setUserAgent(WEB_UA);
    await page.setExtraHTTPHeaders({ 'Accept-Language': 'pt-PT,pt;q=0.9,en;q=0.8' });
    await page.goto(LOGIN_URL, { waitUntil: 'networkidle2', timeout: 60000 });
    await dismissCookieBanner(page);

    await page.waitForSelector('input[name="username"]', { timeout: 20000 });
    await page.type('input[name="username"]', String(username).replace(/^@/, ''), { delay: 55 });
    await page.type('input[name="password"]', String(password), { delay: 55 });
    await sleep(400);
    await page.click('button[type="submit"]');

    const res = await detectOutcome(page);

    if (res.outcome === 'ok') {
      await captureAndSave(page, account);
      await closeBrowser(browser).catch(() => {});
      return { status: 'connected', accountId: account.id, username: account.username };
    }
    if (res.outcome === '2fa') {
      const pendingId = uuid();
      _pending.set(pendingId, { browser, page, accountId: account.id, username: account.username, ts: Date.now() });
      await igDb.setAccountStatus(account.id, 'pending_2fa');
      return { status: '2fa', pendingId, accountId: account.id, username: account.username };
    }
    await igDb.setAccountStatus(account.id, res.outcome === 'bad_credentials' ? 'error' : res.outcome, res.message || null);
    await closeBrowser(browser).catch(() => {});
    return {
      status: res.outcome === 'timeout' ? 'error' : res.outcome,
      accountId: account.id,
      message: res.message || (res.outcome === 'checkpoint'
        ? 'Instagram pediu verificação adicional (checkpoint).'
        : res.outcome === 'timeout' ? 'Login não confirmado a tempo.' : 'Falha no login.'),
    };
  } catch (e) {
    if (browser) await closeBrowser(browser).catch(() => {});
    await igDb.setAccountStatus(account.id, 'error', e.message);
    return { status: 'error', accountId: account.id, message: e.message };
  }
}

async function submitTwoFactor({ pendingId, code }) {
  const pend = _pending.get(pendingId);
  if (!pend) return { status: 'error', message: 'Sessão de 2FA expirou. Faz login outra vez.' };
  const { page, browser, accountId, username } = pend;
  try {
    const sel = 'input[name="verificationCode"], input[autocomplete="one-time-code"]';
    await page.waitForSelector(sel, { timeout: 10000 });
    await page.type(sel, String(code).trim().replace(/\s/g, ''), { delay: 80 });
    await sleep(300);
    const clicked = await page.evaluate(() => {
      const b = document.querySelector('button[type="submit"]') ||
        Array.from(document.querySelectorAll('button')).find((x) => /confirm|continuar|seguinte|next/i.test(x.textContent || ''));
      if (b) { b.click(); return true; }
      return false;
    });
    if (!clicked) await page.keyboard.press('Enter');

    const res = await detectOutcome(page);
    _pending.delete(pendingId);
    if (res.outcome === 'ok') {
      const acc = await igDb.getAccountRow(accountId);
      await captureAndSave(page, acc);
      await closeBrowser(browser).catch(() => {});
      return { status: 'connected', accountId, username };
    }
    await igDb.setAccountStatus(accountId, res.outcome === 'checkpoint' ? 'checkpoint' : 'error');
    await closeBrowser(browser).catch(() => {});
    return { status: res.outcome === 'checkpoint' ? 'checkpoint' : 'error', accountId, message: res.outcome === 'checkpoint' ? 'Verificação adicional pedida.' : 'Código 2FA inválido.' };
  } catch (e) {
    _pending.delete(pendingId);
    if (browser) await closeBrowser(browser).catch(() => {});
    return { status: 'error', accountId, message: e.message };
  }
}

async function loadSession(accountId) {
  const session = await igDb.getAccountSession(accountId);
  if (!session) return null;
  // novo formato com mapa de cookies
  if (session.v === 'web2' && session.cookies?.sessionid) return session;
  // compat: formato antigo { v:'web', sessionid, csrftoken } → converte
  if (session.v === 'web' && session.sessionid) {
    return {
      v: 'web2',
      cookies: { sessionid: session.sessionid, ds_user_id: session.dsUserId, csrftoken: session.csrftoken },
      dsUserId: session.dsUserId,
      userAgent: session.userAgent || WEB_UA,
    };
  }
  return null;
}

/**
 * Verifica se a sessão ainda está válida.
 */
async function checkSession(accountId) {
  try {
    const session = await loadSession(accountId);
    if (!session) return { ok: false, reason: 'no_session' };
    const r = await webRequest(session, '/api/v1/direct_v2/inbox/?limit=1');
    const ok = r.status === 200 && r.body && (r.body.status === 'ok' || !!r.body.inbox);
    await igDb.setAccountStatus(accountId, ok ? 'connected' : 'expired');
    if (ok) await igDb.touchAccountActive(accountId);
    return { ok, reason: ok ? undefined : (r.raw || JSON.stringify(r.body) || `HTTP ${r.status}`) };
  } catch (e) {
    return { ok: false, reason: e.message };
  }
}

/**
 * Lê a inbox de DMs.
 */
async function readInbox(accountId, limit = 20) {
  try {
    const session = await loadSession(accountId);
    if (!session) return { ok: false, reason: 'no_session' };
    const r = await webRequest(session, `/api/v1/direct_v2/inbox/?limit=${limit}&thread_message_limit=1`);
    if (r.status !== 200 || !r.body) return { ok: false, status: r.status, raw: r.raw };
    const threads = (r.body.inbox?.threads || []).map((t) => ({
      threadId: t.thread_id,
      users: (t.users || []).map((u) => ({ id: u.pk, username: u.username, fullName: u.full_name })),
      lastMessage: t.last_permanent_item?.text || null,
      lastActivity: t.last_activity_at || null,
      unread: (t.read_state ?? 0) === 1,
    }));
    await igDb.touchAccountActive(accountId);
    return { ok: true, threads };
  } catch (e) {
    return { ok: false, reason: e.message };
  }
}

// Resolve o user id num jar SEPARADO para não poluir os cookies de envio.
async function resolveUserId(session, username) {
  const u = String(username).replace(/^@/, '').toLowerCase();
  const r = await webRequest(session, `/api/v1/users/web_profile_info/?username=${encodeURIComponent(u)}`);
  return r.body?.data?.user?.id || r.body?.user?.id || null;
}

// Constrói os objetos de cookie do Puppeteer a partir da sessão.
function puppeteerCookies(session) {
  return Object.entries(session.cookies || {})
    .filter(([, v]) => v)
    .map(([name, value]) => ({ name, value: String(value), domain: '.instagram.com', path: '/', secure: true }));
}

/**
 * Envia uma DM via BROWSER REAL (Puppeteer) com a sessão injetada, através do IP móvel.
 * O pedido sai do contexto da página instagram.com → indistinguível do browser do utilizador,
 * por isso o IG não faz logout (ao contrário do HTTP simples).
 */
async function sendDirectMessage(accountId, username, text) {
  const session = await loadSession(accountId);
  if (!session) return { ok: false, reason: 'no_session' };

  let browser;
  try {
    browser = await launchBrowser({ useProxy: true, proxyUrl: getProxyUrl() || undefined });
    const page = await browser.newPage();
    await page.setUserAgent(session.userAgent || WEB_UA);
    await page.setCookie(...puppeteerCookies(session));
    await page.goto(HOME_URL, { waitUntil: 'domcontentloaded', timeout: 45000 });

    const result = await page.evaluate(
      async (uname, txt, appId) => {
        const headers = { 'x-ig-app-id': appId, 'x-requested-with': 'XMLHttpRequest' };
        // resolver user id
        const pr = await fetch(`/api/v1/users/web_profile_info/?username=${encodeURIComponent(uname)}`, {
          headers, credentials: 'include',
        });
        const pj = await pr.json().catch(() => null);
        const uid = pj?.data?.user?.id;
        if (!uid) return { ok: false, reason: 'user_not_found' };
        const csrf = (document.cookie.match(/csrftoken=([^;]+)/) || [])[1] || '';
        const body = new URLSearchParams();
        body.set('action', 'send_item');
        body.set('client_context', String(Date.now()) + Math.floor(Math.random() * 1e6));
        body.set('recipient_users', JSON.stringify([[String(uid)]]));
        body.set('text', txt);
        const r = await fetch('/api/v1/direct_v2/threads/broadcast/text/', {
          method: 'POST',
          headers: { ...headers, 'x-csrftoken': csrf, 'content-type': 'application/x-www-form-urlencoded' },
          body: body.toString(),
          credentials: 'include',
        });
        let j = null;
        try { j = await r.json(); } catch { /* ignore */ }
        return {
          ok: r.status === 200 && (j?.status === 'ok' || !!j?.payload),
          status: r.status,
          itemId: j?.payload?.item_id || null,
          threadId: j?.payload?.thread_id || null,
          raw: j ? JSON.stringify(j).slice(0, 300) : null,
        };
      },
      String(username).replace(/^@/, '').toLowerCase(),
      String(text),
      IG_APP_ID
    );

    if (result.ok) await igDb.touchAccountActive(accountId);
    return result;
  } catch (e) {
    return { ok: false, reason: e.message };
  } finally {
    if (browser) await closeBrowser(browser).catch(() => {});
  }
}

module.exports = {
  loginWithCredentials,
  loginWithSessionId,
  submitTwoFactor,
  checkSession,
  readInbox,
  sendDirectMessage,
};
