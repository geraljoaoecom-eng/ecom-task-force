const fs = require('fs');
const { execSync } = require('child_process');
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const { extractJsonCount } = require('./ad-count-parser');

puppeteer.use(StealthPlugin());

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

const VIEWPORT = { width: 1366, height: 900 };

const HEALTH_CHECK_PAGE_ID = '378128628724966';
const HEALTH_CHECK_PAGE_URL = `https://www.facebook.com/ads/library/?active_status=all&ad_type=all&country=ALL&view_all_page_id=${HEALTH_CHECK_PAGE_ID}&search_type=page&media_type=all`;
const HEALTH_CHECK_KEYWORD_URL =
  'https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=US&q=emagrecimento&search_type=keyword_unordered';
const HEALTH_CHECK_MIN_COUNT = 50;
const HEALTH_CHECK_TIMEOUT_MS = 20000;

let proxyRotateIndex = 0;
let forcedProxyUrl = null;

function findChrome() {
  const paths = [
    '/usr/bin/google-chrome-stable',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium-browser',
    '/usr/bin/chromium',
    '/snap/bin/chromium',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  ];
  for (const p of paths) {
    if (fs.existsSync(p)) return p;
  }
  try {
    const p = execSync(
      'which google-chrome-stable || which google-chrome || which chromium-browser || which chromium',
      { encoding: 'utf8' }
    ).trim();
    if (p && fs.existsSync(p)) return p;
  } catch {
    // ignore
  }
  return null;
}

function getProxyList() {
  const multi = process.env.SPY_PROXY_URLS;
  if (multi?.trim()) {
    return multi.split(',').map((s) => s.trim()).filter(Boolean);
  }
  const single = process.env.SPY_PROXY_URL?.trim();
  if (single) return [single];
  return [];
}

function getNextProxy() {
  const list = getProxyList();
  if (!list.length) return null;
  const proxy = list[proxyRotateIndex % list.length];
  proxyRotateIndex = (proxyRotateIndex + 1) % list.length;
  return proxy;
}

function setActiveProxyUrl(url) {
  forcedProxyUrl = url || null;
}

function clearActiveProxyUrl() {
  forcedProxyUrl = null;
}

function pickProxyUrl() {
  if (forcedProxyUrl) return forcedProxyUrl;
  const list = getProxyList();
  if (!list.length) return null;
  const url = list[proxyRotateIndex % list.length];
  proxyRotateIndex += 1;
  return url;
}

function parseProxyUrl(raw) {
  try {
    const parsed = new URL(raw);
    const protocol = parsed.protocol.replace(':', '');
    const host = parsed.hostname;
    const port = parsed.port || (protocol.startsWith('socks') ? '1080' : '80');
    const username = parsed.username ? decodeURIComponent(parsed.username) : null;
    const password = parsed.password ? decodeURIComponent(parsed.password) : null;
    const server = `${protocol}://${host}:${port}`;
    return { server, username, password, raw };
  } catch {
    console.warn(`⚠️ SPY_PROXY_URL inválido: ${raw}`);
    return null;
  }
}

function maskProxyUrl(raw) {
  if (!raw) return '(não definido)';
  try {
    const parsed = new URL(raw);
    const user = parsed.username ? decodeURIComponent(parsed.username) : '';
    const host = parsed.hostname;
    const port = parsed.port || '80';
    return user ? `${user}:***@${host}:${port}` : `${host}:${port}`;
  } catch {
    return '(inválido)';
  }
}

function buildLaunchArgs(proxyServer) {
  const args = [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage',
    '--disable-blink-features=AutomationControlled',
    '--lang=en-US,pt-BR',
  ];
  if (proxyServer) {
    args.push(`--proxy-server=${proxyServer}`);
  }
  return args;
}

function patchBrowserNewPage(browser, proxyAuth) {
  const originalNewPage = browser.newPage.bind(browser);
  browser.newPage = async function patchedNewPage() {
    const page = await originalNewPage();
    await page.setUserAgent(USER_AGENT);
    await page.setViewport(VIEWPORT);
    if (proxyAuth) {
      await page.authenticate(proxyAuth);
    }
    return page;
  };
}

async function launchBrowserWithProxyRaw(proxyRaw, { label = '' } = {}) {
  const chromePath = findChrome();
  const proxy = proxyRaw ? parseProxyUrl(proxyRaw) : null;
  const proxyAuth =
    proxy?.username && proxy?.password
      ? { username: proxy.username, password: proxy.password }
      : null;

  const opts = {
    headless: 'new',
    args: buildLaunchArgs(proxy?.server),
  };
  if (chromePath) opts.executablePath = chromePath;

  const browser = await puppeteer.launch(opts);
  patchBrowserNewPage(browser, proxyAuth);

  if (proxy?.server) {
    console.log(`🌐 Browser via proxy${label ? ` (${label})` : ''}: ${proxy.server}`);
  } else {
    console.log(`🌐 Browser directo${label ? ` (${label})` : ''}`);
  }

  return browser;
}

async function launchBrowser(options = {}) {
  const useProxy =
    options.useProxy === false
      ? false
      : options.useProxy === true
        ? getProxyList().length > 0 || !!options.proxyUrl
        : getProxyList().length > 0;

  const proxyRaw = useProxy ? options.proxyUrl || pickProxyUrl() : null;
  return launchBrowserWithProxyRaw(proxyRaw);
}

async function getPage(browser, options = {}) {
  const page = await browser.newPage();
  if (options.locale) {
    await page.setExtraHTTPHeaders({
      'Accept-Language': options.locale,
    });
  }
  return page;
}

async function closeBrowser(browser) {
  if (browser?.isConnected?.()) {
    await browser.close().catch(() => {});
  }
}

async function fetchIpThroughBrowser(useProxy, proxyUrl = null) {
  let browser;
  try {
    browser = await launchBrowser({ useProxy, proxyUrl });
    const page = await getPage(browser);
    await page.goto('https://api.ipify.org?format=json', {
      waitUntil: 'networkidle2',
      timeout: 15000,
    });
    const body = await page.evaluate(() => document.body?.innerText || '');
    const parsed = JSON.parse(body.trim());
    return parsed.ip || null;
  } catch {
    return null;
  } finally {
    if (browser) await closeBrowser(browser);
  }
}

/**
 * Verifica se o proxy consegue fazer keyword search (caso de uso SPY).
 * Nota: proxy ISP falha em page_id mas funciona em keyword — não usar page_id aqui.
 * @returns {Promise<{ healthy: boolean, count: number|null, pageIds: number }>}
 */
async function checkProxyHealth(proxyUrl = null) {
  const targetProxy = proxyUrl || getNextProxy();
  if (!targetProxy) {
    return { healthy: false, count: null, pageIds: 0 };
  }

  let browser;
  try {
    browser = await launchBrowserWithProxyRaw(targetProxy);
    const page = await browser.newPage();
    await page.setExtraHTTPHeaders({ 'Accept-Language': 'pt-BR,pt;q=0.9' });
    await page.goto(HEALTH_CHECK_KEYWORD_URL, {
      waitUntil: 'networkidle2',
      timeout: HEALTH_CHECK_TIMEOUT_MS,
    });
    const html = await page.content();
    const count = extractJsonCount(html);
    const pageIds = new Set([...html.matchAll(/view_all_page_id=(\d+)/g)].map((m) => m[1])).size;
    const healthy =
      pageIds > 0 || (count !== null && count > HEALTH_CHECK_MIN_COUNT);
    return { healthy, count, pageIds };
  } catch {
    return { healthy: false, count: null, pageIds: 0 };
  } finally {
    if (browser) await closeBrowser(browser);
  }
}

async function getHealthyProxy() {
  const list = getProxyList();
  if (!list.length) return null;

  for (let i = 0; i < list.length; i++) {
    const proxy = getNextProxy();
    const { healthy } = await checkProxyHealth(proxy);
    if (healthy) return proxy;
  }

  return null;
}

module.exports = {
  launchBrowser,
  getPage,
  closeBrowser,
  checkProxyHealth,
  getHealthyProxy,
  getNextProxy,
  getProxyList,
  setActiveProxyUrl,
  clearActiveProxyUrl,
  maskProxyUrl,
  fetchIpThroughBrowser,
  USER_AGENT,
  HEALTH_CHECK_PAGE_URL,
  HEALTH_CHECK_KEYWORD_URL,
};
