// Sistema Inteligente de Detecção de Padrões para Facebook Ads Library
// Este sistema se adapta automaticamente às mudanças do Facebook

export interface PatternMatch {
  text: string;
  count: number;
  confidence: number;
  pattern: string;
  language: string;
}

export class IntelligentPatternDetector {
  private knownPatterns = [
    // Padrões atuais conhecidos
    { regex: /~(\d[\d.,]*)\s+resultados?/i, languages: ['pt', 'es'], type: 'results' },
    { regex: /~(\d[\d.,]*)\s+results?/i, languages: ['en'], type: 'results' },
    { regex: /~(\d[\d.,]*)\s+resultats?/i, languages: ['fr'], type: 'results' },
    { regex: /~(\d[\d.,]*)\s+risultati?/i, languages: ['it'], type: 'results' },
    { regex: /~(\d[\d.,]*)\s+ergebnisse?/i, languages: ['de'], type: 'results' },
    
    // Padrões de anúncios ativos
    { regex: /(\d[\d.,]*)\s+anúncios?\s+ativos?/i, languages: ['pt'], type: 'active_ads' },
    { regex: /(\d[\d.,]*)\s+ads?\s+active/i, languages: ['en'], type: 'active_ads' },
    { regex: /(\d[\d.,]*)\s+anuncios?\s+activos?/i, languages: ['es'], type: 'active_ads' },
    { regex: /(\d[\d.,]*)\s+annonces?\s+actives?/i, languages: ['fr'], type: 'active_ads' },
    { regex: /(\d[\d.,]*)\s+annunci?\s+attivi?/i, languages: ['it'], type: 'active_ads' },
    { regex: /(\d[\d.,]*)\s+anzeigen?\s+aktiv?/i, languages: ['de'], type: 'active_ads' },
  ];

  private dynamicPatterns: Array<{
    regex: RegExp;
    languages: string[];
    type: string;
    confidence: number;
    lastSeen: Date;
  }> = [];

  // Detecta padrões dinamicamente no HTML
  detectPatterns(html: string): PatternMatch[] {
    const matches: PatternMatch[] = [];
    
    // 1. Primeiro, tenta padrões conhecidos
    for (const pattern of this.knownPatterns) {
      const regex = new RegExp(pattern.regex.source, 'gi');
      let match;
      
      while ((match = regex.exec(html)) !== null) {
        matches.push({
          text: match[0],
          count: this.parseNumber(match[1]),
          confidence: 0.9, // Alta confiança para padrões conhecidos
          pattern: pattern.regex.source,
          language: pattern.languages[0]
        });
      }
    }

    // 2. Detecta novos padrões dinamicamente
    const newPatterns = this.discoverNewPatterns(html);
    for (const pattern of newPatterns) {
      const regex = new RegExp(pattern.regex.source, 'gi');
      let match;
      
      while ((match = regex.exec(html)) !== null) {
        matches.push({
          text: match[0],
          count: this.parseNumber(match[1]),
          confidence: pattern.confidence,
          pattern: pattern.regex.source,
          language: pattern.languages[0]
        });
      }
    }

    // 3. Ordena por confiança e conta
    return matches.sort((a, b) => {
      if (b.confidence !== a.confidence) {
        return b.confidence - a.confidence;
      }
      return b.count - a.count;
    });
  }

  // Descobre novos padrões no HTML
  private discoverNewPatterns(html: string): Array<{
    regex: RegExp;
    languages: string[];
    type: string;
    confidence: number;
  }> {
    const newPatterns: Array<{
      regex: RegExp;
      languages: string[];
      type: string;
      confidence: number;
    }> = [];

    // Procura por elementos que contêm números e palavras relacionadas
    const numberPattern = /(\d[\d.,]*)\s+([a-zA-ZáéíóúàèìòùâêîôûãõçÁÉÍÓÚÀÈÌÒÙÂÊÎÔÛÃÕÇ]+)/gi;
    let match;

    while ((match = numberPattern.exec(html)) !== null) {
      const number = match[1];
      const word = match[2].toLowerCase();
      
      // Verifica se é uma palavra relacionada a resultados/anúncios
      if (this.isRelevantWord(word)) {
        const confidence = this.calculateConfidence(word, number);
        
        if (confidence > 0.5) {
          // Cria regex para este padrão específico
          const escapedWord = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          const regex = new RegExp(`(\\d[\\d.,]*)\\s+${escapedWord}`, 'i');
          
          newPatterns.push({
            regex,
            languages: [this.detectLanguage(word)],
            type: this.categorizeWord(word),
            confidence
          });
        }
      }
    }

    return newPatterns;
  }

  // Verifica se uma palavra é relevante para contagem
  private isRelevantWord(word: string): boolean {
    const relevantWords = [
      // Português
      'resultados', 'resultado', 'anúncios', 'anúncio', 'anuncios', 'anuncio',
      'ativos', 'ativo', 'activos', 'activo', 'disponíveis', 'disponivel',
      'encontrados', 'encontrado', 'itens', 'item', 'total', 'totais',
      
      // Inglês
      'results', 'result', 'ads', 'ad', 'active', 'available', 'found',
      'items', 'item', 'total', 'totals',
      
      // Espanhol
      'resultados', 'resultado', 'anuncios', 'anuncio', 'activos', 'activo',
      'disponibles', 'disponible', 'encontrados', 'encontrado', 'articulos',
      'articulo', 'total', 'totales',
      
      // Francês
      'resultats', 'resultat', 'annonces', 'annonce', 'actives', 'active',
      'disponibles', 'disponible', 'trouvés', 'trouvé', 'éléments', 'élément',
      'total', 'totaux',
      
      // Italiano
      'risultati', 'risultato', 'annunci', 'annuncio', 'attivi', 'attivo',
      'disponibili', 'disponibile', 'trovati', 'trovato', 'elementi', 'elemento',
      'totale', 'totali',
      
      // Alemão
      'ergebnisse', 'ergebnis', 'anzeigen', 'anzeige', 'aktiv', 'verfügbar',
      'gefunden', 'elemente', 'element', 'gesamt', 'gesamte'
    ];

    return relevantWords.some(relevant => 
      word.includes(relevant) || relevant.includes(word)
    );
  }

  // Calcula confiança baseada na palavra e contexto
  private calculateConfidence(word: string, number: string): number {
    let confidence = 0.5; // Base

    // Aumenta confiança para palavras muito específicas
    const highConfidenceWords = ['resultados', 'results', 'anúncios', 'ads', 'active', 'ativos'];
    if (highConfidenceWords.some(w => word.includes(w))) {
      confidence += 0.3;
    }

    // Aumenta confiança para números maiores (mais provável de ser real)
    const num = parseInt(number.replace(/[.,]/g, ''));
    if (num > 10) confidence += 0.1;
    if (num > 100) confidence += 0.1;

    // Aumenta confiança se contém tilde (~) ou símbolos similares
    if (word.includes('~') || word.includes('≈')) {
      confidence += 0.2;
    }

    return Math.min(confidence, 1.0);
  }

  // Detecta idioma baseado na palavra
  private detectLanguage(word: string): string {
    const languagePatterns = {
      'pt': ['resultados', 'anúncios', 'ativos', 'disponíveis', 'encontrados', 'itens'],
      'en': ['results', 'ads', 'active', 'available', 'found', 'items'],
      'es': ['resultados', 'anuncios', 'activos', 'disponibles', 'encontrados', 'articulos'],
      'fr': ['resultats', 'annonces', 'actives', 'disponibles', 'trouvés', 'éléments'],
      'it': ['risultati', 'annunci', 'attivi', 'disponibili', 'trovati', 'elementi'],
      'de': ['ergebnisse', 'anzeigen', 'aktiv', 'verfügbar', 'gefunden', 'elemente']
    };

    for (const [lang, patterns] of Object.entries(languagePatterns)) {
      if (patterns.some(pattern => word.includes(pattern))) {
        return lang;
      }
    }

    return 'en'; // Default
  }

  // Categoriza o tipo de palavra
  private categorizeWord(word: string): string {
    if (word.includes('resultado') || word.includes('result')) return 'results';
    if (word.includes('anúncio') || word.includes('ad') || word.includes('annonce') || word.includes('annuncio') || word.includes('anzeige')) return 'active_ads';
    if (word.includes('ativo') || word.includes('active') || word.includes('activo') || word.includes('attivo') || word.includes('aktiv')) return 'active_ads';
    return 'results';
  }

  // Converte string de número para inteiro
  private parseNumber(numStr: string): number {
    return parseInt(numStr.replace(/[.,]/g, ''));
  }

  // Aprende com novos padrões encontrados
  learnFromPattern(pattern: {
    regex: RegExp;
    languages: string[];
    type: string;
    confidence: number;
  }) {
    // Adiciona ao cache de padrões dinâmicos
    this.dynamicPatterns.push({
      ...pattern,
      lastSeen: new Date()
    });

    // Remove padrões antigos (mais de 30 dias)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    this.dynamicPatterns = this.dynamicPatterns.filter(
      p => p.lastSeen > thirtyDaysAgo
    );
  }

  // Retorna estatísticas dos padrões aprendidos
  getLearningStats() {
    return {
      knownPatterns: this.knownPatterns.length,
      dynamicPatterns: this.dynamicPatterns.length,
      totalPatterns: this.knownPatterns.length + this.dynamicPatterns.length,
      lastLearning: this.dynamicPatterns.length > 0 
        ? Math.max(...this.dynamicPatterns.map(p => p.lastSeen.getTime()))
        : null
    };
  }
}

// Função principal de scraping inteligente
export async function intelligentScrape(page: any, url: string): Promise<{
  activeAds: number;
  confidence: number;
  patterns: PatternMatch[];
  learningStats: any;
}> {
  const detector = new IntelligentPatternDetector();
  
  try {
    // Navega para a página
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
    
    // Aguarda um pouco para o conteúdo carregar
    await page.waitForTimeout(2000);
    
    // Obtém o HTML da página
    const html = await page.content();
    
    // Detecta padrões
    const patterns = detector.detectPatterns(html);
    
    // Encontra o melhor match
    const bestMatch = patterns[0];
    
    if (bestMatch) {
      // Aprende com o padrão encontrado
      detector.learnFromPattern({
        regex: new RegExp(bestMatch.pattern, 'i'),
        languages: [bestMatch.language],
        type: bestMatch.pattern.includes('ativo') || bestMatch.pattern.includes('active') ? 'active_ads' : 'results',
        confidence: bestMatch.confidence
      });
      
      return {
        activeAds: bestMatch.count,
        confidence: bestMatch.confidence,
        patterns: patterns.slice(0, 5), // Top 5 matches
        learningStats: detector.getLearningStats()
      };
    }
    
    return {
      activeAds: 0,
      confidence: 0,
      patterns: [],
      learningStats: detector.getLearningStats()
    };
    
  } catch (error) {
    console.error('Erro no scraping inteligente:', error);
    return {
      activeAds: 0,
      confidence: 0,
      patterns: [],
      learningStats: detector.getLearningStats()
    };
  }
}
