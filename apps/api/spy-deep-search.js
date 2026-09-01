const { isOpenRouterConfigured, callSpyAi, ANALYSIS_MODEL } = require('./spy-openrouter-shared');

const { countryLabelFromCode } = require('./meta-ads-library-options');

const { finalizeMarketIntelKeywords, marketContext } = require('./spy-keyword-adapt');

const DEEP_SEARCH_MODEL =
  process.env.SPY_DEEP_SEARCH_MODEL || process.env.SPY_ANALYSIS_MODEL || ANALYSIS_MODEL;



function parseMarketIntel(text) {
  let rawText = String(text || '').trim();
  const codeBlock = rawText.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (codeBlock) rawText = codeBlock[1];
  else rawText = rawText.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
  const match = rawText.match(/\{[\s\S]*\}/);

  if (!match) return null;

  try {

    const raw = JSON.parse(match[0]);

    const pick = (v) =>

      Array.isArray(v)
        ? v
            .map((x) => String(x).trim())
            .filter(Boolean)
            .slice(0, parseInt(process.env.SPY_MAX_KEYWORDS || '50', 10) || 50)
        : [];



    const keywords = pick(raw.keywords || raw.palavrasChave || raw.palavras_chave || raw.searchKeywords);

    const mecanismos = pick(raw.mecanismos);

    const dores = pick(raw.dores);

    const angulos = pick(raw.angulos || raw.ângulos);

    const hooks = pick(raw.hooks || raw.ganchos);



    if (!keywords.length && !mecanismos.length && !dores.length && !angulos.length) return null;



    const derivedKeywords =

      keywords.length > 0

        ? keywords

        : [...mecanismos.slice(0, 8), ...dores.slice(0, 8), ...hooks.slice(0, 5)].filter(Boolean);



    return {

      mecanismos,

      dores,

      angulos,

      hooks,

      keywords: [...new Set(derivedKeywords.map((k) => k.trim()))].slice(
        0,
        parseInt(process.env.SPY_MAX_KEYWORDS || '50', 10) || 50
      ),

      keywordSeedAdapted: String(raw.keywordSeedAdapted || raw.sementeAdaptada || '').trim() || null,

      keywordSeedOriginal: String(raw.keywordSeedOriginal || raw.sementeOriginal || '').trim() || null,

      localeNotes: String(raw.localeNotes || raw.notasLocale || '').trim() || null,

      sinaisRelevancia: String(raw.sinaisRelevancia || raw.sinais_relevancia || '').trim(),

      resumoMercado: String(raw.resumoMercado || raw.resumo_mercado || '').trim(),

      generatedAt: new Date().toISOString(),

    };

  } catch {

    return null;

  }

}



function buildDeepSearchPrompt(session, existingKeywords = []) {

  const { pais, idioma, nicho, produto } = marketContext(session);

  const known = existingKeywords.length

    ? `\nKEYWORDS JÁ CONHECIDAS neste nicho (re-escreve/adapta para ESTE mercado se estiverem noutro idioma — não copies literalmente):\n${existingKeywords.slice(0, 30).join(', ')}\n`

    : '';



  const seedBlock = session.keywordSeed

    ? `\nKEYWORD SEMENTE (utilizador escreveu): «${session.keywordSeed}»

→ Deves adaptar/traduzir para o idioma e variante de ${pais} (${idioma}) ANTES de pesquisar.

→ NÃO incluas a semente crua se estiver no idioma/variante errados.

→ Coloca a versão adaptada em "keywordSeedAdapted" e também como PRIMEIRA entrada em "keywords".\n`

    : '';



  return `És um estratega de direct response marketing especializado em Facebook Ads Library.



Faz DEEP SEARCH de inteligência de mercado ANTES de scrapear anúncios.



CONTEXTO DA PESQUISA SPY:

- País/mercado: ${pais}

- Idioma dos anúncios na Ads Library: ${idioma}

- Nicho: ${nicho || 'não especificado'}

- Tipo de produto: ${produto || 'todos (INFO, NUTRA, APP, etc.)'}

${seedBlock}${known}



REGRA CRÍTICA — IDIOMA E VARIANTE:

Todas as keywords em "keywords" devem ser o que anunciantes DESTE mercado pesquisam/escalam na Ads Library.

- Brasil → português do Brasil (PT-BR), não PT-PT europeu.

- Portugal → português de Portugal.

- EUA, Reino Unido, África do Sul, etc. com idioma Inglês → inglês natural do mercado (não português/espanhol).

- México/Colômbia com Espanhol → espanhol latino adequado ao país.

Se a semente ou ideias estiverem noutro idioma, TRADUZ e ADAPTA (ex: "disfunção erétil" + África do Sul/Inglês → "erectile dysfunction").



Com base no que está EM ALTA neste mercado/nicho agora:



1. MECANISMOS — fórmulas, ingredientes, métodos que dominam NESTE mercado

2. DORES — problemas emocionais/físicos nos ads locais

3. ÂNGULOS — posicionamentos de copy locais

4. HOOKS — ganchos típicos no idioma do mercado

5. KEYWORDS — 15-25 palavras-chave para pesquisar na Facebook Ads Library (idioma/variante correctos). Frases completas que afiliados usam.

6. SINAIS DE RELEVÂNCIA — o que um anúncio DEVE ter para ser "hot"



Responde APENAS JSON válido (valores descritivos podem estar em português europeu; keywords na língua do MERCADO):

{

  "mecanismos": ["...", "..."],

  "dores": ["...", "..."],

  "angulos": ["...", "..."],

  "hooks": ["...", "..."],

  "keywords": ["...", "..."],

  "keywordSeedAdapted": "versão adaptada da semente ou null",

  "keywordSeedOriginal": "semente original ou null",

  "localeNotes": "1 frase: que adaptação de idioma/variante fizeste",

  "sinaisRelevancia": "texto curto",

  "resumoMercado": "1-2 frases sobre o que está em alta"

}`;

}



function generateKeywordsFromBrief(brief, session = {}) {
  const text = String(brief || '').trim();
  if (!text) return [];

  const t = text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  const cc = String(session.country || '').toUpperCase();
  const isBR = cc === 'BR' || /\bbrasil\b|\bbrazil\b/.test(t);
  const isPT = cc === 'PT' || /\bportugal\b/.test(t);
  const lowTicket = /low ticket|ticket baixo|entrada|barato|preco baixo|r\$|\breais\b|por apenas|so r\$|só r\$/.test(t);
  const infoProd = /infoprod|info prod|curso|ebook|e book|digital|metodo|treinamento|aula|masterclass|desafio|programa|protocolo|plano|guia|manual|checklist|template|pack|mini curso/.test(t);
  const allNiches = /todos os nichos|qualquer nicho|todos nichos|varios nichos|multi nicho|sem nicho/.test(t);

  const out = [];
  const add = (...kws) => {
    for (const k of kws) {
      const p = String(k || '').trim();
      if (!p) continue;
      if (!out.some((x) => x.toLowerCase() === p.toLowerCase())) out.push(p);
    }
  };

  if (isBR && (lowTicket || infoProd)) {
    add(
      'curso por r$10',
      'ebook r$19',
      'por apenas r$27',
      'mini curso digital',
      'desafio 7 dias r$',
      'metodo low ticket',
      'infoproduto barato',
      'oferta r$9',
      'acesso imediato r$',
      'vsl quiz r$',
      'funil low ticket',
      'programa digital r$',
      'treinamento r$47',
      'guia pratico r$',
      'pack digital r$',
      'formula r$37',
      'lancamento low ticket',
      'maquina de vendas r$',
      'recuperacao r$',
      'promocao curso r$'
    );
  }

  if (isPT && (lowTicket || infoProd)) {
    add(
      'curso por 10 euros',
      'ebook 19 euros',
      'metodo low ticket',
      'programa digital barato',
      'desafio 7 dias',
      'infoproduto promocao',
      'guia pratico pdf',
      'acesso imediato curso'
    );
  }

  if (isBR && allNiches) {
    add(
      'emagrecimento r$27',
      'renda extra r$19',
      'relacionamento ebook r$',
      'memoria curso r$',
      'pele rotina r$',
      'financas pessoais r$',
      'marketing digital r$',
      'idiomas curso r$'
    );
  }

  const stop = new Set([
    'queremos', 'encontrar', 'produtos', 'vendidos', 'todos', 'nichos', 'info',
    'brasil', 'portugal', 'no', 'na', 'em', 'de', 'do', 'da', 'dos', 'das',
    'e', 'ou', 'para', 'com', 'low', 'ticket', 'the', 'and',
  ]);
  const words = t.split(/\s+/).filter((w) => w.length >= 3 && !stop.has(w));
  for (let i = 0; i < words.length - 1 && out.length < 22; i++) {
    add(`${words[i]} ${words[i + 1]}`);
  }

  return out.slice(0, 20);
}

function fallbackMarketIntel(session, brief = '') {
  const { generateSeedKeywords } = require('./spy-ad-analyzer');
  const briefText = brief || session.brief || session.consultantBrief || '';
  const fromBrief = generateKeywordsFromBrief(briefText, session);
  const fromSeeds = generateSeedKeywords(session);
  const generic = new Set(['shop now', 'buy now', 'learn more']);
  let keywords = [...fromBrief, ...fromSeeds.filter((k) => !generic.has(String(k).toLowerCase()))];
  if (!keywords.length) keywords = fromSeeds;

  return {
    mecanismos: [],
    dores: [],
    angulos: [],
    hooks: [],
    keywords,
    sinaisRelevancia: `Anúncios de direct response no nicho ${session.nicho || 'geral'} para ${session.country || 'ALL'}`,
    resumoMercado: fromBrief.length
      ? 'GPT indisponível — keywords heurísticas geradas a partir do brief.'
      : 'Deep search indisponível — keywords heurísticas usadas.',
    raciocinio: fromBrief.length
      ? `Serviço IA indisponível. Extraí ${fromBrief.length} keywords do teu brief (low ticket / infoproduto / mercado ${session.country || 'ALL'}). Revê e edita antes de pesquisar.`
      : 'Serviço IA temporariamente inacessível — keywords heurísticas genéricas.',
    generatedAt: new Date().toISOString(),
    fallback: true,
    source: 'fallback',
  };
}



async function runDeepSearch(session, existingKeywords = []) {

  if (!isOpenRouterConfigured()) {

    console.log('⚠️ SPY Deep Search: OpenRouter não configurado, fallback heurístico');

    const fb = fallbackMarketIntel(session);

    return finalizeMarketIntelKeywords(session, fb);

  }



  const prompt = buildDeepSearchPrompt(session, existingKeywords);

  console.log(`🧠 SPY Deep Search: a consultar ${DEEP_SEARCH_MODEL}…`);
  const t0 = Date.now();

  let raw;
  try {
    raw = await callSpyAi([{ role: 'user', content: prompt }], {
      model: DEEP_SEARCH_MODEL,
      max_tokens: parseInt(process.env.SPY_DEEP_SEARCH_MAX_TOKENS || '8000', 10) || 8000,
      temperature: 0.35,
      timeout: 60000,
    });
  } catch (fetchErr) {
    console.log(`⚠️ SPY Deep Search: erro (${fetchErr.message?.slice(0,80)}), fallback`);
    return null;
  }

  if (!raw) {

    console.log('⚠️ SPY Deep Search: resposta vazia');

    return finalizeMarketIntelKeywords(session, fallbackMarketIntel(session));

  }

  let intel = parseMarketIntel(raw);



  if (!intel) {

    console.log('⚠️ SPY Deep Search: resposta inválida, preview:', raw.slice(0, 200));

    intel = fallbackMarketIntel(session);

  } else {

    console.log(
      `🧠 SPY Deep Search OK (${((Date.now() - t0) / 1000).toFixed(1)}s): ${intel.keywords.length} keywords, ${intel.mecanismos.length} mecanismos`
    );

  }



  return finalizeMarketIntelKeywords(session, intel);

}



function normalizeKeywordEntries(raw) {
  const list = Array.isArray(raw) ? raw : [];
  const phrases = [];
  const details = [];
  for (const item of list) {
    if (typeof item === 'string') {
      const phrase = item.trim();
      if (phrase) phrases.push(phrase);
      continue;
    }
    if (item && typeof item === 'object') {
      const phrase = String(item.phrase || item.keyword || item.frase || '').trim();
      if (!phrase) continue;
      phrases.push(phrase);
      details.push({
        phrase,
        motivo: String(item.motivo || item.reason || '').trim() || null,
        tipoFunil: String(item.tipoFunil || item.funnel || item.tipo || '').trim() || null,
      });
    }
  }
  return { phrases, details };
}

function parseConsultantIntel(text) {
  let rawText = String(text || '').trim();
  // Extrai bloco ```json ... ``` mesmo que esteja no meio do texto (modelo chatty)
  const codeBlock = rawText.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (codeBlock) rawText = codeBlock[1];
  else rawText = rawText.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
  const match = rawText.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    const raw = JSON.parse(match[0]);
    const { phrases, details } = normalizeKeywordEntries(
      raw.keywords || raw.palavrasChave || raw.palavras_chave
    );
    const maxKw = parseInt(process.env.SPY_MAX_KEYWORDS || '50', 10) || 50;
    const keywords = [...new Set(phrases.map((k) => k.trim()).filter(Boolean))].slice(0, maxKw);
    if (!keywords.length) return null;

    const pick = (v) =>
      Array.isArray(v)
        ? v
            .map((x) => String(x).trim())
            .filter(Boolean)
            .slice(0, 20)
        : [];

    return {
      mecanismos: pick(raw.mecanismos),
      dores: pick(raw.dores),
      angulos: pick(raw.angulos || raw.ângulos),
      hooks: pick(raw.hooks || raw.ganchos),
      keywords,
      keywordDetails: details.length ? details : keywords.map((phrase) => ({ phrase, motivo: null, tipoFunil: null })),
      raciocinio: String(raw.raciocinio || raw.reasoning || raw.analise || '').trim() || null,
      keywordSeedAdapted: String(raw.keywordSeedAdapted || raw.sementeAdaptada || '').trim() || null,
      keywordSeedOriginal: String(raw.keywordSeedOriginal || raw.sementeOriginal || '').trim() || null,
      localeNotes: String(raw.localeNotes || raw.notasLocale || '').trim() || null,
      sinaisRelevancia: String(raw.sinaisRelevancia || raw.sinais_relevancia || '').trim(),
      resumoMercado: String(raw.resumoMercado || raw.resumo_mercado || '').trim(),
      generatedAt: new Date().toISOString(),
      source: 'consultant',
    };
  } catch {
    return null;
  }
}

function buildConsultantPrompt(session, brief, options = {}) {
  const { pais, idioma, nicho, produto } = marketContext(session);
  const userBrief = String(brief || '').trim();
  const seedBlock = session.keywordSeed
    ? `\nKEYWORD SEMENTE (se relevante, adapta ao mercado): «${session.keywordSeed}»\n`
    : '';

  const refineBlock =
    options.feedback && options.previousIntel
      ? `\nPLANO ANTERIOR (refina com base no feedback do utilizador):\n${JSON.stringify(
          {
            keywords: options.previousIntel.keywords,
            resumoMercado: options.previousIntel.resumoMercado,
            raciocinio: options.previousIntel.raciocinio,
          },
          null,
          2
        )}\n\nFEEDBACK DO UTILIZADOR:\n«${String(options.feedback).trim()}»\n\nGera um plano NOVO completo (não repitas o anterior sem mudanças).\n`
      : '';

  const briefBlock = userBrief
    ? `\nBRIEF DO UTILIZADOR (lê como pedido no ChatGPT — é a tua prioridade):\n«${userBrief}»\n`
    : '\nO utilizador não deu brief longo — infere o melhor plano só com país/nicho/produto.\n';

  return `INSTRUÇÃO CRÍTICA: Responde EXCLUSIVAMENTE com JSON válido. ZERO texto antes ou depois do JSON. Não uses markdown, não escrevas "Olá", não faças introduções.

És um consultor sénior de Facebook Ads Library e direct response marketing.

CONTEXTO SPY:
- País/mercado: ${pais}
- Idioma dos anúncios na Ads Library: ${idioma}
- Nicho: ${nicho || 'não especificado'}
- Tipo de produto: ${produto || 'todos (INFO, NUTRA, APP, etc.)'}
${seedBlock}${briefBlock}${refineBlock}

REGRAS CRÍTICAS:
1. Keywords = frases que ANUNCIANTES DR usam na Ads Library deste mercado (2-6 palavras). Idioma/variante correctos (BR=PT-BR, PT=PT-PT, EN mercados=inglês local).
2. EVITA termos-cabeça sozinhos ("emagrecer", "dieta", "perder peso") — só se forem complemento; prioriza mecanismos, dores, hooks, funis (VSL, quiz, desafio 21 dias, chá seca barriga, etc.).
3. Ordena keywords da MAIS ESPECÍFICA para a mais ampla (as primeiras da lista devem ser as melhores para encontrar DR escalado rápido).
4. "raciocinio" = 2-4 parágrafos em português europeu, estilo consultor: o que está em alta, que funis/CTAs ver, o que evitar (institucional/marca).
5. Para cada keyword inclui "motivo" curto e "tipoFunil" quando aplicável (VSL, quiz, advertorial, webinar, venda directa, desafio, etc.).

Responde APENAS JSON válido:
{
  "raciocinio": "texto consultor 2-4 parágrafos",
  "resumoMercado": "1-2 frases",
  "mecanismos": ["...", "..."],
  "dores": ["...", "..."],
  "angulos": ["...", "..."],
  "hooks": ["...", "..."],
  "keywords": [
    {"phrase": "frase para Ads Library", "motivo": "porque vale scrapear", "tipoFunil": "VSL|quiz|..."}
  ],
  "keywordSeedAdapted": "versão adaptada da semente ou null",
  "keywordSeedOriginal": "semente original ou null",
  "localeNotes": "1 frase sobre idioma/variante",
  "sinaisRelevancia": "o que distingue DR hot vs institucional neste nicho"
}`;
}

async function callConsultantModel(session, brief, options = {}) {
  if (!isOpenRouterConfigured()) {
    const fb = fallbackMarketIntel(session);
    fb.raciocinio =
      'OpenRouter não configurado — keywords heurísticas. Configura a API para o modo consultor GPT.';
    fb.source = 'fallback';
    return finalizeMarketIntelKeywords(session, fb);
  }

  const prompt = buildConsultantPrompt(session, brief, options);
  console.log(`🧠 SPY Consultor GPT: ${DEEP_SEARCH_MODEL}…`);
  const t0 = Date.now();

  let raw;
  try {
    raw = await callSpyAi([{ role: 'user', content: prompt }], {
      model: DEEP_SEARCH_MODEL,
      max_tokens: parseInt(process.env.SPY_DEEP_SEARCH_MAX_TOKENS || '8000', 10) || 8000,
      temperature: 0.4,
      timeout: 90000,
    });
  } catch (fetchErr) {
    console.log(`⚠️ SPY Consultor: erro (${fetchErr.message?.slice(0,80)}), fallback`);
    const fb = fallbackMarketIntel(session, brief);
    return finalizeMarketIntelKeywords(session, fb);
  }
  if (!raw) throw new Error('Consultor GPT: resposta vazia');

  let intel = parseConsultantIntel(raw);
  if (!intel) {
    intel = parseMarketIntel(raw);
    if (intel) intel.source = 'consultant';
  }
  if (!intel) {
    console.log('⚠️ SPY Consultor: JSON inválido, RAW COMPLETO:', raw);
    const fb = fallbackMarketIntel(session);
    fb.raciocinio = 'Resposta inválida do modelo — fallback heurístico.';
    fb.source = 'fallback';
    return finalizeMarketIntelKeywords(session, fb);
  }

  console.log(
    `🧠 SPY Consultor OK (${((Date.now() - t0) / 1000).toFixed(1)}s): ${intel.keywords.length} keywords`
  );
  return finalizeMarketIntelKeywords(session, intel);
}

async function runConsultantPreview(params) {
  const session = {
    country: params.country,
    language: params.language,
    nicho: params.nicho,
    produto: params.produto,
    keywordSeed: params.keywordSeed,
    brief: params.brief,
    consultantBrief: params.brief,
  };
  return callConsultantModel(session, params.brief, {
    previousIntel: params.previousIntel,
    feedback: params.feedback,
  });
}

module.exports = {
  runDeepSearch,
  runConsultantPreview,
  parseMarketIntel,
  parseConsultantIntel,
  generateKeywordsFromBrief,
  fallbackMarketIntel,
  buildDeepSearchPrompt,
  buildConsultantPrompt,
};


