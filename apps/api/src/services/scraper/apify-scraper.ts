import axios from 'axios';
import { SourceType } from '../../types';
import { buildSearchUrl } from './facebook';

// Configuração do Apify
interface ApifyConfig {
  apiToken: string;
  actorId: string;
  baseUrl: string;
}

// Resultado do scraping via Apify
interface ApifyResult {
  activeAds: number;
  totalAds: number;
  success: boolean;
  error?: string;
  data: any[];
  runId?: string;
  confidence: number;
}

// Configuração padrão do Apify
const DEFAULT_APIFY_CONFIG: ApifyConfig = {
  apiToken: process.env.APIFY_API_TOKEN || '',
  actorId: process.env.APIFY_ACTOR_ID || 'apify/facebook-ads-scraper',
  baseUrl: 'https://api.apify.com/v2'
};

// Actor IDs específicos para Facebook Ads Library
const FACEBOOK_ACTORS = {
  // Actor principal do Apify para Facebook Ads Library
  MAIN: 'apify/facebook-ads-scraper',
  // Actor alternativo se o principal não funcionar
  ALTERNATIVE: 'apify/facebook-ads-library-scraper',
  // Actor para scraping mais específico
  SPECIFIC: 'apify/facebook-ads-library-search'
};

class ApifyScraper {
  private config: ApifyConfig;

  constructor(config?: Partial<ApifyConfig>) {
    this.config = { ...DEFAULT_APIFY_CONFIG, ...config };
  }

  /**
   * Executa o scraping via Apify
   */
  async scrapeLibrary(type: SourceType, value: string): Promise<ApifyResult> {
    try {
      console.log(`🤖 Iniciando scraping via Apify: ${type} - ${value}`);
      
      // Construir URL de busca
      const searchUrl = buildSearchUrl(type, value);
      
      // Garantir que active_status=active está na URL
      const url = this.ensureActiveStatus(searchUrl);
      
      console.log(`🔗 URL para scraping: ${url}`);
      
      // Executar o actor do Apify
      const runId = await this.startApifyRun(url);
      
      if (!runId) {
        throw new Error('Falha ao iniciar execução no Apify');
      }
      
      console.log(`🚀 Execução iniciada no Apify - Run ID: ${runId}`);
      
      // Aguardar conclusão e obter resultados
      const results = await this.waitForResults(runId);
      
      // Processar resultados
      const processedResults = this.processResults(results);
      
      console.log(`✅ Scraping via Apify concluído: ${processedResults.activeAds} anúncios ativos`);
      
      return processedResults;
      
    } catch (error: any) {
      console.error('❌ Erro no scraping via Apify:', error.message);
      return {
        activeAds: 0,
        totalAds: 0,
        success: false,
        error: error.message,
        data: [],
        confidence: 0
      };
    }
  }

  /**
   * Garante que active_status=active está na URL
   */
  private ensureActiveStatus(url: string): string {
    try {
      const hasQuery = url.includes('?');
      if (url.includes('active_status=')) {
        return url.replace(/active_status=[^&]*/i, 'active_status=active');
      } else {
        return url + (hasQuery ? '&' : '?') + 'active_status=active';
      }
    } catch {
      return url;
    }
  }

  /**
   * Inicia uma execução no Apify
   */
  private async startApifyRun(url: string): Promise<string | null> {
    try {
      // Tentar com o actor principal primeiro
      let runId = await this.tryStartRun(FACEBOOK_ACTORS.MAIN, url);
      
      if (!runId) {
        console.log('⚠️ Actor principal falhou, tentando alternativo...');
        runId = await this.tryStartRun(FACEBOOK_ACTORS.ALTERNATIVE, url);
      }
      
      if (!runId) {
        console.log('⚠️ Actor alternativo falhou, tentando específico...');
        runId = await this.tryStartRun(FACEBOOK_ACTORS.SPECIFIC, url);
      }
      
      return runId;
    } catch (error) {
      console.error('❌ Erro ao iniciar execução no Apify:', error);
      return null;
    }
  }

  /**
   * Tenta iniciar execução com um actor específico
   */
  private async tryStartRun(actorId: string, url: string): Promise<string | null> {
    try {
      const response = await axios.post(
        `${this.config.baseUrl}/acts/${actorId}/runs`,
        {
          input: {
            startUrls: [url],
            maxResults: 1000,
            includeActiveOnly: true,
            searchType: 'advertiser',
            adStatus: 'active',
            country: 'ALL',
            language: 'en'
          }
        },
        {
          headers: {
            'Authorization': `Bearer ${this.config.apiToken}`,
            'Content-Type': 'application/json'
          },
          timeout: 30000
        }
      );

      if (response.data && response.data.data && response.data.data.id) {
        return response.data.data.id;
      }
      
      return null;
    } catch (error: any) {
      console.error(`❌ Erro ao iniciar execução com actor ${actorId}:`, error.message);
      return null;
    }
  }

  /**
   * Aguarda a conclusão da execução e obtém os resultados
   */
  private async waitForResults(runId: string): Promise<any[]> {
    const maxWaitTime = 300000; // 5 minutos
    const checkInterval = 5000; // 5 segundos
    let waited = 0;

    while (waited < maxWaitTime) {
      try {
        // Verificar status da execução
        const statusResponse = await axios.get(
          `${this.config.baseUrl}/actor-runs/${runId}`,
          {
            headers: {
              'Authorization': `Bearer ${this.config.apiToken}`
            },
            timeout: 10000
          }
        );

        const status = statusResponse.data.data.status;
        console.log(`🔄 Status da execução: ${status}`);

        if (status === 'SUCCEEDED') {
          // Obter resultados
          const resultsResponse = await axios.get(
            `${this.config.baseUrl}/actor-runs/${runId}/dataset/items`,
            {
              headers: {
                'Authorization': `Bearer ${this.config.apiToken}`
              },
              timeout: 30000
            }
          );

          return resultsResponse.data || [];
        } else if (status === 'FAILED' || status === 'ABORTED') {
          throw new Error(`Execução falhou com status: ${status}`);
        }

        // Aguardar antes da próxima verificação
        await new Promise(resolve => setTimeout(resolve, checkInterval));
        waited += checkInterval;

      } catch (error: any) {
        console.error('❌ Erro ao verificar status da execução:', error.message);
        await new Promise(resolve => setTimeout(resolve, checkInterval));
        waited += checkInterval;
      }
    }

    throw new Error('Timeout aguardando resultados do Apify');
  }

  /**
   * Processa os resultados do Apify
   */
  private processResults(results: any[]): ApifyResult {
    if (!Array.isArray(results) || results.length === 0) {
      return {
        activeAds: 0,
        totalAds: 0,
        success: true,
        data: [],
        confidence: 0.8 // Alta confiança em "nenhum resultado"
      };
    }

    // Filtrar apenas anúncios ativos
    const activeAds = results.filter(ad => {
      const status = ad.status || ad.adStatus || ad.activeStatus || '';
      return status.toLowerCase().includes('active') || status.toLowerCase().includes('ativo');
    });

    // Calcular confiança baseada na qualidade dos dados
    let confidence = 0.7; // Base
    if (results.length > 0) confidence += 0.1;
    if (activeAds.length > 0) confidence += 0.1;
    if (results.length > 10) confidence += 0.1; // Mais dados = mais confiança

    return {
      activeAds: activeAds.length,
      totalAds: results.length,
      success: true,
      data: results,
      confidence: Math.min(confidence, 1.0)
    };
  }

  /**
   * Verifica se o Apify está disponível
   */
  async checkAvailability(): Promise<boolean> {
    try {
      const response = await axios.get(
        `${this.config.baseUrl}/users/me`,
        {
          headers: {
            'Authorization': `Bearer ${this.config.apiToken}`
          },
          timeout: 10000
        }
      );

      return response.status === 200;
    } catch (error) {
      console.error('❌ Apify não disponível:', error);
      return false;
    }
  }

  /**
   * Obtém estatísticas de uso do Apify
   */
  async getUsageStats(): Promise<any> {
    try {
      const response = await axios.get(
        `${this.config.baseUrl}/users/me`,
        {
          headers: {
            'Authorization': `Bearer ${this.config.apiToken}`
          },
          timeout: 10000
        }
      );

      return {
        available: true,
        user: response.data.data,
        usage: response.data.data.usage || {}
      };
    } catch (error: any) {
      return {
        available: false,
        error: error.message
      };
    }
  }
}

// Função principal para compatibilidade com o sistema atual
export async function getActiveAdsCountWithApify(
  type: SourceType, 
  value: string, 
  apiToken?: string
): Promise<number> {
  const scraper = new ApifyScraper(apiToken ? { apiToken } : undefined);
  
  // Verificar se o Apify está disponível
  const isAvailable = await scraper.checkAvailability();
  if (!isAvailable) {
    console.log('⚠️ Apify não disponível, retornando 0');
    return 0;
  }

  const result = await scraper.scrapeLibrary(type, value);
  return result.activeAds;
}

// Exportar a classe para uso avançado
export { ApifyScraper, ApifyResult, ApifyConfig };
