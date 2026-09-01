/**
 * Auto-classificação de bibliotecas por IA (Gemini/Vertex).
 * Lê a copy real dos ads (library_ads) + landing e corrige país/nicho/produto/idioma
 * na tabela `libraries` quando a confiança é alta. Resolve erros de import
 * (ex.: discovery importado com país/nicho errado da pesquisa SPY de origem).
 */
const { pool } = require('./db');
const {
  ANALYSIS_MODEL,
  callGeminiVertex,
  isOpenRouterConfigured,
} = require('./spy-openrouter-shared');
const { countryCodeFromInput, countryLabelFromCode } = require('./meta-ads-library-options');

const MIN_CONF = parseFloat(process.env.LIBRARY_CLASSIFY_MIN_CONF || '0.7') || 0.7;

function parseJsonObject(text) {
  let raw = String(text || '').trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim();
  const m = raw.match(/\{[\s\S]*\}/);
  if (!m) return null;
  try { return JSON.parse(m[0]); } catch { return null; }
}

async function getLibraryAndCopy(libraryId) {
  const { rows: libs } = await pool.query('SELECT * FROM libraries WHERE id = $1', [libraryId]);
  const library = libs[0];
  if (!library) return null;
  const { rows: ads } = await pool.query(
    `SELECT headline, body_text, landing_url FROM library_ads
     WHERE library_id = $1 ORDER BY days_active DESC, duplicate_count DESC LIMIT 8`,
    [libraryId]
  );
  return { library, ads };
}

function buildPrompt(library, ads, optionHints) {
  const copy = ads
    .map((a) => `- ${[a.headline, a.body_text, a.landing_url].filter(Boolean).join(' | ')}`)
    .join('\n')
    .slice(0, 2500);

  return `És um classificador de anunciantes de Direct Response na Meta Ads Library.

ANUNCIANTE: ${library.name || '?'}
CLASSIFICAÇÃO ACTUAL (pode estar errada): país=${library.paises || '?'} | nicho=${library.nichos || '?'} | produto=${library.produtos || '?'} | idioma=${library.idiomas || '?'}

OPÇÕES CONHECIDAS (usa estas quando encaixarem; podes propor nova se nenhuma servir):
- Nichos: ${optionHints.nichos.join(', ') || '—'}
- Produtos: ${optionHints.produtos.join(', ') || '—'}

COPY REAL DOS ANÚNCIOS (fonte de verdade):
${copy || '(sem copy)'}

Classifica com base na COPY REAL, corrigindo a actual se necessário.
- país: o MERCADO-ALVO do anúncio (idioma/moeda/refs culturais), nome do país em português.
- idioma: língua predominante da copy.
- nicho: ex. EMAGRECIMENTO, DIABETES, RELACIONAMENTO, FINANÇAS, SORTEIO, etc.
- produto: INFO, NUTRA, APP, Store, SORTEIOS, etc.

Responde APENAS JSON: {"paises":"","idiomas":"","nichos":"","produtos":"","confianca":0.0-1.0,"motivo":"curto"}`;
}

async function getOptionHints() {
  try {
    const { rows } = await pool.query(
      `SELECT type, value FROM filter_options WHERE type IN ('nichos','produtos') ORDER BY value`
    );
    const map = { nichos: [], produtos: [] };
    for (const r of rows) {
      if (map[r.type]) map[r.type].push(r.value);
    }
    return map;
  } catch {
    return { nichos: [], produtos: [] };
  }
}

/**
 * Classifica (e opcionalmente corrige) uma biblioteca.
 * @returns {object|null} { paises, idiomas, nichos, produtos, confianca, applied }
 */
async function classifyLibrary(libraryId, { apply = true } = {}) {
  if (!isOpenRouterConfigured()) return null;
  const data = await getLibraryAndCopy(libraryId);
  if (!data) return null;
  const { library, ads } = data;
  if (!ads.length) return null; // sem copy ainda → nada a classificar

  const optionHints = await getOptionHints();
  const prompt = buildPrompt(library, ads, optionHints);

  let raw;
  try {
    raw = await callGeminiVertex(
      [
        { role: 'system', content: 'Respondes só com JSON. Sem markdown.' },
        { role: 'user', content: prompt },
      ],
      { model: ANALYSIS_MODEL, temperature: 0.1, max_tokens: 400, timeout: 60000 }
    );
  } catch (e) {
    console.warn(`⚠️ classify library ${libraryId}:`, e.message);
    return null;
  }

  const out = parseJsonObject(raw);
  if (!out) return null;

  // Normalizar país → nome canónico Meta
  if (out.paises) {
    const cc = countryCodeFromInput(out.paises);
    if (cc && cc !== 'ALL') out.paises = countryLabelFromCode(cc) || out.paises;
  }

  const conf = Number(out.confianca);
  out.applied = false;
  if (apply && Number.isFinite(conf) && conf >= MIN_CONF) {
    // IA sobrescreve sempre quando tem valor; mantém existente se IA devolveu null/vazio
    await pool.query(
      `UPDATE libraries SET
         paises   = COALESCE($2, paises),
         nichos   = COALESCE($3, nichos),
         produtos = COALESCE($4, produtos),
         idiomas  = COALESCE($5, idiomas),
         updated_at = NOW()
       WHERE id = $1`,
      [libraryId, out.paises || null, out.nichos || null, out.produtos || null, out.idiomas || null]
    );
    out.applied = true;
    console.log(`   🏷️ Classificação aplicada ${library.name}: ${out.paises} / ${out.nichos} / ${out.produtos} (conf ${conf})`);
  }
  return out;
}

module.exports = { classifyLibrary };
