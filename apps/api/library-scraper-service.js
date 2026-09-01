const { launchBrowser, getPage, closeBrowser } = require('./browser-manager');
const { pool, updateLibraryScrapeResult, getLibrariesForScraping } = require('./db');
const { runTaxonomyCheckOnRefresh } = require('./library-taxonomy-service');
const { interpretScrapeResult } = require('./ad-count-parser');
const { normalizeLibraryScrapeUrl, isKeywordLibraryUrl } = require('./library-url-utils');
const { extractPageIdFromUrl } = require('./spy-url-builder');

const LOCALE = 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7';
const BLOCKED_TYPES = new Set(['image', 'media']);
const BATCH_DELAY_MS = 300;
const BROWSER_RECYCLE_EVERY = 25;
const WAIT_FOR_COUNT_MS = 18000;

async function configureFastPage(page) {
  await page.setRequestInterception(true);
  page.on('request', (req) => {
    if (BLOCKED_TYPES.has(req.resourceType())) {
      req.abort();
    } else {
      req.continue();
    }
  });
}

async function dismissCookieConsent(page) {
  try {
    await page.evaluate(() => {
      const labels = [
        'Allow all cookies',
        'Permitir todos os cookies',
        'Accept all',
        'Aceitar tudo',
        'Allow essential',
        'Permitir cookies essenciais',
      ];
      for (const btn of document.querySelectorAll('button, [role="button"]')) {
        const t = (btn.textContent || '').trim();
        if (labels.some((l) => t.includes(l))) {
          btn.click();
          return;
        }
      }
    });
    await new Promise((r) => setTimeout(r, 800));
  } catch {
    // ignore
  }
}

async function readAdCountFromPage(page, previousCount = 0) {
  const html = await page.content();
  const pageText = await page.evaluate(() => document.body?.innerText || '');
  const interpreted = interpretScrapeResult(pageText, html, previousCount);
  return { ...interpreted, pageText };
}

async function loadLibraryPage(page, url, previousCount = 0, { slow = false } = {}) {
  await page.goto(url, {
    waitUntil: slow ? 'networkidle2' : 'domcontentloaded',
    timeout: slow ? 45000 : 25000,
  });

  await dismissCookieConsent(page);

  try {
    await page.waitForFunction(
      () => {
        const text = document.body?.innerText || '';
        return (
          /~\s*[\d][\d\s.,]*\s*resultados?/i.test(text) ||
          /~\s*[\d][\d\s.,]*\s*results?/i.test(text) ||
          /no ads match|nenhum anúncio corresponde|doesn't match your search/i.test(text) ||
          /Library ID|ID da biblioteca/i.test(text)
        );
      },
      { timeout: WAIT_FOR_COUNT_MS }
    );
  } catch {
    await new Promise((r) => setTimeout(r, slow ? 2500 : 1500));
  }

  // Dar tempo ao "~130 resultados" aparecer antes de ler só o JSON
  await new Promise((r) => setTimeout(r, slow ? 2000 : 3500));

  return readAdCountFromPage(page, previousCount);
}

async function scrapeAdCountOnPage(page, rawUrl, previousCount = 0, library = null) {
  if (isKeywordLibraryUrl(rawUrl) && !extractPageIdFromUrl(rawUrl)) {
    console.log('   ⚠️ URL por keyword — não dá para contar ads da página (ignorar refresh)');
    return { count: null, status: 'parse_failed' };
  }

  const url = normalizeLibraryScrapeUrl(rawUrl, library);

  let result = await loadLibraryPage(page, url, previousCount, { slow: false });

  if (result.status === 'parse_failed') {
    console.log('   ↻ Retry lento (contagem não detectada)...');
    result = await loadLibraryPage(page, url, previousCount, { slow: true });
  }

  return result;
}

function logScrapeResult(result) {
  if (result.status === 'ok') {
    console.log(`✅ Encontrado: ${result.count} anúncios`);
  } else if (result.status === 'zero_real') {
    console.log('✅ Confirmado: 0 anúncios activos (zero real)');
  } else if (result.status === 'disabled') {
    console.log('✅ Confirmado: página desactivada');
  } else if (result.status === 'likely_blocked') {
    console.log('⚠️ Zero suspeito — possível bloqueio (BD não alterada)');
  } else if (result.status === 'parse_failed') {
    console.log('⚠️ Contagem não detectada na página');
  }
}

/**
 * Lê contagem de ads numa URL (browser partilhado opcional). Sempre VPS directo.
 */
async function scrapeFacebookAds(url, browser = null, { previousCount = 0, library = null } = {}) {
  const ownsBrowser = !browser;

  try {
    if (!browser) {
      browser = await launchBrowser({ useProxy: false });
    }

    const page = await getPage(browser, { locale: LOCALE });
    try {
      await configureFastPage(page);
      const result = await scrapeAdCountOnPage(page, url, previousCount, library);
      logScrapeResult(result);
      return result;
    } finally {
      await page.close().catch(() => {});
    }
  } catch (error) {
    console.error(`❌ Erro no scraping: ${error.message}`);
    return { count: null, status: 'parse_failed' };
  } finally {
    if (ownsBrowser && browser) {
      await closeBrowser(browser);
    }
  }
}

async function applyTaxonomyAfterRefresh(library, scrapeResult) {
  try {
    const tax = await runTaxonomyCheckOnRefresh(library, { pageText: scrapeResult.pageText });
    return tax;
  } catch (err) {
    console.warn(`⚠️ Taxonomia refresh ${library.id}:`, err.message);
    return null;
  }
}

async function applyScrapeResult(library, scrapeResult) {
  const { count, status } = scrapeResult;
  const previous = library.active_ads ?? 0;
  let taxonomy = null;

  if (status === 'ok') {
    await updateLibraryScrapeResult(library.id, count);
    console.log(`   ✅ Atualizado: ${count} anúncios ativos`);
    taxonomy = await applyTaxonomyAfterRefresh(library, scrapeResult);
    return { success: true, activeAds: count, libraryName: library.name, status, taxonomy };
  }

  if (status === 'zero_real' || status === 'disabled') {
    await updateLibraryScrapeResult(library.id, 0);
    console.log(`   ✅ Atualizado: 0 anúncios ativos`);
    taxonomy = await applyTaxonomyAfterRefresh(library, scrapeResult);
    return { success: true, activeAds: 0, libraryName: library.name, status, taxonomy };
  }

  if (status === 'likely_blocked') {
    console.warn(
      `⚠️ Scrape devolveu 0 mas BD tinha ${previous} — mantendo valor anterior (possível bloqueio)`
    );
    await pool.query(`UPDATE libraries SET last_checked_at = NOW() WHERE id = $1`, [library.id]);
    return {
      success: false,
      error: 'Zero suspeito — valor anterior mantido',
      skipped: true,
      activeAds: previous,
      status,
      needsProxy: true,
    };
  }

  console.warn(`⚠️ Refresh inconclusivo para ${library.source_value} — mantendo valor anterior`);
  await pool.query(`UPDATE libraries SET last_checked_at = NOW() WHERE id = $1`, [library.id]);
  return {
    success: false,
    error: 'Contagem inconclusiva — valor anterior mantido',
    skipped: true,
    activeAds: previous,
    status: status || 'parse_failed',
    needsProxy: true,
  };
}

async function getPreviousAdCount(libraryId, currentActiveAds = 0) {
  const base = currentActiveAds ?? 0;
  const { rows } = await pool.query(
    `SELECT MAX(ads_count) AS peak
     FROM ad_history
     WHERE library_id = $1 AND ads_count > 0`,
    [libraryId]
  );
  const peak = rows[0]?.peak ?? 0;
  return Math.max(base, peak);
}

async function updateSingleLibrary(libraryId, browser = null) {
  try {
    console.log(`\n📚 Atualizando biblioteca: ${libraryId}`);

    const { rows } = await pool.query('SELECT * FROM libraries WHERE id = $1', [libraryId]);

    if (!rows[0]) {
      console.log(`⚠️ Biblioteca ${libraryId} não encontrada`);
      return { success: false, error: 'Biblioteca não encontrada' };
    }

    const library = rows[0];
    console.log(`   Nome: ${library.name}`);

    const previousCount = await getPreviousAdCount(library.id, library.active_ads);

    // 1ª tentativa: IP directo Contabo (rápido, grátis)
    const scrapeResult = await scrapeFacebookAds(library.source_value, browser, {
      previousCount,
      library,
    });
    const result = await applyScrapeResult(library, scrapeResult);

    // 2ª tentativa: DOM extractor (Contabo IP directo) — fallback quando bodyText count falha
    if (!result.success && result.needsProxy) {
      console.log(`   🔄 Fallback DOM extractor (IP Contabo): ${library.name}`);
      try {
        const { scrapeLibraryPagePhase } = require('./spy-meta-scraper');
        const { parseActiveAdsFromScrape } = require('./spy-library-pull');
        const scrape = await scrapeLibraryPagePhase(library.source_value, {
          directScrape: true,
          scrollToEnd: false,
          maxAds: 200,
        });
        const count = parseActiveAdsFromScrape(scrape);
        if (count > 0) {
          await updateLibraryScrapeResult(library.id, count);
          console.log(`   ✅ DOM fallback: ${count} ads activos`);
          return { success: true, activeAds: count, libraryName: library.name, status: 'dom_fallback' };
        }
        // DOM retornou 0 — pode ser zero real ou bloqueio; actualizar last_checked_at e avançar
        console.warn(`   ⚠️ DOM fallback: 0 ads — manter valor anterior (${previousCount})`);
      } catch (de) {
        console.warn(`   ⚠️ DOM fallback falhou: ${de.message}`);
      }
    }

    return result;
  } catch (error) {
    console.error(`   ❌ Erro ao atualizar biblioteca: ${error.message}`);
    return { success: false, error: error.message };
  }
}

async function refreshLibraryBatch(libraries) {
  let successCount = 0;
  let failedCount = 0;
  let browser = null;
  let pagesSinceLaunch = 0;

  try {
    browser = await launchBrowser({ useProxy: false });
    console.log(`🚀 Modo rápido: 1 browser para ${libraries.length} bibliotecas\n`);

    for (let i = 0; i < libraries.length; i++) {
      if (pagesSinceLaunch >= BROWSER_RECYCLE_EVERY) {
        console.log(`♻️ Reciclar browser após ${pagesSinceLaunch} páginas`);
        await closeBrowser(browser);
        browser = await launchBrowser({ useProxy: false });
        pagesSinceLaunch = 0;
      }

      const library = libraries[i];
      console.log(`[${i + 1}/${libraries.length}] ${library.name}`);
      console.log(`🕷️ Scraping: ${normalizeLibraryScrapeUrl(library.source_value, library)}`);

      const previousCount = await getPreviousAdCount(library.id, library.active_ads);
      const scrapeResult = await scrapeFacebookAds(library.source_value, browser, {
        previousCount,
        library,
      });
      const result = await applyScrapeResult(library, scrapeResult);

      if (result.success) successCount++;
      else failedCount++;

      pagesSinceLaunch += 1;

      if (i < libraries.length - 1) {
        await new Promise((r) => setTimeout(r, BATCH_DELAY_MS));
      }
    }
  } finally {
    if (browser) await closeBrowser(browser);
  }

  return { successCount, failedCount };
}

async function updateAllLibraries() {
  try {
    console.log('\n═══════════════════════════════════════════════════════');
    console.log('🕷️ INICIANDO ATUALIZAÇÃO AUTOMÁTICA DE BIBLIOTECAS');
    console.log('═══════════════════════════════════════════════════════\n');

    const startTime = Date.now();
    const libraries = await getLibrariesForScraping();
    console.log(`📊 Total de bibliotecas: ${libraries.length}\n`);

    if (libraries.length === 0) {
      console.log('⚠️ Nenhuma biblioteca para atualizar\n');
      return {
        success: true,
        totalLibraries: 0,
        totalSuccess: 0,
        totalFailed: 0,
        duration: 0,
      };
    }

    const { successCount, failedCount } = await refreshLibraryBatch(libraries);
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);

    console.log('\n═══════════════════════════════════════════════════════');
    console.log('📊 RESUMO DA ATUALIZAÇÃO');
    console.log('═══════════════════════════════════════════════════════');
    console.log(`✅ Sucesso: ${successCount}`);
    console.log(`❌ Falhas/skipped: ${failedCount}`);
    console.log(`⏱️ Tempo total: ${duration}s`);
    console.log('═══════════════════════════════════════════════════════\n');

    return {
      success: true,
      totalLibraries: libraries.length,
      totalSuccess: successCount,
      totalFailed: failedCount,
      duration: parseFloat(duration),
    };
  } catch (error) {
    console.error('❌ Erro crítico ao atualizar bibliotecas:', error.message);
    return {
      success: false,
      error: error.message,
      totalLibraries: 0,
      totalSuccess: 0,
      totalFailed: 0,
    };
  }
}

async function updateUserLibraries(userId) {
  try {
    console.log(`\n🔄 Atualizando bibliotecas do usuário: ${userId}\n`);

    const libraries = await getLibrariesForScraping(userId);
    console.log(`📊 Bibliotecas do usuário: ${libraries.length}\n`);

    if (!libraries.length) {
      return { success: true, totalLibraries: 0, totalSuccess: 0, totalFailed: 0 };
    }

    const { successCount, failedCount } = await refreshLibraryBatch(libraries);

    console.log(`\n✅ Concluído: ${successCount} sucesso, ${failedCount} falhas/skipped\n`);

    return {
      success: true,
      totalLibraries: libraries.length,
      totalSuccess: successCount,
      totalFailed: failedCount,
    };
  } catch (error) {
    console.error('❌ Erro ao atualizar bibliotecas do usuário:', error.message);
    return { success: false, error: error.message };
  }
}

module.exports = {
  scrapeFacebookAds,
  updateSingleLibrary,
  updateAllLibraries,
  updateUserLibraries,
};
