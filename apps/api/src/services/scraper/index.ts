import { executablePath } from 'puppeteer';
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import { HttpsProxyAgent } from 'https-proxy-agent';
import axios from 'axios';
import { buildSearchUrl } from './facebook';
import { activeAdsRegex, englishRegex, alternativeRegexes } from './selectors';
import { ocrFromImageData } from './ocr';
import { SourceType } from '../../types';

// Usar plugin stealth para evitar detecção
puppeteer.use(StealthPlugin());

// Lista de User Agents para rotacionar
function pickUserAgent(): string {
  const userAgents = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:124.0) Gecko/20100101 Firefox/124.0',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36 Edg/121.0.0.0'
  ];
  return userAgents[Math.floor(Math.random() * userAgents.length)];
}

// Sistema de rotação de IPs
let currentProxyIndex = 0;
let proxyList: string[] = [];

// Carregar lista de proxies
async function loadProxyList(): Promise<void> {
  try {
    const response = await axios.get('http://ip-rotator:8080/proxies');
    proxyList = response.data.list || [];
    console.log(`🔄 Carregados ${proxyList.length} proxies para rotação`);
  } catch (error) {
    console.warn('⚠️ Não foi possível carregar lista de proxies, usando modo direto');
    proxyList = [];
  }
}

// Obter próximo proxy
async function getNextProxy(): Promise<string | null> {
  if (proxyList.length === 0) {
    await loadProxyList();
  }
  
  if (proxyList.length === 0) {
    return null;
  }
  
  const proxy = proxyList[currentProxyIndex];
  currentProxyIndex = (currentProxyIndex + 1) % proxyList.length;
  
  console.log(`🔄 Usando proxy ${currentProxyIndex}/${proxyList.length}: ${proxy}`);
  return proxy;
}

async function extractCountFromPage(page: any): Promise<number> {
  let count = 0;

  // Tentar seletores específicos
  try {
    const html = await page.content();
    const match = html.match(activeAdsRegex) || html.match(englishRegex);
    if (match) {
      const numStr = (match[1] || match[2] || '').replace(/[.,]/g, '');
      const parsed = Number(numStr);
      if (Number.isFinite(parsed) && parsed >= 0) return parsed;
    }
  } catch {}

  // Texto completo + regex alternativas
  try {
    const pageText = await page.evaluate(() => {
      const main = document.querySelector('main') || document.body;
      return main?.textContent || '';
    });
    // eslint-disable-next-line no-console
    console.log(`🔍 Texto da página (primeiros 500 chars): "${pageText.substring(0, 500)}..."`);
    for (const regex of alternativeRegexes) {
      const match = pageText.match(regex);
      if (match) {
        const numStr = match[1].replace(/[.,]/g, '');
        const parsed = Number(numStr);
        if (Number.isFinite(parsed) && parsed > 0) return parsed;
      }
    }
  } catch {}

  // OCR como último recurso
  try {
    // pequena rolagem para garantir render
    await page.evaluate(() => window.scrollTo(0, 200));
    await page.waitForTimeout(600);
    const screenshot = await page.screenshot({ type: 'png', fullPage: false });
    const ocrResult = await ocrFromImageData(screenshot as Buffer);
    if (Number.isFinite(ocrResult) && ocrResult > 0) return ocrResult;
  } catch (ocrError) {
    // eslint-disable-next-line no-console
    console.error('❌ Erro no OCR:', ocrError);
  }

  return 0;
}

// Função principal do scraper
export async function getActiveAdsCount(type: SourceType, value: string): Promise<number> {
  let browser: any;

  const attempt = async (tryIndex: number): Promise<number> => {
    try {
      // eslint-disable-next-line no-console
      console.log(`🕷️ Scraping ${type === 'URL' ? 'URL' : 'keyword'} (tentativa ${tryIndex + 1}): ${value}`);
      const url = buildSearchUrl(type, value);

      // Obter proxy para esta tentativa
      const proxy = await getNextProxy();
      const proxyArgs = proxy ? [`--proxy-server=${proxy}`] : [];

      browser = await puppeteer.launch({
        headless: process.env.SCRAPER_HEADLESS === 'false' ? false : ('new' as any),
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
          '--no-zygote',
          '--disable-gpu',
          '--lang=en-US',
          '--window-size=1366,900',
          ...proxyArgs
        ],
        executablePath: executablePath()
      });

      const page = await browser.newPage();

      // Idioma/locale/timezone consistentes e cabeçalhos realistas
      await page.setUserAgent(pickUserAgent());
      await page.setExtraHTTPHeaders({ 'Accept-Language': 'en-US,en;q=0.9' });
      try { await page.emulateTimezone('America/New_York'); } catch {}
      await page.setViewport({ width: 1366, height: 900 });

      // Bloquear recursos pesados
      await page.setRequestInterception(true);
      page.on('request', (req: any) => {
        const type = req.resourceType();
        if (type === 'stylesheet' || type === 'font' || type === 'image' || type === 'media') {
          req.abort();
        } else {
          req.continue();
        }
      });

      // Navegar e aguardar render
      await page.goto(url, {
        timeout: Number(process.env.SCRAPER_TIMEOUT_MS ?? 90000),
        waitUntil: 'domcontentloaded'
      });

      // Tentar aceitar cookies/forçar país ALL via pequenos cliques se presentes
      try {
        // Aceitar consentimento
        const btns = await page.$x("//button[contains(., 'Accept') or contains(., 'Aceitar') or contains(., 'Allow')] ");
        if (btns && btns[0]) { await (btns[0] as any).click(); await page.waitForTimeout(800); }
      } catch {}

      // Dar tempo para preencher conteúdo
      await page.waitForTimeout(3500);

      const count = await extractCountFromPage(page);

      await page.close().catch(() => {});
      await browser.close().catch(() => {});

      const final = Number.isFinite(count) ? count : 0;
      // eslint-disable-next-line no-console
      console.log(`📊 Total final: ${final} anúncios ativos`);
      return final;
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('❌ Erro no scraper:', error);
      try { if (browser) await browser.close(); } catch {}
      return 0;
    }
  };

  // Retries com backoff
  const maxTries = 3;
  for (let i = 0; i < maxTries; i++) {
    const result = await attempt(i);
    if (result > 0) return result;
    const backoff = 1500 * (i + 1);
    await new Promise(r => setTimeout(r, backoff));
  }

  return 0;
}
