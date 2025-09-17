import { prisma } from '../prisma/client';
import { getActiveAdsCount } from './scraper/index';
import { SourceType } from '../types';

// Atualiza TODAS as bibliotecas (usado pelo cron)
export async function refreshAllLibraries(): Promise<void> {
  console.log('🔄 Atualizando TODAS as bibliotecas...');
  
  const libraries = await prisma.library.findMany({
    orderBy: { updatedAt: 'desc' }
  });

  console.log(`📊 Total de bibliotecas para atualizar: ${libraries.length}`);

  for (const lib of libraries) {
    try {
      console.log(`📚 Atualizando: ${lib.name}`);
      const activeAds = await getActiveAdsCount(lib.sourceType as SourceType, lib.sourceValue);
      
      await prisma.library.update({
        where: { id: lib.id },
        data: { 
          activeAds,
          lastCheckedAt: new Date()
        }
      });
      
      console.log(`✅ ${lib.name}: ${activeAds} anúncios ativos`);
      
      // Pequena pausa entre requests para evitar rate limiting
      await new Promise(resolve => setTimeout(resolve, 2000));
      
    } catch (error) {
      console.error(`❌ Erro ao atualizar ${lib.name}:`, error);
    }
  }
  
  console.log('🎉 Atualização de TODAS as bibliotecas concluída!');
}

// Atualiza as bibliotecas mais recentes (usado pelo cron) - MANTIDO PARA COMPATIBILIDADE
export async function refreshTopLibraries(limit = 50): Promise<void> {
  console.log(`🔄 Atualizando ${limit} bibliotecas mais recentes...`);
  
  const libraries = await prisma.library.findMany({
    take: limit,
    orderBy: { updatedAt: 'desc' }
  });

  for (const lib of libraries) {
    try {
      console.log(`📚 Atualizando: ${lib.name}`);
      const activeAds = await getActiveAdsCount(lib.sourceType as SourceType, lib.sourceValue);
      
      await prisma.library.update({
        where: { id: lib.id },
        data: { 
          activeAds,
          lastCheckedAt: new Date()
        }
      });
      
      console.log(`✅ ${lib.name}: ${activeAds} anúncios ativos`);
      
      // Pequena pausa entre requests para evitar rate limiting
      await new Promise(resolve => setTimeout(resolve, 2000));
      
    } catch (error) {
      console.error(`❌ Erro ao atualizar ${lib.name}:`, error);
    }
  }
  
  console.log('🎉 Atualização em lote concluída!');
}

// Atualiza uma biblioteca específica
export async function refreshSingle(libraryId: string): Promise<void> {
  const library = await prisma.library.findUnique({
    where: { id: libraryId }
  });
  
  if (!library) {
    throw new Error('Biblioteca não encontrada');
  }
  
  console.log(`🔄 Atualizando biblioteca: ${library.name}`);
  
  const activeAds = await getActiveAdsCount(library.sourceType as SourceType, library.sourceValue);
  
  // Atualizar biblioteca
  await prisma.library.update({
    where: { id: libraryId },
    data: { 
      activeAds,
      lastCheckedAt: new Date()
    }
  });

  // Salvar histórico (apenas se mudou o número de anúncios ou é primeira vez)
  const lastHistory = await prisma.adHistory.findFirst({
    where: { libraryId },
    orderBy: { date: 'desc' }
  });

  if (!lastHistory || lastHistory.adsCount !== activeAds) {
    await prisma.adHistory.create({
      data: {
        libraryId,
        adsCount: activeAds
      }
    });
  }
  
  console.log(`✅ ${library.name}: ${activeAds} anúncios ativos`);
}
