import { PrismaClient } from '@prisma/client';
import { getActiveAdsCount } from './scraper';
import { SourceType } from '../types';

const prisma = new PrismaClient();

export async function refreshSingle(libraryId: string) {
  const library = await prisma.library.findUnique({
    where: { id: libraryId },
    include: { pages: true }
  });

  if (!library) {
    console.log(`Biblioteca com ID ${libraryId} não encontrada.`);
    return null;
  }

  console.log(`🔄 Atualizando biblioteca: ${library.name}`);

  try {
    // Chama a função de scraping antiga
    const activeAds = await getActiveAdsCount("URL" as SourceType, library.sourceValue);

    // Atualiza a biblioteca com o número de anúncios ativos
    const updatedLibrary = await prisma.library.update({
      where: { id: libraryId },
      data: {
        activeAds: activeAds,
        lastCheckedAt: new Date(),
      },
    });

    // Registra o histórico de anúncios
    const lastHistory = await prisma.adHistory.findFirst({
      where: { libraryId: library.id },
      orderBy: { id: 'desc' },
    });

    if (!lastHistory || lastHistory.adsCount !== activeAds) {
      await prisma.adHistory.create({
        data: {
          libraryId: library.id,
          adsCount: activeAds,
        },
      });
    }

    console.log(`✅ Biblioteca ${library.name} atualizada. Anúncios ativos: ${activeAds}`);
    return updatedLibrary;
  } catch (error) {
    console.error(`❌ Falha no scraping para a biblioteca ${library.name}:`, error);
    return null;
  }
}

export async function refreshAllLibraries() {
  console.log('🔄 Atualizando todas as bibliotecas...');
  const libraries = await prisma.library.findMany();
  for (const library of libraries) {
    await refreshSingle(library.id);
  }
  console.log('✅ Todas as bibliotecas foram atualizadas.');
}