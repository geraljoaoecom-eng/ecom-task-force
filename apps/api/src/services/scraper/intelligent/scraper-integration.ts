// Integração do Sistema Inteligente no Scraper Principal
import { intelligentScrape, IntelligentPatternDetector } from './intelligent-scraper';

// Função principal de scraping com inteligência adaptativa
export async function adaptiveScrape(page: any, url: string, maxRetries: number = 4): Promise<{
  activeAds: number;
  confidence: number;
  patterns: any[];
  learningStats: any;
  success: boolean;
  error?: string;
}> {
  console.log(`🕷️ Scraping inteligente iniciado para: ${url}`);
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`🕷️ Tentativa ${attempt}/${maxRetries} - Scraping inteligente`);
      
      const result = await intelligentScrape(page, url);
      
      if (result.activeAds > 0 && result.confidence > 0.5) {
        console.log(`✅ Scraping inteligente bem-sucedido: ${result.activeAds} anúncios (confiança: ${result.confidence})`);
        return {
          ...result,
          success: true
        };
      } else if (result.activeAds > 0) {
        console.log(`⚠️ Scraping inteligente com baixa confiança: ${result.activeAds} anúncios (confiança: ${result.confidence})`);
        return {
          ...result,
          success: true
        };
      } else {
        console.log(`⚠️ Nenhum anúncio encontrado na tentativa ${attempt}`);
        
        if (attempt < maxRetries) {
          // Aguarda antes da próxima tentativa
          await page.waitForTimeout(2000 + (attempt * 1000));
        }
      }
      
    } catch (error: any) {
      console.error(`❌ Erro na tentativa ${attempt}:`, error.message);
      
      if (attempt < maxRetries) {
        console.log(`🔄 Tentando novamente em ${attempt * 2} segundos...`);
        await page.waitForTimeout(attempt * 2000);
      } else {
        return {
          activeAds: 0,
          confidence: 0,
          patterns: [],
          learningStats: {},
          success: false,
          error: error.message
        };
      }
    }
  }
  
  console.log(`❌ Todas as tentativas falharam para: ${url}`);
  return {
    activeAds: 0,
    confidence: 0,
    patterns: [],
    learningStats: {},
    success: false,
    error: 'Todas as tentativas falharam'
  };
}

// Função para testar e validar padrões
export async function testPatterns(page: any, testUrls: string[]): Promise<{
  results: Array<{
    url: string;
    activeAds: number;
    confidence: number;
    patterns: any[];
  }>;
  learningStats: any;
}> {
  console.log('🧪 Testando padrões inteligentes...');
  
  const detector = new IntelligentPatternDetector();
  const results = [];
  
  for (const url of testUrls) {
    try {
      const result = await intelligentScrape(page, url);
      results.push({
        url,
        activeAds: result.activeAds,
        confidence: result.confidence,
        patterns: result.patterns
      });
      
      console.log(`✅ ${url}: ${result.activeAds} anúncios (confiança: ${result.confidence})`);
      
    } catch (error: any) {
      console.error(`❌ Erro ao testar ${url}:`, error.message);
      results.push({
        url,
        activeAds: 0,
        confidence: 0,
        patterns: []
      });
    }
  }
  
  return {
    results,
    learningStats: detector.getLearningStats()
  };
}

// Função para monitorar e reportar aprendizado
export function getLearningReport(): {
  stats: any;
  recommendations: string[];
} {
  const detector = new IntelligentPatternDetector();
  const stats = detector.getLearningStats();
  
  const recommendations = [];
  
  if (stats.dynamicPatterns > 0) {
    recommendations.push(`✅ Sistema aprendeu ${stats.dynamicPatterns} novos padrões`);
  }
  
  if (stats.dynamicPatterns > 10) {
    recommendations.push('⚠️ Muitos padrões dinâmicos - considere limpeza');
  }
  
  if (stats.dynamicPatterns === 0) {
    recommendations.push('ℹ️ Sistema usando apenas padrões conhecidos');
  }
  
  return {
    stats,
    recommendations
  };
}
