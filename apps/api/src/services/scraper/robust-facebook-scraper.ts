import puppeteer, { Browser, Page } from 'puppeteer';
import { execSync } from 'child_process';
import { existsSync } from 'fs';

// Interface para os dados extraídos
export interface ScrapedData {
  total_resultados: number;
  anuncios: Array<{
    status: 'ativo' | 'inativo';
    texto: string;
  }>;
  success: boolean;
  error?: string;
  confidence: number;
  language: string;
}

// Configurações multi-idioma
const LANGUAGE_CONFIGS = {
  pt: {
    resultados: ['resultados', 'resultado'],
    anuncios_ativos: ['anúncios ativos', 'anúncio ativo', 'anúncios ativos', 'anúncio ativo'],
    anuncios_inativos: ['anúncios inativos', 'anúncio inativo', 'sem anúncios ativos'],
    estado_online: ['estado online', 'online'],
    palavras_chave: ['anúncios', 'anúncio', 'ativo', 'inativo', 'online']
  },
  en: {
    resultados: ['results', 'result'],
    anuncios_ativos: ['active ads', 'active ad', 'ads active', 'ad active'],
    anuncios_inativos: ['inactive ads', 'inactive ad', 'no active ads'],
    estado_online: ['online state', 'online'],
    palavras_chave: ['ads', 'ad', 'active', 'inactive', 'online']
  },
  es: {
    resultados: ['resultados', 'resultado'],
    anuncios_ativos: ['anuncios activos', 'anuncio activo', 'anuncios activos', 'anuncio activo'],
    anuncios_inativos: ['anuncios inactivos', 'anuncio inactivo', 'sin anuncios activos'],
    estado_online: ['estado en línea', 'en línea'],
    palavras_chave: ['anuncios', 'anuncio', 'activo', 'inactivo', 'línea']
  },
  fr: {
    resultados: ['résultats', 'résultat'],
    anuncios_ativos: ['annonces actives', 'annonce active', 'annonces actives', 'annonce active'],
    anuncios_inativos: ['annonces inactives', 'annonce inactive', 'sans annonces actives'],
    estado_online: ['état en ligne', 'en ligne'],
    palavras_chave: ['annonces', 'annonce', 'actif', 'inactif', 'ligne']
  },
  it: {
    resultados: ['risultati', 'risultato'],
    anuncios_ativos: ['annunci attivi', 'annuncio attivo', 'annunci attivi', 'annuncio attivo'],
    anuncios_inativos: ['annunci inattivi', 'annuncio inattivo', 'senza annunci attivi'],
    estado_online: ['stato online', 'online'],
    palavras_chave: ['annunci', 'annuncio', 'attivo', 'inattivo', 'online']
  },
  de: {
    resultados: ['ergebnisse', 'ergebnis'],
    anuncios_ativos: ['aktive anzeigen', 'aktive anzeige', 'anzeigen aktiv', 'anzeige aktiv'],
    anuncios_inativos: ['inaktive anzeigen', 'inaktive anzeige', 'keine aktiven anzeigen'],
    estado_online: ['online status', 'online'],
    palavras_chave: ['anzeigen', 'anzeige', 'aktiv', 'inaktiv', 'online']
  }
};

export class RobustFacebookScraper {
  private browser: Browser | null = null;
  private page: Page | null = null;

  // Encontra o executável do Chrome/Chromium
  private findChromePath(): string | null {
    const possiblePaths = [
      '/root/.cache/puppeteer/chrome/linux-121.0.6167.85/chrome-linux64/chrome',
      '/usr/bin/google-chrome',
      '/usr/bin/chromium-browser',
      '/usr/bin/chromium',
      '/opt/google/chrome/chrome',
      '/usr/bin/google-chrome-stable'
    ];

    for (const path of possiblePaths) {
      if (existsSync(path)) {
        console.log(`🔍 Chrome encontrado em: ${path}`);
        return path;
      }
    }

    // Tenta encontrar via which
    try {
      const chromePath = execSync('which google-chrome || which chromium-browser || which chromium', { encoding: 'utf8' }).trim();
      if (chromePath && existsSync(chromePath)) {
        console.log(`🔍 Chrome encontrado via which: ${chromePath}`);
        return chromePath;
      }
    } catch (error) {
      console.log('⚠️ Não foi possível encontrar Chrome via which');
    }

    return null;
  }

  // Inicializa o browser
  private async initBrowser(): Promise<void> {
    const chromePath = this.findChromePath();
    
    if (!chromePath) {
      throw new Error('Chrome não encontrado. Instale o Chrome ou Chromium.');
    }

    this.browser = await puppeteer.launch({
      headless: "new",
      executablePath: chromePath,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--disable-gpu',
        '--disable-web-security',
        '--disable-features=VizDisplayCompositor'
      ]
    });

    this.page = await this.browser.newPage();
    
    // Configurações da página
    await this.page.setViewport({ width: 1920, height: 1080 });
    await this.page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
  }

  // Fecha o browser
  private async closeBrowser(): Promise<void> {
    if (this.page) {
      await this.page.close();
      this.page = null;
    }
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }

  // Detecta o idioma da página
  private async detectLanguage(page: Page): Promise<string> {
    // Tenta detectar o idioma baseado no conteúdo da página
    const text = await page.evaluate(() => document.body.textContent || '');
    
    for (const [lang, config] of Object.entries(LANGUAGE_CONFIGS)) {
      const matches = config.palavras_chave.filter(word => 
        text.toLowerCase().includes(word.toLowerCase())
      ).length;
      
      if (matches >= 2) {
        console.log(`🌍 Idioma detectado: ${lang}`);
        return lang;
      }
    }
    
    console.log('🌍 Idioma não detectado, usando português como padrão');
    return 'pt';
  }

  // Extrai o número total de resultados
  private async extractTotalResults(page: Page, language: string): Promise<number> {
    const config = LANGUAGE_CONFIGS[language as keyof typeof LANGUAGE_CONFIGS];
    
    // Procura por padrões de "X resultados"
    for (const pattern of config.resultados) {
      // Tenta encontrar elementos que contenham o padrão
      const elements = await page.$$eval(`*`, (elements, pattern) => {
        return elements
          .filter(el => el.textContent && el.textContent.toLowerCase().includes(pattern.toLowerCase()))
          .map(el => el.textContent);
      }, pattern);
      
      for (const text of elements) {
        if (text) {
          // Procura por números no texto (capturando com separadores)
          const numberMatch = text.match(/(\d+[\d.,\s]*)/);
          if (numberMatch) {
            const number = parseInt(numberMatch[1].replace(/[.,\s]/g, ''));
            console.log(`📊 Total de resultados encontrado: ${number} (${pattern})`);
            return number;
          }
        }
      }
    }
    
    // Fallback: procura por qualquer número seguido de palavra relacionada
    const allText = await page.evaluate(() => document.body.textContent || '');
    const numberPattern = /(\d+[\d.,\s]*)\s+(resultados?|results?|résultats?|risultati?|ergebnisse?)/i;
    const match = allText.match(numberPattern);
    
    if (match) {
      const number = parseInt(match[1].replace(/[.,\s]/g, ''));
      console.log(`📊 Total de resultados encontrado (fallback): ${number}`);
      return number;
    }
    
    console.log('⚠️ Nenhum total de resultados encontrado');
    return 0;
  }

  // Verifica se há anúncios ativos
  private async checkActiveAds(page: Page, language: string): Promise<boolean> {
    const config = LANGUAGE_CONFIGS[language as keyof typeof LANGUAGE_CONFIGS];
    
    // Procura por indicadores de anúncios ativos
    for (const pattern of config.anuncios_ativos) {
      const elements = await page.$$eval(`*`, (elements, pattern) => {
        return elements.some(el => 
          el.textContent && el.textContent.toLowerCase().includes(pattern.toLowerCase())
        );
      }, pattern);
      
      if (elements) {
        console.log(`✅ Anúncios ativos detectados: ${pattern}`);
        return true;
      }
    }
    
    // Procura por "Estado online: Anúncios ativos"
    for (const estado of config.estado_online) {
      for (const ativo of config.anuncios_ativos) {
        const pattern = `${estado}.*${ativo}`;
        const elements = await page.$$eval(`*`, (elements, pattern) => {
          const regex = new RegExp(pattern, 'i');
          return elements.some(el => 
            el.textContent && regex.test(el.textContent)
          );
        }, pattern);
        
        if (elements) {
          console.log(`✅ Estado online com anúncios ativos detectado: ${pattern}`);
          return true;
        }
      }
    }
    
    // Fallback: procura por números > 0 seguidos de palavras de anúncios
    const allText = await page.evaluate(() => document.body.textContent || '');
    const numberAdPattern = /(\d+[\d.,\s]*)\s+(anúncios?|ads?|anuncios?|annonces?|annunci?|anzeigen?)/i;
    const match = allText.match(numberAdPattern);
    
    if (match) {
      const number = parseInt(match[1].replace(/[.,\s]/g, ''));
      if (number > 0) {
        console.log(`✅ Anúncios ativos detectados (fallback): ${number}`);
        return true;
      }
    }
    
    console.log('❌ Nenhum anúncio ativo detectado');
    return false;
  }

  // Extrai informações dos anúncios individuais
  private async extractAdsInfo(page: Page, language: string): Promise<Array<{status: 'ativo' | 'inativo', texto: string}>> {
    const config = LANGUAGE_CONFIGS[language as keyof typeof LANGUAGE_CONFIGS];
    const ads: Array<{status: 'ativo' | 'inativo', texto: string}> = [];
    
    try {
      // Procura por elementos que possam conter anúncios
      const adElements = await page.$$('[data-testid*="ad"], [class*="ad"], [class*="Ad"]');
      
      for (const element of adElements) {
        const text = await page.evaluate(el => el.textContent, element);
        if (text && text.trim().length > 10) {
          // Verifica se é ativo ou inativo baseado no texto
          let status: 'ativo' | 'inativo' = 'inativo';
          
          for (const ativoPattern of config.anuncios_ativos) {
            if (text.toLowerCase().includes(ativoPattern.toLowerCase())) {
              status = 'ativo';
              break;
            }
          }
          
          if (status === 'inativo') {
            for (const inativoPattern of config.anuncios_inativos) {
              if (text.toLowerCase().includes(inativoPattern.toLowerCase())) {
                status = 'inativo';
                break;
              }
            }
          }
          
          ads.push({
            status,
            texto: text.trim().substring(0, 200) // Limita o texto para evitar dados muito grandes
          });
        }
      }
    } catch (error) {
      console.log('⚠️ Erro ao extrair informações dos anúncios:', error);
    }
    
    return ads;
  }

  // Função principal de scraping
  async scrapeLibrary(url: string, libraryName: string): Promise<ScrapedData> {
    console.log(`🕷️ Iniciando scraping robusto para: ${libraryName}`);
    
    try {
      // Inicializa o browser
      await this.initBrowser();
      
      if (!this.page) {
        throw new Error('Falha ao inicializar a página');
      }
      
      // Navega para a URL
      console.log(`🌐 Navegando para: ${url}`);
      await this.page.goto(url, { 
        waitUntil: 'networkidle2',
        timeout: 30000 
      });
      
      // Aguarda a página carregar completamente
      await this.page.waitForTimeout(3000);
      
      // Detecta o idioma
      const language = await this.detectLanguage(this.page);
      
      // Extrai o número total de resultados
      const total_resultados = await this.extractTotalResults(this.page, language);
      
      // Verifica se há anúncios ativos
      const hasActiveAds = await this.checkActiveAds(this.page, language);
      
      // Extrai informações dos anúncios
      const anuncios = await this.extractAdsInfo(this.page, language);
      
      // Calcula a confiança baseada nos dados encontrados
      let confidence = 0.5;
      if (total_resultados > 0) confidence += 0.3;
      if (hasActiveAds) confidence += 0.2;
      if (anuncios.length > 0) confidence += 0.2;
      
      const result: ScrapedData = {
        total_resultados,
        anuncios,
        success: true,
        confidence: Math.min(confidence, 1.0),
        language
      };
      
      console.log(`✅ Scraping concluído: ${total_resultados} resultados, ${anuncios.length} anúncios, confiança: ${confidence.toFixed(2)}`);
      
      return result;
      
    } catch (error: any) {
      console.error(`❌ Erro no scraping de ${libraryName}:`, error.message);
      
      return {
        total_resultados: 0,
        anuncios: [],
        success: false,
        error: error.message,
        confidence: 0,
        language: 'unknown'
      };
    } finally {
      // Sempre fecha o browser
      await this.closeBrowser();
    }
  }
}

// Função de conveniência para usar o scraper
export async function scrapeFacebookLibrary(url: string, libraryName: string): Promise<ScrapedData> {
  const scraper = new RobustFacebookScraper();
  return await scraper.scrapeLibrary(url, libraryName);
}
