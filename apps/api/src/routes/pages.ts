import { Router } from 'express';
import { prisma } from '../prisma/client';

export const router: Router = Router();

router.post('/:libraryId', async (req, res) => {
  try {
    const { libraryId } = req.params;
    const { url } = req.body;
    if (!url) return res.status(400).json({ error: 'URL é obrigatória' });
    const page = await prisma.page.create({ data: { url, libraryId } });
    res.status(201).json(page);
  } catch (error: any) {
    console.error('Erro ao criar página:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await prisma.page.delete({ where: { id } });
    res.status(204).send();
  } catch (error: any) {
    console.error('Erro ao deletar página:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});
