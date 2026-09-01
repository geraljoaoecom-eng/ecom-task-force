// Configuração do Sistema Inteligente - Versão Corrigida
export const INTELLIGENT_SCRAPER_CONFIG = {
  // Configurações de detecção
  detection: {
    minConfidence: 0.5,        // Confiança mínima para aceitar resultado
    maxPatterns: 10,           // Máximo de padrões a retornar
    learningThreshold: 0.7,    // Threshold para aprender novos padrões
    maxDynamicPatterns: 50,    // Máximo de padrões dinâmicos a manter
  },
  
  // Configurações de scraping
  scraping: {
    maxRetries: 4,             // Máximo de tentativas
    retryDelay: 2000,          // Delay entre tentativas (ms)
    pageTimeout: 30000,        // Timeout da página (ms)
    waitAfterLoad: 2000,       // Aguardar após carregar (ms)
  },
  
  // Idiomas suportados
  languages: {
    'pt': {
      name: 'Português',
      patterns: ['resultados', 'anúncios', 'ativos', 'disponíveis', 'encontrados', 'itens'],
      confidence: 0.9
    },
    'en': {
      name: 'English',
      patterns: ['results', 'ads', 'active', 'available', 'found', 'items'],
      confidence: 0.9
    },
    'es': {
      name: 'Español',
      patterns: ['resultados', 'anuncios', 'activos', 'disponibles', 'encontrados', 'articulos'],
      confidence: 0.9
    },
    'fr': {
      name: 'Français',
      patterns: ['resultats', 'annonces', 'actives', 'disponibles', 'trouvés', 'éléments'],
      confidence: 0.9
    },
    'it': {
      name: 'Italiano',
      patterns: ['risultati', 'annunci', 'attivi', 'disponibili', 'trovati', 'elementi'],
      confidence: 0.9
    },
    'de': {
      name: 'Deutsch',
      patterns: ['ergebnisse', 'anzeigen', 'aktiv', 'verfügbar', 'gefunden', 'elemente'],
      confidence: 0.9
    }
  } as const,
  
  // Palavras-chave para detecção
  keywords: {
    results: [
      'resultados', 'results', 'resultats', 'risultati', 'ergebnisse',
      'resultado', 'result', 'resultat', 'risultato', 'ergebnis'
    ],
    ads: [
      'anúncios', 'ads', 'annonces', 'annunci', 'anzeigen',
      'anúncio', 'ad', 'annonce', 'annuncio', 'anzeige'
    ],
    active: [
      'ativos', 'active', 'actives', 'attivi', 'aktiv',
      'ativo', 'activo', 'attivo'
    ],
    available: [
      'disponíveis', 'available', 'disponibles', 'disponibili', 'verfügbar',
      'disponivel', 'disponible', 'disponibile'
    ]
  },
  
  // Configurações de aprendizado
  learning: {
    enabled: true,              // Habilitar aprendizado automático
    maxAge: 30,                // Idade máxima dos padrões (dias)
    minOccurrences: 3,         // Mínimo de ocorrências para aprender
    confidenceDecay: 0.1,      // Decaimento de confiança por dia
  },
  
  // Configurações de debug
  debug: {
    enabled: process.env.NODE_ENV === 'development',
    logPatterns: true,         // Log dos padrões encontrados
    logLearning: true,         // Log do aprendizado
    logConfidence: true,       // Log dos níveis de confiança
  }
};

// Função para obter configuração por idioma
export function getLanguageConfig(language: string) {
  const languages = INTELLIGENT_SCRAPER_CONFIG.languages;
  return languages[language as keyof typeof languages] || languages['en'];
}

// Função para verificar se uma palavra é relevante
export function isRelevantKeyword(word: string, category: 'results' | 'ads' | 'active' | 'available'): boolean {
  const keywords = INTELLIGENT_SCRAPER_CONFIG.keywords[category];
  return keywords.some(keyword => 
    word.toLowerCase().includes(keyword.toLowerCase()) ||
    keyword.toLowerCase().includes(word.toLowerCase())
  );
}

// Função para obter configuração de scraping
export function getScrapingConfig() {
  return INTELLIGENT_SCRAPER_CONFIG.scraping;
}

// Função para obter configuração de detecção
export function getDetectionConfig() {
  return INTELLIGENT_SCRAPER_CONFIG.detection;
}
