// Configuração do Apify
export const APIFY_CONFIG = {
  API_TOKEN: process.env.APIFY_API_TOKEN || '',
  ACTOR_ID: 'apify/facebook-ads-scraper',
  BASE_URL: 'https://api.apify.com/v2',
  
  // Actors alternativos para Facebook Ads Library
  ACTORS: {
    MAIN: 'apify/facebook-ads-scraper',
    ALTERNATIVE: 'apify/facebook-ads-library-scraper',
    SPECIFIC: 'apify/facebook-ads-library-search'
  },
  
  // Configurações de timeout
  TIMEOUTS: {
    START_RUN: 30000,
    WAIT_RESULTS: 300000,
    CHECK_STATUS: 10000
  },
  
  // Configurações de retry
  RETRY: {
    MAX_ATTEMPTS: 3,
    DELAY_MS: 5000
  }
};

// Configuração do sistema híbrido
export const HYBRID_CONFIG = {
  USE_APIFY_FIRST: true,
  FALLBACK_TO_PUPPETEER: true,
  APIFY_TIMEOUT: 120000, // 2 minutos
  PUPPETEER_TIMEOUT: 60000, // 1 minuto
  
  // Configurações de confiança
  CONFIDENCE: {
    APIFY_SUCCESS: 0.9,
    APIFY_ZERO: 0.8,
    PUPPETEER_SUCCESS: 0.8,
    PUPPETEER_ZERO: 0.6,
    FALLBACK: 0.0
  }
};
