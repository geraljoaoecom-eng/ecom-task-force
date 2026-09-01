require('dotenv').config({ path: require('path').join(__dirname, '../../env-config') });
require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });

const { buildAdsLibrarySearchUrl } = require('./spy-url-builder');
const { isApifyConfigured, checkApifyHealth, scrapeKeywordSearchViaApify, getConfig } = require('./spy-apify-scraper');
const { getSpyScraperMode } = require('./spy-search-scraper');

async function main() {
  console.log('🤖 Teste Apify SPY\n');
  console.log('Modo SPY:', getSpyScraperMode());
  console.log('Apify configurado:', isApifyConfigured() ? 'sim' : 'não');

  if (!isApifyConfigured()) {
    console.error('\n❌ Define APIFY_API_TOKEN no env-config da VPS');
    process.exit(1);
  }

  const cfg = getConfig();
  console.log('Actor:', cfg.actorId);
  console.log('Max ads/keyword:', cfg.maxAds);
  console.log('Timeout:', cfg.timeoutSec, 's\n');

  const health = await checkApifyHealth();
  console.log('Health:', health.healthy ? '✅ OK' : '❌ falhou');
  if (!health.healthy) process.exit(1);

  const keyword = process.argv[2] || 'emagrecimento';
  const country = process.argv[3] || 'BR';
  const url = buildAdsLibrarySearchUrl(keyword, country);

  console.log(`\n🔎 Keyword: "${keyword}" (${country})`);
  console.log(`URL: ${url}\n`);

  const start = Date.now();
  const result = await scrapeKeywordSearchViaApify(url);
  const elapsed = ((Date.now() - start) / 1000).toFixed(1);

  console.log(`\n✅ Concluído em ${elapsed}s`);
  console.log(`Ads brutos Apify: ${result.rawCount}`);
  console.log(`Anunciantes únicos: ${result.ads.length}\n`);

  result.ads.slice(0, 5).forEach((ad, i) => {
    console.log(`${i + 1}. page_id=${ad.pageId} | ${ad.pageName || '—'}`);
    console.log(`   texto: ${(ad.adText || '').slice(0, 120)}`);
    console.log(`   landing: ${ad.landingUrl || '—'}`);
  });

  if (result.ads.length > 5) {
    console.log(`\n... e mais ${result.ads.length - 5} anunciantes`);
  }
}

main().catch((err) => {
  console.error('❌ Erro:', err.message);
  process.exit(1);
});
