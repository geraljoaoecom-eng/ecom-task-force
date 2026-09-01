require('dotenv').config({ path: './env-config' });

const express = require('express');
const cors = require('cors');
const path = require('path');
const { authenticateToken, registerUser, loginUser, getUserData } = require('./apps/api/auth-supabase');
const { getUserLibraries, getUserFolders, createFolder, updateFolder, deleteFolder, getFilterOptions } = require('./apps/api/supabase-helpers');
// const CronScheduler = require('./apps/api/cron-scheduler'); // Desabilitado - usa SQLite

const app = express();
const PORT = process.env.PORT || 4000;

// Função para encontrar Chrome instalado
function findChrome() {
  const { execSync } = require('child_process');
  const fs = require('fs');
  
  const possiblePaths = [
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/chromium-browser',
    '/usr/bin/chromium',
    '/snap/bin/chromium',
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
  ];

  for (const path of possiblePaths) {
    if (fs.existsSync(path)) {
      console.log(`✅ Chrome encontrado em: ${path}`);
      return path;
    }
  }

  try {
    const chromePath = execSync('which google-chrome-stable || which google-chrome || which chromium-browser || which chromium', { encoding: 'utf8' }).trim();
    if (chromePath && fs.existsSync(chromePath)) {
      console.log(`✅ Chrome encontrado via which: ${chromePath}`);
      return chromePath;
    }
  } catch (e) {}

  console.log('⚠️ Chrome do sistema não encontrado, usando Puppeteer padrão');
  return null;
}

// Função simplificada de scraping do Facebook
async function scrapeFacebookAds(url) {
  const puppeteer = require('puppeteer');
  
  try {
    console.log(`🕷️ Iniciando scraping para: ${url}`);
    
    const chromePath = findChrome();
    const launchOptions = {
      headless: 'new',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--lang=en-US'
      ]
    };

    if (chromePath) {
      launchOptions.executablePath = chromePath;
    }
    
    const browser = await puppeteer.launch(launchOptions);
    
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
    
    // Navegar para a URL
    await page.goto(url, { 
      waitUntil: 'networkidle2',
      timeout: 30000 
    });
    
    // Aguardar carregamento
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Tentar encontrar o número de resultados
    let activeAds = 0;
    
    try {
      // Procurar por diferentes seletores que indicam número de resultados
      const selectors = [
        '[data-testid="result-count"]',
        '.x1i10hfl',
        '[role="main"] span',
        '.x193iq5w',
        'span:contains("results")',
        'span:contains("anúncios")',
        'span:contains("ads")'
      ];
      
      for (const selector of selectors) {
        try {
          const element = await page.$(selector);
          if (element) {
            const text = await page.evaluate(el => el.textContent, element);
            console.log(`🔍 Texto encontrado: "${text}"`);
            
            // Extrair número do texto
            const match = text.match(/(\d+)/);
            if (match) {
              activeAds = parseInt(match[1]);
              console.log(`✅ Número extraído: ${activeAds}`);
              break;
            }
          }
        } catch (e) {
          // Continuar para o próximo seletor
        }
      }
      
      // Se não encontrou, tentar buscar por padrões de texto melhorados
      if (activeAds === 0) {
        const pageText = await page.evaluate(() => document.body.textContent);
        
        // Padrões melhorados para capturar números com > e diferentes formatos
        const patterns = [
          />\s*(\d+)\s*resultados?/gi,  // >50 000 resultados
          /(\d+)\s*resultados?/gi,      // 50 000 resultados
          />\s*(\d+)\s*results?/gi,    // >50 000 results
          /(\d+)\s*results?/gi,         // 50 000 results
          />\s*(\d+)\s*anúncios?/gi,   // >50 000 anúncios
          /(\d+)\s*anúncios?/gi         // 50 000 anúncios
        ];
        
        for (const pattern of patterns) {
          const matches = pageText.match(pattern);
          if (matches && matches.length > 0) {
            const firstMatch = matches[0].match(/(\d+)/);
            if (firstMatch) {
              const number = parseInt(firstMatch[1].replace(/[.,\s]/g, ''));
              if (number > 0) {
                activeAds = number;
                console.log(`✅ Número encontrado no texto: ${activeAds} (padrão: ${pattern})`);
                break;
              }
            }
          }
        }
      }
      
    } catch (error) {
      console.log(`⚠️ Erro ao extrair número: ${error.message}`);
    }
    
    await browser.close();
    
    console.log(`✅ Scraping concluído: ${activeAds} anúncios encontrados`);
    return activeAds;
    
  } catch (error) {
    console.error(`❌ Erro no scraping: ${error.message}`);
    return -1;
  }
}

// Inicializar sistema automático de scraping
// DESABILITADO TEMPORARIAMENTE - CronScheduler usa SQLite mas o projeto usa Supabase
// const cronScheduler = new CronScheduler();
// console.log('🕷️ Iniciando sistema automático de scraping...');
// cronScheduler.start();
console.log('⚠️ Sistema de scraping automático desabilitado (incompatibilidade SQLite/Supabase)');

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true
}));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'apps/web/out')));

// Middleware de autenticação para admin
function isAdmin(req, res, next) {
  if (req.user && req.user.email === 'directbpsquad@gmail.com') {
    next();
  } else {
    res.status(403).json({ error: 'Acesso negado. Apenas administradores.' });
  }
}

// Rotas de Admin
app.get('/api/admin/users', authenticateToken, isAdmin, async (req, res) => {
  try {
    console.log('👑 Admin buscando usuários...');
    
    const axios = require('axios');
    const SUPABASE_URL = 'https://kpnhedyyxgodfgzqggdx.supabase.co';
    const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtwbmhlZHl5eGdvZGZnenFnZ2R4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MDIwNTI3NywiZXhwIjoyMDc1NzgxMjc3fQ.0hHQ62SD1y-6-fgJRIh1xAeojo19Y2gvieYd26hEdT0';
    
    const response = await axios.get(`${SUPABASE_URL}/rest/v1/users?select=id,email,name,created_at&order=created_at.desc`, {
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`
      }
    });
    
    console.log(`✅ Encontrados ${response.data.length} usuários`);
    res.json(response.data);
    
  } catch (error) {
    console.error('❌ Erro ao buscar usuários:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

app.get('/api/admin/libraries', authenticateToken, isAdmin, async (req, res) => {
  try {
    console.log('👑 Admin buscando bibliotecas mais escaladas...');
    
    const axios = require('axios');
    const SUPABASE_URL = 'https://kpnhedyyxgodfgzqggdx.supabase.co';
    const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtwbmhlZHl5eGdvZGZnenFnZ2R4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MDIwNTI3NywiZXhwIjoyMDc1NzgxMjc3fQ.0hHQ62SD1y-6-fgJRIh1xAeojo19Y2gvieYd26hEdT0';
    
    const response = await axios.get(`${SUPABASE_URL}/rest/v1/libraries?select=id,name,active_ads,source_type,source_value,country,language,nichos,estrategias,produtos,created_at,user_id&order=active_ads.desc,created_at.desc`, {
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`
      }
    });
    
    console.log(`✅ Encontradas ${response.data.length} bibliotecas`);
    res.json(response.data);
    
  } catch (error) {
    console.error('❌ Erro ao buscar bibliotecas:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Rotas principais
app.get('/api/test', (req, res) => {
  res.json({ message: 'API funcionando!', timestamp: new Date().toISOString() });
});

app.get('/api/libraries', authenticateToken, async (req, res) => {
  try {
    console.log('📚 Buscando bibliotecas do usuário...');
    console.log('👤 Usuário ID:', req.user.userId);
    console.log('🔍 Filtros aplicados:', req.query);
    const libraries = await getUserLibraries(req.user.userId, req.query);
    console.log(`✅ Encontradas ${libraries.length} bibliotecas`);
    res.json(libraries);
  } catch (error) {
    console.error('❌ Erro ao buscar bibliotecas:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Endpoint para criar biblioteca
app.post('/api/libraries', authenticateToken, async (req, res) => {
  try {
    console.log('📚 Criando nova biblioteca...');
    console.log('👤 Usuário:', req.user.email);
    console.log('📝 Dados:', req.body);
    
    const axios = require('axios');
    const SUPABASE_URL = 'https://kpnhedyyxgodfgzqggdx.supabase.co';
    const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtwbmhlZHl5eGdvZGZnenFnZ2R4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MDIwNTI3NywiZXhwIjoyMDc1NzgxMjc3fQ.0hHQ62SD1y-6-fgJRIh1xAeojo19Y2gvieYd26hEdT0';
    
    // Verificar se já existe uma biblioteca com o mesmo link
    if (req.body.sourceValue) {
      console.log('🔍 Verificando se o link já existe...');
      const existingLibraryResponse = await axios.get(`${SUPABASE_URL}/rest/v1/libraries?source_value=eq.${encodeURIComponent(req.body.sourceValue)}&user_id=eq.${req.user.userId}`, {
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${SUPABASE_KEY}`
        }
      });
      
      if (existingLibraryResponse.data && existingLibraryResponse.data.length > 0) {
        console.log('❌ Link já existe:', req.body.sourceValue);
        return res.status(400).json({ 
          error: 'Erro, esse link já existe no sistema',
          details: 'Uma biblioteca com este link já foi adicionada anteriormente'
        });
      }
      console.log('✅ Link único, pode prosseguir');
    }
    
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
    
    console.log('✅ Biblioteca criada com sucesso');
    console.log('📋 Biblioteca criada:', response.data);
    
    // 🚀 SCRAPING AUTOMÁTICO IMEDIATO para nova biblioteca
    if (req.body.sourceValue) {
      console.log('🕷️ Iniciando scraping automático para nova biblioteca...');
      
      try {
        const activeAds = await scrapeFacebookAds(req.body.sourceValue);
        console.log(`✅ Scraping automático concluído: ${activeAds} anúncios encontrados`);
        
        // Atualizar a biblioteca com os números reais usando o sourceValue para encontrar
        if (activeAds >= 0) {
          await axios.patch(`${SUPABASE_URL}/rest/v1/libraries?source_value=eq.${encodeURIComponent(req.body.sourceValue)}&user_id=eq.${req.user.userId}`, {
            active_ads: activeAds,
            last_checked_at: new Date().toISOString()
          }, {
            headers: {
              'apikey': SUPABASE_KEY,
              'Authorization': `Bearer ${SUPABASE_KEY}`,
              'Content-Type': 'application/json'
            }
          });
          console.log(`📊 Biblioteca atualizada com ${activeAds} anúncios ativos`);
        }
      } catch (scrapeError) {
        console.log('⚠️ Erro no scraping automático:', scrapeError.message);
        // Não falha a criação da biblioteca se o scraping falhar
      }
    }
    
    res.json({ success: true, library: response.data });

  } catch (error) {
    console.error('❌ Erro ao criar biblioteca:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Endpoint para atualizar biblioteca
app.put('/api/libraries/:id', authenticateToken, async (req, res) => {
  try {
    console.log(`📚 Atualizando biblioteca ${req.params.id}...`);
    console.log('👤 Usuário:', req.user.email);
    console.log('📝 Dados:', req.body);
    
    const axios = require('axios');
    const SUPABASE_URL = 'https://kpnhedyyxgodfgzqggdx.supabase.co';
    const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtwbmhlZHl5eGdvZGZnenFnZ2R4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MDIwNTI3NywiZXhwIjoyMDc1NzgxMjc3fQ.0hHQ62SD1y-6-fgJRIh1xAeojo19Y2gvieYd26hEdT0';
    
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
    
    const response = await axios.patch(`${SUPABASE_URL}/rest/v1/libraries?id=eq.${req.params.id}&user_id=eq.${req.user.userId}`, updateData, {
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json'
      }
    });
    
    console.log('✅ Biblioteca atualizada com sucesso');
    res.json({ success: true });
    
  } catch (error) {
    console.error('❌ Erro ao atualizar biblioteca:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Endpoint para deletar biblioteca
app.delete('/api/libraries/:id', authenticateToken, async (req, res) => {
  try {
    console.log(`🗑️ Deletando biblioteca ${req.params.id}...`);
    console.log('👤 Usuário:', req.user.email);
    
    const axios = require('axios');
    const SUPABASE_URL = 'https://kpnhedyyxgodfgzqggdx.supabase.co';
    const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtwbmhlZHl5eGdvZGZnenFnZ2R4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MDIwNTI3NywiZXhwIjoyMDc1NzgxMjc3fQ.0hHQ62SD1y-6-fgJRIh1xAeojo19Y2gvieYd26hEdT0';
    
    // Deletar páginas primeiro
    await axios.delete(`${SUPABASE_URL}/rest/v1/pages?library_id=eq.${req.params.id}`, {
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`
      }
    });
    
    // Deletar biblioteca
    await axios.delete(`${SUPABASE_URL}/rest/v1/libraries?id=eq.${req.params.id}&user_id=eq.${req.user.userId}`, {
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`
      }
    });
    
    console.log('✅ Biblioteca deletada com sucesso');
    res.json({ success: true });
    
  } catch (error) {
    console.error('❌ Erro ao deletar biblioteca:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Endpoint para refresh de biblioteca individual
app.post('/api/libraries/:id/refresh', authenticateToken, async (req, res) => {
  try {
    console.log(`🔄 Atualizando biblioteca ${req.params.id}...`);
    console.log('👤 Usuário:', req.user.email);
    
    const axios = require('axios');
    const SUPABASE_URL = 'https://kpnhedyyxgodfgzqggdx.supabase.co';
    const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtwbmhlZHl5eGdvZGZnenFnZ2R4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MDIwNTI3NywiZXhwIjoyMDc1NzgxMjc3fQ.0hHQ62SD1y-6-fgJRIh1xAeojo19Y2gvieYd26hEdT0';
    
    // Buscar biblioteca para verificar se existe e pertence ao usuário
    const libraryResponse = await axios.get(`${SUPABASE_URL}/rest/v1/libraries?id=eq.${req.params.id}&user_id=eq.${req.user.userId}`, {
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`
      }
    });
    
    if (!libraryResponse.data || libraryResponse.data.length === 0) {
        return res.status(404).json({ error: 'Biblioteca não encontrada' });
      }

    const library = libraryResponse.data[0];
    
    // Simular atualização (atualizar timestamp)
    await axios.patch(`${SUPABASE_URL}/rest/v1/libraries?id=eq.${req.params.id}`, {
      updated_at: new Date().toISOString()
    }, {
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json'
      }
    });
    
    console.log('✅ Biblioteca atualizada com sucesso');
      res.json({ 
      success: true, 
        message: 'Biblioteca atualizada com sucesso',
      library: {
        id: library.id,
        name: library.name,
        updated_at: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('❌ Erro ao atualizar biblioteca:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Endpoint para verificar status do cron scheduler
app.get('/api/scraping/status', authenticateToken, (req, res) => {
  try {
    // Cron desabilitado temporariamente
    res.json({
      success: true,
      isRunning: false,
      nextExecution: null,
      schedule: [],
      message: 'Sistema de scraping automático desabilitado (use refresh manual)'
    });
  } catch (error) {
    console.error('❌ Erro ao verificar status do cron:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Endpoint para refresh de todas as bibliotecas
app.post('/api/libraries/refresh-all', authenticateToken, async (req, res) => {
  try {
    console.log('🔄 Atualizando todas as bibliotecas...');
    console.log('👤 Usuário:', req.user.email);
    
    const axios = require('axios');
    const SUPABASE_URL = 'https://kpnhedyyxgodfgzqggdx.supabase.co';
    const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtwbmhlZHl5eGdvZGZnenFnZ2R4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MDIwNTI3NywiZXhwIjoyMDc1NzgxMjc3fQ.0hHQ62SD1y-6-fgJRIh1xAeojo19Y2gvieYd26hEdT0';
    
    // Buscar todas as bibliotecas do usuário
    const librariesResponse = await axios.get(`${SUPABASE_URL}/rest/v1/libraries?user_id=eq.${req.user.userId}`, {
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`
      }
    });
    
    const libraries = librariesResponse.data || [];
    
    // Executar scraping para cada biblioteca usando sistema direto
    let updatedCount = 0;
    for (const library of libraries) {
      try {
        console.log(`🕷️ Executando scraping para: ${library.name}`);
        console.log(`🔗 URL: ${library.source_value}`);
        
        // Usar o sistema de scraping direto
        const activeAds = await scrapeFacebookAds(library.source_value);
        
        if (activeAds >= 0) {
          // Atualizar no Supabase
          await axios.patch(`${SUPABASE_URL}/rest/v1/libraries?id=eq.${library.id}`, {
            active_ads: activeAds,
            last_checked_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          }, {
            headers: {
              'apikey': SUPABASE_KEY,
              'Authorization': `Bearer ${SUPABASE_KEY}`,
              'Content-Type': 'application/json'
            }
          });
          
          updatedCount++;
          console.log(`✅ ${library.name}: ${activeAds} anúncios ativos`);
        } else {
          console.log(`❌ ${library.name}: Erro no scraping`);
        }
      } catch (error) {
        console.error(`❌ Erro ao atualizar ${library.name}:`, error.message);
      }
    }
    
    console.log(`✅ Scraping concluído: ${updatedCount}/${libraries.length} bibliotecas atualizadas`);
    res.json({ 
      success: true, 
      message: `${updatedCount} bibliotecas atualizadas com sucesso`,
      updated: updatedCount,
      total: libraries.length
    });
    
  } catch (error) {
    console.error('❌ Erro ao executar scraping:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Endpoint para pastas
app.get('/api/folders', authenticateToken, async (req, res) => {
  try {
    console.log('📁 Buscando pastas do usuário...');
    const folders = await getUserFolders(req.user.userId);
    console.log(`✅ Encontradas ${folders.length} pastas`);
    res.json(folders);
  } catch (error) {
    console.error('❌ Erro ao buscar pastas:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

app.post('/api/folders', authenticateToken, async (req, res) => {
  try {
    console.log('📁 Criando nova pasta...');
    const folder = await createFolder(req.user.userId, req.body.name);
    console.log('✅ Pasta criada com sucesso');
    res.json(folder);
  } catch (error) {
    console.error('❌ Erro ao criar pasta:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

app.put('/api/folders/:id', authenticateToken, async (req, res) => {
  try {
    console.log(`📁 Atualizando pasta ${req.params.id}...`);
    await updateFolder(req.params.id, req.user.userId, req.body.name);
    console.log('✅ Pasta atualizada com sucesso');
    res.json({ success: true });
  } catch (error) {
    console.error('❌ Erro ao atualizar pasta:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

app.delete('/api/folders/:id', authenticateToken, async (req, res) => {
  try {
    console.log(`🗑️ Deletando pasta ${req.params.id}...`);
    await deleteFolder(req.params.id, req.user.userId);
    console.log('✅ Pasta deletada com sucesso');
    res.json({ success: true });
  } catch (error) {
    console.error('❌ Erro ao deletar pasta:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Endpoint para opções de filtro
app.get('/api/filter-options/:type', authenticateToken, async (req, res) => {
  try {
    console.log(`🔍 Buscando opções de filtro para: ${req.params.type}`);
    const options = await getFilterOptions(req.params.type);
    console.log(`✅ Encontradas ${options.length} opções para ${req.params.type}:`, options);
    res.json(options);
  } catch (error) {
    console.error('❌ Erro ao buscar opções de filtro:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Endpoint para adicionar opção de filtro
app.post('/api/filter-options', authenticateToken, async (req, res) => {
  try {
    console.log('🔍 Adicionando nova opção de filtro...');
    console.log('📝 Dados:', req.body);
    
    const axios = require('axios');
    const SUPABASE_URL = 'https://kpnhedyyxgodfgzqggdx.supabase.co';
    const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtwbmhlZHl5eGdvZGZnenFnZ2R4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MDIwNTI3NywiZXhwIjoyMDc1NzgxMjc3fQ.0hHQ62SD1y-6-fgJRIh1xAeojo19Y2gvieYd26hEdT0';
    
    const filterData = {
      type: req.body.type,
      value: req.body.value,
      created_at: new Date().toISOString()
    };
    
    const response = await axios.post(`${SUPABASE_URL}/rest/v1/filter_options`, filterData, {
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'resolution=ignore-duplicates'
      }
    });
    
    console.log('✅ Opção de filtro adicionada com sucesso');
    res.json({ success: true });
    
  } catch (error) {
    console.error('❌ Erro ao adicionar opção de filtro:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Endpoint para deletar opção de filtro
app.delete('/api/filter-options/:type/:value', authenticateToken, async (req, res) => {
  try {
    console.log(`🗑️ Deletando opção de filtro: ${req.params.type} = ${req.params.value}`);
    
    const axios = require('axios');
    const SUPABASE_URL = 'https://kpnhedyyxgodfgzqggdx.supabase.co';
    const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtwbmhlZHl5eGdvZGZnenFnZ2R4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MDIwNTI3NywiZXhwIjoyMDc1NzgxMjc3fQ.0hHQ62SD1y-6-fgJRIh1xAeojo19Y2gvieYd26hEdT0';
    
    await axios.delete(`${SUPABASE_URL}/rest/v1/filter_options?type=eq.${req.params.type}&value=eq.${req.params.value}`, {
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`
      }
    });
    
    console.log('✅ Opção de filtro deletada com sucesso');
    res.json({ success: true });
    
  } catch (error) {
    console.error('❌ Erro ao deletar opção de filtro:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Rotas de autenticação
app.post('/api/auth/register', async (req, res) => {
  try {
    console.log('👤 Registrando novo usuário...');
    const result = await registerUser(req.body.email, req.body.password, req.body.name);
    console.log('✅ Usuário registrado com sucesso');
    res.json(result);
  } catch (error) {
    console.error('❌ Erro ao registrar usuário:', error);
    res.status(400).json({ error: error.message });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    console.log('🔐 Tentativa de login...');
    console.log('📧 Email recebido:', req.body.email);
    console.log('🔑 Senha recebida (comprimento):', req.body.password ? req.body.password.length : 0);
    
    const result = await loginUser(req.body.email, req.body.password);
    console.log('✅ Login realizado com sucesso');
    res.json(result);
  } catch (error) {
    console.error('❌ Erro ao fazer login:', error.message);
    res.status(401).json({ error: error.message });
  }
});

app.get('/api/auth/verify', authenticateToken, async (req, res) => {
  try {
    console.log('🔍 Verificando token...');
    const userData = await getUserData(req.user.userId);
    console.log('✅ Token válido');
    res.json({ 
      valid: true, 
      user: {
        id: req.user.userId,
        email: req.user.email
      }
    });
  } catch (error) {
    console.error('❌ Token inválido:', error);
    res.status(401).json({ error: 'Token inválido' });
  }
});

app.get('/api/auth/me', authenticateToken, async (req, res) => {
  try {
    console.log('👤 Buscando dados do usuário...');
    const userData = await getUserData(req.user.userId);
    console.log('✅ Dados do usuário encontrados');
    res.json(userData);
  } catch (error) {
    console.error('❌ Erro ao buscar dados do usuário:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Rota para plano atual do Stripe (mock)
app.get('/api/stripe/current-plan', authenticateToken, async (req, res) => {
  try {
    console.log('💳 Buscando plano atual...');
    res.json({
      plan: 'premium',
      status: 'active',
      features: ['unlimited_libraries', 'advanced_filters', 'priority_support']
    });
  } catch (error) {
    console.error('❌ Erro ao buscar plano:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Middleware para servir arquivos estáticos do Next.js
app.get('*', (req, res) => {
  // Redirecionar para o frontend se não for uma rota da API
  if (!req.path.startsWith('/api/')) {
    res.redirect('http://localhost:3000');
  } else {
    res.status(404).json({ error: 'Rota não encontrada' });
  }
});

// Iniciar servidor
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Servidor rodando na porta ${PORT}`);
  console.log(`📊 API disponível em: http://localhost:${PORT}/api`);
  console.log('🧪 Executando primeira verificação...');
  
  // Verificação inicial
  setTimeout(async () => {
    try {
      console.log('📚 Buscando bibliotecas do usuário...');
      console.log('👤 Usuário: directbpsquad@gmail.com');
      console.log('🔍 Filtros aplicados: {}');
      const libraries = await getUserLibraries('user_1760225551168_1br2glm7v', {});
      console.log(`✅ Encontradas ${libraries.length} bibliotecas`);
      
      console.log('🔍 Buscando opções de filtro para: status');
      console.log('🔍 Buscando opções de filtro para: nichos');
      const statusOptions = await getFilterOptions('status');
      const nichosOptions = await getFilterOptions('nichos');
      console.log(`✅ Encontradas ${statusOptions.length} opções para status:`, statusOptions);
      console.log(`✅ Encontradas ${nichosOptions.length} opções para nichos:`, nichosOptions);
      
      console.log('🔍 Buscando opções de filtro para: estrategias');
      console.log('🔍 Buscando opções de filtro para: idiomas');
      const estrategiasOptions = await getFilterOptions('estrategias');
      const idiomasOptions = await getFilterOptions('idiomas');
      console.log(`✅ Encontradas ${estrategiasOptions.length} opções para estrategias:`, estrategiasOptions);
      console.log(`✅ Encontradas ${idiomasOptions.length} opções para idiomas:`, idiomasOptions);
      
      console.log('🔍 Buscando opções de filtro para: produtos');
      console.log('🔍 Buscando opções de filtro para: paises');
      const produtosOptions = await getFilterOptions('produtos');
      const paisesOptions = await getFilterOptions('paises');
      console.log(`✅ Encontradas ${produtosOptions.length} opções para produtos:`, produtosOptions);
      console.log(`✅ Encontradas ${paisesOptions.length} opções para paises:`, paisesOptions);
      
    } catch (error) {
      console.error('❌ Erro na verificação inicial:', error);
    }
  }, 1000);
});