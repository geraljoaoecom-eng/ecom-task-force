import { Router } from 'express';
import { prisma } from '../prisma/client';

export const router: Router = Router();

router.get('/', async (_req, res) => {
  try {
    const folders = await prisma.folder.findMany({
      include: { libraries: true },
      orderBy: { name: 'asc' }
    });
    res.json(folders);
  } catch (error: any) {
    console.error('Erro ao buscar pastas:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

router.post('/', async (req, res) => {
  try {
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: 'Nome é obrigatório' });
    const folder = await prisma.folder.create({ data: { name } });
    res.status(201).json(folder);
  } catch (error: any) {
    console.error('Erro ao criar pasta:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await prisma.folder.delete({ where: { id } });
    res.status(204).send();
  } catch (error: any) {
    console.error('Erro ao deletar pasta:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});
