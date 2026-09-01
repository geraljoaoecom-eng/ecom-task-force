/**
 * Guardas DR — separar ofertas direct response de entretenimento/branding.
 */
const { scoreCriteriaMatch } = require('./spy-ad-analyzer');

const ENTERTAINMENT =
  /\b(netflix|prime video|disney\+?|hbo|streaming|serie[s]?|série[s]?|season|temporada|episodio|episódio|filme[s]?|cinema|trailer|dublagem|legendado|imdb|documentario|documentário|podcast de historias|história real|novela|telenovela|anime|manga|jogo mobile gratuito|gameplay|fortnite|roblox|minecraft)\b/i;

const ENTERTAINMENT_PAGE =
  /\b(theater|theatre|studio[s]?|pictures|films|series|streaming|entertainment|cinema|cine|televis[aã]o|tv channel|canal)\b/i;

const DR_SALE =
  /\b(compr[ae]|compre|adquir[ae]|garant[ae]|desconto|oferta|promo[cç][aã]o|checkout|carrinho|frete|entrega|ebook|e-book|curso|m[eé]todo|metodo|protocolo|f[oó]rmula|suplemento|capsula|c[aá]psula|nutra|desafio|programa|treinamento|masterclass|webinar|inscri[cç][aã]o|inscreva|cadastre|baixe o app|download|app store|play store|funil|vsl|quiz|lead|nutra|dropship|afiliad|infoprodut|resultado[s]?|transforme|elimine|perca|emagrec|ere[cç][aã]o|pot[eê]ncia|pr[oó]stata|testosteron|saude|saúde|masculin|impot|disfunc|libido|vigor|performance|natural|remedio|remédio|tratamento|solucao|solução|guia|manual|plan|plano|desafio|dieta|fitness|wellness|betterme|men\s|homem|homens)\b/i;

const DR_CTA =
  /\b(saiba mais|learn more|shop now|comprar agora|buy now|get started|comece agora|clique aqui|link na bio|whatsapp|fale conosco|agende|reserve|teste gr[aá]tis|experimente|participe)\b/i;

const WEAK_GENERIC =
  /\b(description|send message|watch more|see more|play game|install now)\b/i;

function normalize(text) {
  return String(text || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function isEntertainmentOffer(text, pageName = '') {
  const blob = normalize(`${text} ${pageName}`);
  if (ENTERTAINMENT.test(blob)) return true;
  if (ENTERTAINMENT_PAGE.test(normalize(pageName)) && !DR_SALE.test(blob)) return true;
  return false;
}

/**
 * @returns {{ isDr: boolean, score: number, reason: string }}
 */
function classifyDrOffer(text, landingUrl = '', criteria = {}) {
  const blob = `${text || ''} ${landingUrl || ''}`;
  const n = normalize(blob);
  const pageName = criteria.pageName || '';

  if (isEntertainmentOffer(blob, pageName)) {
    return { isDr: false, score: 0.05, reason: 'entretenimento/streaming' };
  }

  if (WEAK_GENERIC.test(n) && !DR_SALE.test(n)) {
    return { isDr: false, score: 0.1, reason: 'cta_generico' };
  }

  let score = 0.2;
  if (DR_SALE.test(n)) score += 0.45;
  if (DR_CTA.test(n)) score += 0.15;

  const { nichoScore, produtoScore } = scoreCriteriaMatch(blob, criteria);
  if (nichoScore != null) score += nichoScore * 0.25;
  if (produtoScore != null) score += produtoScore * 0.2;

  const kw = normalize(criteria.keyword || '');
  if (kw && kw.length >= 4 && n.includes(kw)) score += 0.2;

  const strongNicho = (nichoScore != null && nichoScore >= 0.12) || (produtoScore != null && produtoScore >= 0.12);
  const threshold = strongNicho ? 0.38 : 0.45;
  const isDr =
    score >= threshold &&
    (DR_SALE.test(n) ||
      (DR_CTA.test(n) && score >= 0.48) ||
      (strongNicho && score >= 0.42));

  return {
    isDr,
    score: Math.min(1, score),
    reason: isDr ? 'direct_response' : 'dr_fraco',
  };
}

/** Frases aprendíveis — só padrões DR ou overlap com keywords da sessão. */
function extractDrLearnablePhrases(text, sessionKeywords = [], limit = 4) {
  const { extractKeywordsFromAdText, cleanAdText } = require('./spy-ad-analyzer');
  if (isEntertainmentOffer(text)) return [];

  const cleaned = cleanAdText(text);
  if (!cleaned) return [];

  const seedTokens = new Set();
  for (const kw of sessionKeywords) {
    for (const w of normalize(kw).split(/\s+/)) {
      if (w.length >= 4) seedTokens.add(w);
    }
  }

  const candidates = extractKeywordsFromAdText(text, 12);
  const out = [];

  for (const phrase of candidates) {
    const pn = normalize(phrase);
    if (isEntertainmentOffer(phrase)) continue;
    if (WEAK_GENERIC.test(pn)) continue;

    const hasDrPattern = DR_SALE.test(pn) || /truque|segredo|metodo|metodo|protocolo|formula|desafio|suplemento|curso|ebook/.test(pn);
    const overlapsSeed = [...seedTokens].some((t) => pn.includes(t));
    if (!hasDrPattern && !overlapsSeed) continue;

    out.push(phrase);
    if (out.length >= limit) break;
  }
  return out;
}

const MANUAL_SOURCES = new Set(['deep', 'manual', 'seed', 'niche_intel', 'cta']);

function isManualKeywordSource(source) {
  return MANUAL_SOURCES.has(String(source || '').toLowerCase());
}

module.exports = {
  classifyDrOffer,
  isEntertainmentOffer,
  extractDrLearnablePhrases,
  isManualKeywordSource,
};
