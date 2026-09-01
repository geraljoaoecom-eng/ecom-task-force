/**
 * Identidade única de biblioteca Meta Ads Library (page_id ou URL canónica).
 */
const { pool } = require('./db');
const {
  extractPageIdFromUrl,
  buildPageLibraryUrl,
  isKeywordLibraryUrl,
  normalizeCountry,
} = require('./spy-url-builder');
const { countryFromSourceUrl } = require('./library-url-utils');

const LIBRARY_DUPLICATE_MESSAGE = 'Esta biblioteca já existe no sistema';

function resolveCanonicalSourceValue(rawUrl, hints = {}) {
  const url = String(rawUrl || '').trim();
  if (!url) return { canonical: '', pageId: null, isKeyword: false };

  if (isKeywordLibraryUrl(url)) {
    try {
      const parsed = new URL(url);
      return { canonical: parsed.toString(), pageId: null, isKeyword: true };
    } catch {
      return { canonical: url, pageId: null, isKeyword: true };
    }
  }

  const pageId = extractPageIdFromUrl(url);
  if (pageId) {
    const country =
      countryFromSourceUrl(url) ||
      normalizeCountry(hints.country || hints.paises || 'BR');
    return {
      canonical: buildPageLibraryUrl(pageId, country),
      pageId,
      isKeyword: false,
    };
  }

  try {
    const parsed = new URL(url);
    if (parsed.hostname.includes('facebook.com') && parsed.pathname.includes('/ads/library')) {
      return { canonical: parsed.toString(), pageId: null, isKeyword: false };
    }
  } catch {
    // ignore
  }

  return { canonical: url, pageId: null, isKeyword: false };
}

async function findExistingLibrary(poolOrClient, rawUrl, hints = {}) {
  const db = poolOrClient || pool;
  const { canonical, pageId } = resolveCanonicalSourceValue(rawUrl, hints);

  if (canonical) {
    const { rows } = await db.query(
      'SELECT id, name, source_value FROM libraries WHERE source_value = $1 LIMIT 1',
      [canonical]
    );
    if (rows[0]) return { library: rows[0], match: 'canonical' };
  }

  if (pageId) {
    const { rows } = await db.query(
      `SELECT id, name, source_value FROM libraries
       WHERE source_value LIKE $1 OR source_value LIKE $2
       LIMIT 1`,
      [`%view_all_page_id=${pageId}%`, `%page_id=${pageId}%`]
    );
    if (rows[0]) return { library: rows[0], match: 'page_id' };
  }

  return null;
}

/** Mapa page_id → biblioteca (cache em memória para listagens SPY). */
async function buildLibraryPageIdIndex() {
  const { rows } = await pool.query('SELECT id, name, source_value FROM libraries');
  const byPageId = new Map();
  const byCanonical = new Map();

  for (const lib of rows) {
    if (lib.source_value) byCanonical.set(lib.source_value, lib);
    const pageId = extractPageIdFromUrl(lib.source_value);
    if (pageId && !byPageId.has(pageId)) byPageId.set(pageId, lib);
  }

  return { byPageId, byCanonical };
}

function lookupExistingFromIndex(rawUrl, index, hints = {}) {
  const { canonical, pageId } = resolveCanonicalSourceValue(rawUrl, hints);
  if (canonical && index.byCanonical.has(canonical)) {
    return { library: index.byCanonical.get(canonical), match: 'canonical' };
  }
  if (pageId && index.byPageId.has(pageId)) {
    return { library: index.byPageId.get(pageId), match: 'page_id' };
  }
  return null;
}

module.exports = {
  LIBRARY_DUPLICATE_MESSAGE,
  resolveCanonicalSourceValue,
  findExistingLibrary,
  buildLibraryPageIdIndex,
  lookupExistingFromIndex,
  extractPageIdFromUrl,
};
