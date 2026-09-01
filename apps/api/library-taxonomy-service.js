/**
 * Valida nicho / produto / idioma / país nas 3 primeiras actualizações de cada biblioteca.
 * Prioridade: contexto SPY > IA (1 chamada barata) > heurísticas inferFilters.
 */
const { pool } = require('./db');
const { inferFilters } = require('./library-analyzer-service');
const { countryLabelFromCode } = require('./meta-ads-library-options');
const {
  ANALYSIS_MODEL,
  callGeminiVertex,
  isOpenRouterConfigured,
} = require('./spy-openrouter-shared');

const MAX_TAXONOMY_CHECKS = 3;

async function getFilterOptionsMap() {
  const { rows } = await pool.query('SELECT type, value FROM filter_options ORDER BY type, value');
  const map = {};
  for (const row of rows) {
    if (!map[row.type]) map[row.type] = [];
    map[row.type].push(row.value);
  }
  return map;
}

async function getSpyContextForLibrary(libraryId) {
  const { rows } = await pool.query(
    `SELECT s.nicho, s.produto, s.country, s.language, s.name AS session_name
     FROM spy_discoveries d
     JOIN spy_sessions s ON s.id = d.session_id
     WHERE d.imported_library_id = $1
     ORDER BY d.created_at DESC
     LIMIT 1`,
    [libraryId]
  );
  return rows[0] || null;
}

async function getLibraryPages(libraryId) {
  const { rows } = await pool.query('SELECT url FROM pages WHERE library_id = $1 LIMIT 5', [libraryId]);
  return rows.map((r) => r.url);
}

function pickAllowed(value, allowedList) {
  if (!value || !allowedList?.length) return '';
  const norm = (s) =>
    String(s)
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toUpperCase()
      .trim();
  const v = norm(value);
  const exact = allowedList.find((opt) => norm(opt) === v);
  if (exact) return exact;
  const partial = allowedList.find((opt) => v.includes(norm(opt)) || norm(opt).includes(v));
  return partial || value.trim();
}

function mergeTaxonomy({ spy, ai, heuristic, allowed }) {
  const out = {
    nichos: '',
    produtos: '',
    idiomas: '',
    paises: '',
  };

  if (spy?.nicho) out.nichos = pickAllowed(spy.nicho, allowed.nichos);
  else if (ai?.nichos) out.nichos = pickAllowed(ai.nichos, allowed.nichos);
  else out.nichos = pickAllowed(heuristic.nichos, allowed.nichos);

  if (spy?.produto) out.produtos = pickAllowed(spy.produto, allowed.produtos);
  else if (ai?.produtos) out.produtos = pickAllowed(ai.produtos, allowed.produtos);
  else out.produtos = pickAllowed(heuristic.produtos, allowed.produtos);

  if (spy?.language) out.idiomas = pickAllowed(spy.language, allowed.idiomas);
  else if (ai?.idiomas) out.idiomas = pickAllowed(ai.idiomas, allowed.idiomas);
  else out.idiomas = pickAllowed(heuristic.idiomas, allowed.idiomas);

  if (spy?.country) {
    const paisLabel = countryLabelFromCode(spy.country) || spy.country;
    out.paises = pickAllowed(paisLabel, allowed.paises) || paisLabel;
  }
  else if (ai?.paises) out.paises = pickAllowed(ai.paises, allowed.paises);
  else out.paises = pickAllowed(heuristic.paises, allowed.paises);

  return out;
}

function parseTaxonomyJson(text) {
  let raw = String(text || '').trim();
  raw = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim();
  const m = raw.match(/\{[\s\S]*\}/);
  if (!m) return null;
  try {
    const o = JSON.parse(m[0]);
    return {
      nichos: o.nichos || o.nicho || '',
      produtos: o.produtos || o.produto || '',
      idiomas: o.idiomas || o.idioma || o.language || '',
      paises: o.paises || o.pais || o.country || '',
      reason: o.reason || '',
    };
  } catch {
    return null;
  }
}

async function classifyTaxonomyWithAI(ctx, allowed) {
  if (!isOpenRouterConfigured()) return null;

  const prompt = `Classifica esta biblioteca da Meta Ads Library. Escolhe UMA opção de cada lista (ou string vazia se incerto).

NICHOS: ${(allowed.nichos || []).join(' | ')}
PRODUTOS: ${(allowed.produtos || []).join(' | ')}
IDIOMAS: ${(allowed.idiomas || []).join(' | ')}
PAISES: ${(allowed.paises || []).join(' | ')}

Nome: ${ctx.name}
Notas: ${(ctx.notes || '').slice(0, 400)}
${ctx.spyHint || ''}
Landing pages: ${(ctx.pages || []).slice(0, 3).join(' | ') || 'n/d'}
Texto da biblioteca (amostra): ${(ctx.pageText || '').slice(0, 1200)}

Responde APENAS JSON: {"nichos":"","produtos":"","idiomas":"","paises":"","reason":"max 80 chars"}`;

  try {
    const content = await callGeminiVertex([
      { role: 'system', content: 'Respondes só com JSON válido. Sem markdown.' },
      { role: 'user', content: prompt },
    ], { model: ANALYSIS_MODEL, temperature: 0.05, max_tokens: 180 });
    return parseTaxonomyJson(content);
  } catch (err) {
    console.warn(`⚠️ Taxonomia IA: ${err.message?.slice(0, 80)}`);
    return null;
  }
}

/**
 * @param {object} library - row libraries
 * @param {{ pageText?: string }} scrapeMeta
 */
async function runTaxonomyCheckOnRefresh(library, scrapeMeta = {}) {
  const checkCount = library.taxonomy_check_count ?? 0;
  if (checkCount >= MAX_TAXONOMY_CHECKS) {
    return { skipped: true, reason: 'max_checks_reached' };
  }

  const allowed = await getFilterOptionsMap();
  const pages = await getLibraryPages(library.id);
  const spy = await getSpyContextForLibrary(library.id);

  const combinedText = [
    library.name,
    library.notes,
    library.nota,
    library.source_value,
    pages.join(' '),
    scrapeMeta.pageText || '',
  ].join('\n');

  const heuristic = inferFilters(combinedText, allowed);
  const spyHint = spy
    ? `\nPesquisa SPY de origem: nicho=${spy.nicho || '?'} produto=${spy.produto || '?'} país=${spy.country || '?'} idioma=${spy.language || '?'}`
    : '';

  let ai = null;
  try {
    ai = await classifyTaxonomyWithAI(
      {
        name: library.name,
        notes: library.notes || library.nota,
        pages,
        pageText: scrapeMeta.pageText,
        spyHint,
      },
      allowed
    );
  } catch (err) {
    console.warn(`⚠️ Taxonomia IA biblioteca ${library.id}:`, err.message);
  }

  const merged = mergeTaxonomy({
    spy: spy
      ? { nicho: spy.nicho, produto: spy.produto, country: spy.country, language: spy.language }
      : null,
    ai,
    heuristic,
    allowed,
  });

  const changed =
    (merged.nichos && merged.nichos !== (library.nichos || '')) ||
    (merged.produtos && merged.produtos !== (library.produtos || '')) ||
    (merged.idiomas && merged.idiomas !== (library.idiomas || '')) ||
    (merged.paises && merged.paises !== (library.paises || ''));

  await pool.query(
    `UPDATE libraries SET
      nichos = COALESCE(NULLIF($2, ''), nichos),
      produtos = COALESCE(NULLIF($3, ''), produtos),
      idiomas = COALESCE(NULLIF($4, ''), idiomas),
      paises = COALESCE(NULLIF($5, ''), paises),
      taxonomy_check_count = taxonomy_check_count + 1,
      taxonomy_last_checked_at = NOW(),
      updated_at = NOW()
     WHERE id = $1`,
    [library.id, merged.nichos, merged.produtos, merged.idiomas, merged.paises]
  );

  const checkNum = checkCount + 1;
  if (changed) {
    console.log(
      `🏷️ Taxonomia #${checkNum}/3 ${library.name}: ` +
        `${merged.nichos || '-'} · ${merged.produtos || '-'} · ${merged.idiomas || '-'} · ${merged.paises || '-'}`
    );
  } else {
    console.log(`🏷️ Taxonomia #${checkNum}/3 confirmada: ${library.name}`);
  }

  return {
    skipped: false,
    checkNum,
    changed,
    taxonomy: merged,
    usedAi: !!ai,
    usedSpy: !!spy,
  };
}

module.exports = {
  MAX_TAXONOMY_CHECKS,
  runTaxonomyCheckOnRefresh,
};
