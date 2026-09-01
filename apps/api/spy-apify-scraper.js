/**
 * SPY keyword scrape via Apify (apify/facebook-ads-scraper).
 * Refresh de bibliotecas continua com VPS directo — não usar Apify aí.
 */
const { buildPageLibraryUrl } = require('./spy-url-builder');

const APIFY_BASE = 'https://api.apify.com/v2';
const DEFAULT_ACTOR = 'apify/facebook-ads-scraper';

function getConfig() {
  const token = process.env.APIFY_API_TOKEN?.trim();
  const actorId = process.env.APIFY_ACTOR_ID?.trim() || DEFAULT_ACTOR;
  const maxAds = parseInt(process.env.SPY_APIFY_MAX_ADS || '100', 10);
  const timeoutSec = parseInt(process.env.SPY_APIFY_TIMEOUT_SEC || '180', 10);
  return {
    token,
    actorId,
    actorSlug: actorId.replace('/', '~'),
    maxAds: Number.isFinite(maxAds) && maxAds > 0 ? Math.min(maxAds, 500) : 100,
    timeoutSec: Number.isFinite(timeoutSec) && timeoutSec >= 60 ? Math.min(timeoutSec, 600) : 180,
  };
}

function isApifyConfigured() {
  return !!getConfig().token;
}

function pickText(...values) {
  for (const v of values) {
    const t = String(v || '').trim();
    if (t && !/^\{\{product\./i.test(t)) return t.slice(0, 800);
  }
  return '';
}

function pickUrl(...values) {
  for (const v of values) {
    const u = String(v || '').trim();
    if (u.startsWith('http') && !u.includes('facebook.com')) return u;
  }
  return null;
}

function mapApifyItemsToAds(items) {
  const byPage = new Map();

  for (const item of items || []) {
    const pageId = String(
      item.pageId || item.pageID || item.snapshot?.pageId || item.advertiser?.pageId || ''
    ).replace(/\D/g, '');
    if (!pageId) continue;

    const snap = item.snapshot || {};
    const card = Array.isArray(snap.cards) && snap.cards.length ? snap.cards[0] : {};
    const adText = pickText(snap.body?.text, card.body, snap.title, card.title, item.adText);
    const landingUrl = pickUrl(snap.linkUrl, card.linkUrl, item.linkUrl);
    const imageUrl =
      card.originalImageUrl ||
      card.resizedImageUrl ||
      (Array.isArray(snap.images) && snap.images[0]?.originalImageUrl) ||
      null;
    const videoUrl = card.videoSdUrl || card.videoHdUrl || null;

    const candidate = {
      pageId,
      libraryUrl: buildPageLibraryUrl(pageId),
      adText,
      imageUrl,
      videoUrl,
      landingUrl,
      pageName: snap.pageName || item.pageName || null,
      rawApify: {
        adArchiveId: item.adArchiveId || item.adArchiveID || null,
        pageName: snap.pageName || null,
      },
    };

    const existing = byPage.get(pageId);
    if (!existing || (candidate.adText?.length || 0) > (existing.adText?.length || 0)) {
      byPage.set(pageId, {
        ...existing,
        ...candidate,
        adText: candidate.adText || existing?.adText || '',
        imageUrl: candidate.imageUrl || existing?.imageUrl || null,
        videoUrl: candidate.videoUrl || existing?.videoUrl || null,
        landingUrl: candidate.landingUrl || existing?.landingUrl || null,
      });
    }
  }

  return [...byPage.values()];
}

async function apifyFetch(path, { method = 'GET', body, token, timeoutMs = 30000 } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${APIFY_BASE}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });

    const text = await res.text();
    let data;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = text;
    }

    if (!res.ok) {
      const msg =
        typeof data === 'object' && data?.error?.message
          ? data.error.message
          : typeof data === 'string'
            ? data.slice(0, 200)
            : res.statusText;
      throw new Error(`Apify HTTP ${res.status}: ${msg}`);
    }

    return data;
  } finally {
    clearTimeout(timer);
  }
}

async function checkApifyAvailability() {
  const { token } = getConfig();
  if (!token) return false;
  try {
    await apifyFetch('/users/me', { token, timeoutMs: 15000 });
    return true;
  } catch (err) {
    console.error('❌ Apify indisponível:', err.message);
    return false;
  }
}

/**
 * Health check leve — valida token Apify.
 */
async function checkApifyHealth() {
  const ok = await checkApifyAvailability();
  return { healthy: ok, mode: 'apify' };
}

async function runActorSync(searchUrl, maxAdsOverride) {
  const { token, actorSlug, maxAds, timeoutSec } = getConfig();
  const limit = maxAdsOverride ?? maxAds;
  const input = {
    startUrls: [{ url: searchUrl }],
    resultsLimit: limit,
    activeStatus: 'active',
    isDetailsPerAd: false,
    includeAboutPage: false,
  };

  console.log(`🤖 Apify SPY: ${searchUrl.slice(0, 100)}... (max ${limit} ads)`);

  const items = await apifyFetch(
    `/acts/${actorSlug}/run-sync-get-dataset-items?timeout=${timeoutSec}`,
    {
      method: 'POST',
      token,
      body: input,
      timeoutMs: (timeoutSec + 30) * 1000,
    }
  );

  return Array.isArray(items) ? items : [];
}

function mapApifyItemsToMetaAds(items) {
  const out = [];
  for (const item of items || []) {
    const pageId = String(
      item.pageId || item.pageID || item.snapshot?.pageId || item.advertiser?.pageId || ''
    ).replace(/\D/g, '');
    if (!pageId) continue;

    const snap = item.snapshot || {};
    const card = Array.isArray(snap.cards) && snap.cards.length ? snap.cards[0] : {};
    const adId = String(item.adArchiveId || item.adArchiveID || item.ad_archive_id || pageId).replace(
      /\D/g,
      ''
    );
    const headline = pickText(snap.body?.text, card.body, snap.title, card.title, item.adText);

    out.push({
      adId: adId || pageId,
      pageId,
      pageName: snap.pageName || item.pageName || null,
      headline,
      thumbnailUrl:
        card.originalImageUrl ||
        card.resizedImageUrl ||
        (Array.isArray(snap.images) && snap.images[0]?.originalImageUrl) ||
        null,
      libraryUrl: buildPageLibraryUrl(pageId),
      landingUrl: pickUrl(snap.linkUrl, card.linkUrl, item.linkUrl),
      adStatus: 'active',
      rawMetadata: item,
    });
  }
  return out;
}

async function scrapeKeywordSearchViaApify(searchUrl, options = {}) {
  if (!isApifyConfigured()) {
    throw new Error('APIFY_API_TOKEN não configurado');
  }

  const maxAds = options.collectCap ?? options.maxAds ?? getConfig().maxAds;
  const items = await runActorSync(searchUrl, maxAds);
  const metaAds = mapApifyItemsToMetaAds(items);
  const ads = mapApifyItemsToAds(items);

  console.log(
    `   🤖 Apify → ${items.length} ads brutos, ${metaAds.length} para filtro, ${ads.length} páginas`
  );

  const bodyText = ads
    .map((a) => `${a.pageName || a.pageId}: ${a.adText || ''}`.trim())
    .join('\n')
    .slice(0, 5000);

  return {
    ads,
    metaAds,
    bodyText,
    source: 'apify',
    rawCount: items.length,
    meta: { scanned: items.length, pipeline: 'apify_collect' },
  };
}

module.exports = {
  isApifyConfigured,
  checkApifyAvailability,
  checkApifyHealth,
  scrapeKeywordSearchViaApify,
  mapApifyItemsToAds,
  mapApifyItemsToMetaAds,
  getConfig,
};
