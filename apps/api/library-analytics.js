/**
 * Analytics das Bibliotecas — leituras agregadas sobre `libraries` + `library_ads`.
 * Tudo no IP Contabo (dados já recolhidos pelo deep-scan). Sem custo de scraping aqui.
 */
const { pool } = require('./db');

function clampLimit(n, def = 20, max = 100) {
  const v = parseInt(n, 10);
  return Number.isFinite(v) && v > 0 ? Math.min(v, max) : def;
}

/**
 * @param {{ limit?: number, country?: string, niche?: string }} opts
 */
async function getLibraryAnalytics(opts = {}) {
  const limit = clampLimit(opts.limit);
  const country = opts.country && opts.country !== 'all' ? opts.country : null;
  const niche = opts.niche && opts.niche !== 'all' ? opts.niche : null;

  // Filtro comum (país/nicho) para os rankings de bibliotecas
  const libWhere = [];
  const libParams = [];
  if (country) { libParams.push(country); libWhere.push(`paises = $${libParams.length}`); }
  if (niche) { libParams.push(niche); libWhere.push(`nichos = $${libParams.length}`); }
  const libFilter = libWhere.length ? `AND ${libWhere.join(' AND ')}` : '';

  // 1) Mais escaladas (por nº de ads activos)
  const scaled = await pool.query(
    `SELECT id, name, paises, nichos, produtos, active_ads
     FROM libraries
     WHERE active_ads > 0 ${libFilter}
     ORDER BY active_ads DESC
     LIMIT ${limit}`,
    libParams
  );

  // 2) Por país (nº de bibliotecas + total de ads activos)
  const byCountry = await pool.query(
    `SELECT COALESCE(NULLIF(paises,''),'(sem país)') AS pais,
            count(*)::int AS libs,
            COALESCE(sum(active_ads),0)::int AS total_ads
     FROM libraries
     WHERE 1=1 ${niche ? `AND nichos = $1` : ''}
     GROUP BY 1 ORDER BY total_ads DESC LIMIT ${limit}`,
    niche ? [niche] : []
  );

  // 3) Por nicho
  const byNiche = await pool.query(
    `SELECT COALESCE(NULLIF(nichos,''),'(sem nicho)') AS nicho,
            count(*)::int AS libs,
            COALESCE(sum(active_ads),0)::int AS total_ads
     FROM libraries
     WHERE 1=1 ${country ? `AND paises = $1` : ''}
     GROUP BY 1 ORDER BY total_ads DESC LIMIT ${limit}`,
    country ? [country] : []
  );

  // 4) Ads há MAIS TEMPO activos (longevidade) — sinal de oferta vencedora
  const longevity = await pool.query(
    `SELECT la.library_id, l.name, l.paises, l.nichos,
            max(la.days_active)::int AS max_dias,
            count(*) FILTER (WHERE la.is_active)::int AS ads_ativos
     FROM library_ads la
     JOIN libraries l ON l.id = la.library_id
     WHERE la.is_active = true ${country ? `AND l.paises = $1` : ''} ${niche ? `AND l.nichos = $${country ? 2 : 1}` : ''}
     GROUP BY la.library_id, l.name, l.paises, l.nichos
     ORDER BY max_dias DESC
     LIMIT ${limit}`,
    [country, niche].filter(Boolean)
  );

  // 5) Creatives MAIS DUPLICADOS (mesma criatividade repetida = escala/teste vencedor)
  const duplicated = await pool.query(
    `SELECT la.library_id, l.name, l.paises,
            la.duplicate_count::int AS dup,
            la.days_active::int AS dias,
            left(la.body_text, 100) AS copy
     FROM library_ads la
     JOIN libraries l ON l.id = la.library_id
     WHERE la.duplicate_count > 1 ${country ? `AND l.paises = $1` : ''} ${niche ? `AND l.nichos = $${country ? 2 : 1}` : ''}
     ORDER BY la.duplicate_count DESC, la.days_active DESC
     LIMIT ${limit}`,
    [country, niche].filter(Boolean)
  );

  // Totais
  const totals = await pool.query(
    `SELECT
       (SELECT count(*)::int FROM libraries) AS libraries,
       (SELECT count(*)::int FROM library_ads WHERE is_active) AS ads_ativos,
       (SELECT count(DISTINCT library_id)::int FROM library_ads) AS libs_com_ads`
  );

  return {
    totals: totals.rows[0],
    scaled: scaled.rows,
    byCountry: byCountry.rows,
    byNiche: byNiche.rows,
    longevity: longevity.rows,
    duplicated: duplicated.rows,
  };
}

module.exports = { getLibraryAnalytics };
