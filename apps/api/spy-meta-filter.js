/**
 * SPY Fase 2 — filtragem em batch via OpenRouter/Gemini.
 */
const {
  ANALYSIS_MODEL,
  callGeminiVertex,
  isOpenRouterConfigured,
  getMetaFilterBatchSize,
} = require('./spy-openrouter-shared');
const { scoreCriteriaMatch } = require('./spy-ad-analyzer');
const { classifyDrOffer, isEntertainmentOffer } = require('./spy-dr-guard');

function buildCriteriaRules(criteria = {}) {
  const rules = [];
  if (criteria.nicho) {
    rules.push(
      `- Nicho OBRIGATÓRIO: "${criteria.nicho}". REJEITA anúncios claramente de outro nicho (ex.: sexual, finanças, sorteios, telecom) mesmo que tenham CTA de DR.`
    );
  }
  if (criteria.produto) {
    rules.push(
      `- Tipo de produto OBRIGATÓRIO: "${criteria.produto}". REJEITA ofertas claramente de outro tipo (ex.: NUTRA vs curso INFO, APP vs nutra).`
    );
  }
  if (criteria.language) {
    rules.push(
      `- Idioma alvo: "${criteria.language}". Preferir copy nesse idioma; rejeitar se claramente noutra língua sem ligação à keyword.`
    );
  }
  return rules.length ? `\nREGRAS OBRIGATÓRIAS:\n${rules.join('\n')}\n` : '';
}

function extractJsonArray(text) {
  let raw = String(text || '').trim();
  raw = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim();
  const arrMatch = raw.match(/\[[\s\S]*\]/);
  if (arrMatch) {
    try {
      return JSON.parse(arrMatch[0]);
    } catch {
      // fallthrough
    }
  }
  const objMatch = raw.match(/\{[\s\S]*\}/);
  if (objMatch) {
    try {
      const obj = JSON.parse(objMatch[0]);
      if (Array.isArray(obj.results)) return obj.results;
      if (Array.isArray(obj.ads)) return obj.ads;
    } catch {
      return null;
    }
  }
  return null;
}

function buildFilterPrompt(batch, criteria, intelContext = '') {
  const lines = batch.map((ad, i) => {
    const parts = [
      `[${i}] id=${ad.adId}`,
      `page=${ad.pageName || ad.pageId || '?'}`,
      `headline=${String(ad.headline || '').slice(0, 150)}`,
      `body=${String(ad.body || ad.bodyText || ad.text || ad.adText || '').slice(0, 300)}`,
      `cta=${ad.ctaText || ad.cta || ''}`,
      `url=${ad.destinationUrl || ad.url || ad.linkUrl || ''}`,
      `status=${ad.adStatus || 'unknown'}`,
      `started=${ad.startDate || '?'}`,
    ];
    return parts.filter(p => !p.endsWith('=')).join(' | ');
  });

  return `És um filtro de direct response (DR) para pesquisa na Meta Ads Library.

CRITÉRIOS DA PESQUISA:
- Keyword / pesquisa: ${criteria.keyword || '(não definida)'}
- País: ${criteria.country || 'ALL'}
- Nicho: ${criteria.nicho || '(qualquer)'}
- Produto: ${criteria.produto || '(qualquer)'}
- Idioma: ${criteria.language || '(qualquer)'}

Para cada anúncio, classifica RELEVANTE ou IRRELEVANTE com base em TUDO o que vês (headline, body, CTA, URL).

RELEVANTE (direct response) = infoproduto, nutra, curso, desafio, método, app, ebook, lead gen, funil, promessa clara de resultado, CTA de compra/inscrição, afiliado/infoprodutor.

IRRELEVANTE = institucional/corporativo (banco, telecom, governo, ONG, branding sem oferta), entretenimento (filmes, séries, streaming, jogos, dublagem), sem CTA de resposta directa, unrelated ao nicho/keyword/produto.
${buildCriteriaRules(criteria)}${intelContext || ''}

Responde APENAS JSON válido (array):
[{"id":"<adId>","relevant":true|false,"score":0.0-1.0,"reason":"curto"}]

ANÚNCIOS:
${lines.join('\n')}`;
}

async function callOpenRouterBatch(prompt) {
  return callGeminiVertex([
    { role: 'system', content: 'Respondes só com JSON. Sem markdown.' },
    { role: 'user', content: prompt },
  ], { model: ANALYSIS_MODEL, temperature: 0.1, max_tokens: 4000, timeout: 120000 });
}

function heuristicFilter(ad, criteria) {
  const text = `${ad.headline || ''} ${ad.body || ad.bodyText || ''} ${ad.pageName || ''} ${ad.cta || ''} ${ad.destinationUrl || ''}`;
  const textLower = text.toLowerCase();
  const kw = String(criteria.keyword || '').toLowerCase();

  if (isEntertainmentOffer(text, ad.pageName)) {
    return { adId: ad.adId, relevant: false, score: 0.05, reason: 'entretenimento' };
  }

  const dr = classifyDrOffer(text, ad.destinationUrl || ad.landingUrl, {
    ...criteria,
    pageName: ad.pageName,
  });
  if (!dr.isDr) {
    return { adId: ad.adId, relevant: false, score: dr.score, reason: dr.reason };
  }

  // Excluir claramente institucionais
  const isInstitutional = /\b(banco|telecom|governo|ong|câmara|município|ministerio|segurança social|fnac|continente|worten|vodafone|meo|nos\b|nib|iban)\b/i.test(text);
  if (isInstitutional) return { adId: ad.adId, relevant: false, score: 0.1, reason: 'institucional' };

  const { nichoScore, produtoScore } = scoreCriteriaMatch(text, criteria);
  if (criteria.nicho && (nichoScore == null || nichoScore < 0.08)) {
    return { adId: ad.adId, relevant: false, score: 0.12, reason: `fora do nicho ${criteria.nicho}` };
  }
  if (criteria.produto && (produtoScore == null || produtoScore < 0.08)) {
    return { adId: ad.adId, relevant: false, score: 0.15, reason: `fora do produto ${criteria.produto}` };
  }

  let score = 0.55;
  if (kw && textLower.includes(kw)) score = 0.9;
  if (nichoScore != null) score = Math.max(score, 0.45 + nichoScore * 0.45);
  if (produtoScore != null) score = Math.max(score, 0.4 + produtoScore * 0.35);
  return {
    adId: ad.adId,
    relevant: score >= 0.5,
    score,
    reason: 'heurística',
  };
}

/**
 * Filtra metadados em batches.
 * @returns {Promise<{ relevant: object[], rejected: object[], decisions: object[] }>}
 */
async function filterMetadataBatch(allAds, criteria = {}, options = {}) {
  const batchSize = options.batchSize ?? getMetaFilterBatchSize();
  const useAi = options.useAi !== false && isOpenRouterConfigured();
  const intelContext = options.intelContext || '';
  const preClassified = options.preClassified || { relevant: [], rejected: [] };
  const decisions = [];
  const relevant = [...(preClassified.relevant || [])];
  const rejected = [...(preClassified.rejected || [])];

  for (const ad of preClassified.relevant || []) {
    if (ad.relevance) decisions.push({ ...ad.relevance, adId: ad.adId });
  }
  for (const ad of preClassified.rejected || []) {
    if (ad.relevance) decisions.push({ ...ad.relevance, adId: ad.adId });
  }

  if (preClassified.relevant?.length || preClassified.rejected?.length) {
    console.log(
      `   📚 SPY Meta Fase 2 cache: ${preClassified.relevant?.length || 0} ouro, ${preClassified.rejected?.length || 0} rejeitados (sem LLM)`
    );
  }

  if (!allAds.length) {
    console.log(`   ✅ SPY Meta Fase 2: ${relevant.length} relevantes / ${relevant.length + rejected.length} total`);
    return { relevant, rejected, decisions };
  }

  for (let offset = 0; offset < allAds.length; offset += batchSize) {
    const batch = allAds.slice(offset, offset + batchSize);
    console.log(
      `   🤖 SPY Meta Fase 2: batch ${Math.floor(offset / batchSize) + 1} (${batch.length} ads)`
    );

    if (!useAi) {
      for (const ad of batch) {
        const d = heuristicFilter(ad, criteria);
        decisions.push(d);
        if (d.relevant) relevant.push({ ...ad, relevance: d });
        else rejected.push({ ...ad, relevance: d });
      }
      continue;
    }

    try {
      const prompt = buildFilterPrompt(batch, criteria, intelContext);
      const content = await callOpenRouterBatch(prompt);
      const parsed = extractJsonArray(content);

      const byId = new Map();
      if (Array.isArray(parsed)) {
        for (const row of parsed) {
          const id = String(row.id || row.adId || '').replace(/\D/g, '');
          if (!id) continue;
          const score = typeof row.score === 'number' ? row.score : parseFloat(row.score) || 0;
          byId.set(id, {
            adId: id,
            relevant: row.relevant !== false && row.relevant !== 'false' && score >= 0.35,
            score: Math.max(0, Math.min(1, score)),
            reason: String(row.reason || '').slice(0, 200),
          });
        }
      }

      for (const ad of batch) {
        let d = byId.get(ad.adId) || heuristicFilter(ad, criteria);
        if (d.relevant && (criteria.nicho || criteria.produto)) {
          const guard = heuristicFilter(ad, criteria);
          if (!guard.relevant) d = { ...guard, reason: guard.reason || 'fora nicho/produto' };
        }
        decisions.push(d);
        if (d.relevant) relevant.push({ ...ad, relevance: d });
        else rejected.push({ ...ad, relevance: d });
      }
    } catch (err) {
      console.warn(`   ⚠️ SPY Meta Fase 2 batch falhou: ${err.message} — a passar tudo para Fase 3`);
      // Quando Gemini falha (429/timeout), não rejeitar — Fase 3 filtra por contagem de ads ativos
      for (const ad of batch) {
        const d = { adId: ad.adId, relevant: true, score: 0.5, reason: 'gemini-unavailable' };
        decisions.push(d);
        relevant.push({ ...ad, relevance: d });
      }
    }

    await new Promise((r) => setTimeout(r, 400 + Math.random() * 600));
  }

  const totalIn = allAds.length + (preClassified.relevant?.length || 0) + (preClassified.rejected?.length || 0);
  console.log(`   ✅ SPY Meta Fase 2: ${relevant.length} relevantes / ${totalIn} total`);

  return { relevant, rejected, decisions };
}

function parseCriteriaFromSearchUrl(searchUrl, session = {}) {
  let keyword = session.keywordSeed || session.keyword || '';
  let country = session.country || 'ALL';
  try {
    const u = new URL(searchUrl);
    keyword = u.searchParams.get('q') || keyword;
    country = u.searchParams.get('country') || country;
  } catch {
    // ignore
  }
  return {
    keyword,
    country,
    nicho: session.nicho || null,
    produto: session.produto || null,
    language: session.language || null,
  };
}

module.exports = {
  filterMetadataBatch,
  parseCriteriaFromSearchUrl,
  buildFilterPrompt,
};
