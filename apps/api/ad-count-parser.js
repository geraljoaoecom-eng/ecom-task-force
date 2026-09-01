/**
 * Contagens da Meta Ad Library — ver LIBRARY-SCRAPER-NOTAS.md na raiz do projeto.
 * UI mostra ~130 (arredondado); JSON pode trazer 126 (exacto). Não tratar diferença pequena como bug.
 */
function parseNumberToken(raw) {
  const cleaned = String(raw || '').replace(/[\s.,]/g, '');
  if (!/\d/.test(cleaned)) return null;
  const value = parseInt(cleaned, 10);
  return Number.isFinite(value) ? value : null;
}

function getHeaderSection(text) {
  const markers = [
    /Library ID/i,
    /ID da biblioteca/i,
    /Identificação da biblioteca/i,
    /Started running on/i,
    /Começou a veicular em/i,
    /Veiculação iniciada em/i,
    /Active status/i,
    /Estado:\s*Ativo/i,
    /Open Dropdown/i,
    /Abrir menu/i,
    /Sponsored/i,
    /Patrocinado/i,
  ];

  let endIndex = text.length;
  for (const marker of markers) {
    const match = marker.exec(text);
    if (match && match.index > 80 && match.index < endIndex) {
      endIndex = match.index;
    }
  }

  return text.slice(0, Math.min(endIndex, 8000));
}

function detectLibraryPageState(text) {
  const t = String(text || '');
  if (/no ads match|nenhum anúncio corresponde|não há anúncios|doesn't match your search|does not match your search/i.test(t)) {
    return 'zero';
  }
  if (/disabled it for not following|desactivada|desativada|página foi desativada|page was disabled/i.test(t)) {
    return 'disabled';
  }
  return null;
}

function extractJsonCount(html) {
  if (!html) return null;

  const patterns = [
    /"search_results_connection"\s*:\s*\{\s*"count"\s*:\s*(\d+)/gi,
    /"search_results_connection"[\s\S]{0,120}?"count"\s*:\s*(\d+)/gi,
  ];

  let foundAny = false;
  let best = null;

  for (const pattern of patterns) {
    for (const match of html.matchAll(pattern)) {
      foundAny = true;
      const count = parseNumberToken(match[1]);
      if (count >= 0 && count < 500000) {
        if (best === null || count > best) best = count;
      }
    }
  }

  return foundAny ? best : null;
}

/**
 * Arredondamento que a Meta usa no UI (~130, ~250, ~650).
 * O JSON embutido traz o valor exacto (ex. 126, 245, 652).
 */
function metaDisplayRound(exact) {
  const n = Number(exact);
  if (!Number.isFinite(n) || n <= 0) return n;
  if (n < 1000) return Math.round(n / 10) * 10;
  if (n < 10000) return Math.round(n / 50) * 50;
  return Math.round(n / 100) * 100;
}

function reconcileCounts(textCount, jsonCount) {
  if (textCount !== null && jsonCount !== null) {
    if (jsonCount > textCount * 2) return textCount;
    if (Math.abs(jsonCount - textCount) <= 15) return textCount;
    return textCount;
  }
  if (textCount !== null) return textCount;
  if (jsonCount !== null) return metaDisplayRound(jsonCount);
  return null;
}

function extractTextCount(text) {
  if (!text) return null;

  const headerSection = getHeaderSection(text);
  const patterns = [
    /~\s*([\d\s.,]+)\s*(resultados?|results?|résultats?|risultati?|ergebnisse?|anúncios|anuncios|ads)/i,
    /([\d\s.,]+)\s*(resultados?|results?|résultats?|risultati?|ergebnisse?|anúncios|anuncios|ads)/i,
    /([\d\s.,]+)\s+active\s+ads/i,
    /([\d\s.,]+)\s+anúncios?\s+ativos?/i,
  ];

  for (const pattern of patterns) {
    const match = headerSection.match(pattern);
    if (!match || !/\d/.test(match[1] || '')) continue;
    const count = parseNumberToken(match[1]);
    if (count !== null && count >= 0 && count < 500000) return count;
  }

  return null;
}

/**
 * Interpreta resultado de scrape com prioridade JSON → texto → null.
 * @returns {{ count: number|null, status: 'ok'|'zero_real'|'disabled'|'parse_failed'|'likely_blocked' }}
 */
function interpretScrapeResult(text, html = '', previousCount = 0) {
  if (/disabled it for not following|desactivada|desativada|página foi desativada|page was disabled/i.test(String(text || ''))) {
    return { count: 0, status: 'disabled' };
  }

  const jsonCount = extractJsonCount(html);
  const textCount = extractTextCount(text);
  const pageState = detectLibraryPageState(text);

  // Shell bloqueado: JSON carregou mas o ~X resultados ainda não apareceu no texto
  if (pageState === 'zero' && jsonCount > 0) {
    return { count: reconcileCounts(textCount, jsonCount), status: 'ok' };
  }
  if (pageState === 'zero') {
    if (previousCount >= 50) {
      return { count: null, status: 'likely_blocked' };
    }
    return { count: 0, status: 'zero_real' };
  }
  let count = reconcileCounts(textCount, jsonCount);

  if (count === null) {
    return { count: null, status: 'parse_failed' };
  }
  if (count === 0 && previousCount >= 50) {
    return { count: null, status: 'likely_blocked' };
  }
  if (count === 0) {
    return { count: 0, status: 'zero_real' };
  }
  return { count, status: 'ok' };
}

function collectHtmlCounts(html, pattern) {
  const counts = [];
  for (const match of html.matchAll(pattern)) {
    const count = parseNumberToken(match[1]);
    if (count > 0 && count < 500000) counts.push(count);
  }
  return counts;
}

function parseAdCountFromHtml(html) {
  const json = extractJsonCount(html);
  if (json !== null && json > 0) return json;

  if (!html) return 0;

  const patternGroups = [
    /"active_ad_count"\s*:\s*(\d+)/gi,
    /"ad_count"\s*:\s*(\d+)/gi,
    /"total_count"\s*:\s*(\d+)/gi,
    /"search_results_count"\s*:\s*(\d+)/gi,
    /"count"\s*:\s*(\d+)\s*,\s*"type"\s*:\s*"ads"/gi,
  ];

  let best = 0;
  for (const pattern of patternGroups) {
    for (const count of collectHtmlCounts(html, pattern)) {
      if (count > best) best = count;
    }
  }

  return best;
}

function parseAdCountFromText(text) {
  const count = extractTextCount(text);
  return count ?? 0;
}

/**
 * Parse contagem de ads — wrapper compatível com código legado.
 * @returns {{ count: number, status: 'ok'|'zero'|'disabled'|'unknown'|'parse_failed'|'likely_blocked' }}
 */
function parseLibraryAdCount(text, html = '', previousCount = 0) {
  const result = interpretScrapeResult(text, html, previousCount);

  if (result.status === 'ok') {
    return { count: result.count, status: 'ok' };
  }
  if (result.status === 'zero_real') {
    return { count: 0, status: 'zero' };
  }
  if (result.status === 'disabled') {
    return { count: 0, status: 'disabled' };
  }
  if (result.status === 'likely_blocked') {
    return { count: 0, status: 'likely_blocked' };
  }
  return { count: 0, status: 'parse_failed' };
}

module.exports = {
  parseAdCountFromText,
  parseAdCountFromHtml,
  parseLibraryAdCount,
  interpretScrapeResult,
  extractJsonCount,
  extractTextCount,
  parseNumberToken,
  detectLibraryPageState,
  metaDisplayRound,
  reconcileCounts,
};
