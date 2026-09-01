/**
 * Language Sweep — mapa idioma → países (country codes Meta) ordenados por
 * interesse para Direct Response. Usado quando a pesquisa SPY define IDIOMA mas
 * NÃO país: o motor varre os mercados dessa língua, do mais ao menos interessante.
 *
 * Ordem = prioridade DR (volume de infoproduto/nutra/DR escalado no Facebook).
 * Idiomas sem mapa explícito → ['ALL'] (pesquisa global).
 */

// Chaves em minúsculas e sem acentos para casar com qualquer label de idioma.
const LANGUAGE_MARKETS = {
  'portugues':   ['BR', 'PT'],
  'ingles':      ['US', 'GB', 'CA', 'AU', 'NZ', 'IE', 'ZA'],
  'espanhol':    ['MX', 'ES', 'CO', 'AR', 'CL', 'PE', 'EC'],
  'frances':     ['FR', 'CA', 'BE', 'CH'],
  'alemao':      ['DE', 'AT', 'CH'],
  'italiano':    ['IT', 'CH'],
  'holandes':    ['NL', 'BE'],
  'polaco':      ['PL'],
  'romeno':      ['RO'],
  'russo':       ['RU', 'UA'],
  'arabe':       ['SA', 'AE', 'EG', 'MA'],
  'turco':       ['TR'],
  'japones':     ['JP'],
  'coreano':     ['KR'],
  'vietnamita':  ['VN'],
  'tailandes':   ['TH'],
  'indonesio':   ['ID'],
  'hindi':       ['IN'],
  'hebraico':    ['IL'],
  'sueco':       ['SE'],
  'nogues':      ['NO'],
  'noruegues':   ['NO'],
  'dinamarques': ['DK'],
  'finlandes':   ['FI'],
  'grego':       ['GR'],
  'checo':       ['CZ'],
  'hungaro':     ['HU'],
  'ucraniano':   ['UA'],
  'chines':      ['HK', 'TW'],
};

function normKey(s) {
  return String(s || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();
}

function getSweepMax() {
  const n = parseInt(process.env.SPY_SWEEP_MAX_COUNTRIES || '8', 10);
  return Number.isFinite(n) && n >= 1 ? n : 8;
}

/**
 * Lista de country codes para uma língua, por ordem de interesse DR.
 * @returns {string[]} ['ALL'] se a língua não tiver mapa.
 */
function countriesForLanguage(language) {
  const key = normKey(language);
  if (!key || key === 'todos os idiomas') return ['ALL'];
  const list = LANGUAGE_MARKETS[key];
  if (!list || !list.length) return ['ALL'];
  return list.slice(0, getSweepMax());
}

/**
 * Resolve os países alvo de uma sessão SPY:
 *  - país definido           → [countryCode]
 *  - senão idioma definido    → países da língua por ordem de interesse (Language Sweep)
 *  - senão                    → ['ALL'] (global)
 * @param {{country?: string, language?: string}} session
 * @returns {string[]}
 */
function resolveTargetCountries(session = {}) {
  const { countryCodeFromInput } = require('./meta-ads-library-options');
  const rawCountry = String(session.country || '').trim();
  if (rawCountry) {
    // Suporta multi-país separado por vírgula (ex: "US,BR,MX")
    const parts = rawCountry.split(',').map((s) => s.trim()).filter(Boolean);
    const codes = parts.map((p) => countryCodeFromInput(p)).filter(Boolean);
    // Se só ALL explícito, pesquisa global
    if (codes.length === 1 && codes[0] === 'ALL') return ['ALL'];
    // Remove ALL de listas mistas; mantém países específicos
    const specific = codes.filter((c) => c !== 'ALL');
    if (specific.length) return specific;
    return ['ALL'];
  }
  const rawLanguage = String(session.language || '').trim();
  if (rawLanguage) {
    return countriesForLanguage(rawLanguage);
  }
  return ['ALL'];
}

module.exports = {
  LANGUAGE_MARKETS,
  countriesForLanguage,
  resolveTargetCountries,
  getSweepMax,
};
