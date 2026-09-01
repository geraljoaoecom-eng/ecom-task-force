const puppeteer = require('puppeteer');

class FacebookAdsCrawler {
  constructor() {
    this.browser = null;
    this.page = null;
  }

  async initBrowser() {
    if (!this.browser) {
      this.browser = await puppeteer.launch({
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
    }
    
    if (!this.page) {
      this.page = await this.browser.newPage();
      
      // Configurar user agent e viewport
      await this.page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
      await this.page.setViewport({ width: 1920, height: 1080 });
      
      // Interceptar requests para otimizar performance
      await this.page.setRequestInterception(true);
      this.page.on('request', (req) => {
        const resourceType = req.resourceType();
        if (resourceType === 'image' || resourceType === 'stylesheet' || resourceType === 'font') {
          req.abort();
        } else {
          req.continue();
        }
      });
    }
  }

  async scrapeLibrary(url, libraryName, userId) {
    console.log(`🕷️ Iniciando scraping para: ${libraryName} (${url})`);
    
    try {
      await this.initBrowser();
      
      // Navegar para a URL
      console.log(`🌐 Navegando para: ${url}`);
      await this.page.goto(url, { 
        waitUntil: 'networkidle2',
        timeout: 30000 
      });
      
      // Aguardar carregamento completo
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      // Verificar se há anúncios ativos
      const hasActiveAds = await this.checkActiveAds();
      if (!hasActiveAds) {
        console.log(`❌ ${libraryName}: Nenhum anúncio ativo encontrado`);
        return {
          activeAds: 0,
          success: true,
          message: 'Biblioteca sem anúncios ativos'
        };
      }
      
      // Extrair número de resultados
      const resultsCount = await this.extractResultsCount();
      
      console.log(`✅ ${libraryName}: ${resultsCount} anúncios ativos encontrados`);
      
      return {
        activeAds: resultsCount,
        success: true,
        message: 'Scraping realizado com sucesso'
      };
      
    } catch (error) {
      console.error(`❌ Erro ao fazer scraping de ${libraryName}:`, error.message);
      return {
        activeAds: 0,
        success: false,
        error: error.message
      };
    }
  }

  async checkActiveAds() {
    try {
      // Aguardar elemento de status aparecer
      await this.page.waitForSelector('[data-testid="active_status"]', { timeout: 10000 });
      
      // Verificar se há texto indicando anúncios ativos
      const activeStatusText = await this.page.evaluate(() => {
        const elements = document.querySelectorAll('*');
        for (let element of elements) {
          const text = element.textContent || '';
          if (text.includes('Anúncios ativos') || text.includes('Active ads') || text.includes('Anuncios activos')) {
            return true;
          }
        }
        return false;
      });
      
      return activeStatusText;
    } catch (error) {
      console.log('⚠️ Não foi possível verificar status de anúncios ativos:', error.message);
      return true; // Assume que há anúncios se não conseguir verificar
    }
  }

  async extractResultsCount() {
    try {
      // Aguardar elemento de resultados aparecer
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Tentar múltiplos seletores para encontrar o contador
      const count = await this.page.evaluate(() => {
        // Seletores específicos baseados no HTML fornecido
        const selectors = [
          '[aria-level="3"]',
          '.x8t9es0.x1uxerd5.xrohxju.x108nfp6.xq9mrsl.x1h4wwuj.x117nqv4.xeuugli',
          '[role="heading"]'
        ];
        
        for (let selector of selectors) {
          const elements = document.querySelectorAll(selector);
          for (let element of elements) {
            const text = element.textContent || '';
            // Padrões melhorados para capturar números com > e diferentes formatos (incluindo separadores)
            const patterns = [
              />\s*(\d+[\d.,\s]*)\s*resultados?/i,  // >50 000 resultados ou >14.000 resultados
              /(\d+[\d.,\s]*)\s*resultados?/i,      // 50 000 resultados ou 14.000 resultados
              />\s*(\d+[\d.,\s]*)\s*results?/i,     // >50 000 results ou >14.000 results
              /(\d+[\d.,\s]*)\s*results?/i,         // 50 000 results ou 14.000 results
              />\s*(\d+[\d.,\s]*)\s*anúncios?/i,    // >50 000 anúncios ou >14.000 anúncios
              /(\d+[\d.,\s]*)\s*anúncios?/i         // 50 000 anúncios ou 14.000 anúncios
            ];
            
            for (const pattern of patterns) {
              const match = text.match(pattern);
              if (match) {
                const number = parseInt(match[1].replace(/[.,\s]/g, ''));
                if (number > 0) {
                  console.log(`✅ Número encontrado: ${number} (padrão: ${pattern})`);
                  return number;
                }
              }
            }
          }
        }
        
        // Fallback: buscar por qualquer número seguido de "resultados" em toda a página
        const allElements = document.querySelectorAll('*');
        for (let element of allElements) {
          const text = element.textContent || '';
          const patterns = [
            />\s*(\d+[\d.,\s]*)\s*(resultados?|results?|anúncios?)/i,
            /(\d+[\d.,\s]*)\s*(resultados?|results?|anúncios?)/i
          ];
          
          for (const pattern of patterns) {
            const match = text.match(pattern);
            if (match) {
              const number = parseInt(match[1].replace(/[.,\s]/g, ''));
              if (number > 0) {
                console.log(`✅ Número encontrado (fallback): ${number}`);
                return number;
              }
            }
          }
        }
        
        return 0;
      });
      
      return count || 0;
    } catch (error) {
      console.error('❌ Erro ao extrair contagem de resultados:', error.message);
      return 0;
    }
  }

  async close() {
    if (this.page) {
      await this.page.close();
      this.page = null;
    }
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }
}

module.exports = FacebookAdsCrawler;
