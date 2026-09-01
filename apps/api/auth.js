const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '..', '..', 'atlas.db');
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

// Middleware para verificar token JWT
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Token de acesso necessário' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Token inválido' });
    }
    req.user = user;
    next();
  });
}

// Função para registrar usuário
function registerUser(email, password, name) {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(dbPath, (err) => {
      if (err) {
        console.error('❌ Erro ao conectar ao banco:', err.message);
        reject(err);
        return;
      }
    });

    // Verificar se usuário já existe
    const checkQuery = 'SELECT id FROM User WHERE email = ?';
    db.get(checkQuery, [email], (err, row) => {
      if (err) {
        console.error('❌ Erro ao verificar usuário:', err.message);
        db.close();
        reject(err);
        return;
      }

      if (row) {
        db.close();
        reject(new Error('Usuário já existe'));
        return;
      }

      // Hash da senha
      const saltRounds = 10;
      bcrypt.hash(password, saltRounds, (err, hashedPassword) => {
        if (err) {
          console.error('❌ Erro ao fazer hash da senha:', err.message);
          db.close();
          reject(err);
          return;
        }

        // Inserir usuário
        const userId = 'user_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        const insertQuery = 'INSERT INTO User (id, email, password, name, createdAt, updatedAt) VALUES (?, ?, ?, ?, datetime("now"), datetime("now"))';
        
        db.run(insertQuery, [userId, email, hashedPassword, name], function(err) {
          if (err) {
            console.error('❌ Erro ao inserir usuário:', err.message);
            db.close();
            reject(err);
            return;
          }

          console.log(`✅ Usuário registrado com ID: ${userId}`);
          db.close();
          resolve({ id: userId, email, name });
        });
      });
    });
  });
}

// Função para fazer login
function loginUser(email, password) {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(dbPath, (err) => {
      if (err) {
        console.error('❌ Erro ao conectar ao banco:', err.message);
        reject(err);
        return;
      }
    });

    const query = 'SELECT id, email, password, name FROM User WHERE email = ?';
    db.get(query, [email], (err, row) => {
      if (err) {
        console.error('❌ Erro ao buscar usuário:', err.message);
        db.close();
        reject(err);
        return;
      }

      if (!row) {
        db.close();
        reject(new Error('Usuário não encontrado'));
        return;
      }

      // Verificar senha
      bcrypt.compare(password, row.password, (err, isMatch) => {
        if (err) {
          console.error('❌ Erro ao verificar senha:', err.message);
          db.close();
          reject(err);
          return;
        }

        if (!isMatch) {
          db.close();
          reject(new Error('Senha incorreta'));
          return;
        }

        // Gerar token JWT
        const token = jwt.sign(
          { id: row.id, email: row.email },
          JWT_SECRET,
          { expiresIn: '24h' }
        );

        console.log(`✅ Login realizado para usuário: ${row.email}`);
        db.close();
        resolve({
          id: row.id,
          email: row.email,
          name: row.name,
          token
        });
      });
    });
  });
}

// Função para buscar bibliotecas do usuário
function getUserLibraries(userId, filters = {}) {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(dbPath, (err) => {
      if (err) {
        console.error('❌ Erro ao conectar ao banco:', err.message);
        reject(err);
        return;
      }
    });

    // Construir query com filtros e userId
    let whereConditions = ['l.userId = ?'];
    let params = [userId];

    // Filtro por nome (busca)
    if (filters.q && filters.q.trim()) {
      whereConditions.push('l.name LIKE ?');
      params.push(`%${filters.q.trim()}%`);
    }

    // Filtro por pasta
    if (filters.folderId && filters.folderId !== '') {
      whereConditions.push('l.folderId = ?');
      params.push(filters.folderId);
    }

    // Filtro por status
    if (filters.status && filters.status !== '') {
      if (filters.status === 'ativo') {
        whereConditions.push('l.status = ?');
        params.push('active');
      } else if (filters.status === 'inativo') {
        whereConditions.push('(l.status IS NULL OR l.status != ?)');
        params.push('active');
      }
    }

    // Filtro por nicho
    if (filters.nichos && filters.nichos !== '') {
      whereConditions.push('l.nichos LIKE ?');
      params.push(`%${filters.nichos}%`);
    }

    // Filtro por estratégia
    if (filters.estrategias && filters.estrategias !== '') {
      whereConditions.push('l.estrategias LIKE ?');
      params.push(`%${filters.estrategias}%`);
    }

    // Filtro por produto
    if (filters.produtos && filters.produtos !== '') {
      whereConditions.push('l.produtos LIKE ?');
      params.push(`%${filters.produtos}%`);
    }

    // Filtro por idioma
    if (filters.idiomas && filters.idiomas !== '') {
      whereConditions.push('l.idiomas LIKE ?');
      params.push(`%${filters.idiomas}%`);
    }

    // Filtro por país
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
        console.error('❌ Erro na query:', err.message);
        reject(err);
      } else {
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
        resolve(libraries);
      }
      db.close();
    });
  });
}

// Função para buscar pastas do usuário
function getUserFolders(userId) {
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
      LEFT JOIN Library l ON f.id = l.folderId AND l.userId = ?
      WHERE f.userId = ?
      GROUP BY f.id, f.name, f.createdAt
      ORDER BY f.name
    `;

    db.all(query, [userId, userId], (err, rows) => {
      if (err) {
        console.error('❌ Erro na query:', err.message);
        reject(err);
      } else {
        const foldersWithLibraries = rows.map(folder => ({
          ...folder,
          libraries: folder.libraryIds ? folder.libraryIds.split(',') : []
        }));
        
        resolve(foldersWithLibraries);
      }
      db.close();
    });
  });
}

module.exports = {
  authenticateToken,
  registerUser,
  loginUser,
  getUserLibraries,
  getUserFolders
};
