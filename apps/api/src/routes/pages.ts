import { Router } from 'express';
import { prisma } from '../prisma/client';

export const router: Router = Router();

// Adicionar página a uma biblioteca
router.post('/:libraryId', async (req, res) => {
  try {
    const { libraryId } = req.params;
    const { url } = req.body;
    
    if (!url) {
      return res.status(400).json({ error: 'URL é obrigatória' });
    }
    
    const page = await prisma.page.create({
      data: {
        url,
        libraryId
      }
    });
    
    res.json(page);
  } catch (error: any) {
    console.error('Erro ao adicionar página:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Editar página
router.patch('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { url } = req.body;
    
    if (!url) {
      return res.status(400).json({ error: 'URL é obrigatória' });
    }
    
    const page = await prisma.page.update({
      where: { id },
      data: { url }
    });
    
    res.json(page);
  } catch (error: any) {
    console.error('Erro ao editar página:', error);
    if (error.code === 'P2025') {
      res.status(404).json({ error: 'Página não encontrada' });
    } else {
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  }
});

// Deletar página
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    await prisma.page.delete({
      where: { id }
    });
    
    res.json({ ok: true });
  } catch (error: any) {
    console.error('Erro ao deletar página:', error);
    if (error.code === 'P2025') {
      res.status(404).json({ error: 'Página não encontrada' });
    } else {
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  }
});
