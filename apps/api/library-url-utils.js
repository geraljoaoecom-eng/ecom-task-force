const {
  extractPageIdFromUrl,
  buildPageLibraryUrl,
  isKeywordLibraryUrl,
  normalizeCountry,
} = require('./spy-url-builder');

/**
 * País para scrape — BR por defeito; ALL só se biblioteca for claramente worldwide.
 */
function resolveLibraryCountry(library) {
  const paises = String(library?.paises || library?.countries || '').toUpperCase();
  const idiomas = String(library?.idiomas || '').toUpperCase();

  const hasBr = /BR|BRASIL|BRAZIL/.test(paises);
  const hasWw = /WW|WORLD|MUNDIAL|GLOBAL|ALL\b|US\b|USA|EUROPA|EU\b/.test(paises);

  if (hasWw && !hasBr) return 'ALL';
  if (/PT|PORTUGAL/.test(paises)) return 'PT';
  if (/US|USA|ESTADOS/.test(paises)) return 'US';
  if (hasBr) return 'BR';

  // Sem país definido: BR (produto focado em mercado BR)
  return 'BR';
}

function countryFromSourceUrl(rawUrl) {
  try {
    const c = new URL(String(rawUrl || '')).searchParams.get('country');
    if (c && String(c).trim()) {
      return normalizeCountry(c);
    }
  } catch {
    // ignore
  }
  return null;
}

function normalizeLibraryScrapeUrl(rawUrl, library = null) {
  const url = String(rawUrl || '').trim();

  if (isKeywordLibraryUrl(url)) {
    return url;
  }

  const pageId = extractPageIdFromUrl(url);
  if (pageId) {
    const country =
      countryFromSourceUrl(url) || (library ? resolveLibraryCountry(library) : 'BR');
    return buildPageLibraryUrl(pageId, country);
  }

  return url;
}

module.exports = {
  normalizeLibraryScrapeUrl,
  resolveLibraryCountry,
  countryFromSourceUrl,
  isKeywordLibraryUrl,
};
