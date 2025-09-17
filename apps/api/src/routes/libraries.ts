import { Router } from 'express';
import { prisma } from '../prisma/client';
import { refreshSingle } from '../services/libraries';

export const router: Router = Router();

// Listar bibliotecas com filtros e ordenação
router.get('/', async (req, res) => {
  try {
    const { q, folderId, order, tags, status, nichos, estrategias, produtos, idiomas, paises } = req.query as any;
    
    const where: any = {};
    
    // Filtro por texto (nome ou valor da fonte)
    if (q) {
      where.OR = [
        { name: { contains: q } },
        { sourceValue: { contains: q } }
      ];
    }
    
    // Filtro por pasta
    if (folderId) {
      where.folderId = folderId;
    }
    
    // Filtros estruturados
    if (status) {
      if (status === 'ativo') {
        where.activeAds = { gt: 0 };
      } else if (status === 'inativo') {
        where.activeAds = { equals: 0 };
      }
    }
    
    if (nichos) {
      where.nichos = { contains: nichos };
    }
    
    if (estrategias) {
      where.estrategias = { contains: estrategias };
    }
    
    if (produtos) {
      where.produtos = { contains: produtos };
    }
    
    if (idiomas) {
      where.idiomas = { contains: idiomas };
    }
    
    if (paises) {
      where.paises = { contains: paises };
    }
    
    // Filtro por tags (campo antigo)
    if (tags) {
      const tagList = Array.isArray(tags) ? tags : [tags];
      where.OR = [
        ...(where.OR || []),
        ...tagList.map((tag: string) => ({
          tags: { contains: tag }
        }))
      ];
    }
    
    // Ordenação
    let orderBy: any = { createdAt: 'desc' }; // padrão
    
    switch (order) {
      case 'ads_desc':
        orderBy = { activeAds: 'desc' };
        break;
      case 'ads_asc':
        orderBy = { activeAds: 'asc' };
        break;
      case 'oldest':
        orderBy = { createdAt: 'asc' };
        break;
      case 'newest':
        orderBy = { createdAt: 'desc' };
        break;
    }
    
    const libraries = await prisma.library.findMany({
      where,
      orderBy,
      include: {
        pages: true,
        folder: true
      }
    });
    
    // Adicionar status calculado automaticamente
    const librariesWithStatus = libraries.map(library => ({
      ...library,
      calculatedStatus: library.activeAds > 0 ? 'ativo' : 'inativo'
    }));
    
    res.json(librariesWithStatus);
  } catch (error: any) {
    console.error('Erro ao buscar bibliotecas:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Criar nova biblioteca (com refresh imediato)
router.post('/', async (req, res) => {
  try {
    const {
      name,
      sourceType,
      sourceValue,
      country,
      language,
      notes,
      tags,
      folderId,
      pages
    } = req.body;
    
    if (!name || !sourceType || !sourceValue) {
      return res.status(400).json({ 
        error: 'Nome, tipo de fonte e valor da fonte são obrigatórios' 
      });
    }

    // Verificar se já existe uma biblioteca com o mesmo sourceValue
    const existingLibrary = await prisma.library.findFirst({
      where: {
        sourceValue: sourceValue
      }
    });

    if (existingLibrary) {
      return res.status(400).json({ 
        error: 'Erro: Biblioteca já existente' 
      });
    }

    // Criar biblioteca
    const library = await prisma.library.create({
      data: {
        name,
        sourceType,
        sourceValue,
        country,
        language,
        notes,
        tags: Array.isArray(tags) ? tags.join(',') : (tags || ''),
        folderId
      }
    });
    
    // Criar páginas se fornecidas
    if (pages && pages.length > 0) {
      await prisma.page.createMany({
        data: pages.map((url: string) => ({
          url,
          libraryId: library.id
        }))
      });
    }
    
    // Retornar biblioteca imediatamente (sem aguardar scraping)
    const libraryWithStatus = {
      ...library,
      pages: pages ? pages.filter((p: string) => p.trim()).map((url: string) => ({ url, libraryId: library.id })) : [],
      folder: null,
      calculatedStatus: 'em_atualizacao', // Indicar que está sendo atualizada
      activeAds: 0 // Começar com 0, será atualizado depois
    };
    
    res.json(libraryWithStatus);
    
    // Fazer refresh em background (sem aguardar)
    refreshSingle(library.id).catch(error => {
      console.error('Erro no refresh em background:', error);
    });
  } catch (error: any) {
    console.error('Erro ao criar biblioteca:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Atualizar biblioteca
router.patch('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;
    
    const library = await prisma.library.update({
      where: { id },
      data: updateData,
      include: {
        pages: true,
        folder: true
      }
    });
    
    // Adicionar status calculado
    const libraryWithStatus = {
      ...library,
      calculatedStatus: library.activeAds > 0 ? 'ativo' : 'inativo'
    };
    
    res.json(libraryWithStatus);
  } catch (error: any) {
    console.error('Erro ao atualizar biblioteca:', error);
    if (error.code === 'P2025') {
      res.status(404).json({ error: 'Biblioteca não encontrada' });
    } else {
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  }
});

// Deletar biblioteca
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Deletar páginas relacionadas primeiro
    await prisma.page.deleteMany({
      where: { libraryId: id }
    });
    
    // Deletar biblioteca
    await prisma.library.delete({
      where: { id }
    });
    
    res.json({ ok: true });
  } catch (error: any) {
    console.error('Erro ao deletar biblioteca:', error);
    if (error.code === 'P2025') {
      res.status(404).json({ error: 'Biblioteca não encontrada' });
    } else {
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  }
});

// Refresh manual de uma biblioteca
router.post('/:id/refresh', async (req, res) => {
  try {
    const { id } = req.params;
    
    await refreshSingle(id);
    
    const library = await prisma.library.findUnique({
      where: { id },
      include: {
        pages: true,
        folder: true
      }
    });
    
    // Adicionar status calculado
    const libraryWithStatus = library ? {
      ...library,
      calculatedStatus: library.activeAds > 0 ? 'ativo' : 'inativo'
    } : null;
    
    res.json(libraryWithStatus);
  } catch (error: any) {
    console.error('Erro ao atualizar biblioteca:', error);
    if (error.message === 'Biblioteca não encontrada') {
      res.status(404).json({ error: 'Biblioteca não encontrada' });
    } else {
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  }
});

// Buscar histórico de anúncios de uma biblioteca
router.get('/:id/history', async (req, res) => {
  try {
    const { id } = req.params;
    const { days = 15 } = req.query;
    
    const daysAgo = new Date();
    daysAgo.setDate(daysAgo.getDate() - Number(days));
    
    const history = await prisma.adHistory.findMany({
      where: {
        libraryId: id,
        date: { gte: daysAgo }
      },
      orderBy: { date: 'asc' }
    });
    
    res.json(history);
  } catch (error: any) {
    console.error('Erro ao buscar histórico:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});
