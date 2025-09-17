import { Router } from 'express';
import { prisma } from '../prisma/client';

export const router: Router = Router();

// Listar todas as pastas com suas bibliotecas
router.get('/', async (_req, res) => {
  try {
    const folders = await prisma.folder.findMany({
      include: {
        libraries: true
      },
      orderBy: {
        name: 'asc'
      }
    });
    res.json(folders);
  } catch (error: any) {
    console.error('Erro ao buscar pastas:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Criar nova pasta
router.post('/', async (req, res) => {
  try {
    const { name } = req.body;
    
    if (!name) {
      return res.status(400).json({ error: 'Nome da pasta é obrigatório' });
    }

    const folder = await prisma.folder.create({
      data: { name }
    });
    
    res.json(folder);
  } catch (error: any) {
    console.error('Erro ao criar pasta:', error);
    if (error.code === 'P2002') {
      res.status(400).json({ error: 'Pasta com este nome já existe' });
    } else {
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  }
});

// Atualizar pasta
router.patch('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name } = req.body;

    const folder = await prisma.folder.update({
      where: { id },
      data: { name }
    });
    
    res.json(folder);
  } catch (error: any) {
    console.error('Erro ao atualizar pasta:', error);
    if (error.code === 'P2025') {
      res.status(404).json({ error: 'Pasta não encontrada' });
    } else if (error.code === 'P2002') {
      res.status(400).json({ error: 'Pasta com este nome já existe' });
    } else {
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  }
});

// Deletar pasta
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    await prisma.folder.delete({
      where: { id }
    });
    
    res.json({ ok: true });
  } catch (error: any) {
    console.error('Erro ao deletar pasta:', error);
    if (error.code === 'P2025') {
      res.status(404).json({ error: 'Pasta não encontrada' });
    } else {
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  }
});
