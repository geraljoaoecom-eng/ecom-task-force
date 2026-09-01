/**
 * Adapta/traduz keywords para o idioma e variante do mercado (Meta Ads Library).
 * Ex.: PT-PT → PT-BR no Brasil; português → inglês na África do Sul.
 */
const {
  isOpenRouterConfigured,
  callGeminiVertex,
  ANALYSIS_MODEL,
} = require('./spy-openrouter-shared');
const { countryLabelFromCode } = require('./meta-ads-library-options');

function parseAdaptJson(text) {
  let raw = String(text || '').trim();
  raw = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '');
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    const j = JSON.parse(match[0]);
    const keywords = Array.isArray(j.keywords)
      ? j.keywords.map((k) => String(k).trim()).filter(Boolean)
      : [];
    return {
      keywords,
      notes: String(j.notes || j.localeNotes || '').trim(),
    };
  } catch {
    return null;
  }
}

function marketContext(session) {
  const pais = countryLabelFromCode(session.country) || session.country || 'não especificado';
  const idioma = session.language?.trim() || 'inferir do país/mercado';
  const nicho = session.nicho?.trim() || '';
  const produto = session.produto?.trim() || '';
  return { pais, idioma, nicho, produto };
}

/**
 * Adapta lista de keywords para pesquisa na Ads Library do mercado escolhido.
 */
async function adaptKeywordsForMarket(session, keywords, options = {}) {
  const list = [...new Set((keywords || []).map((k) => String(k).trim()).filter(Boolean))];
  if (!list.length) return [];

  if (!isOpenRouterConfigured()) {
    console.log('   ⚠️ Adaptação keywords: OpenRouter off — keywords originais');
    return list;
  }

  const { pais, idioma, nicho, produto } = marketContext(session);
  const label = options.reason || 'pesquisa SPY';

  const prompt = `És especialista em Facebook Ads Library e copy de direct response por mercado.

TAREFA: Adaptar palavras-chave de pesquisa para o mercado abaixo. Anunciantes reais usam estas formas nos ads — não tradução literal rígida se soa artificial.

MERCADO:
- País/região: ${pais}
- Idioma dos anúncios: ${idioma}
${nicho ? `- Nicho: ${nicho}` : ''}
${produto ? `- Tipo produto: ${produto}` : ''}
- Contexto: ${label}

REGRAS:
1. Cada keyword de saída deve estar no idioma e variante que convertem NESTE mercado (ex: Brasil = português BR; Portugal = português PT; EUA/Reino Unido/África do Sul em inglês = inglês local).
2. Se a entrada estiver no idioma errado, TRADUZ e adapta (ex: "disfunção erétil" + mercado EN → "erectile dysfunction").
3. Se for mesma língua mas variante errada, adapta (ex: PT-PT "autocarro" → PT-BR "ônibus" só se for keyword de pesquisa; para nicho DR usa termos que afiliados usam no BR).
4. Mantém o mesmo número de keywords e a mesma ordem que a entrada (1:1).
5. Frases curtas como aparecem na Ads Library (2-6 palavras quando possível).

ENTRADA (${list.length} keywords):
${list.map((k, i) => `${i + 1}. ${k}`).join('\n')}

Responde APENAS JSON:
{"keywords":["...mesma quantidade e ordem..."],"notes":"1 frase sobre adaptação"}`;

  try {
    const text = await callGeminiVertex([{ role: 'user', content: prompt }], {
      model: process.env.SPY_ADAPT_MODEL || ANALYSIS_MODEL,
      max_tokens: 900,
      temperature: 0.25,
      timeout: 60000,
    });
    const parsed = parseAdaptJson(text || '');
    if (!parsed?.keywords?.length) return list;

    const out = list.map((original, i) => parsed.keywords[i] || original);
    if (parsed.notes) {
      console.log(`   🌐 Keywords adaptadas (${pais} / ${idioma}): ${parsed.notes}`);
    }
    return out;
  } catch (err) {
    console.warn(`   ⚠️ Adaptação keywords: ${err.message}`);
    return list;
  }
}

/**
 * Pós-processamento do Deep Search: garante keywords + semente no idioma do mercado.
 */
async function finalizeMarketIntelKeywords(session, intel) {
  if (!intel) return intel;

  const base = { ...intel };
  const deepKeywords = [...(base.keywords || [])];
  const batch = [];

  if (session.keywordSeed?.trim()) batch.push(session.keywordSeed.trim());
  for (const kw of deepKeywords) {
    if (kw && !batch.includes(kw)) batch.push(kw);
  }

  if (!batch.length) return base;

  const adapted = await adaptKeywordsForMarket(session, batch, { reason: 'deep search + semente' });

  if (session.keywordSeed?.trim()) {
    base.keywordSeedOriginal = session.keywordSeed.trim();
    const fromBatch = adapted[0];
    base.keywordSeedAdapted =
      base.keywordSeedAdapted ||
      fromBatch ||
      session.keywordSeed.trim();
    if (
      base.keywordSeedOriginal.toLowerCase() !==
      String(base.keywordSeedAdapted).toLowerCase()
    ) {
      console.log(
        `   🌐 Semente adaptada: «${base.keywordSeedOriginal}» → «${base.keywordSeedAdapted}»`
      );
    }
  }

  const finalKw = [];
  if (base.keywordSeedAdapted) finalKw.push(base.keywordSeedAdapted);

  for (const kw of deepKeywords) {
    const pos = batch.indexOf(kw);
    const adaptedKw = pos >= 0 ? adapted[pos] : kw;
    if (
      adaptedKw &&
      !finalKw.some((x) => x.toLowerCase() === adaptedKw.toLowerCase())
    ) {
      finalKw.push(adaptedKw);
    }
  }

  // Máx 3 palavras por keyword — mais específicas = menos ruído na Ads Library
  const trimTo3Words = (kw) => kw.trim().split(/\s+/).slice(0, 3).join(' ');
  base.keywords = [...new Set(finalKw.map((k) => trimTo3Words(k)).filter(Boolean))].slice(0, 25);
  return base;
}

module.exports = {
  adaptKeywordsForMarket,
  finalizeMarketIntelKeywords,
  marketContext,
};
