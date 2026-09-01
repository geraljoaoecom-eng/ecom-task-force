require('dotenv').config({ path: './env-config' });

const express = require('express');
const cors = require('cors');
const path = require('path');
const { authenticateToken, registerUser, loginUser, getUserData } = require('./apps/api/auth-supabase');
const { getUserLibraries, getUserFolders, createFolder, updateFolder, deleteFolder, getFilterOptions } = require('./apps/api/supabase-helpers');
const { 
  createCheckoutSession, 
  createPortalSession, 
  handleStripeWebhook, 
  checkLibraryLimit, 
  getUserCurrentPlan, 
  getUserSubscriptions 
} = require('./apps/api/stripe-service');
const LibraryUpdateService = require('./apps/api/library-update-service');
const CronScheduler = require('./apps/api/cron-scheduler');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

const dbPath = path.join(__dirname, 'atlas.db');

// Inicializar serviços
const updateService = new LibraryUpdateService();
const cronScheduler = new CronScheduler();

// Iniciar cron automático
cronScheduler.start();







// Rotas de Autenticação
app.post('/api/auth/register', registerUser);

app.post('/api/auth/login', loginUser);

app.get('/api/auth/user', authenticateToken, getUserData);

app.get('/api/auth/verify', authenticateToken, (req, res) => {
  res.json({
    valid: true,
    user: { id: req.user.id, email: req.user.email }
  });
});

// Middleware para proteger rotas
app.use('/api/libraries', authenticateToken);
app.use('/api/folders', authenticateToken);
app.use('/api/filter-options', authenticateToken);

// Middleware para verificar se é admin
function isAdmin(req, res, next) {
  if (req.user.email === 'directbpsquad@gmail.com') {
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

app.delete('/api/admin/users/:id', authenticateToken, isAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    console.log(`👑 Admin excluindo usuário: ${id}`);
    
    const db = new sqlite3.Database(dbPath);
    
    // Verificar se não é o próprio admin
    if (id === req.user.id) {
      db.close();
      return res.status(400).json({ error: 'Não é possível excluir o próprio usuário admin' });
    }
    
    // Excluir usuário (cascade vai excluir bibliotecas e pastas)
    const query = 'DELETE FROM User WHERE id = ?';
    
    db.run(query, [id], function(err) {
      if (err) {
        console.error('❌ Erro ao excluir usuário:', err.message);
        db.close();
        return res.status(500).json({ error: 'Erro ao excluir usuário' });
      }
      
      if (this.changes === 0) {
        console.log('❌ Usuário não encontrado');
        db.close();
        return res.status(404).json({ error: 'Usuário não encontrado' });
      }
      
      console.log(`✅ Usuário excluído: ${id}`);
      db.close();
      res.json({ success: true, message: 'Usuário excluído com sucesso' });
    });
  } catch (error) {
    console.error('❌ Erro ao excluir usuário:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Rotas
app.get('/api/test', (req, res) => {
  res.json({ message: 'API funcionando!', timestamp: new Date().toISOString() });
});

app.get('/api/libraries', async (req, res) => {
  try {
    console.log('📚 Buscando bibliotecas do usuário...');
    console.log('👤 Usuário:', req.user.email);
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
app.post('/api/libraries', async (req, res) => {
  try {
    console.log('📚 Criando nova biblioteca...');
    console.log('👤 Usuário:', req.user.email);
    console.log('📝 Dados recebidos:', req.body);
    
          const {
            name,
            nota,
            sourceType,
            sourceValue,
            country,
            language,
            notes,
            folderId,
            pages,
            nichos,
            estrategias,
            produtos,
            idiomas,
            paises
          } = req.body;

    if (!name || !sourceType || !sourceValue) {
      return res.status(400).json({ error: 'Nome, tipo de fonte e valor da fonte são obrigatórios' });
    }

    const db = new sqlite3.Database(dbPath);
    
    // Gerar ID único
    const libraryId = `lib_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
          // Inserir biblioteca
          const insertQuery = `
            INSERT INTO Library (
              id, name, nota, sourceType, sourceValue, country, language, 
              notes, folderId, userId, status, nichos, estrategias, produtos, 
              idiomas, paises, activeAds, createdAt, updatedAt
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, ?, ?, ?, 0, datetime('now'), datetime('now'))
          `;
          
          const params = [
            libraryId,
            name,
            nota || null,
            sourceType,
            sourceValue,
            country || null,
            language || null,
            notes || null,
            folderId || null,
            req.user.id,
            nichos || null,
            estrategias || null,
            produtos || null,
            idiomas || null,
            paises || null
          ];

    db.run(insertQuery, params, function(err) {
      if (err) {
        console.error('❌ Erro ao inserir biblioteca:', err.message);
        db.close();
        return res.status(500).json({ error: 'Erro ao criar biblioteca' });
      }

      console.log(`✅ Biblioteca criada com ID: ${libraryId}`);

      // Inserir páginas se fornecidas
      if (pages && pages.length > 0 && pages[0].trim()) {
        const pageInsertQuery = 'INSERT INTO Page (id, libraryId, url) VALUES (?, ?, ?)';
        
        pages.forEach((pageUrl, index) => {
          if (pageUrl && pageUrl.trim()) {
            const pageId = `page_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            db.run(pageInsertQuery, [pageId, libraryId, pageUrl.trim()], (err) => {
              if (err) {
                console.error(`❌ Erro ao inserir página ${index + 1}:`, err.message);
              } else {
                console.log(`✅ Página ${index + 1} inserida: ${pageUrl.trim()}`);
              }
            });
          }
        });
      }

      db.close();
      
      res.status(201).json({ 
        id: libraryId, 
        message: 'Biblioteca criada com sucesso',
        name: name,
        crawlerExecuted: false
      });
      
      // Executar crawler automaticamente após criar a biblioteca (em background)
      console.log(`🕷️ Executando crawler automático para nova biblioteca: ${name}`);
      updateService.updateSingleLibrary(libraryId, req.user.id)
        .then(crawlerResult => {
          if (crawlerResult.success) {
            console.log(`✅ Crawler executado com sucesso: ${crawlerResult.activeAds} anúncios encontrados`);
          } else {
            console.log(`⚠️ Crawler falhou: ${crawlerResult.error}`);
          }
        })
        .catch(crawlerError => {
          console.error('❌ Erro no crawler automático:', crawlerError.message);
        });
    });

  } catch (error) {
    console.error('❌ Erro ao criar biblioteca:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Endpoint para atualizar biblioteca
app.put('/api/libraries/:id', async (req, res) => {
  try {
    console.log('📚 Atualizando biblioteca...');
    console.log('📝 ID:', req.params.id);
    console.log('📝 Dados recebidos:', req.body);
    
    const {
      name,
      nota,
      sourceValue,
      notes,
      folderId,
      nichos,
      estrategias,
      produtos,
      idiomas,
      paises,
      status
    } = req.body;

    // Para atualizações parciais, não exigir todos os campos obrigatórios
    // Apenas verificar se pelo menos um campo está sendo atualizado
    if (Object.keys(req.body).length === 0) {
      return res.status(400).json({ error: 'Pelo menos um campo deve ser fornecido para atualização' });
    }

    const db = new sqlite3.Database(dbPath);
    
    // Construir query dinamicamente baseada nos campos fornecidos
    const updateFields = [];
    const params = [];
    
    if (name !== undefined) {
      updateFields.push('name = ?');
      params.push(name);
    }
    if (nota !== undefined) {
      updateFields.push('nota = ?');
      params.push(nota);
    }
    if (sourceValue !== undefined) {
      updateFields.push('sourceValue = ?');
      params.push(sourceValue);
    }
    if (notes !== undefined) {
      updateFields.push('notes = ?');
      params.push(notes);
    }
    if (folderId !== undefined) {
      updateFields.push('folderId = ?');
      params.push(folderId);
    }
    if (nichos !== undefined) {
      updateFields.push('nichos = ?');
      params.push(nichos);
    }
    if (estrategias !== undefined) {
      updateFields.push('estrategias = ?');
      params.push(estrategias);
    }
    if (produtos !== undefined) {
      updateFields.push('produtos = ?');
      params.push(produtos);
    }
    if (idiomas !== undefined) {
      updateFields.push('idiomas = ?');
      params.push(idiomas);
    }
    if (paises !== undefined) {
      updateFields.push('paises = ?');
      params.push(paises);
    }
    if (status !== undefined) {
      updateFields.push('status = ?');
      params.push(status);
    }
    
    // Sempre atualizar updatedAt
    updateFields.push('updatedAt = datetime(\'now\')');
    params.push(req.params.id);
    
    const updateQuery = `UPDATE Library SET ${updateFields.join(', ')} WHERE id = ?`;

    db.run(updateQuery, params, function(err) {
      if (err) {
        console.error('❌ Erro ao atualizar biblioteca:', err.message);
        db.close();
        return res.status(500).json({ error: 'Erro ao atualizar biblioteca' });
      }

      if (this.changes === 0) {
        console.log('❌ Biblioteca não encontrada');
        db.close();
        return res.status(404).json({ error: 'Biblioteca não encontrada' });
      }

      console.log(`✅ Biblioteca atualizada: ${req.params.id}`);
      db.close();
      res.json({ 
        id: req.params.id, 
        message: 'Biblioteca atualizada com sucesso',
        name: name
      });
    });

  } catch (error) {
    console.error('❌ Erro ao atualizar biblioteca:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

app.get('/api/folders', async (req, res) => {
  try {
    console.log('📁 Buscando pastas do usuário...');
    console.log('👤 Usuário:', req.user.email);
    const folders = await getUserFolders(req.user.userId);
    console.log(`✅ Encontradas ${folders.length} pastas`);
    res.json(folders);
  } catch (error) {
    console.error('❌ Erro ao buscar pastas:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Criar nova pasta
app.post('/api/folders', async (req, res) => {
  try {
    const { name } = req.body;
    console.log(`📁 Criando pasta: ${name}`);
    console.log('👤 Usuário:', req.user.email);
    
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Nome da pasta é obrigatório' });
    }
    
    const folder = await createFolder(name.trim(), req.user.userId);
    console.log(`✅ Pasta criada com sucesso: ${folder.id}`);
    res.json(folder);
  } catch (error) {
    console.error('❌ Erro ao criar pasta:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Atualizar pasta
app.patch('/api/folders/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name } = req.body;
    console.log(`📁 Atualizando pasta ${id}: ${name}`);
    
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Nome da pasta é obrigatório' });
    }
    
    const folder = await updateFolder(id, name.trim());
    if (!folder) {
      return res.status(404).json({ error: 'Pasta não encontrada' });
    }
    
    console.log(`✅ Pasta atualizada com sucesso: ${id}`);
    res.json(folder);
  } catch (error) {
    console.error('❌ Erro ao atualizar pasta:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Excluir pasta
app.delete('/api/folders/:id', async (req, res) => {
  try {
    const { id } = req.params;
    console.log(`📁 Excluindo pasta: ${id}`);
    
    await deleteFolder(id);
    console.log(`✅ Pasta excluída com sucesso: ${id}`);
    res.json({ success: true });
  } catch (error) {
    console.error('❌ Erro ao excluir pasta:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

app.get('/api/filter-options/:field', async (req, res) => {
  try {
    const { field } = req.params;
    console.log(`🔍 Buscando opções de filtro para: ${field}`);
    const options = await getFilterOptions(field);
    console.log(`✅ Encontradas ${options.length} opções para ${field}:`, options);
    res.json(options);
  } catch (error) {
    console.error('❌ Erro ao buscar opções de filtro:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Endpoint para refresh de uma biblioteca específica
app.post('/api/libraries/:id/refresh', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    
    console.log(`🔄 Atualizando biblioteca: ${id} para usuário: ${userId}`);
    
    const result = await updateService.updateSingleLibrary(id, userId);
    
    if (result.success) {
      res.json({
        success: true,
        message: `Biblioteca "${result.libraryName}" atualizada com sucesso`,
        activeAds: result.activeAds,
        libraryName: result.libraryName
      });
    } else {
      res.status(500).json({
        success: false,
        error: result.error || 'Erro ao atualizar biblioteca'
      });
    }
    
  } catch (error) {
    console.error('❌ Erro ao atualizar biblioteca:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Endpoint para eliminar biblioteca
app.delete('/api/libraries/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    
    console.log(`🗑️ Eliminando biblioteca: ${id} para usuário: ${userId}`);
    
    const db = new sqlite3.Database(dbPath);
    
    // Primeiro verificar se a biblioteca existe e pertence ao usuário
    db.get('SELECT id, name FROM Library WHERE id = ? AND userId = ?', [id, userId], (err, library) => {
      if (err) {
        console.error('❌ Erro ao verificar biblioteca:', err.message);
        db.close();
        return res.status(500).json({ error: 'Erro interno do servidor' });
      }
      
      if (!library) {
        console.log('❌ Biblioteca não encontrada ou não pertence ao usuário');
        db.close();
        return res.status(404).json({ error: 'Biblioteca não encontrada' });
      }
      
      // Eliminar páginas associadas primeiro (devido à foreign key constraint)
      db.run('DELETE FROM Page WHERE libraryId = ?', [id], (err) => {
        if (err) {
          console.error('❌ Erro ao eliminar páginas:', err.message);
          db.close();
          return res.status(500).json({ error: 'Erro ao eliminar páginas da biblioteca' });
        }
        
        // Eliminar histórico de anúncios
        db.run('DELETE FROM AdHistory WHERE libraryId = ?', [id], (err) => {
          if (err) {
            console.error('❌ Erro ao eliminar histórico:', err.message);
            db.close();
            return res.status(500).json({ error: 'Erro ao eliminar histórico da biblioteca' });
          }
          
          // Finalmente eliminar a biblioteca
          db.run('DELETE FROM Library WHERE id = ?', [id], (err) => {
            if (err) {
              console.error('❌ Erro ao eliminar biblioteca:', err.message);
              db.close();
              return res.status(500).json({ error: 'Erro ao eliminar biblioteca' });
            }
            
            console.log(`✅ Biblioteca "${library.name}" eliminada com sucesso`);
            db.close();
            res.json({ 
              success: true,
              message: `Biblioteca "${library.name}" foi eliminada com sucesso`,
              id: id
            });
          });
        });
      });
    });
    
  } catch (error) {
    console.error('❌ Erro ao eliminar biblioteca:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Endpoint para refresh de todas as bibliotecas
app.post('/api/libraries/refresh-all', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    console.log(`🔄 Iniciando atualização de todas as bibliotecas do usuário: ${userId}`);
    
    const result = await updateService.updateUserLibraries(userId);
    
    if (result.success) {
      res.json({
        success: true,
        message: `Todas as ${result.totalLibraries} bibliotecas foram atualizadas com sucesso!`,
        librariesUpdated: result.totalLibraries,
        successCount: result.successCount,
        timestamp: new Date().toISOString()
      });
    } else {
      res.status(500).json({
        success: false,
        error: result.error || 'Erro ao atualizar bibliotecas'
      });
    }
    
  } catch (error) {
    console.error('❌ Erro ao atualizar todas as bibliotecas:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Endpoint para buscar biblioteca por ID
function getLibraryById(id) {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(dbPath, (err) => {
      if (err) {
        console.error('❌ Erro ao conectar ao banco:', err.message);
        reject(err);
        return;
      }
    });

    const query = `
      SELECT 
        l.*,
        f.name as folder_name,
        GROUP_CONCAT(p.url) as page_urls
      FROM Library l
      LEFT JOIN Folder f ON l.folderId = f.id
      LEFT JOIN Page p ON l.id = p.libraryId
      WHERE l.id = ?
      GROUP BY l.id
    `;

    db.get(query, [id], (err, row) => {
      if (err) {
        console.error('❌ Erro na query:', err.message);
        reject(err);
      } else if (row) {
        const library = {
          id: row.id,
          name: row.name,
          sourceType: row.sourceType,
          sourceValue: row.sourceValue,
          country: row.country,
          language: row.language,
          activeAds: row.activeAds,
          folder: row.folder_name ? { name: row.folder_name } : null,
          pages: row.page_urls ? row.page_urls.split(',').map(url => ({ url })) : [],
          nichos: row.nichos ? row.nichos.split(',') : [],
          estrategias: row.estrategias ? row.estrategias.split(',') : [],
          produtos: row.produtos ? row.produtos.split(',') : [],
          idiomas: row.idiomas ? row.idiomas.split(',') : [],
          paises: row.paises ? row.paises.split(',') : [],
          status: row.status,
          tipos: row.tipos ? row.tipos.split(',') : [],
          nota: row.nota,
          createdAt: row.createdAt,
          updatedAt: row.updatedAt
        };
        resolve(library);
      } else {
        resolve(null);
      }
      db.close();
    });
  });
}

// Endpoint para histórico de uma biblioteca
app.get('/api/libraries/:id/history', async (req, res) => {
  try {
    const { id } = req.params;
    const { days = 7 } = req.query;
    console.log(`📊 Buscando histórico da biblioteca: ${id} (${days} dias)`);
    
    // Simular dados de histórico (você pode implementar a lógica real aqui)
    const history = [];
    const today = new Date();
    
    for (let i = 0; i < parseInt(days); i++) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      
      history.push({
        date: date.toISOString().split('T')[0],
        adsCount: Math.floor(Math.random() * 20) + 5, // Simular dados
        libraryId: id
      });
    }
    
    console.log(`✅ Encontrados ${history.length} registros de histórico`);
    res.json(history);
  } catch (error) {
    console.error('❌ Erro ao buscar histórico:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Endpoint para status do cron (apenas admin)
app.get('/api/admin/cron-status', authenticateToken, isAdmin, (req, res) => {
  try {
    const status = cronScheduler.getStatus();
    res.json({
      success: true,
      cron: status
    });
  } catch (error) {
    console.error('❌ Erro ao buscar status do cron:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Endpoint para executar atualização manual (apenas admin)
app.post('/api/admin/update-all', authenticateToken, isAdmin, async (req, res) => {
  try {
    console.log('🔧 Executando atualização manual via admin...');
    
    const result = await cronScheduler.executeManualUpdate();
    
    res.json({
      success: true,
      message: 'Atualização manual executada',
      result: result
    });
  } catch (error) {
    console.error('❌ Erro na atualização manual:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Ativar conta após compra
app.post('/api/auth/activate', async (req, res) => {
  try {
    const { email, password, token } = req.body;
    
    if (!email || !password || !token) {
      return res.status(400).json({ error: 'Email, senha e token são obrigatórios' });
    }

    // Verificar se o token é válido (implementar lógica de verificação)
    // Por enquanto, vamos apenas criar a conta
    const hashedPassword = await bcrypt.hash(password, 10);
    
    const { data, error } = await supabase
      .from('users')
      .insert([{
        email,
        password: hashedPassword,
        name: email.split('@')[0] // Nome baseado no email
      }])
      .select();

    if (error) {
      if (error.code === '23505') { // Unique constraint violation
        return res.status(400).json({ error: 'Este email já possui uma conta ativa' });
      }
      throw error;
    }

    console.log(`✅ Conta ativada para: ${email}`);
    res.json({ 
      success: true, 
      message: 'Conta ativada com sucesso',
      user: data[0]
    });
  } catch (error) {
    console.error('❌ Erro ao ativar conta:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// ===== ROTAS STRIPE =====

// Criar checkout session (sem autenticação para novos clientes)
app.post('/api/stripe/create-checkout-session', async (req, res) => {
  try {
    const { priceId, planId, billingCycle } = req.body;
    
    if (!priceId || !planId || !billingCycle) {
      return res.status(400).json({ error: 'Parâmetros obrigatórios: priceId, planId, billingCycle' });
    }

    const session = await createCheckoutSession(null, priceId, planId, billingCycle);
    
    res.json({ 
      sessionId: session.id,
      url: session.url 
    });
  } catch (error) {
    console.error('❌ Erro ao criar checkout session:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Criar portal session (gerenciar assinatura)
app.post('/api/stripe/create-portal-session', authenticateToken, async (req, res) => {
  try {
    const session = await createPortalSession(req.user.userId);
    
    res.json({ 
      url: session.url 
    });
  } catch (error) {
    console.error('❌ Erro ao criar portal session:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Webhook do Stripe
app.post('/api/stripe/webhook', express.raw({ type: 'application/json' }), (req, res) => {
  handleStripeWebhook(req, res);
});

// Verificar limite de bibliotecas
app.get('/api/stripe/check-limit', authenticateToken, async (req, res) => {
  try {
    const canAddMore = await checkLibraryLimit(req.user.userId);
    
    res.json({ 
      canAddMore,
      message: canAddMore ? 'Pode adicionar mais bibliotecas' : 'Limite de bibliotecas atingido'
    });
  } catch (error) {
    console.error('❌ Erro ao verificar limite:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Buscar plano atual do usuário
app.get('/api/stripe/current-plan', authenticateToken, async (req, res) => {
  try {
    const plan = await getUserCurrentPlan(req.user.userId);
    
    res.json({ plan });
  } catch (error) {
    console.error('❌ Erro ao buscar plano atual:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Buscar assinaturas do usuário
app.get('/api/stripe/subscriptions', authenticateToken, async (req, res) => {
  try {
    const subscriptions = await getUserSubscriptions(req.user.userId);
    
    res.json({ subscriptions });
  } catch (error) {
    console.error('❌ Erro ao buscar assinaturas:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Buscar todos os planos disponíveis
app.get('/api/stripe/plans', async (req, res) => {
  try {
    const { createClient } = require('@supabase/supabase-js');
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const { data: plans, error } = await supabase
      .from('plans')
      .select('*')
      .eq('is_active', true)
      .order('price_monthly', { ascending: true });

    if (error) {
      throw error;
    }

    res.json({ plans: plans || [] });
  } catch (error) {
    console.error('❌ Erro ao buscar planos:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

const PORT = process.env.PORT || 4000;

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Servidor rodando na porta ${PORT}`);
  console.log(`📊 API disponível em: http://localhost:${PORT}/api`);
});
