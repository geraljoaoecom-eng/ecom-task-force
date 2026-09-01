import { getActiveAdsCount } from './index';
import { getActiveAdsCountWithApify, ApifyScraper } from './apify-scraper';
import { SourceType } from '../../types';

// Configuração do sistema híbrido
interface HybridConfig {
  useApifyFirst: boolean;
  fallbackToPuppeteer: boolean;
  apifyTimeout: number;
  puppeteerTimeout: number;
}

const DEFAULT_CONFIG: HybridConfig = {
  useApifyFirst: true,
  fallbackToPuppeteer: true,
  apifyTimeout: 120000, // 2 minutos
  puppeteerTimeout: 60000 // 1 minuto
};

// Resultado do scraping híbrido
interface HybridResult {
  activeAds: number;
  method: 'apify' | 'puppeteer' | 'fallback';
  success: boolean;
  error?: string;
  confidence: number;
  apifyResult?: any;
  puppeteerResult?: any;
}

class HybridScraper {
  private config: HybridConfig;
  private apifyScraper: ApifyScraper;

  constructor(config?: Partial<HybridConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.apifyScraper = new ApifyScraper();
  }

  /**
   * Executa scraping híbrido (Apify + Puppeteer como fallback)
   */
  async scrapeLibrary(type: SourceType, value: string): Promise<HybridResult> {
    console.log(`🔄 Iniciando scraping híbrido: ${type} - ${value}`);

    // Verificar se Apify está disponível
    const apifyAvailable = await this.apifyScraper.checkAvailability();
    
    if (apifyAvailable && this.config.useApifyFirst) {
      console.log('🤖 Tentando Apify primeiro...');
      
      try {
        const apifyResult = await this.scrapeWithApify(type, value);
        
        if (apifyResult.success && apifyResult.activeAds > 0) {
          console.log(`✅ Apify bem-sucedido: ${apifyResult.activeAds} anúncios`);
          return {
            activeAds: apifyResult.activeAds,
            method: 'apify',
            success: true,
            confidence: apifyResult.confidence,
            apifyResult
          };
        } else if (apifyResult.success && apifyResult.activeAds === 0) {
          console.log('✅ Apify retornou 0 anúncios (biblioteca inativa)');
          return {
            activeAds: 0,
            method: 'apify',
            success: true,
            confidence: apifyResult.confidence,
            apifyResult
          };
        } else {
          console.log('⚠️ Apify falhou, tentando Puppeteer...');
        }
      } catch (error: any) {
        console.error('❌ Erro no Apify:', error.message);
      }
    }

    // Fallback para Puppeteer
    if (this.config.fallbackToPuppeteer) {
      console.log('🕷️ Usando Puppeteer como fallback...');
      
      try {
        const puppeteerResult = await this.scrapeWithPuppeteer(type, value);
        
        return {
          activeAds: puppeteerResult,
          method: 'puppeteer',
          success: puppeteerResult >= 0,
          confidence: puppeteerResult > 0 ? 0.8 : 0.6,
          puppeteerResult
        };
      } catch (error: any) {
        console.error('❌ Erro no Puppeteer:', error.message);
        
        return {
          activeAds: 0,
          method: 'fallback',
          success: false,
          error: error.message,
          confidence: 0
        };
      }
    }

    // Se chegou aqui, ambos falharam
    return {
      activeAds: 0,
      method: 'fallback',
      success: false,
      error: 'Ambos os métodos falharam',
      confidence: 0
    };
  }

  /**
   * Executa scraping com Apify
   */
  private async scrapeWithApify(type: SourceType, value: string): Promise<any> {
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Timeout do Apify')), this.config.apifyTimeout);
    });

    const apifyPromise = this.apifyScraper.scrapeLibrary(type, value);

    return Promise.race([apifyPromise, timeoutPromise]);
  }

  /**
   * Executa scraping com Puppeteer
   */
  private async scrapeWithPuppeteer(type: SourceType, value: string): Promise<number> {
    const timeoutPromise = new Promise<number>((_, reject) => {
      setTimeout(() => reject(new Error('Timeout do Puppeteer')), this.config.puppeteerTimeout);
    });

    const puppeteerPromise = getActiveAdsCount(type, value);

    return Promise.race([puppeteerPromise, timeoutPromise]);
  }

  /**
   * Obtém estatísticas do sistema híbrido
   */
  async getStats(): Promise<any> {
    const apifyStats = await this.apifyScraper.getUsageStats();
    
    return {
      config: this.config,
      apify: apifyStats,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Testa ambos os métodos
   */
  async testBothMethods(type: SourceType, value: string): Promise<{
    apify: any;
    puppeteer: any;
    comparison: any;
  }> {
    console.log('🧪 Testando ambos os métodos...');

    const results = await Promise.allSettled([
      this.scrapeWithApify(type, value),
      this.scrapeWithPuppeteer(type, value)
    ]);

    const apifyResult = results[0].status === 'fulfilled' ? results[0].value : null;
    const puppeteerResult = results[1].status === 'fulfilled' ? results[1].value : null;

    const comparison = {
      apifySuccess: apifyResult?.success || false,
      puppeteerSuccess: typeof puppeteerResult === 'number' && puppeteerResult >= 0,
      apifyCount: apifyResult?.activeAds || 0,
      puppeteerCount: puppeteerResult || 0,
      difference: Math.abs((apifyResult?.activeAds || 0) - (puppeteerResult || 0)),
      apifyError: results[0].status === 'rejected' ? results[0].reason?.message : null,
      puppeteerError: results[1].status === 'rejected' ? results[1].reason?.message : null
    };

    return {
      apify: apifyResult,
      puppeteer: puppeteerResult,
      comparison
    };
  }
}

// Função principal para compatibilidade
export async function getActiveAdsCountHybrid(
  type: SourceType, 
  value: string, 
  config?: Partial<HybridConfig>
): Promise<number> {
  const scraper = new HybridScraper(config);
  const result = await scraper.scrapeLibrary(type, value);
  return result.activeAds;
}

// Exportar classes e tipos
export { HybridScraper, HybridResult, HybridConfig };
