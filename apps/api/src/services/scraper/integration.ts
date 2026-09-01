// Integração principal com Apify
import { SourceType } from '../../types';
import { getActiveAdsCount } from './index';
import { getActiveAdsCountHybrid } from './hybrid-scraper';

/**
 * Função principal recomendada que usa o sistema híbrido (Apify + Puppeteer)
 * Esta é a função que deve ser usada em produção
 */
export async function getActiveAdsCountRecommended(type: SourceType, value: string): Promise<number> {
  try {
    console.log(`🚀 Usando sistema híbrido recomendado: ${type} - ${value}`);
    return await getActiveAdsCountHybrid(type, value);
  } catch (error: any) {
    console.error('❌ Erro no sistema híbrido, usando Puppeteer puro:', error.message);
    return await getActiveAdsCount(type, value);
  }
}

/**
 * Função que força o uso apenas do Apify
 */
export async function getActiveAdsCountApifyOnly(type: SourceType, value: string): Promise<number> {
  try {
    console.log(`🤖 Usando apenas Apify: ${type} - ${value}`);
    const { getActiveAdsCountWithApify } = await import('./apify-scraper');
    return await getActiveAdsCountWithApify(type, value);
  } catch (error: any) {
    console.error('❌ Erro no Apify, retornando 0:', error.message);
    return 0;
  }
}

/**
 * Função que força o uso apenas do Puppeteer (método antigo)
 */
export async function getActiveAdsCountPuppeteerOnly(type: SourceType, value: string): Promise<number> {
  try {
    console.log(`🕷️ Usando apenas Puppeteer: ${type} - ${value}`);
    return await getActiveAdsCount(type, value);
  } catch (error: any) {
    console.error('❌ Erro no Puppeteer, retornando 0:', error.message);
    return 0;
  }
}

/**
 * Função que testa ambos os métodos e retorna comparação
 */
export async function compareScrapingMethods(type: SourceType, value: string): Promise<{
  apify: number;
  puppeteer: number;
  difference: number;
  recommendation: string;
}> {
  console.log(`🧪 Comparando métodos de scraping: ${type} - ${value}`);
  
  const results = await Promise.allSettled([
    getActiveAdsCountApifyOnly(type, value),
    getActiveAdsCountPuppeteerOnly(type, value)
  ]);

  const apifyResult = results[0].status === 'fulfilled' ? results[0].value : 0;
  const puppeteerResult = results[1].status === 'fulfilled' ? results[1].value : 0;
  
  const difference = Math.abs(apifyResult - puppeteerResult);
  
  let recommendation = 'apify';
  if (puppeteerResult > apifyResult) {
    recommendation = 'puppeteer';
  } else if (difference < 2) {
    recommendation = 'both';
  }

  return {
    apify: apifyResult,
    puppeteer: puppeteerResult,
    difference,
    recommendation
  };
}

