const {
  ANALYSIS_MODEL,
  callGeminiVertex,
  isOpenRouterConfigured,
} = require('./spy-openrouter-shared');

function extractJsonObject(text) {
  let rawText = String(text || '').trim();
  rawText = rawText.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim();
  const match = rawText.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    return JSON.parse(match[0]);
  } catch {
    try {
      return JSON.parse(match[0].replace(/,\s*}/g, '}').replace(/,\s*]/g, ']'));
    } catch {
      return null;
    }
  }
}

function parseJsonScore(text) {
  const json = extractJsonObject(text);
  if (!json) return null;
  const scoreRaw = json.score;
  const score = typeof scoreRaw === 'number' ? scoreRaw : parseFloat(scoreRaw);
  if (Number.isNaN(score)) return null;
  const relevant = json.relevant !== false && json.relevant !== 'false' && score >= 0.35;
  return {
    score: Math.max(0, Math.min(1, score)),
    relevant,
    reason: String(json.reason || '').trim(),
  };
}

function buildAnalysisPrompt({ title, description, cta, text, searchCriteria }) {
  const c = searchCriteria || {};
  const intel = c.marketIntel || {};
  const list = (arr) => (Array.isArray(arr) && arr.length ? arr.join(', ') : 'n/a');

  const adText = [
    title ? `Título: ${title}` : '',
    description ? `Descrição: ${description}` : '',
    cta ? `CTA: ${cta}` : '',
    !title && !description && !cta && text ? `Texto: ${text}` : '',
  ].filter(Boolean).join('\n');

  return `És um analista de direct response marketing. Avalia se este anúncio Facebook Ads Library é relevante para a pesquisa SPY.

CRITÉRIOS DA PESQUISA:
- País: ${c.country || 'qualquer'}
- Idioma: ${c.language || 'qualquer'}
- Nicho: ${c.nicho || 'qualquer'}
- Tipo produto: ${c.produto || 'qualquer'}
- Keyword semente (mercado): ${c.keywordSeedAdapted || c.keywordSeed || 'qualquer'}

INTEL DE MERCADO (Deep Search — o que está em alta):
- Resumo: ${intel.resumoMercado || 'n/a'}
- Mecanismos hot: ${list(intel.mecanismos)}
- Dores hot: ${list(intel.dores)}
- Ângulos hot: ${list(intel.angulos)}
- Hooks hot: ${list(intel.hooks)}
- Sinais de relevância: ${intel.sinaisRelevancia || 'n/a'}

PONTUA MAIS ALTO se o anúncio usar mecanismos/dores/ângulos em alta listados acima.

COPY DO ANÚNCIO:
${adText || '(sem texto)'}

Responde APENAS JSON válido, sem markdown:
{"score":0.0,"relevant":true,"reason":"resumo curto em português"}`;
}

/**
 * Analisa um anúncio com base no copy (título, descrição, CTA).
 * Sem imagens, sem vídeo, sem áudio.
 */
async function analyzeAd({ title, description, cta, text, searchCriteria }) {
  const prompt = buildAnalysisPrompt({ title, description, cta, text, searchCriteria });
  const raw = await callGeminiVertex([{ role: 'user', content: prompt }], {
    model: ANALYSIS_MODEL, max_tokens: 200, temperature: 0.2, timeout: 30000,
  });
  const parsed = parseJsonScore(raw);

  if (!parsed) {
    throw new Error(`Resposta IA inválida: ${raw.slice(0, 120)}`);
  }

  return {
    ...parsed,
    analysisModel: ANALYSIS_MODEL,
  };
}

module.exports = {
  analyzeAd,
  isOpenRouterConfigured,
  parseJsonScore,
  ANALYSIS_MODEL,
};
