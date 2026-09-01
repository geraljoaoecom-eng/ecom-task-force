const express = require('express');
const cors = require('cors');
require('dotenv').config({ path: '../env-config' });

const app = express();
const PORT = process.env.PORT || 4000;

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true
}));
app.use(express.json());

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'online',
    timestamp: new Date().toISOString(),
    version: '2.0.0',
    database: 'Supabase',
    message: 'Sistema operacional'
  });
});

// Test login endpoint
app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body;
  
  console.log('Tentativa de login:', { email, password: '***' });
  
  // Teste simples
  if (email === 'pokt@gmail.com' && password === '84005787') {
    res.json({
      message: 'Login realizado com sucesso',
      token: 'test-token-123',
      user: {
        id: 1,
        email: 'pokt@gmail.com',
        name: 'Test User'
      }
    });
  } else {
    res.status(401).json({
      error: 'Credenciais inválidas'
    });
  }
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log('');
  console.log('═══════════════════════════════════════════════════════');
  console.log('🧪 SERVIDOR DE TESTE');
  console.log('═══════════════════════════════════════════════════════');
  console.log(`📡 Servidor rodando em: http://localhost:${PORT}`);
  console.log(`🔗 API disponível em: http://localhost:${PORT}/api`);
  console.log(`🏥 Health check: http://localhost:${PORT}/api/health`);
  console.log('═══════════════════════════════════════════════════════');
  console.log('');
  console.log('✅ Sistema pronto para receber requisições');
  console.log('');
});

module.exports = app;
