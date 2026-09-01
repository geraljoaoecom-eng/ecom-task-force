const { launchBrowser } = require('./browser-manager');
const { buildPageLibraryUrl, extractPageIdFromUrl } = require('./spy-url-builder');
const {
  isMetaScraperConfigured,
  scrapeKeywordSearchViaMeta,
} = require('./spy-meta-orchestrator');
const { configureMetaBandwidthSaver } = require('./spy-meta-scraper');
const {
  isApifyConfigured: isLegacyApifyToken,
  scrapeKeywordSearchViaApify: scrapeKeywordSearchViaLegacyApify,
} = require('./spy-apify-scraper');

let sharedBrowserPromise = null;
let browserLock = Promise.resolve();

function getSpyScraperMode() {
  const mode = (process.env.SPY_SCRAPER || 'meta').toLowerCase();
  if (mode === 'puppeteer') return 'puppeteer';
  if (mode === 'meta') return 'meta';
  if (isMetaScraperConfigured()) return 'meta';
  return 'puppeteer';
}

async function withSharedBrowser(fn) {
  const prev = browserLock;
  let release;
  browserLock = new Promise((resolve) => {
    release = resolve;
  });
  await prev;
  try {
    if (!sharedBrowserPromise) {
      sharedBrowserPromise = launchBrowser().catch((err) => {
        sharedBrowserPromise = null;
        throw err;
      });
    }
    const browser = await sharedBrowserPromise;
    if (!browser.isConnected()) {
      sharedBrowserPromise = launchBrowser();
      return fn(await sharedBrowserPromise);
    }
    return await fn(browser);
  } finally {
    release();
  }
}

async function closeSharedBrowser() {
  if (sharedBrowserPromise) {
    try {
      const browser = await sharedBrowserPromise;
      if (browser?.isConnected()) await browser.close();
    } catch {
      // ignore
    }
    sharedBrowserPromise = null;
  }
}

function parseAdsFromHtml(html, bodyText) {
  const ads = [];
  const seen = new Set();

  const addPage = (pageId) => {
    if (!pageId || seen.has(pageId)) return;
    seen.add(pageId);
    ads.push({
      pageId,
      libraryUrl: buildPageLibraryUrl(pageId),
    });
  };

  let m;
  const pageIdRegex = /view_all_page_id=(\d+)/g;
  while ((m = pageIdRegex.exec(html)) !== null) addPage(m[1]);

  const jsonPagePatterns = [
    /"page_id"\s*:\s*"(\d+)"/g,
    /"pageID"\s*:\s*"(\d+)"/g,
    /"page_id"\s*:\s*(\d+)/g,
  ];
  for (const re of jsonPagePatterns) {
    while ((m = re.exec(html)) !== null) addPage(m[1]);
  }

  const cleanUrl = (u) =>
    u
      .replace(/\\\//g, '/')
      .replace(/&amp;/g, '&')
      .replace(/\\u0026/g, '&');

  const imageRegex = /"(https:\/\/[^"]+\.(?:jpg|jpeg|png|webp)[^"]*)"/gi;
  const videoRegex = /"(https:\/\/video[^"]*fbcdn[^"]*)"/gi;
  const images = [];
  const videos = [];
  let im;
  while ((im = imageRegex.exec(html)) !== null) {
    images.push(cleanUrl(im[1]));
  }
  while ((im = videoRegex.exec(html)) !== null) {
    videos.push(cleanUrl(im[1]));
  }

  const textChunks = bodyText.split(/Sponsored|Patrocinado|Library ID|ID da biblioteca/i);
  textChunks.slice(1, Math.min(textChunks.length, seen.size + 5)).forEach((chunk, idx) => {
    const pageIds = [...seen];
    const pageId = pageIds[idx % pageIds.length];
    if (!pageId) return;
    const adText = chunk.trim().slice(0, 800);
    const existing = ads.find((a) => a.pageId === pageId);
    if (existing) {
      existing.adText = adText;
      existing.imageUrl = images[idx] || existing.imageUrl || null;
      existing.videoUrl = videos[idx] || existing.videoUrl || null;
    }
  });

  for (const ad of ads) {
    if (!ad.adText) {
      const idx = ads.indexOf(ad);
      ad.adText = textChunks[idx + 1]?.trim().slice(0, 800) || '';
      ad.imageUrl = images[idx] || null;
      ad.videoUrl = videos[idx] || null;
    }
  }

  return ads;
}

async function scrapeKeywordSearchPuppeteer(searchUrl, options = {}) {
  return withSharedBrowser(async (browser) => {
    const page = await browser.newPage();
    try {
      await page.setUserAgent(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      );
      await page.setViewport({ width: 1366, height: 900 });
      await configureMetaBandwidthSaver(page);
      await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 90000 });

      try {
        await page.evaluate(() => {
          const labels = ['Allow all cookies', 'Permitir todos os cookies', 'Accept all', 'Aceitar tudo', 'Allow essential'];
          for (const btn of document.querySelectorAll('button, [role="button"]')) {
            const t = (btn.textContent || '').trim();
            if (labels.some((l) => t.includes(l))) { btn.click(); return; }
          }
        });
        await new Promise((r) => setTimeout(r, 1500));
      } catch {
        // ignore
      }

      try {
        await page.waitForFunction(
          () => /Library ID|ID da biblioteca|\d+\s+results|\d+\s+resultados/i.test(document.body?.innerText || ''),
          { timeout: 25000 }
        );
      } catch {
        // continua
      }

      await new Promise((r) => setTimeout(r, 800 + Math.random() * 700));

      for (let i = 0; i < 12; i++) {
        await page.evaluate(() => window.scrollBy(0, window.innerHeight * 2));
        await new Promise((r) => setTimeout(r, 1500 + Math.random() * 1000));
      }

      const html = await page.content();
      const bodyText = await page.evaluate(() => document.body?.innerText || '');
      const ads = parseAdsFromHtml(html, bodyText);

      const linkUrls = [];
      const linkRegex = /"link_url":"([^"]+)"/g;
      let lm;
      while ((lm = linkRegex.exec(html)) !== null) {
        const url = lm[1].replace(/\\\//g, '/');
        if (url.startsWith('http') && !url.includes('facebook.com')) linkUrls.push(url);
      }

      ads.forEach((ad, i) => {
        ad.landingUrl = linkUrls[i] || linkUrls[0] || null;
      });

      if (!ads.length) {
        const preview = bodyText.slice(0, 200).replace(/\s+/g, ' ');
        console.log(`⚠️ SPY scrape 0 ads — body: ${preview}`);
      }

      const maxAds = options.maxAds;
      const limitedAds = maxAds ? ads.slice(0, maxAds) : ads;
      return {
        ads: limitedAds,
        bodyText: bodyText.slice(0, 5000),
        source: 'puppeteer',
        rawCount: limitedAds.length,
      };
    } finally {
      await page.close().catch(() => {});
    }
  });
}

async function scrapeKeywordSearch(searchUrl, options = {}) {
  const mode = getSpyScraperMode();
  if (mode === 'meta') {
    return scrapeKeywordSearchViaMeta(searchUrl, options);
  }
  if (mode === 'apify') {
    const result = await scrapeKeywordSearchViaLegacyApify(searchUrl);
    if (options.maxAds && result.ads) {
      result.ads = result.ads.slice(0, options.maxAds);
      result.rawCount = result.ads.length;
    }
    return result;
  }
  return scrapeKeywordSearchPuppeteer(searchUrl, options);
}

async function quickCountLibraryAds(libraryUrl) {
  const { scrapeFacebookAds } = require('./library-scraper-service');
  const result = await scrapeFacebookAds(libraryUrl, null, { previousCount: 0 });
  if (result.status === 'ok' && result.count != null) return result.count;
  if (result.status === 'zero_real' || result.status === 'disabled') return 0;
  return 0;
}

module.exports = {
  scrapeKeywordSearch,
  scrapeKeywordSearchPuppeteer,
  quickCountLibraryAds,
  extractPageIdFromUrl,
  closeSharedBrowser,
  getSpyScraperMode,
};
