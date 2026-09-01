// Seletores inteligentes e adaptativos para a Ads Library do Facebook
export const selectors = {
  // Seletores para elementos que contêm números de resultados
  resultCount: [
    // NOVO: Seletores específicos para o formato atual do Facebook
    'div[aria-level="3"][role="heading"]',  // ~50 resultados
    'div[class*="x8t9es0"][class*="x1uxerd5"]', // Classe específica encontrada
    'div[class*="xrohxju"][class*="x108nfp6"]',
    'div[class*="xq9mrsl"][class*="x1h4wwuj"]',
    'div[class*="x117nqv4"][class*="xeuugli"]',
    
    // Seletores baseados em roles e aria-labels
    'div[role="heading"]',
    'div[aria-level="3"]',
    'div[aria-label*="resultados"]',
    'div[aria-label*="results"]',
    'div[aria-label*="anúncios"]',
    'div[aria-label*="ads"]',
    'div[aria-label*="resultados"]',
    'div[aria-label*="resultats"]',
    'div[aria-label*="risultati"]',
    'div[aria-label*="resultados"]',
    
    // Seletores baseados em classes CSS (podem mudar)
    'div[class*="x8t9es0"]', // Classe específica encontrada
    'div[class*="x1uxerd5"]',
    'div[class*="xrohxju"]',
    'div[class*="x108nfp6"]',
    'div[class*="xq9mrsl"]',
    'div[class*="x1h4wwuj"]',
    'div[class*="x117nqv4"]',
    'div[class*="xeuugli"]',
    
    // Seletores genéricos que devem funcionar
    'div[role="main"] span:has(span)',
    'div[role="main"] [dir="auto"]',
    '[data-testid="search-results"] span',
    'div[role="main"] div[dir="auto"] span',
    'div[role="main"] div span',
    'span[dir="auto"]'
  ],
  
  // Seletores para status de atividade
  statusIndicator: [
    'div[class*="x8t9es0"][class*="x1fvot60"]',
    'div[class*="xo1l8bm"]',
    'div[class*="xxio538"]',
    'div[class*="xuxw1ft"]',
    'div[class*="x6ikm8r"]',
    'div[class*="x10wlt62"]',
    'div[class*="xlyipyv"]',
    'div[class*="x1diwwjn"]',
    'div:has(strong:contains("Estado online"))',
    'div:has(strong:contains("Anúncios ativos"))',
    'div:has(strong:contains("Active ads"))'
  ]
};

// Regex para capturar números como "430 resultados" - múltiplas variações
export const activeAdsRegex = /(\d[\d.,]*)\s+resultados?/i;
export const englishRegex = /(\d[\d.,]*)\s+results?/i;

// Regex adaptativos que funcionam com diferentes formatos e idiomas
export const alternativeRegexes = [
  // MAIOR PRIORIDADE: Padrões de resultados em múltiplos idiomas (formato principal do Facebook)
  /(\d[\d.,]*)\s+resultados?/i,                     // 82 resultados (PT/ES)
  /(\d[\d.,]*)\s+results?/i,                        // 82 results (EN)
  /(\d[\d.,]*)\s+resultats?/i,                      // 82 resultats (FR)
  /(\d[\d.,]*)\s+risultati?/i,                      // 82 risultati (IT)
  /(\d[\d.,]*)\s+ergebnisse?/i,                     // 82 ergebnisse (DE)
  /(\d[\d.,]*)\s+resultados?/i,                     // 82 resultados (PT)
  /(\d[\d.,]*)\s+resultados?/i,                     // 82 resultados (ES)
  /(\d[\d.,]*)\s+resultados?/i,                     // 82 resultados (BR)
  /(\d[\d.,]*)\s+resultados?/i,                     // 82 resultados (MX)
  /(\d[\d.,]*)\s+resultados?/i,                     // 82 resultados (AR)
  
  // Padrões com tilde (~) - formato específico do Facebook
  /~(\d[\d.,]*)\s+resultados?/i,                    // ~50 resultados (PT/ES)
  /~(\d[\d.,]*)\s+results?/i,                       // ~50 results (EN)
  /~(\d[\d.,]*)\s+resultats?/i,                     // ~50 resultats (FR)
  /~(\d[\d.,]*)\s+risultati?/i,                     // ~50 risultati (IT)
  /~(\d[\d.,]*)\s+ergebnisse?/i,                    // ~50 ergebnisse (DE)
  
  // Padrões com tilde opcional
  /~?(\d[\d.,]*)\s+resultados?/i,                   // ~82 resultados (PT/ES)
  /~?(\d[\d.,]*)\s+results?/i,                      // ~82 results (EN)
  /~?(\d[\d.,]*)\s+resultats?/i,                    // ~82 resultats (FR)
  /~?(\d[\d.,]*)\s+risultati?/i,                    // ~82 risultati (IT)
  /~?(\d[\d.,]*)\s+ergebnisse?/i,                   // ~82 ergebnisse (DE)
  
  // Padrões de anúncios ativos em múltiplos idiomas (menor prioridade)
  /(\d[\d.,]*)\s+anúncios?\s+ativos?/i,            // 82 anúncios ativos (PT)
  /(\d[\d.,]*)\s+ads?\s+active/i,                  // 82 ads active (EN)
  /(\d[\d.,]*)\s+anuncios?\s+activos?/i,           // 82 anuncios activos (ES)
  /(\d[\d.,]*)\s+annonces?\s+actives?/i,           // 82 annonces actives (FR)
  /(\d[\d.,]*)\s+annunci?\s+attivi?/i,             // 82 annunci attivi (IT)
  /(\d[\d.,]*)\s+anzeigen?\s+aktiv?/i,             // 82 anzeigen aktiv (DE)
  
  // Padrões de anúncios em múltiplos idiomas
  /(\d[\d.,]*)\s+anúncios?/i,                       // 82 anúncios (PT)
  /(\d[\d.,]*)\s+anuncios?/i,                       // 82 anuncios (ES)
  /(\d[\d.,]*)\s+ads?/i,                            // 82 ads (EN)
  /(\d[\d.,]*)\s+annonces?/i,                       // 82 annonces (FR)
  /(\d[\d.,]*)\s+annunci?/i,                        // 82 annunci (IT)
  /(\d[\d.,]*)\s+anzeigen?/i,                       // 82 anzeigen (DE)
  
  // Padrões de itens/encontrados em múltiplos idiomas
  /(\d[\d.,]*)\s+itens?/i,                          // 82 itens (PT)
  /(\d[\d.,]*)\s+items?/i,                          // 82 items (EN)
  /(\d[\d.,]*)\s+artículos?/i,                      // 82 artículos (ES)
  /(\d[\d.,]*)\s+éléments?/i,                       // 82 éléments (FR)
  /(\d[\d.,]*)\s+elementi?/i,                       // 82 elementi (IT)
  /(\d[\d.,]*)\s+elemente?/i,                       // 82 elemente (DE)
  
  // Padrões de encontrados/found em múltiplos idiomas
  /(\d[\d.,]*)\s+encontrados?/i,                    // 82 encontrados (PT)
  /(\d[\d.,]*)\s+found/i,                           // 82 found (EN)
  /(\d[\d.,]*)\s+encontrados?/i,                    // 82 encontrados (ES)
  /(\d[\d.,]*)\s+trouvés?/i,                        // 82 trouvés (FR)
  /(\d[\d.,]*)\s+trovati?/i,                        // 82 trovati (IT)
  /(\d[\d.,]*)\s+gefunden/i,                        // 82 gefunden (DE)
  
  // Padrões de total em múltiplos idiomas
  /(\d[\d.,]*)\s+total/i,                           // 82 total (PT/EN/ES)
  /(\d[\d.,]*)\s+totale?/i,                         // 82 totale (IT)
  /(\d[\d.,]*)\s+gesamt/i,                          // 82 gesamt (DE)
  
  // Padrões de disponibilidade em múltiplos idiomas
  /(\d[\d.,]*)\s+anúncios?\s+disponíveis?/i,       // 82 anúncios disponíveis (PT)
  /(\d[\d.,]*)\s+ads?\s+available/i,               // 82 ads available (EN)
  /(\d[\d.,]*)\s+anuncios?\s+disponibles?/i,       // 82 anuncios disponibles (ES)
  /(\d[\d.,]*)\s+annonces?\s+disponibles?/i,       // 82 annonces disponibles (FR)
  /(\d[\d.,]*)\s+annunci?\s+disponibili?/i,        // 82 annunci disponibili (IT)
  /(\d[\d.,]*)\s+anzeigen?\s+verfügbar/i,          // 82 anzeigen verfügbar (DE)
  
  // Padrões genéricos (menor prioridade)
  /(\d[\d.,]*)\s+active\s+ads?/i,                  // 82 active ads (EN)
  /(\d[\d.,]*)\s+anúncios?\s+activos?/i,           // 82 anúncios activos (PT)
  /(\d[\d.,]*)\s+ads?\s+activos?/i                 // 82 ads activos (ES)
];

// Regex para detectar status de atividade em múltiplos idiomas
export const statusRegexes = [
  // Padrões específicos "Estado online: Anúncios ativos"
  /estado\s+online:\s*anúncios?\s+ativos?/i,           // Estado online: Anúncios ativos (PT)
  /estado\s+online:\s*anuncios?\s+activos?/i,          // Estado online: Anuncios activos (ES)
  /online\s+status:\s*active\s+ads?/i,                 // Online status: Active ads (EN)
  /statut\s+en\s+ligne:\s*annonces?\s+actives?/i,      // Statut en ligne: Annonces actives (FR)
  /stato\s+online:\s*annunci?\s+attivi?/i,             // Stato online: Annunci attivi (IT)
  /online\s+status:\s*anzeigen?\s+aktiv/i,             // Online status: Anzeigen aktiv (DE)
  
  // Padrões mais genéricos
  /estado\s+online/i,                                   // Estado online (PT)
  /online\s+status/i,                                   // Online status (EN)
  /statut\s+en\s+ligne/i,                               // Statut en ligne (FR)
  /stato\s+online/i,                                    // Stato online (IT)
  /online\s+status/i,                                   // Online status (DE)
  
  // Padrões de anúncios ativos
  /anúncios?\s+ativos?/i,                               // Anúncios ativos (PT)
  /anuncios?\s+activos?/i,                              // Anuncios activos (ES)
  /active\s+ads?/i,                                     // Active ads (EN)
  /ads?\s+active/i,                                     // Ads active (EN)
  /annonces?\s+actives?/i,                              // Annonces actives (FR)
  /annunci?\s+attivi?/i,                                // Annunci attivi (IT)
  /anzeigen?\s+aktiv/i,                                 // Anzeigen aktiv (DE)
  
  // Padrões genéricos de status
  /online/i,                                            // Online (universal)
  /ativo/i,                                             // Ativo (PT)
  /active/i,                                            // Active (EN/FR)
  /activo/i,                                            // Activo (ES)
  /attivo/i,                                            // Attivo (IT)
  /aktiv/i                                              // Aktiv (DE)
];
