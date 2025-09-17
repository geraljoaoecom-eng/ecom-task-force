// Seletores para extrair informações da Ads Library do Facebook
export const selectors = {
  // bolha "X anúncios ativos" - múltiplos seletores para diferentes layouts
  badge: [
    'div[role="main"] span:has(span)',
    'div[role="main"] [dir="auto"]',
    '[data-testid="search-results"] span',
    'div[role="main"] div[dir="auto"] span',
    'div[role="main"] div span',
    'div[aria-label*="anúncios"]',
    'div[aria-label*="ads"]',
    'span[dir="auto"]'
  ],
};

// Regex para capturar números como "430 anúncios ativos" - múltiplas variações
export const activeAdsRegex = /(\d[\d.,]*)\s+anúncios?\s+ativos?/i;
export const englishRegex = /(\d[\d.,]*)\s+ads?\s+active/i;

// Regex adicionais para diferentes formatos
export const alternativeRegexes = [
  /(\d[\d.,]*)\s+anúncios?\s+ativos?/i,
  /(\d[\d.,]*)\s+ads?\s+active/i,
  /(\d[\d.,]*)\s+anúncios?/i,
  /(\d[\d.,]*)\s+ads?/i,
  /(\d[\d.,]*)\s+resultados?/i,
  /(\d[\d.,]*)\s+results?/i,
  /(\d[\d.,]*)\s+itens?/i,
  /(\d[\d.,]*)\s+items?/i,
  /(\d[\d.,]*)\s+encontrados?/i,
  /(\d[\d.,]*)\s+found/i,
  /(\d[\d.,]*)\s+total/i,
  /(\d[\d.,]*)\s+ads?\s+found/i,
  /(\d[\d.,]*)\s+anúncios?\s+encontrados?/i
];
