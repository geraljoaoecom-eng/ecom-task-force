/**
 * @deprecated NÃO USAR — gera contagens falsas (URL sem normalizar active/BR).
 * Refresh e criação de bibliotecas usam proxy para ecom-api (:4000).
 */
import { parseAdCountFromText } from './ad-count-parser';
import { getPool, updateLibraryScrapeResult } from './db';
import puppeteer from 'puppeteer';

/**
 * Função de scraping do Facebook Ads Library (OBSOLETA)
 */
export async function scrapeFacebookAds(url: string): Promise<number> {
  let browser;
  
  try {
    console.log(`🕷️ Scraping REAL: ${url}`);
    
    // Lista de User Agents para rotacionar (do código original)
    const userAgents = [
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15',
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:124.0) Gecko/20100101 Firefox/124.0',
      'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36 Edg/121.0.0.0'
    ];
    
    const randomUserAgent = userAgents[Math.floor(Math.random() * userAgents.length)];
    
    browser = await puppeteer.launch({
      headless: 'new',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--disable-gpu',
        '--lang=en-US',
        '--window-size=1366,900'
      ]
    });
    
    const page = await browser.newPage();
    
    // Configurações avançadas (do código original)
    await page.setUserAgent(randomUserAgent);
    await page.setExtraHTTPHeaders({ 'Accept-Language': 'en-US,en;q=0.9' });
    await page.setViewport({ width: 1366, height: 900 });
    
    // Bloquear recursos pesados (do código original)
    await page.setRequestInterception(true);
    page.on('request', (req: any) => {
      const type = req.resourceType();
      if (['image', 'stylesheet', 'font', 'media'].includes(type)) {
        req.abort();
      } else {
        req.continue();
      }
    });
    
    // Navegar para a URL
    await page.goto(url, { 
      waitUntil: 'networkidle2',
      timeout: 30000 
    });
    
    await new Promise(resolve => setTimeout(resolve, 4000));
    
    const pageText = await page.evaluate(() => document.body.innerText || '');
    const activeAds = parseAdCountFromText(pageText);

    await browser.close();
    
    if (activeAds > 0) {
      console.log(`✅ Scraping concluído: ${activeAds} anúncios ativos`);
    } else {
      console.log(`⚠️ Nenhum total de resultados encontrado na URL: ${url}`);
    }
    
    return activeAds;
    
  } catch (error: any) {
    console.error(`❌ Erro no scraping: ${error.message}`);
    if (browser) {
      await browser.close();
    }
    return -1;
  }
}

/**
 * Atualizar uma biblioteca específica
 */
export async function updateSingleLibrary(libraryId: string) {
  try {
    console.log(`\n📚 Atualizando biblioteca: ${libraryId}`);

    const pool = getPool();
    const { rows } = await pool.query('SELECT * FROM libraries WHERE id = $1', [libraryId]);

    if (!rows[0]) {
      console.log(`⚠️ Biblioteca ${libraryId} não encontrada`);
      return { success: false, error: 'Biblioteca não encontrada' };
    }

    const library = rows[0];
    console.log(`   Nome: ${library.name}`);
    console.log(`   URL: ${library.source_value}`);

    const activeAds = await scrapeFacebookAds(library.source_value);

    if (activeAds < 0) {
      console.log(`   ❌ Falha no scraping`);
      return { success: false, error: 'Falha no scraping' };
    }

    await updateLibraryScrapeResult(libraryId, activeAds);

    console.log(`   ✅ Atualizado: ${activeAds} anúncios ativos`);
    return { success: true, activeAds, libraryName: library.name };
  } catch (error: any) {
    console.error(`   ❌ Erro ao atualizar biblioteca: ${error.message}`);
    return { success: false, error: error.message };
  }
}

/**
 * Atualizar todas as bibliotecas
 */
export async function updateAllLibraries() {
  try {
    console.log('\n═══════════════════════════════════════════════════════');
    console.log('🕷️ INICIANDO ATUALIZAÇÃO AUTOMÁTICA DE BIBLIOTECAS');
    console.log('═══════════════════════════════════════════════════════\n');
    
    const startTime = Date.now();
    
    const pool = getPool();
    const { rows: libraries } = await pool.query(
      'SELECT id, name, source_value, user_id FROM libraries ORDER BY created_at DESC'
    );
    console.log(`📊 Total de bibliotecas: ${libraries.length}\n`);
    
    if (libraries.length === 0) {
      console.log('⚠️ Nenhuma biblioteca para atualizar\n');
      return {
        success: true,
        totalLibraries: 0,
        totalSuccess: 0,
        totalFailed: 0,
        duration: 0
      };
    }
    
    let successCount = 0;
    let failedCount = 0;
    
    // Atualizar cada biblioteca
    for (let i = 0; i < libraries.length; i++) {
      const library = libraries[i];
      console.log(`[${i + 1}/${libraries.length}] ${library.name}`);
      
      const result = await updateSingleLibrary(library.id);
      
      if (result.success) {
        successCount++;
      } else {
        failedCount++;
      }
      
      // Pequeno delay entre requisições para não sobrecarregar
      if (i < libraries.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
    
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    
    console.log('\n═══════════════════════════════════════════════════════');
    console.log('📊 RESUMO DA ATUALIZAÇÃO');
    console.log('═══════════════════════════════════════════════════════');
    console.log(`✅ Sucesso: ${successCount}`);
    console.log(`❌ Falhas: ${failedCount}`);
    console.log(`⏱️ Tempo total: ${duration}s`);
    console.log('═══════════════════════════════════════════════════════\n');
    
    return {
      success: true,
      totalLibraries: libraries.length,
      totalSuccess: successCount,
      totalFailed: failedCount,
      duration: parseFloat(duration)
    };
    
  } catch (error: any) {
    console.error('❌ Erro crítico ao atualizar bibliotecas:', error.message);
    return {
      success: false,
      error: error.message,
      totalLibraries: 0,
      totalSuccess: 0,
      totalFailed: 0
    };
  }
}

/**
 * Atualizar bibliotecas de um usuário específico
 */
export async function updateUserLibraries(userId: string) {
  try {
    console.log(`\n🔄 Atualizando bibliotecas do usuário: ${userId}\n`);
    
    const pool = getPool();
    const { rows: libraries } = await pool.query(
      'SELECT id, name, source_value FROM libraries WHERE user_id = $1',
      [userId]
    );
    console.log(`📊 Bibliotecas do usuário: ${libraries.length}\n`);
    
    let successCount = 0;
    let failedCount = 0;
    
    for (const library of libraries) {
      const result = await updateSingleLibrary(library.id);
      if (result.success) {
        successCount++;
      } else {
        failedCount++;
      }
    }
    
    console.log(`\n✅ Concluído: ${successCount} sucesso, ${failedCount} falhas\n`);
    
    return {
      success: true,
      totalLibraries: libraries.length,
      totalSuccess: successCount,
      totalFailed: failedCount
    };
    
  } catch (error: any) {
    console.error('❌ Erro ao atualizar bibliotecas do usuário:', error.message);
    return {
      success: false,
      error: error.message
    };
  }
}
