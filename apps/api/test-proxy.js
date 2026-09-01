require('dotenv').config({ path: require('path').join(__dirname, '../../env-config') });
require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });

const {
  launchBrowser,
  getPage,
  closeBrowser,
  checkProxyHealth,
  getProxyList,
  maskProxyUrl,
  fetchIpThroughBrowser,
  HEALTH_CHECK_PAGE_URL,
} = require('./browser-manager');
const { interpretScrapeResult, extractJsonCount, extractTextCount } = require('./ad-count-parser');
const { isApifyConfigured, checkApifyHealth } = require('./spy-apify-scraper');
const { getSpyScraperMode } = require('./spy-search-scraper');

const KEYWORD_TEST_URL =
  'https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=US&q=emagrecimento&search_type=keyword_unordered';
const PAGE_ID_TEST_URL = HEALTH_CHECK_PAGE_URL;
const LOCALE = 'pt-BR,pt;q=0.9,en-US;q=0.8';

function diagnoseBlock(html, text) {
  const jsonCount = extractJsonCount(html);
  const textCount = extractTextCount(text);
  const noMatch = /no ads match|nenhum anúncio/i.test(text || '');

  if (jsonCount !== null && jsonCount > 0 && noMatch) {
    return 'bloqueio_parcial (JSON tem count, DOM bloqueado)';
  }
  if (jsonCount === 0 && noMatch) {
    return 'bloqueio_total (JSON count=0 + No ads match)';
  }
  if (jsonCount !== null && jsonCount > 0) {
    return 'ok (count no JSON)';
  }
  if (textCount !== null && textCount > 0) {
    return 'ok (count visível no texto)';
  }
  return 'inconclusivo';
}

async function scrapeTestPage(url, useProxy) {
  let browser;
  try {
    browser = await launchBrowser({ useProxy });
    const page = await getPage(browser, { locale: LOCALE });
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 45000 });
    await new Promise((r) => setTimeout(r, 4000));
    const html = await page.content();
    const text = await page.evaluate(() => document.body?.innerText || '');
    const result = interpretScrapeResult(text, html, 0);
    const pageIds = [...html.matchAll(/view_all_page_id=(\d+)/g)].map((m) => m[1]);
    return {
      jsonCount: extractJsonCount(html),
      textCount: extractTextCount(text),
      interpret: result,
      diagnosis: diagnoseBlock(html, text),
      pageIdsFound: new Set(pageIds).size,
      bodyPreview: text.replace(/\s+/g, ' ').slice(0, 300),
    };
  } finally {
    if (browser) await closeBrowser(browser);
  }
}

async function main() {
  console.log('═══════════════════════════════════════════════════════');
  console.log('🔍 ECOM TaskForce — Diagnóstico Proxy & Scraping');
  console.log('═══════════════════════════════════════════════════════\n');

  const proxies = getProxyList();
  console.log('📋 Variáveis de ambiente:');
  console.log('   SPY_SCRAPER:', getSpyScraperMode());
  console.log('   APIFY_API_TOKEN:', isApifyConfigured() ? '(definido)' : '(não definido)');
  console.log('   SPY_PROXY_URL:', maskProxyUrl(process.env.SPY_PROXY_URL));
  console.log('   SPY_PROXY_URLS:', proxies.length ? `${proxies.length} proxy(s) configurados` : '(não definido)');
  proxies.forEach((p, i) => console.log(`     [${i + 1}] ${maskProxyUrl(p)}`));
  console.log('');

  let apifyOk = false;
  if (isApifyConfigured()) {
    console.log('0️⃣ Health check Apify (SPY)...');
    const apifyHealth = await checkApifyHealth();
    apifyOk = apifyHealth.healthy;
    console.log(apifyHealth.healthy ? '   ✅ Apify token válido' : '   ❌ Apify indisponível');
    console.log('');
  }

  console.log('1️⃣ IP VPS directo (sem proxy)...');
  const vpsIp = await fetchIpThroughBrowser(false);
  console.log(`   IP: ${vpsIp || '❌ falhou'}\n`);

  console.log('2️⃣ IP com proxy ISP...');
  const proxyIp = proxies.length ? await fetchIpThroughBrowser(true) : null;
  if (proxies.length) {
    console.log(`   IP: ${proxyIp || '❌ falhou'}`);
    console.log(
      `   Diferente do VPS: ${vpsIp && proxyIp && vpsIp !== proxyIp ? '✅ sim' : vpsIp === proxyIp ? '⚠️ igual (proxy pode não estar activo)' : '❓'}\n`
    );
  } else {
    console.log('   ⏭️ Ignorado — nenhum proxy configurado\n');
  }

  console.log('3️⃣ Health check proxy (keyword search SPY)...');
  let healthOk = false;
  let healthCount = null;
  let healthPageIds = 0;
  if (proxies.length) {
    const health = await checkProxyHealth();
    healthOk = health.healthy;
    healthCount = health.count;
    healthPageIds = health.pageIds;
    console.log(
      health.healthy
        ? `   ✅ Proxy saudável (count JSON: ${health.count ?? 'N/A'}, page_ids: ${health.pageIds})`
        : `   ❌ Proxy bloqueado ou offline (count: ${health.count ?? 'N/A'}, page_ids: ${health.pageIds})`
    );
  } else {
    console.log('   ⏭️ Ignorado — nenhum proxy configurado');
  }
  console.log('');

  console.log('4️⃣ Teste SPY — keyword search (com proxy)...');
  let spyOk = false;
  if (proxies.length) {
    const spy = await scrapeTestPage(KEYWORD_TEST_URL, true);
    spyOk = spy.pageIdsFound > 0 || (spy.jsonCount !== null && spy.jsonCount > 0);
    console.log(`   JSON count: ${spy.jsonCount ?? 'N/A'}`);
    console.log(`   Text count: ${spy.textCount ?? 'N/A'}`);
    console.log(`   page_ids no HTML: ${spy.pageIdsFound}`);
    console.log(`   Diagnóstico: ${spy.diagnosis}`);
    console.log(`   Body: ${spy.bodyPreview}`);
    console.log(`   Resultado: ${spyOk ? '✅ page_ids/count encontrados' : '❌ sem resultados'}\n`);
  } else {
    console.log('   ⏭️ Ignorado\n');
  }

  console.log('5️⃣ Teste Refresh — page_id (VPS directo, sem proxy)...');
  const refresh = await scrapeTestPage(PAGE_ID_TEST_URL, false);
  const refreshOk = refresh.interpret.status === 'ok' && refresh.interpret.count > 0;
  console.log(`   JSON count: ${refresh.jsonCount ?? 'N/A'}`);
  console.log(`   Text count: ${refresh.textCount ?? 'N/A'}`);
  console.log(`   Interpret: ${refresh.interpret.status} → ${refresh.interpret.count ?? 'null'}`);
  console.log(`   Diagnóstico: ${refresh.diagnosis}`);
  console.log(`   Resultado: ${refreshOk ? `✅ count ${refresh.interpret.count}` : '❌ falhou'}\n`);

  console.log('═══════════════════════════════════════════════════════');
  console.log('📊 RESUMO');
  console.log('═══════════════════════════════════════════════════════');

  if (isApifyConfigured()) {
    console.log(`Apify SPY:        ${apifyOk ? '✅ configurado (modo recomendado)' : '❌ token inválido'}`);
  } else {
    console.log('Apify SPY:        ⚠️ APIFY_API_TOKEN não configurado');
  }
  if (proxies.length) {
    console.log(`Proxy SPY:        ${healthOk && spyOk ? '✅ funcional' : healthOk ? '⚠️ health OK mas keyword falhou' : '❌ bloqueado/offline'}`);
  } else {
    console.log('Proxy SPY:        ⚠️ SPY_PROXY_URL não configurado');
  }
  console.log(`Refresh page_id:  ${refreshOk ? '✅ funcional (VPS directo)' : '❌ falhou'}`);

  if (isApifyConfigured() && apifyOk) {
    console.log('\n💡 SPY usará Apify (SPY_SCRAPER=auto ou apify). Refresh continua VPS directo.');
  } else if (proxies.length && !healthOk) {
    console.log('\n💡 Proxy bloqueado. Configura APIFY_API_TOKEN para SPY ou renova proxy ISP.');
  }

  console.log('\nDIAGNÓSTICO CONCLUÍDO');
  const spyReady = isApifyConfigured() ? apifyOk : healthOk;
  process.exitCode = refreshOk && spyReady ? 0 : 1;
}

main().catch((err) => {
  console.error('❌ Erro fatal:', err.message);
  process.exit(1);
});
