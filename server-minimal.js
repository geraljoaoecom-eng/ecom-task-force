require('dotenv').config({ path: './env-config' });

const express = require('express');
const cors = require('cors');
const { authenticateToken, registerUser, loginUser, getUserData } = require('./apps/api/auth-supabase');
const { getUserLibraries, getUserFolders, createFolder, updateFolder, deleteFolder, getFilterOptions } = require('./apps/api/supabase-helpers');
const axios = require('axios');

const app = express();
const PORT = 4000;

// SUPABASE CONFIG
const SUPABASE_URL = 'https://kpnhedyyxgodfgzqggdx.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtwbmhlZHl5eGdvZGZnenFnZ2R4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MDIwNTI3NywiZXhwIjoyMDc1NzgxMjc3fQ.0hHQ62SD1y-6-fgJRIh1xAeojo19Y2gvieYd26hEdT0';

// Middleware
app.use(cors({ origin: 'http://localhost:3000', credentials: true }));
app.use(express.json());

console.log('🚀 Iniciando servidor mínimo...');

// ===== ROTAS DE AUTENTICAÇÃO =====
app.post('/api/auth/register', async (req, res) => {
  try {
    const result = await registerUser(req.body.email, req.body.password, req.body.name);
    res.json(result);
  } catch (error) {
    console.error('❌ Erro register:', error.message);
    res.status(400).json({ error: error.message });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    console.log('🔐 Login:', req.body.email);
    const result = await loginUser(req.body.email, req.body.password);
    res.json(result);
  } catch (error) {
    console.error('❌ Erro login:', error.message);
    res.status(401).json({ error: error.message });
  }
});

app.get('/api/auth/verify', authenticateToken, async (req, res) => {
  try {
    const userData = await getUserData(req.user.userId);
    res.json({ valid: true, user: { id: req.user.userId, email: req.user.email } });
  } catch (error) {
    res.status(401).json({ error: 'Token inválido' });
  }
});

app.get('/api/auth/me', authenticateToken, async (req, res) => {
  try {
    const userData = await getUserData(req.user.userId);
    res.json(userData);
  } catch (error) {
    res.status(500).json({ error: 'Erro interno' });
  }
});

// ===== ROTAS DE BIBLIOTECAS =====
app.get('/api/libraries', authenticateToken, async (req, res) => {
  try {
    const libraries = await getUserLibraries(req.user.userId, req.query);
    res.json(libraries);
  } catch (error) {
    console.error('❌ Erro libraries:', error.message);
    res.status(500).json({ error: 'Erro interno' });
  }
});

app.post('/api/libraries', authenticateToken, async (req, res) => {
  try {
    const libraryData = {
      id: req.body.id,
      name: req.body.name,
      source_type: req.body.sourceType,
      source_value: req.body.sourceValue,
      country: req.body.country || '',
      language: req.body.language || '',
      notes: req.body.notes || '',
      tags: req.body.tags || '',
      active_ads: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      user_id: req.user.userId,
      folder_id: req.body.folderId || null,
      estrategias: req.body.estrategias || '',
      idiomas: req.body.idiomas || '',
      nichos: req.body.nichos || '',
      paises: req.body.paises || '',
      produtos: req.body.produtos || '',
      status: 'active',
      tipos: req.body.tipos || '',
      nota: req.body.nota || ''
    };
    
    const response = await axios.post(`${SUPABASE_URL}/rest/v1/libraries`, libraryData, {
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
      }
    });
    
    res.json({ success: true, library: response.data });
  } catch (error) {
    console.error('❌ Erro create library:', error.message);
    res.status(500).json({ error: 'Erro interno' });
  }
});

app.put('/api/libraries/:id', authenticateToken, async (req, res) => {
  try {
    const updateData = {
      name: req.body.name,
      source_type: req.body.sourceType,
      source_value: req.body.sourceValue,
      country: req.body.country || '',
      language: req.body.language || '',
      notes: req.body.notes || '',
      tags: req.body.tags || '',
      folder_id: req.body.folderId || null,
      estrategias: req.body.estrategias || '',
      idiomas: req.body.idiomas || '',
      nichos: req.body.nichos || '',
      paises: req.body.paises || '',
      produtos: req.body.produtos || '',
      status: req.body.status || 'active',
      tipos: req.body.tipos || '',
      nota: req.body.nota || '',
      updated_at: new Date().toISOString()
    };
    
    await axios.patch(`${SUPABASE_URL}/rest/v1/libraries?id=eq.${req.params.id}&user_id=eq.${req.user.userId}`, updateData, {
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json'
      }
    });
    
    res.json({ success: true });
  } catch (error) {
    console.error('❌ Erro update library:', error.message);
    res.status(500).json({ error: 'Erro interno' });
  }
});

app.delete('/api/libraries/:id', authenticateToken, async (req, res) => {
  try {
    await axios.delete(`${SUPABASE_URL}/rest/v1/libraries?id=eq.${req.params.id}&user_id=eq.${req.user.userId}`, {
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`
      }
    });
    
    res.json({ success: true });
  } catch (error) {
    console.error('❌ Erro delete library:', error.message);
    res.status(500).json({ error: 'Erro interno' });
  }
});

// ===== ROTAS DE PASTAS =====
app.get('/api/folders', authenticateToken, async (req, res) => {
  try {
    const folders = await getUserFolders(req.user.userId);
    res.json(folders);
  } catch (error) {
    res.status(500).json({ error: 'Erro interno' });
  }
});

app.post('/api/folders', authenticateToken, async (req, res) => {
  try {
    const folder = await createFolder(req.user.userId, req.body.name);
    res.json(folder);
  } catch (error) {
    res.status(500).json({ error: 'Erro interno' });
  }
});

app.put('/api/folders/:id', authenticateToken, async (req, res) => {
  try {
    await updateFolder(req.params.id, req.user.userId, req.body.name);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Erro interno' });
  }
});

app.delete('/api/folders/:id', authenticateToken, async (req, res) => {
  try {
    await deleteFolder(req.params.id, req.user.userId);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Erro interno' });
  }
});

// ===== ROTAS DE FILTROS =====
app.get('/api/filter-options/:type', authenticateToken, async (req, res) => {
  try {
    const options = await getFilterOptions(req.params.type);
    res.json(options);
  } catch (error) {
    res.status(500).json({ error: 'Erro interno' });
  }
});

// ===== ROTAS EXTRAS =====
app.get('/api/test', (req, res) => {
  res.json({ message: 'API funcionando!', timestamp: new Date().toISOString() });
});

app.get('/api/scraping/status', authenticateToken, (req, res) => {
  res.json({
    success: true,
    isRunning: false,
    message: 'Sistema de scraping manual apenas'
  });
});

app.get('/api/stripe/current-plan', authenticateToken, (req, res) => {
  res.json({
    plan: 'premium',
    status: 'active',
    features: ['unlimited_libraries']
  });
});

// Iniciar servidor
app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Servidor rodando na porta ${PORT}`);
  console.log(`📊 API: http://localhost:${PORT}/api`);
  console.log(`🔐 Login: POST /api/auth/login`);
});

