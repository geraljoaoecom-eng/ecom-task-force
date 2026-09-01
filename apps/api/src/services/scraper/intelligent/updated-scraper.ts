// Scraper Principal Atualizado com Sistema Inteligente
import { adaptiveScrape } from './scraper-integration';

export async function scrapeLibrary(page: any, url: string, libraryName: string): Promise<{
  activeAds: number;
  success: boolean;
  confidence: number;
  patterns: any[];
  learningStats: any;
}> {
  console.log(`🕷️ Iniciando scraping inteligente para: ${libraryName}`);
  
  try {
    const result = await adaptiveScrape(page, url, 4);
    
    if (result.success) {
      console.log(`✅ ${libraryName}: ${result.activeAds} anúncios ativos (confiança: ${result.confidence})`);
      
      // Log dos padrões encontrados para debug
      if (result.patterns.length > 0) {
        console.log(`🔍 Padrões encontrados:`, result.patterns.map(p => ({
          text: p.text,
          count: p.count,
          confidence: p.confidence,
          language: p.language
        })));
      }
      
      // Log das estatísticas de aprendizado
      if (result.learningStats) {
        console.log(`🧠 Estatísticas de aprendizado:`, result.learningStats);
      }
      
    } else {
      console.log(`❌ ${libraryName}: Falha no scraping (${result.error})`);
    }
    
    return result;
    
  } catch (error: any) {
    console.error(`❌ Erro crítico no scraping de ${libraryName}:`, error);
    return {
      activeAds: 0,
      success: false,
      confidence: 0,
      patterns: [],
      learningStats: {}
    };
  }
}
