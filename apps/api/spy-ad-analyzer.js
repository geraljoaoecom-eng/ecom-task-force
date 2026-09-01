const { analyzeAd, isOpenRouterConfigured } = require('./spy-openrouter');

const NICHO_KEYWORDS = {
  EMAGRECIMENTO: ['emagrec', 'weight loss', 'afvallen', 'diet', 'dieet', 'slim', 'barriga', 'fat burn', 'abnehmen', 'gelatina', 'jejum', 'metabolismo', 'gordura', 'detox', 'truque'],
  DIABETES: ['diabetes', 'glicose', 'blood sugar', 'insulina'],
  SEXUAL: ['libido', 'erec', 'sexual', 'potencia'],
  RELIGIOSO: ['oracao', 'oração', 'deus', 'biblia', 'prosperidade', 'padre'],
  RELACIONAMENTO: ['relacion', 'namoro', 'ex', 'casamento'],
  EDUCACIONAL: ['curso', 'treinamento', 'aprenda', 'método'],
  TINNITUS: ['tinnitus', 'zumbido'],
  'MEMÓRIA': ['memoria', 'memória', 'alzheimer'],
  VISÃO: ['visao', 'visão', 'olho'],
};

const PRODUTO_KEYWORDS = {
  INFO: ['curso', 'método', 'desafio', 'programa', 'treino'],
  NUTRA: ['suplement', 'capsula', 'nutra', 'fórmula natural'],
  APP: ['app', 'aplicativo', 'download'],
  SORTEIOS: ['rifa', 'sorteio'],
};

const STOP_WORDS = new Set([
  'para', 'com', 'uma', 'the', 'and', 'you', 'your', 'this', 'that', 'https', 'www', 'facebook',
  'more', 'learn', 'shop', 'now', 'click', 'here', 'com', 'html', 'started', 'running', 'platforms',
  'transparency', 'details', 'active', 'open', 'drop', 'down', 'library', 'patrocinado', 'sponsored',
  'send', 'message', 'play', 'google', 'store', 'apps', 'details', 'video', 'watch', 'compartilhar',
]);

const META_LINE = /^(library id|started running|platforms|eu transparency|open drop|see ad details|active|learn more|shop now|send message|this ad has|\d{10,}|:\s*\d{10,})/i;

const DR_PHRASE_PATTERNS = [
  /truque da? \w+/gi,
  /truque do? \w+/gi,
  /segredo da? \w+/gi,
  /receita (?:para|de|com) [\w\s]{3,30}/gi,
  /gelatina [\w\s]{3,25}/gi,
  /jejum [\w\s]{3,25}/gi,
  /desafio de \d+ [\w\s]{3,20}/gi,
  /metodo [\w\s]{3,25}/gi,
  /método [\w\s]{3,25}/gi,
  /perder [\w\s]{3,20}/gi,
  /queimar [\w\s]{3,20}/gi,
  /barriga [\w\s]{3,20}/gi,
  /gordura [\w\s]{3,20}/gi,
  /detox [\w\s]{3,20}/gi,
  /low carb/gi,
  /cetogenica/gi,
  /cetogênica/gi,
];

function normalize(text) {
  return String(text || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function scoreByKeywords(text, keywords) {
  const n = normalize(text);
  let hits = 0;
  for (const kw of keywords) {
    if (n.includes(normalize(kw))) hits++;
  }
  return keywords.length ? hits / keywords.length : 0;
}

function cleanAdText(text) {
  return String(text || '')
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line && !META_LINE.test(line) && !/^\d{12,}$/.test(line))
    .join('\n')
    .replace(/Library ID[:\s]*\d+/gi, '')
    .replace(/Started running on[^\n]*/gi, '')
    .trim();
}

function isValidKeyword(kw) {
  if (!kw || kw.length < 4 || kw.length > 60) return false;
  if (/^\d+$/.test(kw)) return false;
  if (/^\d{8,}/.test(kw)) return false;
  const words = kw.split(/\s+/);
  if (words.every((w) => STOP_WORDS.has(w) || w.length < 3)) return false;
  if (words.length === 1 && words[0].length < 5) return false;
  return true;
}

/**
 * Extrai keywords/frases das descrições dos anúncios (ex: "truque da gelatina").
 */
function extractKeywordsFromAdText(text, limit = 8) {
  const cleaned = cleanAdText(text);
  if (!cleaned || cleaned.length < 8) return [];

  const phrases = new Map();
  const add = (phrase, weight = 1) => {
    const p = normalize(phrase).replace(/\s+/g, ' ').trim();
    if (!isValidKeyword(p)) return;
    phrases.set(p, (phrases.get(p) || 0) + weight);
  };

  for (const re of DR_PHRASE_PATTERNS) {
    const matches = cleaned.match(re) || [];
    for (const m of matches) add(m, 3);
  }

  const words = normalize(cleaned)
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 3 && !STOP_WORDS.has(w) && !/^\d+$/.test(w));

  for (let i = 0; i < words.length - 1; i++) {
    add(`${words[i]} ${words[i + 1]}`, 1);
    if (i < words.length - 2) add(`${words[i]} ${words[i + 1]} ${words[i + 2]}`, 2);
  }

  for (const w of words) {
    if (w.length >= 6) add(w, 0.5);
  }

  return [...phrases.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([phrase]) => phrase);
}

function extractTermsFromText(text, limit = 12) {
  return extractKeywordsFromAdText(text, limit);
}

function generateSeedKeywords(session) {
  const seeds = new Set();
  if (session.keywordSeed) seeds.add(session.keywordSeed.trim().toLowerCase());
  if (session.nicho) {
    const nichoKey = session.nicho.toUpperCase();
    for (const kw of NICHO_KEYWORDS[nichoKey] || [session.nicho]) {
      seeds.add(kw.toLowerCase());
    }
  }
  if (session.produto) {
    const prodKey = session.produto.toUpperCase();
    for (const kw of PRODUTO_KEYWORDS[prodKey] || [session.produto]) {
      seeds.add(kw.toLowerCase());
    }
  }
  if (!seeds.size && session.country) {
    seeds.add('buy now');
    seeds.add('learn more');
  }
  if (!seeds.size) seeds.add('shop now');
  return [...seeds];
}

/**
 * Fase SPY: só texto + imagem. Sem Whisper/vídeo (custo).
 */
async function analyzeAdRelevance(ad, session) {
  const searchCriteria = {
    country: session.country,
    language: session.language,
    nicho: session.nicho,
    produto: session.produto,
    keywordSeed: session.keywordSeed,
    keywordSeedAdapted:
      session.stats?.marketIntel?.keywordSeedAdapted || session.keywordSeedAdapted || null,
    marketIntel: session.stats?.marketIntel || session.marketIntel || null,
  };

  const adText = cleanAdText(ad.adText);

  if (isOpenRouterConfigured() && (adText || ad.imageUrl)) {
    try {
      const ai = await analyzeAd({
        text: adText,
        imageUrl: ad.imageUrl || null,
        searchCriteria,
        skipVideo: true,
      });
      return {
        relevant: ai.relevant,
        score: ai.score,
        reason: ai.reason || 'análise OpenRouter (texto + imagem)',
      };
    } catch (err) {
      console.log('⚠️ SPY OpenRouter:', err.message);
    }
  }

  return analyzeAdHeuristic({ ...ad, adText }, session);
}

async function analyzeAdHeuristic(ad, session) {
  const blob = [ad.adText, ad.landingUrl, ad.imageUrl].filter(Boolean).join('\n');
  let score = 0;
  const reasons = [];

  if (session.nicho) {
    const nichoKey = session.nicho.toUpperCase();
    const kws = NICHO_KEYWORDS[nichoKey] || [session.nicho];
    const s = scoreByKeywords(blob, kws);
    score += s * 0.45;
    if (s > 0.2) reasons.push(`match nicho (${session.nicho})`);
  }

  if (session.produto) {
    const prodKey = session.produto.toUpperCase();
    const kws = PRODUTO_KEYWORDS[prodKey] || [session.produto];
    const s = scoreByKeywords(blob, kws);
    score += s * 0.25;
    if (s > 0.2) reasons.push(`match produto (${session.produto})`);
  }

  const seedForMatch =
    session.keywordSeedAdapted ||
    session.stats?.marketIntel?.keywordSeedAdapted ||
    session.keywordSeed ||
    '';
  if (seedForMatch) {
    const s = normalize(blob).includes(normalize(seedForMatch)) ? 0.3 : 0;
    score += s;
    if (s) reasons.push('match keyword semente');
  }

  if (session.language) {
    const lang = session.language.toLowerCase();
    const langHints = {
      pt: ['você', 'voce', 'compre', 'saiba', 'grátis', 'desafio'],
      en: ['buy now', 'learn more', 'free', 'shop now'],
      es: ['compra', 'gratis', 'descubre'],
      nl: ['kopen', 'gratis', 'ontdek', 'afvallen'],
    };
    const hints = langHints[lang] || langHints[lang.slice(0, 2)] || [];
    const s = scoreByKeywords(blob, hints);
    score += s * 0.15;
    if (s > 0.15) reasons.push(`match idioma (${session.language})`);
  }

  if (ad.imageUrl) {
    score += 0.05;
    reasons.push('criativo visual detectado');
  }

  const relevant = score >= 0.28;
  return {
    relevant,
    score: Math.min(1, score),
    reason: reasons.join('; ') || (relevant ? 'relevância heurística' : 'baixa relevância'),
  };
}

function scoreCriteriaMatch(text, criteria = {}) {
  const blob = normalize(text);
  let nichoScore = null;
  let produtoScore = null;
  if (criteria.nicho) {
    const kws = NICHO_KEYWORDS[String(criteria.nicho).toUpperCase()] || [criteria.nicho];
    nichoScore = scoreByKeywords(blob, kws);
  }
  if (criteria.produto) {
    const kws = PRODUTO_KEYWORDS[String(criteria.produto).toUpperCase()] || [criteria.produto];
    produtoScore = scoreByKeywords(blob, kws);
  }
  return { nichoScore, produtoScore };
}

module.exports = {
  generateSeedKeywords,
  extractTermsFromText,
  extractKeywordsFromAdText,
  cleanAdText,
  analyzeAdRelevance,
  NICHO_KEYWORDS,
  PRODUTO_KEYWORDS,
  scoreByKeywords,
  scoreCriteriaMatch,
};
