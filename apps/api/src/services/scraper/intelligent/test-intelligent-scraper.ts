// Script de Teste do Sistema Inteligente
import { testPatterns, getLearningReport } from './scraper-integration';
import puppeteer from 'puppeteer';

async function testIntelligentScraper() {
  console.log('🧪 Iniciando teste do sistema inteligente...');
  
  // URLs de teste (substitua pelas suas bibliotecas reais)
  const testUrls = [
    'https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=ALL&is_targeted_country=false&media_type=all&search_type=page&view_all_page_id=780102685185034',
    // Adicione mais URLs aqui para testar
  ];
  
  let browser;
  
  try {
    // Inicia o browser
    browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--disable-gpu'
      ]
    });
    
    const page = await browser.newPage();
    
    // Configurações da página
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
    await page.setViewport({ width: 1920, height: 1080 });
    
    // Testa os padrões
    const testResults = await testPatterns(page, testUrls);
    
    console.log('\n📊 Resultados do Teste:');
    console.log('====================');
    
    testResults.results.forEach((result, index) => {
      console.log(`\n${index + 1}. ${result.url}`);
      console.log(`   Anúncios: ${result.activeAds}`);
      console.log(`   Confiança: ${result.confidence}`);
      console.log(`   Padrões: ${result.patterns.length}`);
      
      if (result.patterns.length > 0) {
        console.log('   Detalhes dos padrões:');
        result.patterns.forEach((pattern, i) => {
          console.log(`     ${i + 1}. "${pattern.text}" (${pattern.language}) - Confiança: ${pattern.confidence}`);
        });
      }
    });
    
    // Relatório de aprendizado
    const learningReport = getLearningReport();
    console.log('\n🧠 Relatório de Aprendizado:');
    console.log('============================');
    console.log(`Padrões conhecidos: ${learningReport.stats.knownPatterns}`);
    console.log(`Padrões dinâmicos: ${learningReport.stats.dynamicPatterns}`);
    console.log(`Total de padrões: ${learningReport.stats.totalPatterns}`);
    
    if (learningReport.recommendations.length > 0) {
      console.log('\n💡 Recomendações:');
      learningReport.recommendations.forEach(rec => console.log(`   - ${rec}`));
    }
    
    console.log('\n✅ Teste concluído com sucesso!');
    
  } catch (error) {
    console.error('❌ Erro durante o teste:', error);
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

// Executa o teste se chamado diretamente
if (require.main === module) {
  testIntelligentScraper().catch(console.error);
}

export { testIntelligentScraper };
