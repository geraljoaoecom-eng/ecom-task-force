import { Router } from 'express';
import { prisma } from '../prisma/client';

const router: Router = Router();

// Buscar todas as opções de um tipo específico
router.get('/:type', async (req, res) => {
  try {
    const { type } = req.params;
    
    const options = await prisma.filterOption.findMany({
      where: { type },
      orderBy: { value: 'asc' }
    });
    
    res.json(options.map(opt => opt.value));
  } catch (error: any) {
    console.error('Erro ao buscar opções:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Buscar todas as opções de todos os tipos
router.get('/', async (req, res) => {
  try {
    const allOptions = await prisma.filterOption.findMany({
      orderBy: [{ type: 'asc' }, { value: 'asc' }]
    });
    
    const grouped = allOptions.reduce((acc, opt) => {
      if (!acc[opt.type]) acc[opt.type] = [];
      acc[opt.type].push(opt.value);
      return acc;
    }, {} as Record<string, string[]>);
    
    res.json(grouped);
  } catch (error: any) {
    console.error('Erro ao buscar opções:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Adicionar nova opção
router.post('/:type', async (req, res) => {
  try {
    const { type } = req.params;
    const { value } = req.body;
    
    if (!value || !value.trim()) {
      return res.status(400).json({ error: 'Valor é obrigatório' });
    }
    
    const option = await prisma.filterOption.create({
      data: {
        type,
        value: value.trim()
      }
    });
    
    res.json(option);
  } catch (error: any) {
    if (error.code === 'P2002') {
      return res.status(409).json({ error: 'Opção já existe' });
    }
    console.error('Erro ao criar opção:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Remover opção
router.delete('/:type/:value', async (req, res) => {
  try {
    const { type, value } = req.params;
    
    await prisma.filterOption.deleteMany({
      where: {
        type,
        value: decodeURIComponent(value)
      }
    });
    
    res.json({ ok: true });
  } catch (error: any) {
    console.error('Erro ao deletar opção:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

export { router };
