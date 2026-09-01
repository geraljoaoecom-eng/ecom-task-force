import { executablePath } from 'puppeteer';
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import { HttpsProxyAgent } from 'https-proxy-agent';
import axios from 'axios';
import { buildSearchUrl } from './facebook';
import { activeAdsRegex, englishRegex, alternativeRegexes, statusRegexes } from './selectors';
import { ocrFromImageData } from './ocr';
import { SourceType } from '../../types';
import { getActiveAdsCountHybrid } from './hybrid-scraper';

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

// Função para verificar se a biblioteca está ativa (tem "Estado online: Anúncios ativos")
async function isLibraryActive(page: any): Promise<boolean> {
  try {
    const pageText: string = await page.evaluate(() => {
      const main = document.querySelector('main') || document.body;
      return (main?.textContent || '').trim();
    });

    // NOVA VERIFICAÇÃO: Verificar se o filtro "Estado online: Anúncios ativos" está aplicado
    const hasActiveFilter = pageText.toLowerCase().includes('estado online: anúncios ativos') ||
                           pageText.toLowerCase().includes('online status: active ads');
    
    if (hasActiveFilter) {
      console.log(`✅ Filtro "Estado online: Anúncios ativos" aplicado - biblioteca realmente ativa`);
      return true;
    }

    // Verificar se há indicadores de status ativo (método antigo)
    for (const regex of statusRegexes) {
      if (regex.test(pageText)) {
        console.log(`✅ Biblioteca ativa detectada: ${regex.source}`);
        return true;
      }
    }
    
    console.log(`❌ Biblioteca inativa - filtro "Estado online: Anúncios ativos" não aplicado`);
    return false;
  } catch (error) {
    console.error('❌ Erro ao verificar status da biblioteca:', error);
    return false;
  }
}

async function extractCountFromPage(page: any): Promise<number> {
  // 1) Tentar via HTML estático imediatamente
  try {
    const html = await page.content();
    const match = html.match(activeAdsRegex) || html.match(englishRegex);
    if (match) {
      const numStr = (match[1] || match[2] || '').replace(/[.,]/g, '');
      const parsed = Number(numStr);
      if (Number.isFinite(parsed) && parsed >= 0) return parsed;
    }
  } catch {}

  // 2) Aguardar elementos típicos da Ads Library e fazer polling de texto
  try {
    // Espera por algum container de resultados aparecer
    await Promise.race([
      page.waitForSelector('[data-testid="search-results"]', { timeout: 10000 }),
      page.waitForSelector('div[role="main"]', { timeout: 10000 })
    ]).catch(() => {});

    // Polling incremental até 15s para aguardar o texto aparecer
    const maxMs = 15000;
    const stepMs = 1500;
    let waited = 0;
    while (waited <= maxMs) {
      const pageText: string = await page.evaluate(() => {
        const main = document.querySelector('main') || document.body;
        return (main?.textContent || '').trim();
      });
      // eslint-disable-next-line no-console
      if (waited === 0) console.log(`🔍 Texto da página (primeiros 500 chars): "${pageText.substring(0, 500)}..."`);

      for (const regex of alternativeRegexes) {
        const match = pageText.match(regex);
        if (match) {
          const numStr = match[1].replace(/[.,]/g, '');
          const parsed = Number(numStr);
          if (Number.isFinite(parsed) && parsed >= 0) return parsed;
        }
      }

      await page.waitForTimeout(stepMs);
      waited += stepMs;
    }
  } catch {}

  // 3) OCR como último recurso
  try {
    // pequena rolagem para garantir render
    await page.evaluate(() => window.scrollTo(0, 300));
    await page.waitForTimeout(800);
    const screenshot = await page.screenshot({ type: 'png', fullPage: false });
    const ocrResult = await ocrFromImageData(screenshot as Buffer);
    if (Number.isFinite(ocrResult) && ocrResult > 0) return ocrResult;
  } catch (ocrError) {
    // eslint-disable-next-line no-console
    console.error('❌ Erro no OCR:', ocrError);
  }

  return 0;
}

// Nova função híbrida que usa Apify + Puppeteer como fallback
export async function getActiveAdsCountHybridWrapper(type: SourceType, value: string): Promise<number> {
  try {
    console.log(`🔄 Usando sistema híbrido (Apify + Puppeteer): ${type} - ${value}`);
    return await getActiveAdsCountHybrid(type, value);
  } catch (error: any) {
    console.error('❌ Erro no sistema híbrido, usando Puppeteer puro:', error.message);
    return await getActiveAdsCount(type, value);
  }
}

// Função principal do scraper
export async function getActiveAdsCount(type: SourceType, value: string): Promise<number> {
  let browser: any;

  const attempt = async (tryIndex: number): Promise<number> => {
    try {
      // eslint-disable-next-line no-console
      console.log(`🕷️ Scraping ${type === 'URL' ? 'URL' : 'keyword'} (tentativa ${tryIndex + 1}): ${value}`);
      let url = buildSearchUrl(type, value);
      // Forçar active_status=active na URL
      try {
        const hasQuery = url.includes('?');
        if (url.includes('active_status=')) {
          url = url.replace(/active_status=[^&]*/i, 'active_status=active');
        } else {
          url = url + (hasQuery ? '&' : '?') + 'active_status=active';
        }
      } catch {}

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

      // Capturar contagem via rede (XHR/Fetch) - tentaremos extrair total_count
      let networkActiveCount: number | null = null;
      const responseHandlers: Array<() => void> = [];
      const onResponse = async (res: any) => {
        try {
          const rType = res.request().resourceType();
          const rUrl = res.url();
          if (!(rType === 'xhr' || rType === 'fetch')) return;
          if (!/ads\/library|graphql|async|search/i.test(rUrl)) return;

          const ct = res.headers()['content-type'] || '';
          if (!ct.includes('application/json') && !ct.includes('text/json')) return;

          const json = await res.json().catch(() => null as any);
          if (!json) return;

          const extractCounts = (obj: any): number[] => {
            const hits: number[] = [];
            const visit = (o: any) => {
              if (!o || typeof o !== 'object') return;
              for (const [k, v] of Object.entries(o)) {
                const key = k.toLowerCase();
                if (typeof v === 'number') {
                  if (/(^|_)total(count)?($)/.test(key) || /active[_-]?ads?(_?count)?/.test(key)) {
                    hits.push(v as number);
                  }
                } else if (typeof v === 'object') {
                  visit(v);
                }
              }
            };
            visit(obj);
            return hits;
          };

          const candidates = extractCounts(json).filter((n) => Number.isFinite(n) && n >= 0) as number[];
          if (candidates.length > 0) {
            const maxVal = Math.max(...candidates);
            if (Number.isFinite(maxVal) && maxVal >= 0) {
              networkActiveCount = maxVal;
              // eslint-disable-next-line no-console
              console.log(`🛰️ total_count via rede: ${networkActiveCount} (de ${rUrl})`);
            }
          }
        } catch {}
      };
      page.on('response', onResponse);
      responseHandlers.push(() => page.off('response', onResponse));

      // Navegar e aguardar render (usar networkidle2 para garantir recursos dinâmicos)
      await page.goto(url, {
        timeout: Number(process.env.SCRAPER_TIMEOUT_MS ?? 120000),
        waitUntil: 'networkidle2'
      });

      // Tentar aceitar cookies/forçar país ALL via pequenos cliques se presentes
      try {
        // Aceitar consentimento
        const btns = await page.$x("//button[contains(., 'Accept') or contains(., 'Aceitar') or contains(., 'Allow')] ");
        if (btns && btns[0]) { await (btns[0] as any).click(); await page.waitForTimeout(800); }
        
        // Forçar país = All (vários seletores possíveis)
        const tryForceCountryAll = async () => {
          try {
            // Tenta abrir dropdown de país
            const openers = await Promise.race([
              page.$("[data-testid='country_selector']"),
              page.$("[aria-label*='Country']"),
              page.$("[aria-label*='País']"),
              page.$x("//span[contains(., 'Country') or contains(., 'País')]//ancestor::button[1]")
            ]).catch(() => null as any);

            if (openers) {
              if (Array.isArray(openers)) {
                if (openers[0]) await (openers[0] as any).click();
              } else {
                await (openers as any).click();
              }
              await page.waitForTimeout(600);
            }

            // Tenta selecionar a opção "All" no dropdown
            const allOption = await Promise.race([
              page.$x("//div[contains(@role, 'option') or contains(@role, 'menuitem')][.//text()[contains(., 'All') or contains(., 'Todos') or contains(., 'ALL')]]"),
              page.$x("//span[text()='All' or text()='ALL' or text()='Todos']//ancestor::div[contains(@role, 'option') or contains(@role, 'menuitem')][1]")
            ]).catch(() => null as any);

            if (allOption) {
              if (Array.isArray(allOption)) {
                if (allOption[0]) await (allOption[0] as any).click();
              } else {
                await (allOption as any).click();
              }
              await page.waitForTimeout(700);
            }
          } catch {}
        };
        await tryForceCountryAll();
      } catch {}

      // Dar tempo para preencher conteúdo (timing maior + pequeno jitter)
      await page.waitForTimeout(6000 + Math.floor(Math.random() * 2000));

      // Scroll leve para estimular renderização dinâmica
      try { await page.evaluate(() => window.scrollBy(0, 400)); } catch {}
      await page.waitForTimeout(1000);

      // PRIMEIRO: Verificar se a biblioteca está ativa
      const isActive = await isLibraryActive(page);
      if (!isActive) {
        console.log(`❌ Biblioteca inativa - retornando 0 anúncios`);
        await page.close().catch(() => {});
        await browser.close().catch(() => {});
        return 0;
      }

      // SEGUNDO: Se ativa, contar os resultados
      // Preferir contagem via rede, se disponível após pequena espera
      let count: number | null = null;
      try {
        const startWait = Date.now();
        while (Date.now() - startWait < 7000 && (networkActiveCount == null)) {
          await page.waitForTimeout(250);
        }
        if (networkActiveCount != null && Number.isFinite(networkActiveCount) && networkActiveCount >= 0) {
          count = networkActiveCount;
        }
      } catch {}

      if (count == null || !Number.isFinite(count)) {
        count = await extractCountFromPage(page);
      }

      // Se ainda 0, tentar novo ciclo: reforçar país ALL, scroll e novo polling
      if (!Number.isFinite(count) || count === 0) {
        try {
          // novo forcing de país e breve espera
          try {
            const againBtn = await page.$("[data-testid='country_selector']");
            if (againBtn) { await (againBtn as any).click(); await page.waitForTimeout(400); }
          } catch {}
          await page.waitForTimeout(800);
          try { await page.evaluate(() => window.scrollBy(0, 300)); } catch {}
          await page.waitForTimeout(1200);
        } catch {}
        const retryCount = await extractCountFromPage(page);
        if (Number.isFinite(retryCount) && retryCount > 0) count = retryCount;
      }

      // limpar listeners
      try { responseHandlers.forEach((fn) => fn()); } catch {}
      await page.close().catch(() => {});
      await browser.close().catch(() => {});

      const final = Number.isFinite(count as number) ? (count as number) : 0;
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
  const maxTries = 4;
  for (let i = 0; i < maxTries; i++) {
    const result = await attempt(i);
    if (result > 0) return result;
    const backoff = 2000 * (i + 1);
    await new Promise(r => setTimeout(r, backoff));
  }

  return 0;
}

