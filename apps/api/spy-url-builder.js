const { countryCodeFromInput, countryLabelFromCode } = require('./meta-ads-library-options');

function normalizeCountry(input) {
  return countryCodeFromInput(input);
}

/** País efectivo da pesquisa — nunca cair silenciosamente em BR. */
function resolveSpyMarketCountry(...candidates) {
  for (const raw of candidates) {
    const c = String(raw || '').trim();
    if (c && c !== 'ALL') return normalizeCountry(c);
  }
  return 'ALL';
}

/** Força country= na URL da biblioteca (page_id). */
function withLibraryCountry(libraryUrl, countryCode) {
  if (!libraryUrl) return libraryUrl;
  const cc = resolveSpyMarketCountry(countryCode);
  try {
    const u = new URL(libraryUrl);
    u.searchParams.set('country', cc);
    return u.toString();
  } catch {
    return libraryUrl;
  }
}

function buildAdsLibrarySearchUrl(keyword, country = 'ALL') {
  const params = new URLSearchParams({
    active_status: 'active',
    ad_type: 'all',
    country: normalizeCountry(country),
    q: keyword,
    search_type: 'keyword_unordered',
    media_type: 'all',
  });
  return `https://www.facebook.com/ads/library/?${params.toString()}`;
}

/**
 * URL de refresh por page_id — alinhada ao que o browser mostra (~X resultados).
 * active_status=active (só activos); country=BR por defeito (ALL inflaciona 10–50×).
 */
function buildPageLibraryUrl(pageId, country = 'ALL') {
  const params = new URLSearchParams({
    active_status: 'active',
    ad_type: 'all',
    country: normalizeCountry(country),
    view_all_page_id: pageId,
    search_type: 'page',
    media_type: 'all',
  });
  return `https://www.facebook.com/ads/library/?${params.toString()}`;
}

function isKeywordLibraryUrl(url) {
  const s = String(url || '');
  return /search_type=keyword/i.test(s) || (/[?&]q=/.test(s) && !/view_all_page_id=/.test(s));
}

function extractPageIdFromUrl(url) {
  try {
    const parsed = new URL(url);
    return parsed.searchParams.get('view_all_page_id') || parsed.searchParams.get('page_id') || null;
  } catch {
    return null;
  }
}

module.exports = {
  normalizeCountry,
  countryLabelFromCode,
  resolveSpyMarketCountry,
  withLibraryCountry,
  buildAdsLibrarySearchUrl,
  buildPageLibraryUrl,
  extractPageIdFromUrl,
  isKeywordLibraryUrl,
};
