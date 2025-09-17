import { Router } from 'express';

export const router: Router = Router();

// Endpoint de saúde da API
router.get('/', (_req, res) => {
  res.json({ 
    ok: true, 
    timestamp: new Date().toISOString(),
    status: 'healthy',
    scheduler: 'active'
  });
});
