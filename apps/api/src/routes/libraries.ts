import { Router } from 'express';
import { prisma } from '../prisma/client';
import { refreshSingle } from '../services/libraries';

export const router: Router = Router();

router.get('/', async (req, res) => {
  try {
    const { q, folderId, order, tags, status, nichos, estrategias, produtos, idiomas, paises } = req.query as any;
    const where: any = {};

    if (q) {
      where.OR = [
        { name: { contains: q } },
        { sourceValue: { contains: q } }
      ];
    }
    if (folderId) where.folderId = folderId;
    if (status === 'ativo') where.activeAds = { gt: 0 };
    else if (status === 'inativo') where.activeAds = { equals: 0 };
    if (nichos) where.nichos = { contains: nichos };
    if (estrategias) where.estrategias = { contains: estrategias };
    if (produtos) where.produtos = { contains: produtos };
    if (idiomas) where.idiomas = { contains: idiomas };
    if (paises) where.paises = { contains: paises };
    if (tags) {
      const tagList = Array.isArray(tags) ? tags : [tags];
      where.OR = [
        ...(where.OR || []),
        ...tagList.map((tag: string) => ({ tags: { contains: tag } }))
      ];
    }

    let orderBy: any = { createdAt: 'desc' };
    switch (order) {
      case 'ads_desc': orderBy = { activeAds: 'desc' }; break;
      case 'ads_asc': orderBy = { activeAds: 'asc' }; break;
      case 'oldest': orderBy = { createdAt: 'asc' }; break;
      case 'newest': orderBy = { createdAt: 'desc' }; break;
    }

    const libraries = await prisma.library.findMany({
      where,
      orderBy,
      include: { pages: true, folder: true }
    });

    res.json(libraries.map(lib => ({
      ...lib,
      calculatedStatus: lib.activeAds > 0 ? 'ativo' : 'inativo'
    })));
  } catch (error: any) {
    console.error('Erro ao buscar bibliotecas:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

router.post('/', async (req, res) => {
  try {
    const { name, sourceType, sourceValue, country, language, notes, tags, folderId, pages } = req.body;

    if (!name || !sourceType || !sourceValue) {
      return res.status(400).json({ error: 'Nome, tipo de fonte e valor da fonte são obrigatórios' });
    }

    const existing = await prisma.library.findFirst({ where: { sourceValue } });
    if (existing) return res.status(400).json({ error: 'Erro: Biblioteca já existente' });

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

    if (pages && pages.length > 0) {
      await prisma.page.createMany({
        data: pages.map((url: string) => ({ url, libraryId: library.id }))
      });
    }

    res.json({
      ...library,
      pages: pages ? pages.filter((p: string) => p.trim()).map((url: string) => ({ url, libraryId: library.id })) : [],
      folder: null,
      calculatedStatus: 'em_atualizacao',
      activeAds: 0
    });

    refreshSingle(library.id).catch(err => console.error('Erro no refresh em background:', err));
  } catch (error: any) {
    console.error('Erro ao criar biblioteca:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

router.patch('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const library = await prisma.library.update({
      where: { id },
      data: req.body,
      include: { pages: true, folder: true }
    });
    res.json({ ...library, calculatedStatus: library.activeAds > 0 ? 'ativo' : 'inativo' });
  } catch (error: any) {
    console.error('Erro ao atualizar biblioteca:', error);
    if (error.code === 'P2025') res.status(404).json({ error: 'Biblioteca não encontrada' });
    else res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await prisma.page.deleteMany({ where: { libraryId: id } });
    await prisma.library.delete({ where: { id } });
    res.json({ ok: true });
  } catch (error: any) {
    console.error('Erro ao deletar biblioteca:', error);
    if (error.code === 'P2025') res.status(404).json({ error: 'Biblioteca não encontrada' });
    else res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

router.post('/:id/refresh', async (req, res) => {
  try {
    const { id } = req.params;
    await refreshSingle(id);
    const library = await prisma.library.findUnique({
      where: { id },
      include: { pages: true, folder: true }
    });
    res.json(library ? { ...library, calculatedStatus: library.activeAds > 0 ? 'ativo' : 'inativo' } : null);
  } catch (error: any) {
    console.error('Erro ao atualizar biblioteca:', error);
    if (error.message === 'Biblioteca não encontrada') res.status(404).json({ error: 'Biblioteca não encontrada' });
    else res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

router.get('/:id/history', async (req, res) => {
  try {
    const { id } = req.params;
    const { days = 15 } = req.query;
    const daysAgo = new Date();
    daysAgo.setDate(daysAgo.getDate() - Number(days));
    const history = await prisma.adHistory.findMany({
      where: { libraryId: id, date: { gte: daysAgo } },
      orderBy: { date: 'asc' }
    });
    res.json(history);
  } catch (error: any) {
    console.error('Erro ao buscar histórico:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});
