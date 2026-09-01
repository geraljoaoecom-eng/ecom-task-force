const express = require('express');
const cors = require('cors');
const path = require('path');
const { authenticateToken, registerUser, loginUser, getUserLibraries, getUserFolders } = require('./apps/api/auth');

const app = express();

// Configurações de produção
const PORT = process.env.PORT || 4000;
const NODE_ENV = process.env.NODE_ENV || 'development';
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';

// Middleware
app.use(cors({
  origin: NODE_ENV === 'production' ? FRONTEND_URL : true,
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

console.log(`🚀 Iniciando servidor em modo ${NODE_ENV}`);
console.log(`🌐 Frontend URL: ${FRONTEND_URL}`);

// Importar todas as rotas do servidor original
const sqlite3 = require('sqlite3').verbose();
const dbPath = process.env.DATABASE_URL 
  ? process.env.DATABASE_URL.replace('file:', '') 
  : path.join(__dirname, 'atlas.db');

// Função para buscar bibliotecas com filtros
function getAllLibraries(filters = {}) {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(dbPath, (err) => {
      if (err) {
        console.error('❌ Erro ao conectar ao banco:', err.message);
        reject(err);
        return;
      }
    });

    let whereConditions = [];
    let params = [];

    if (filters.q && filters.q.trim()) {
      whereConditions.push('l.name LIKE ?');
      params.push(`%${filters.q.trim()}%`);
    }

    if (filters.folderId && filters.folderId !== '') {
      whereConditions.push('l.folderId = ?');
      params.push(filters.folderId);
    }

    if (filters.status && filters.status !== '') {
      if (filters.status === 'ativo') {
        whereConditions.push('l.status = ?');
        params.push('active');
      } else if (filters.status === 'inativo') {
        whereConditions.push('(l.status IS NULL OR l.status != ?)');
        params.push('active');
      }
    }

    if (filters.nichos && filters.nichos !== '') {
      whereConditions.push('l.nichos LIKE ?');
      params.push(`%${filters.nichos}%`);
    }

    if (filters.estrategias && filters.estrategias !== '') {
      whereConditions.push('l.estrategias LIKE ?');
      params.push(`%${filters.estrategias}%`);
    }

    if (filters.produtos && filters.produtos !== '') {
      whereConditions.push('l.produtos LIKE ?');
      params.push(`%${filters.produtos}%`);
    }

    if (filters.idiomas && filters.idiomas !== '') {
      whereConditions.push('l.idiomas LIKE ?');
      params.push(`%${filters.idiomas}%`);
    }

    if (filters.paises && filters.paises !== '') {
      whereConditions.push('l.paises LIKE ?');
      params.push(`%${filters.paises}%`);
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    const query = `
      SELECT
        l.*,
        f.name as folder_name,
        GROUP_CONCAT(p.url) as page_urls
      FROM Library l
      LEFT JOIN Folder f ON l.folderId = f.id
      LEFT JOIN Page p ON l.id = p.libraryId
      ${whereClause}
      GROUP BY l.id
      ORDER BY l.activeAds DESC
    `;

    db.all(query, params, (err, rows) => {
      if (err) {
        console.error('❌ Erro ao buscar bibliotecas:', err.message);
        db.close();
        return reject(err);
      }

      const libraries = rows.map(row => ({
        id: row.id,
        name: row.name,
        sourceType: row.sourceType,
        sourceValue: row.sourceValue,
        country: row.country,
        language: row.language,
        activeAds: row.activeAds,
        folder: row.folder_name ? { name: row.folder_name } : null,
        pages: row.page_urls ? row.page_urls.split(',').map(url => ({ url })) : [],
        nichos: row.nichos,
        estrategias: row.estrategias,
        produtos: row.produtos,
        idiomas: row.idiomas,
        paises: row.paises,
        status: row.status,
        tipos: row.tipos,
        nota: row.nota,
        notes: row.notes,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
        lastCheckedAt: row.lastCheckedAt
      }));

      db.close();
      resolve(libraries);
    });
  });
}

// Função para buscar pastas
function getAllFolders() {
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
        f.id,
        f.name,
        f.createdAt,
        COUNT(l.id) as libraryCount,
        GROUP_CONCAT(l.id) as libraryIds
      FROM Folder f
      LEFT JOIN Library l ON f.id = l.folderId
      GROUP BY f.id, f.name, f.createdAt
      ORDER BY f.name
    `;

    db.all(query, [], (err, rows) => {
      if (err) {
        console.error('❌ Erro ao buscar pastas:', err.message);
        db.close();
        return reject(err);
      }

      const foldersWithLibraries = rows.map(folder => ({
        ...folder,
        libraries: folder.libraryIds ? folder.libraryIds.split(',') : []
      }));

      db.close();
      resolve(foldersWithLibraries);
    });
  });
}

// Função para buscar opções de filtro
function getFilterOptions() {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(dbPath, (err) => {
      if (err) {
        console.error('❌ Erro ao conectar ao banco:', err.message);
        reject(err);
        return;
      }
    });

    const query = `
      SELECT type, value, COUNT(*) as count
      FROM FilterOption
      GROUP BY type, value
      ORDER BY type, count DESC
    `;

    db.all(query, [], (err, rows) => {
      if (err) {
        console.error('❌ Erro ao buscar opções de filtro:', err.message);
        db.close();
        return reject(err);
      }

      const options = {};
      rows.forEach(row => {
        if (!options[row.type]) {
          options[row.type] = [];
        }
        options[row.type].push({
          value: row.value,
          count: row.count
        });
      });

      db.close();
      resolve(options);
    });
  });
}

// Middleware para verificar se é admin
function isAdmin(req, res, next) {
  if (req.user.email === 'directbpsquad@gmail.com') {
    next();
  } else {
    res.status(403).json({ error: 'Acesso negado. Apenas administradores.' });
  }
}

// Rotas de Autenticação
app.post('/api/auth/register', async (req, res) => {
  try {
    const { email, password, name } = req.body;
    console.log('👤 Registrando novo usuário...');

    if (!email || !password) {
      return res.status(400).json({ error: 'Email e senha são obrigatórios' });
    }

    const user = await registerUser(email, password, name);
    res.status(201).json({
      message: 'Usuário registrado com sucesso',
      user: { id: user.id, email: user.email, name: user.name }
    });
  } catch (error) {
    console.error('❌ Erro ao registrar usuário:', error);
    if (error.message === 'Usuário já existe') {
      res.status(409).json({ error: 'Usuário já existe' });
    } else {
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    console.log('🔐 Fazendo login...');

    if (!email || !password) {
      return res.status(400).json({ error: 'Email e senha são obrigatórios' });
    }

    const result = await loginUser(email, password);
    res.json({
      message: 'Login realizado com sucesso',
      user: { id: result.id, email: result.email, name: result.name },
      token: result.token
    });
  } catch (error) {
    console.error('❌ Erro ao fazer login:', error);
    if (error.message === 'Usuário não encontrado' || error.message === 'Senha incorreta') {
      res.status(401).json({ error: 'Credenciais inválidas' });
    } else {
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  }
});

app.get('/api/auth/verify', authenticateToken, (req, res) => {
  res.json({
    valid: true,
    user: { id: req.user.id, email: req.user.email }
  });
});

// Rotas protegidas (requerem autenticação)
app.get('/api/libraries', authenticateToken, async (req, res) => {
  try {
    console.log('📚 Buscando bibliotecas do usuário...');
    const filters = req.query;
    const libraries = await getUserLibraries(req.user.id, filters);
    console.log(`✅ Encontradas ${libraries.length} bibliotecas`);
    res.json(libraries);
  } catch (error) {
    console.error('❌ Erro ao buscar bibliotecas:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

app.get('/api/folders', authenticateToken, async (req, res) => {
  try {
    console.log('📁 Buscando pastas do usuário...');
    const folders = await getUserFolders(req.user.id);
    console.log(`✅ Encontradas ${folders.length} pastas`);
    res.json(folders);
  } catch (error) {
    console.error('❌ Erro ao buscar pastas:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

app.get('/api/filter-options', authenticateToken, async (req, res) => {
  try {
    console.log('🔍 Buscando opções de filtro...');
    const options = await getFilterOptions();
    console.log('✅ Opções de filtro carregadas');
    res.json(options);
  } catch (error) {
    console.error('❌ Erro ao buscar opções de filtro:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Rotas de Admin
app.get('/api/admin/users', authenticateToken, isAdmin, async (req, res) => {
  try {
    console.log('👑 Admin buscando usuários...');

    const db = new sqlite3.Database(dbPath);

    const query = `
      SELECT
        u.id,
        u.email,
        u.name,
        u.createdAt,
        COUNT(DISTINCT l.id) as librariesCount,
        COUNT(DISTINCT f.id) as foldersCount
      FROM User u
      LEFT JOIN Library l ON u.id = l.userId
      LEFT JOIN Folder f ON u.id = f.userId
      GROUP BY u.id, u.email, u.name, u.createdAt
      ORDER BY u.createdAt DESC
    `;

    db.all(query, [], (err, rows) => {
      if (err) {
        console.error('❌ Erro ao buscar usuários:', err.message);
        db.close();
        return res.status(500).json({ error: 'Erro interno do servidor' });
      }

      console.log(`✅ Encontrados ${rows.length} usuários`);
      db.close();
      res.json(rows);
    });
  } catch (error) {
    console.error('❌ Erro ao buscar usuários:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

app.get('/api/admin/libraries', authenticateToken, isAdmin, async (req, res) => {
  try {
    console.log('👑 Admin buscando bibliotecas mais escaladas...');

    const db = new sqlite3.Database(dbPath);

    const query = `
      SELECT
        l.id,
        l.name,
        l.activeAds,
        l.sourceType,
        l.sourceValue,
        l.country,
        l.language,
        l.nichos,
        l.estrategias,
        l.produtos,
        l.createdAt,
        u.email as userEmail,
        u.name as userName
      FROM Library l
      JOIN User u ON l.userId = u.id
      ORDER BY l.activeAds DESC, l.createdAt DESC
    `;

    db.all(query, [], (err, rows) => {
      if (err) {
        console.error('❌ Erro ao buscar bibliotecas:', err.message);
        db.close();
        return res.status(500).json({ error: 'Erro interno do servidor' });
      }

      console.log(`✅ Encontradas ${rows.length} bibliotecas`);
      db.close();
      res.json(rows);
    });
  } catch (error) {
    console.error('❌ Erro ao buscar bibliotecas:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Rota de health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    environment: NODE_ENV,
    database: dbPath
  });
});

// Para produção na Hostinger, servir arquivos estáticos
if (NODE_ENV === 'production') {
  // Servir arquivos estáticos do Next.js
  app.use(express.static(path.join(__dirname, 'apps/web/.next/static')));
  app.use(express.static(path.join(__dirname, 'apps/web/public')));
  
  // Para todas as outras rotas, servir o index.html
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'apps/web/.next/server/pages/index.html'));
  });
}

// Iniciar servidor
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Servidor rodando na porta ${PORT}`);
  console.log(`🌐 Modo: ${NODE_ENV}`);
  console.log(`📊 Banco: ${dbPath}`);
});
