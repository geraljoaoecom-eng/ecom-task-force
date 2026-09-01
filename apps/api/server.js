require('dotenv').config({ path: '../../env-config' });

const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const { authenticateToken, registerUser, loginUser, getUserData } = require('./auth-supabase');
const { getUserLibraries, getUserFolders, createFolder, updateFolder, deleteFolder, getFilterOptions } = require('./supabase-helpers');

// Scraping
const AutoScraperScheduler = require('./auto-scraper-scheduler');
const { updateSingleLibrary, updateUserLibraries } = require('./library-scraper-service');
const { analyzeLibraryFromUrl, createLibraryFromAnalysis, normalizeAdsLibraryUrl } = require('./library-analyzer-service');
const { assertLibrarySourceIsUnique, LIBRARY_DUPLICATE_MESSAGE } = require('./library-constants');
const {
  createSpySession,
  listSpySessions,
  getSpySession,
  deleteSpySession,
  listDiscoveries,
  getDiscovery,
  deleteDiscovery,
  deleteDiscoveryInSession,
  markDiscoveryImported,
  listCopyBank,
  getSpyIntegrationsStatus,
} = require('./spy-db');
const {
  startSpySession,
  resumeRunningSessions,
  pauseSpySession,
  cancelSpySession,
  resumeSpySession,
} = require('./spy-engine');
const { startSpyCleanupScheduler } = require('./spy-cleanup-scheduler');
const { patchDiscoveryForDisplay } = require('./spy-taxonomy');
const { buildLibraryPageIdIndex, lookupExistingFromIndex, resolveCanonicalSourceValue } = require('./library-source-key');
const { startImportJob, getImportJob } = require('./spy-import-jobs');
const {
  recordImportedFromDiscovery,
  recordImportedFromLibraryDraft,
} = require('./spy-page-intel');
const { enqueueLibraryCopyScan } = require('./copy-library-scanner');
const {
  listCopyVault,
  getCopyTaxonomyTree,
  getCopyRankings,
  getCopyJobStatus,
} = require('./copy-vault-db');

// ==========================
// CONFIGURAÇÕES
// ==========================
const app = express();
app.set('trust proxy', 1);
const PORT = process.env.PORT || 4000;
const { pool, getUserById, getUserByEmail, getUserCurrentPlan } = require('./db');

// Inicializar scheduler de scraping automático
const scraperScheduler = new AutoScraperScheduler();
console.log('🕷️ Iniciando sistema de scraping automático...');
scraperScheduler.start();
startSpyCleanupScheduler();
const { startCopyDeepScanScheduler } = require('./copy-deep-scan-scheduler');
startCopyDeepScanScheduler();
const { startLibraryRefreshScheduler } = require('./library-refresh-scheduler');
startLibraryRefreshScheduler();

// ==========================
// MIDDLEWARE
// ==========================
const { spyMobileBrowserCors } = require('./spy-mobile-browser-cors');
app.use(spyMobileBrowserCors);
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true
}));
app.use(express.json({ limit: '25mb' }));

// Logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// ==========================
// FUNÇÕES AUXILIARES
// ==========================

// Middleware de Admin
async function isAdmin(req, res, next) {
  try {
    const user = await getUserById(req.user.userId);
    if (user && user.role === 'admin') {
      next();
    } else {
      res.status(403).json({ error: 'Acesso negado. Apenas administradores.' });
    }
  } catch {
    res.status(403).json({ error: 'Acesso negado. Apenas administradores.' });
  }
}

// ==========================
// ROTAS DE HEALTH CHECK
// ==========================

app.get('/api/health', (req, res) => {
  res.json({
    status: 'online',
    timestamp: new Date().toISOString(),
    version: '2.0.0',
    database: 'PostgreSQL',
    message: 'Sistema operacional'
  });
});

app.get('/api/test', (req, res) => {
  res.json({
    message: 'API funcionando!',
    timestamp: new Date().toISOString()
  });
});

// ==========================
// ROTAS DE AUTENTICAÇÃO
// ==========================

app.post('/api/auth/register', async (req, res) => {
  try {
    console.log('📝 Registrando usuário:', req.body.email);
    const result = await registerUser(req.body.email, req.body.password, req.body.name);
    console.log('✅ Usuário registrado com sucesso');
    res.json(result);
  } catch (error) {
    console.error('❌ Erro ao registrar:', error.message);
    res.status(400).json({ error: error.message });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    console.log('🔐 Login:', req.body.email);
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
    const user = await getUserById(req.user.userId);
    if (!user) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }
    res.json({
      valid: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role || 'user',
      },
    });
  } catch (error) {
    res.status(401).json({ error: 'Token inválido' });
  }
});

app.get('/api/auth/me', authenticateToken, async (req, res) => {
  try {
    const userData = await getUserData(req.user.userId);
    res.json(userData);
  } catch (error) {
    console.error('❌ Erro ao buscar usuário:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// ==========================
// ROTAS DE BIBLIOTECAS
// ==========================

app.get('/api/libraries', authenticateToken, async (req, res) => {
  try {
    const user = await getUserById(req.user.userId);
    const userIsAdmin = user && user.role === 'admin';
    const showAll = userIsAdmin && req.query.showAll === 'true';
    console.log('📚 Buscando bibliotecas do usuário:', req.user.userId, showAll ? '(todas as contas)' : '');
    const libraries = await getUserLibraries(showAll ? null : req.user.userId, req.query);
    console.log(`✅ Encontradas ${libraries.length} bibliotecas`);
    res.json(libraries);
  } catch (error) {
    console.error('❌ Erro ao buscar bibliotecas:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

app.post('/api/libraries', authenticateToken, async (req, res) => {
  try {
    console.log('➕ Criando biblioteca:', req.body.name);

    let sourceValue = req.body.sourceValue?.trim() || '';
    if (sourceValue.includes('facebook.com/ads/library')) {
      try {
        const { canonical } = resolveCanonicalSourceValue(sourceValue, {
          country: req.body.country,
          paises: req.body.paises,
        });
        sourceValue = canonical || normalizeAdsLibraryUrl(sourceValue);
      } catch {
        /* mantém URL original se normalização falhar */
      }
    }

    if (sourceValue) {
      try {
        await assertLibrarySourceIsUnique(pool, sourceValue, {
          country: req.body.country,
          paises: req.body.paises,
        });
      } catch (error) {
        if (error.code === 'LIBRARY_DUPLICATE') {
          return res.status(400).json({ error: LIBRARY_DUPLICATE_MESSAGE });
        }
        throw error;
      }
    }

    const { rows } = await pool.query(
      `INSERT INTO libraries (
        name, source_type, source_value, country, language, notes, tags,
        active_ads, user_id, folder_id, estrategias, idiomas, nichos, paises,
        produtos, status, tipos, nota
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,0,$8,$9,$10,$11,$12,$13,$14,'active',$15,$16)
      RETURNING *`,
      [
        req.body.name,
        req.body.sourceType,
        sourceValue,
        req.body.country || '',
        req.body.language || '',
        req.body.notes || '',
        req.body.tags || '',
        req.user.userId,
        req.body.folderId || null,
        req.body.estrategias || '',
        req.body.idiomas || '',
        req.body.nichos || '',
        req.body.paises || '',
        req.body.produtos || '',
        req.body.tipos || '',
        req.body.nota || '',
      ]
    );

    const library = rows[0];
    console.log('✅ Biblioteca criada com sucesso');

    if (req.body.pages?.length) {
      for (const pageUrl of req.body.pages.filter(Boolean)) {
        await pool.query('INSERT INTO pages (url, library_id) VALUES ($1, $2)', [pageUrl, library.id]);
      }
    }

    if (library?.id) {
      updateSingleLibrary(library.id).catch((err) =>
        console.error('❌ Erro no scraping automático:', err.message)
      );
    }

    res.json({ success: true, library, scrapingStarted: true });
  } catch (error) {
    console.error('❌ Erro ao criar biblioteca:', error.message);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

app.put('/api/libraries/:id', authenticateToken, async (req, res) => {
  try {
    console.log('📝 Atualizando biblioteca:', req.params.id);

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

    await pool.query(
      `UPDATE libraries SET
        name = $1, source_type = $2, source_value = $3, country = $4, language = $5,
        notes = $6, tags = $7, folder_id = $8, estrategias = $9, idiomas = $10,
        nichos = $11, paises = $12, produtos = $13, status = $14, tipos = $15,
        nota = $16, updated_at = NOW()
      WHERE id = $17 AND user_id = $18`,
      [
        req.body.name,
        req.body.sourceType,
        req.body.sourceValue,
        req.body.country || '',
        req.body.language || '',
        req.body.notes || '',
        req.body.tags || '',
        req.body.folderId || null,
        req.body.estrategias || '',
        req.body.idiomas || '',
        req.body.nichos || '',
        req.body.paises || '',
        req.body.produtos || '',
        req.body.status || 'active',
        req.body.tipos || '',
        req.body.nota || '',
        req.params.id,
        req.user.userId,
      ]
    );

    console.log('✅ Biblioteca atualizada');
    res.json({ success: true });
  } catch (error) {
    console.error('❌ Erro ao atualizar biblioteca:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

app.delete('/api/libraries/:id', authenticateToken, async (req, res) => {
  try {
    console.log('🗑️ Deletando biblioteca:', req.params.id);

    await pool.query('DELETE FROM pages WHERE library_id = $1', [req.params.id]);
    await pool.query('DELETE FROM ad_history WHERE library_id = $1', [req.params.id]);
    await pool.query('DELETE FROM libraries WHERE id = $1 AND user_id = $2', [
      req.params.id,
      req.user.userId,
    ]);

    console.log('✅ Biblioteca deletada');
    res.json({ success: true });
  } catch (error) {
    console.error('❌ Erro ao deletar biblioteca:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// ==========================
// ROTAS DE PASTAS
// ==========================

app.get('/api/folders', authenticateToken, async (req, res) => {
  try {
    const folders = await getUserFolders(req.user.userId);
    res.json(folders);
  } catch (error) {
    console.error('❌ Erro ao buscar pastas:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

app.post('/api/folders', authenticateToken, async (req, res) => {
  try {
    const folder = await createFolder(req.user.userId, req.body.name);
    res.json(folder);
  } catch (error) {
    console.error('❌ Erro ao criar pasta:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

app.put('/api/folders/:id', authenticateToken, async (req, res) => {
  try {
    await updateFolder(req.params.id, req.user.userId, req.body.name);
    res.json({ success: true });
  } catch (error) {
    console.error('❌ Erro ao atualizar pasta:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

app.delete('/api/folders/:id', authenticateToken, async (req, res) => {
  try {
    await deleteFolder(req.params.id, req.user.userId);
    res.json({ success: true });
  } catch (error) {
    console.error('❌ Erro ao deletar pasta:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// ==========================
// ROTAS DE FILTROS
// ==========================

app.get('/api/filter-options/:type', authenticateToken, async (req, res) => {
  try {
    const options = await getFilterOptions(req.params.type);
    res.json(options);
  } catch (error) {
    console.error('❌ Erro ao buscar filtros:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

app.post('/api/filter-options', authenticateToken, async (req, res) => {
  try {
    const filterData = {
      type: req.body.type,
      value: req.body.value,
      created_at: new Date().toISOString()
    };

    await pool.query(
      'INSERT INTO filter_options (type, value) VALUES ($1, $2) ON CONFLICT (type, value) DO NOTHING',
      [req.body.type, req.body.value]
    );

    res.json({ success: true });
  } catch (error) {
    console.error('❌ Erro ao adicionar filtro:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

app.delete('/api/filter-options/:type/:value', authenticateToken, async (req, res) => {
  try {
    await pool.query('DELETE FROM filter_options WHERE type = $1 AND value = $2', [
      req.params.type,
      req.params.value,
    ]);

    res.json({ success: true });
  } catch (error) {
    console.error('❌ Erro ao deletar filtro:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// ==========================
// ROTAS DE USUÁRIOS (ADMIN)
// ==========================

app.get('/api/users', authenticateToken, isAdmin, async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT id, email, name, role, created_at, updated_at FROM users ORDER BY created_at DESC'
    );
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

app.post('/api/users', authenticateToken, isAdmin, async (req, res) => {
  try {
    const { email, password, name, role } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email e senha são obrigatórios' });
    }
    const existing = await getUserByEmail(email);
    if (existing) {
      return res.status(400).json({ error: 'Email já cadastrado' });
    }
    const hashedPassword = await bcrypt.hash(password, 10);
    const { rows } = await pool.query(
      `INSERT INTO users (email, password, name, role) VALUES ($1, $2, $3, $4)
       RETURNING id, email, name, role, created_at, updated_at`,
      [email, hashedPassword, name || null, role || 'user']
    );
    res.json({ success: true, user: rows[0] });
  } catch (error) {
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

app.put('/api/users/:id', authenticateToken, isAdmin, async (req, res) => {
  try {
    const { email, name, role, password } = req.body;
    const fields = [];
    const values = [];
    let i = 1;
    if (email) { fields.push(`email = $${i++}`); values.push(email); }
    if (name !== undefined) { fields.push(`name = $${i++}`); values.push(name); }
    if (role) { fields.push(`role = $${i++}`); values.push(role); }
    if (password) { fields.push(`password = $${i++}`); values.push(await bcrypt.hash(password, 10)); }
    fields.push('updated_at = NOW()');
    values.push(req.params.id);
    await pool.query(`UPDATE users SET ${fields.join(', ')} WHERE id = $${i}`, values);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

app.delete('/api/users/:id', authenticateToken, isAdmin, async (req, res) => {
  try {
    await pool.query('DELETE FROM libraries WHERE user_id = $1', [req.params.id]);
    await pool.query('DELETE FROM folders WHERE user_id = $1', [req.params.id]);
    await pool.query('DELETE FROM users WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// ==========================
// ROTAS DE ADMIN
// ==========================

app.get('/api/admin/users', authenticateToken, isAdmin, async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT id, email, name, role, created_at FROM users ORDER BY created_at DESC'
    );
    res.json(rows);
  } catch (error) {
    console.error('❌ Erro ao buscar usuários:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

app.get('/api/admin/libraries', authenticateToken, isAdmin, async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM libraries ORDER BY active_ads DESC, created_at DESC'
    );
    res.json(rows);
  } catch (error) {
    console.error('❌ Erro ao buscar bibliotecas:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

app.post('/api/admin/libraries/analyze', authenticateToken, isAdmin, async (req, res) => {
  try {
    const { url } = req.body;
    if (!url?.trim()) {
      return res.status(400).json({ error: 'URL é obrigatória' });
    }

    console.log('🔍 Analisando biblioteca (admin):', url);
    const draft = await analyzeLibraryFromUrl(url.trim());
    res.json({ success: true, draft });
  } catch (error) {
    console.error('❌ Erro ao analisar biblioteca:', error.message);
    const status = error.code === 'LIBRARY_DUPLICATE' || error.message === LIBRARY_DUPLICATE_MESSAGE ? 400 : 500;
    res.status(status).json({ error: error.message || 'Erro ao analisar biblioteca' });
  }
});

app.post('/api/admin/libraries/import', authenticateToken, isAdmin, async (req, res) => {
  try {
    const { draft, folderId } = req.body;
    if (!draft?.sourceValue || !draft?.name) {
      return res.status(400).json({ error: 'Dados da biblioteca incompletos' });
    }

    console.log('➕ Importando biblioteca (admin):', draft.name);
    const library = await createLibraryFromAnalysis(req.user.userId, draft, folderId || null);

    updateSingleLibrary(library.id).catch((err) =>
      console.error('❌ Erro no scraping automático:', err.message)
    );

    recordImportedFromLibraryDraft(draft, library.id).catch((err) =>
      console.warn('⚠️ spy_page_intel (import manual):', err.message)
    );
    enqueueLibraryCopyScan(library.id);

    res.json({ success: true, library, scrapingStarted: true });
  } catch (error) {
    console.error('❌ Erro ao importar biblioteca:', error.message);
    const status = error.code === 'LIBRARY_DUPLICATE' || error.message === LIBRARY_DUPLICATE_MESSAGE ? 400 : 500;
    res.status(status).json({ error: error.message || 'Erro ao importar biblioteca' });
  }
});

// ==========================
// ROTAS COPY VAULT (admin)
// ==========================

app.get('/api/copy', authenticateToken, isAdmin, async (req, res) => {
  try {
    const result = await listCopyVault({
      language: req.query.language,
      nicho: req.query.nicho,
      produto: req.query.produto,
      q: req.query.q,
      sort: req.query.sort,
      range: req.query.range,
      from: req.query.from,
      to: req.query.to,
      limit: req.query.limit,
      offset: req.query.offset,
    });
    res.json(result);
  } catch (error) {
    console.error('❌ GET /api/copy:', error.message);
    res.status(500).json({ error: 'Erro ao listar copy vault' });
  }
});

app.get('/api/copy/taxonomy', authenticateToken, isAdmin, async (req, res) => {
  try {
    const tree = await getCopyTaxonomyTree();
    res.json({ tree });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao carregar taxonomia' });
  }
});

app.get('/api/copy/rankings/:type', authenticateToken, isAdmin, async (req, res) => {
  try {
    const items = await getCopyRankings(req.params.type || 'hot', parseInt(req.query.limit || '20', 10));
    res.json({ items });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao carregar rankings' });
  }
});

app.get('/api/copy/jobs/:libraryId', authenticateToken, isAdmin, async (req, res) => {
  try {
    const job = await getCopyJobStatus(req.params.libraryId);
    res.json({ job });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao consultar job' });
  }
});

app.post('/api/copy/scan/:libraryId', authenticateToken, isAdmin, async (req, res) => {
  try {
    enqueueLibraryCopyScan(req.params.libraryId);
    res.json({ success: true, message: 'Scan Copy enfileirado' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Deep-scan de TODAS as bibliotecas (popula library_ads) — corre em background.
app.post('/api/copy/deep-scan-all', authenticateToken, isAdmin, (req, res) => {
  try {
    const { runDeepScanAll } = require('./copy-deep-scan-scheduler');
    runDeepScanAll().catch((e) => console.error('❌ deep-scan-all:', e.message));
    res.json({ success: true, message: 'Deep scan de todas as bibliotecas iniciado em background' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/copy/asset', authenticateToken, isAdmin, async (req, res) => {
  try {
    const rel = String(req.query.path || '');
    if (!rel || rel.includes('..')) return res.status(400).json({ error: 'Path inválido' });
    const { resolveAssetPath } = require('./copy-assets');
    const fs = require('fs');
    const full = resolveAssetPath(rel);
    if (!full || !fs.existsSync(full)) return res.status(404).end();
    res.sendFile(full);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao servir imagem' });
  }
});

// ==========================
// ROTAS SPY (admin)
// ==========================

app.get('/api/spy/config', authenticateToken, isAdmin, async (req, res) => {
  try {
    const { getBridgeStatus } = require('./spy-mobile-bridge');
    const base = getSpyIntegrationsStatus();
    res.json({
      ...base,
      mobileBridge: getBridgeStatus(),
    });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao carregar config SPY' });
  }
});

function verifySpyMobileSecret(req, res, next) {
  const { verifyMobileAgentRequest, getAgentSecret } = require('./spy-mobile-bridge');
  const agentId = req.body?.agentId || req.query?.agentId;
  if (agentId && req.headers['x-spy-agent-key']) {
    if (verifyMobileAgentRequest(req)) return next();
    return res.status(401).json({ error: 'Chave do agente inválida' });
  }
  if (!getAgentSecret()) {
    return res.status(503).json({ error: 'SPY_MOBILE_AGENT_SECRET não configurado na VPS' });
  }
  if (!verifyMobileAgentRequest(req)) {
    return res.status(401).json({ error: 'Secret do agente inválido' });
  }
  next();
}

// Filtro DR chamado pelo Mac agent durante scroll — só o agente autenticado pode usar
app.post('/api/spy/filter-batch', verifySpyMobileSecret, async (req, res) => {
  try {
    const { filterMetadataBatch, parseCriteriaFromSearchUrl } = require('./spy-meta-filter');
    const { ads = [], criteria = {} } = req.body;
    if (!ads.length) return res.json({ relevant: [], rejected: [] });
    const result = await filterMetadataBatch(ads, criteria, { useAi: true });
    res.json({ relevant: result.relevant, rejected: result.rejected });
  } catch (err) {
    console.error('❌ filter-batch:', err.message);
    res.status(500).json({ error: err.message });
  }
});

function getSpyMacProjectDir() {
  const DEFAULT =
    '/Volumes/Remote Nrl /Cursor/Projetos/TaskForce 2026/ECOOM TaskForce';
  const raw = process.env.SPY_MAC_PROJECT_DIR?.trim().replace(/^["']|["']$/g, '') || '';
  // PM2/export antigo truncava no 1.º espaço — ignorar valores incompletos
  if (!raw || !raw.includes('ECOOM TaskForce')) return DEFAULT;
  return raw;
}

function getSpyWindowsProjectDir() {
  const DEFAULT = 'C:\\EcoomTaskForce';
  const raw = process.env.SPY_WINDOWS_PROJECT_DIR?.trim().replace(/^["']|["']$/g, '') || '';
  return raw || DEFAULT;
}

function getSpyLinuxProjectDir() {
  const DEFAULT = process.env.HOME ? `${process.env.HOME}/EcoomTaskForce` : '~/EcoomTaskForce';
  const raw = process.env.SPY_LINUX_PROJECT_DIR?.trim().replace(/^["']|["']$/g, '') || '';
  return raw || DEFAULT;
}

function buildSpyTerminalCommand({ pairingToken, apiUrl } = {}) {
  const dir = getSpyMacProjectDir().replace(/"/g, '\\"');
  if (pairingToken && apiUrl) {
    return `cd "${dir}" && node scripts/spy-mobile-bridge-local.js --pairing=${pairingToken} --api=${apiUrl}`;
  }
  return `cd "${dir}" && node scripts/spy-mobile-bridge-local.js`;
}

function buildSpyWindowsCommand({ pairingToken, apiUrl } = {}) {
  const dir = getSpyWindowsProjectDir();
  const base =
    `cd /d "${dir}" && set SPY_MOBILE_PATH=hotspot&& node scripts\\spy-mobile-bridge-local.js`;
  if (pairingToken && apiUrl) {
    return `${base} --pairing=${pairingToken} --api=${apiUrl}`;
  }
  return base;
}

function buildSpyWindowsPowerShell({ pairingToken, apiUrl } = {}) {
  const dir = getSpyWindowsProjectDir().replace(/'/g, "''");
  const args =
    pairingToken && apiUrl
      ? ` --pairing=${pairingToken} --api=${apiUrl}`
      : '';
  return (
    `$env:SPY_MOBILE_PATH='hotspot'; Set-Location '${dir}'; ` +
    `node .\\scripts\\spy-mobile-bridge-local.js${args}`
  );
}

function buildSpyLinuxCommand({ pairingToken, apiUrl } = {}) {
  const dir = getSpyLinuxProjectDir().replace(/"/g, '\\"');
  if (pairingToken && apiUrl) {
    return `cd "${dir}" && node scripts/spy-mobile-bridge-local.js --pairing=${pairingToken} --api=${apiUrl}`;
  }
  return `cd "${dir}" && node scripts/spy-mobile-bridge-local.js`;
}

app.get('/api/spy/mobile/status', authenticateToken, isAdmin, (req, res) => {
  const { getBridgeStatus } = require('./spy-mobile-bridge');
  res.json(getBridgeStatus());
});

app.get('/api/spy/mobile/terminal', authenticateToken, isAdmin, (req, res) => {
  const platform = String(req.query.platform || 'mac').toLowerCase();
  if (platform === 'windows') {
    const projectDir = getSpyWindowsProjectDir();
    return res.json({
      platform: 'windows',
      projectDir,
      resumeCommand: buildSpyWindowsPowerShell(),
      resumeCommandCmd: buildSpyWindowsCommand(),
      hint:
        'No Windows: liga o PC ao hotspot do telemóvel → abre PowerShell → cola o comando. Deixa a janela aberta (localhost:9780).',
    });
  }
  if (platform === 'linux') {
    const projectDir = getSpyLinuxProjectDir();
    return res.json({
      platform: 'linux',
      projectDir,
      resumeCommand: buildSpyLinuxCommand(),
      hint:
        'No Linux: liga o PC ao hotspot → cola no terminal. Deixa a janela aberta (localhost:9780).',
    });
  }
  const projectDir = getSpyMacProjectDir();
  res.json({
    platform: 'mac',
    projectDir,
    resumeCommand: buildSpyTerminalCommand(),
    hint: 'Cola no Terminal do Mac. Deixa a janela aberta — a ponte corre em localhost:9780.',
  });
});

// Endpoint público — só devolve se o agente está pronto (sem dados sensíveis)
app.get('/api/spy/mobile/agent-ready', authenticateToken, (req, res) => {
  const { getBridgeStatus } = require('./spy-mobile-bridge');
  const s = getBridgeStatus();
  const mobileValidated = s.agents.some((a) => a.mobileValidated);
  res.json({
    ready: s.ready && mobileValidated,
    mobileValidated,
    agentCount: s.agentCount,
    message: s.message,
    agents: s.agents,
  });
});

app.post('/api/spy/mobile/pairing', authenticateToken, isAdmin, (req, res) => {
  const { createPairingToken } = require('./spy-mobile-pairing');
  const { getPublicApiUrl } = require('./spy-public-url');
  const token = createPairingToken(req.user.userId);
  const apiUrl = getPublicApiUrl(req);
  const projectDir = getSpyMacProjectDir();
  const windowsDir = getSpyWindowsProjectDir();
  res.json({
    pairingToken: token,
    apiUrl,
    projectDir,
    windowsProjectDir: windowsDir,
    localPort: parseInt(process.env.SPY_MOBILE_LOCAL_PORT || '9780', 10) || 9780,
    expiresInSec: 900,
    resumeCommand: buildSpyTerminalCommand(),
    activateCommand: buildSpyTerminalCommand({ pairingToken: token, apiUrl }),
    resumeCommandWindows: buildSpyWindowsPowerShell(),
    activateCommandWindows: buildSpyWindowsPowerShell({ pairingToken: token, apiUrl }),
    activateCommandWindowsCmd: buildSpyWindowsCommand({ pairingToken: token, apiUrl }),
  });
});

app.post('/api/spy/mobile/register-pairing', async (req, res) => {
  try {
    const { validatePairingToken } = require('./spy-mobile-pairing');
    const { registerAgent } = require('./spy-mobile-bridge');
    const pairingToken = req.body?.pairingToken;
    const userId = validatePairingToken(pairingToken);
    if (!userId) {
      return res.status(401).json({ error: 'Sessão expirada — volta à ferramenta e activa de novo' });
    }
    const { agent, check, agentKey } = await registerAgent({
      ...req.body,
      userId,
    });
    res.json({
      agentId: agent.id,
      agentKey,
      mobileValidated: agent.mobileValidated,
      ip: agent.ip,
      message: check.reason || agent.validationReason,
    });
  } catch (error) {
    res.status(500).json({ error: error.message || 'Erro ao registar agente' });
  }
});

app.get('/api/spy/mobile/install-script', authenticateToken, isAdmin, (req, res) => {
  const { validatePairingToken } = require('./spy-mobile-pairing');
  const token = req.query.pairingToken;
  if (!validatePairingToken(token)) {
    return res.status(401).json({ error: 'Sessão expirada — gera novo código na ferramenta' });
  }
  const { getPublicApiUrl } = require('./spy-public-url');
  const apiUrl = getPublicApiUrl(req);
  const platform = String(req.query.platform || 'mac').toLowerCase();

  if (platform === 'windows') {
    const taskforceDir = getSpyWindowsProjectDir();
    const dirPs = taskforceDir.replace(/'/g, "''");
    const innerCmd =
      `Set-Location '${dirPs}'; $env:SPY_MOBILE_PATH='hotspot'; ` +
      `node .\\scripts\\spy-mobile-bridge-local.js --pairing=${token} --api=${apiUrl}`;
    const innerCmdEscaped = innerCmd.replace(/'/g, "''");
    const script = [
      '# Ecoom SPY — Activar ponte Windows (PowerShell)',
      '# 1) Liga o PC ao hotspot / USB tether do telemóvel (dados móveis)',
      '# 2) Garante Node.js instalado: https://nodejs.org',
      `# 3) Pasta do projecto em: ${taskforceDir}`,
      "$ErrorActionPreference = 'Stop'",
      "$env:SPY_MOBILE_PATH = 'hotspot'",
      `$DIR = '${dirPs}'`,
      `$PAIRING = '${token}'`,
      `$API_URL = '${apiUrl}'`,
      "if (-not (Test-Path (Join-Path $DIR 'scripts\\spy-mobile-bridge-local.js'))) {",
      '  Write-Host "Pasta Ecoom Task Force nao encontrada: $DIR"',
      '  Write-Host "Copia o projecto para essa pasta ou define SPY_WINDOWS_PROJECT_DIR."',
      '  exit 1',
      '}',
      'Set-Location $DIR',
      "if (-not (Test-Path 'apps\\api\\node_modules')) {",
      "  Write-Host 'A instalar dependencias (primeira vez)...'",
      '  npm install --prefix apps\\api',
      '}',
      "Write-Host 'A arrancar ponte SPY em localhost:9780...'",
      'Start-Process powershell -ArgumentList @(',
      "  '-NoExit',",
      "  '-Command',",
      `  '${innerCmdEscaped}'`,
      ')',
      'Start-Sleep -Seconds 3',
      "Start-Process 'https://ecoomtaskforce.site/spy'",
      '',
    ].join('\n');
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Disposition', 'attachment; filename="Ecoom-SPY-Activar-Windows.ps1"');
    return res.send(script);
  }

  const taskforceDir = getSpyMacProjectDir();
  const dirForBash = taskforceDir.replace(/'/g, `'\\''`);
  const activateUrl = `http://127.0.0.1:9780/activate?pairingToken=${token}&apiUrl=${encodeURIComponent(apiUrl)}`;
  const script = `#!/bin/bash
# ECOM SPY — Ponte móvel (gerado pela ferramenta)
PAIRING="${token}"
API_URL="${apiUrl}"
ACTIVATE_URL="${activateUrl}"
DIR='${dirForBash}'
LOG="$HOME/.ecom-spy-ponte.log"

if [ ! -f "$DIR/scripts/spy-mobile-bridge-local.js" ]; then
  osascript -e 'display alert "Pasta Ecoom Task Force não encontrada" message "Confirma que o projecto está em:\\n'"$DIR"'" as critical'
  exit 1
fi

if ! curl -s --max-time 2 "http://127.0.0.1:9780/health" >/dev/null 2>&1; then
  cd "$DIR" || exit 1
  nohup node scripts/spy-mobile-bridge-local.js --pairing="$PAIRING" --api="$API_URL" >> "$LOG" 2>&1 &
  sleep 2
else
  curl -s "$ACTIVATE_URL" >> "$LOG" 2>&1 || true
fi

open "https://ecoomtaskforce.site/spy"
`;
  res.setHeader('Content-Type', 'application/x-sh');
  res.setHeader('Content-Disposition', 'attachment; filename="Ecoom-Task-Force-SPY-Activar.command"');
  res.send(script);
});

app.get('/api/spy/mobile/autostart-script', authenticateToken, isAdmin, (req, res) => {
  const taskforceDir = getSpyMacProjectDir();
  const dirForBash = taskforceDir.replace(/'/g, `'\\''`);
  const script = `#!/bin/bash
# ECOM SPY — Arranque automático da ponte (1× duplo clique)
DIR='${dirForBash}'
if [ ! -f "$DIR/scripts/install-spy-bridge-autostart.sh" ]; then
  osascript -e 'display alert "Pasta Ecoom Task Force não encontrada" message "Confirma o caminho:\\n'"$DIR"'" as critical'
  exit 1
fi
bash "$DIR/scripts/install-spy-bridge-autostart.sh"
osascript -e 'display notification "Ponte SPY activa em background" with title "Ecoom Task Force"'
open "https://ecoomtaskforce.site/spy"
`;
  res.setHeader('Content-Type', 'application/x-sh');
  res.setHeader('Content-Disposition', 'attachment; filename="Ecoom-SPY-Arranque-Automatico.command"');
  res.send(script);
});

app.post('/api/spy/mobile/reconnect', async (req, res) => {
  try {
    const { reconnectAgent } = require('./spy-mobile-bridge');
    const agentId = req.body?.agentId;
    const agentKey = req.headers['x-spy-agent-key'] || req.body?.agentKey;
    if (!agentId || !agentKey) {
      return res.status(400).json({ error: 'agentId e agentKey em falta' });
    }
    const result = reconnectAgent({ ...req.body, agentId, agentKey });
    if (!result) return res.status(401).json({ error: 'Agente desconhecido — activa de novo na ferramenta' });
    res.json({
      agentId: result.agent.id,
      agentKey: result.agent.agentKey,
      mobileValidated: result.agent.mobileValidated,
      message: result.check.reason || 'Religado',
    });
  } catch (error) {
    res.status(500).json({ error: error.message || 'Erro ao religar agente' });
  }
});

app.post('/api/spy/mobile/register', verifySpyMobileSecret, async (req, res) => {
  try {
    const { registerAgent } = require('./spy-mobile-bridge');
    const { agent, check, agentKey } = await registerAgent(req.body || {});
    res.json({
      agentId: agent.id,
      agentKey,
      mobileValidated: agent.mobileValidated,
      ip: agent.ip,
      message: check.reason || agent.validationReason,
    });
  } catch (error) {
    res.status(500).json({ error: error.message || 'Erro ao registar agente' });
  }
});

app.get('/api/spy/mobile/agent/liveness', verifySpyMobileSecret, (req, res) => {
  const { listLiveAgents } = require('./spy-mobile-bridge');
  const { getRegistryEntry } = require('./spy-mobile-agent-store');
  const agentId = String(req.query.agentId || '');
  if (!agentId) return res.status(400).json({ error: 'agentId em falta' });
  const live = listLiveAgents().some((a) => a.id === agentId);
  const reg = getRegistryEntry(agentId);
  res.json({
    registered: !!reg,
    live,
    ready: live,
    agentId,
  });
});

app.post('/api/spy/mobile/heartbeat', verifySpyMobileSecret, (req, res) => {
  const { heartbeatAgent } = require('./spy-mobile-bridge');
  const agentId = req.body?.agentId;
  if (!agentId) return res.status(400).json({ error: 'agentId em falta' });
  const agentKey = req.headers['x-spy-agent-key'] || req.body?.agentKey;
  const agent = heartbeatAgent(String(agentId), { ...req.body, agentKey });
  if (!agent) return res.status(404).json({ error: 'Agente não registado — activa de novo na ferramenta' });
  res.json({ ok: true, mobileValidated: agent.mobileValidated, message: agent.validationReason });
});

app.get('/api/spy/mobile/jobs/claim', verifySpyMobileSecret, (req, res) => {
  const { claimJob } = require('./spy-mobile-bridge');
  const agentId = req.query.agentId;
  if (!agentId) return res.status(400).json({ error: 'agentId em falta' });
  const job = claimJob(String(agentId));
  res.json({
    job: job ? { id: job.id, type: job.type, payload: job.payload } : null,
  });
});

app.get('/api/spy/mobile/jobs/current', verifySpyMobileSecret, (req, res) => {
  const { getRunningJobForAgent } = require('./spy-mobile-bridge');
  const agentId = String(req.query.agentId || '');
  if (!agentId) return res.status(400).json({ error: 'agentId em falta' });
  const job = getRunningJobForAgent(agentId);
  res.json({
    job: job ? { id: job.id, type: job.type, payload: job.payload } : null,
  });
});

app.post('/api/spy/mobile/jobs/:id/partial', verifySpyMobileSecret, (req, res) => {
  const { handleJobPartial } = require('./spy-mobile-bridge');
  const { agentId, ads } = req.body || {};
  if (!agentId) return res.status(400).json({ error: 'agentId em falta' });
  const ok = handleJobPartial(req.params.id, String(agentId), { ads: ads || [] });
  res.json({ ok });
});

app.post('/api/spy/mobile/jobs/:id/complete', verifySpyMobileSecret, (req, res) => {
  const { completeJob } = require('./spy-mobile-bridge');
  const agentId = req.body?.agentId;
  if (!agentId) return res.status(400).json({ error: 'agentId em falta' });
  const ok = completeJob(
    req.params.id,
    String(agentId),
    req.body.result,
    req.body.error || null
  );
  if (!ok) return res.status(404).json({ error: 'Job não encontrado ou agente incorrecto' });
  res.json({ success: true });
});

app.get('/api/spy/sessions/:id/copy-bank', authenticateToken, isAdmin, async (req, res) => {
  try {
    const session = await getSpySession(req.params.id, req.user.userId);
    if (!session) return res.status(404).json({ error: 'Pesquisa não encontrada' });
    const items = await listCopyBank(req.params.id, { q: req.query.q });
    res.json({ items, total: items.length });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao carregar copy bank' });
  }
});

app.get('/api/spy/sessions', authenticateToken, isAdmin, async (req, res) => {
  try {
    const sessions = await listSpySessions(req.user.userId);
    res.json(sessions);
  } catch (error) {
    console.error('❌ SPY list sessions:', error);
    res.status(500).json({ error: 'Erro ao listar pesquisas SPY' });
  }
});

app.get('/api/spy/form-options', authenticateToken, isAdmin, (req, res) => {
  try {
    const { META_COUNTRIES, META_LANGUAGES } = require('./meta-ads-library-options');
    const { pool } = require('./db');
    Promise.all([
      pool.query(`SELECT value FROM filter_options WHERE type = 'nichos' ORDER BY value`),
      pool.query(`SELECT value FROM filter_options WHERE type = 'produtos' ORDER BY value`),
    ])
      .then(([nichos, produtos]) => {
        const countriesSorted = [
          { code: 'ALL', label: 'Todos os países' },
          ...META_COUNTRIES.filter((c) => c.code !== 'ALL'),
        ];
        res.json({
          countries: countriesSorted,
          languages: META_LANGUAGES.filter((l) => l.value !== ''),
          nichos: nichos.rows.map((r) => r.value),
          produtos: produtos.rows.map((r) => r.value),
        });
      })
      .catch((err) => {
        console.error('❌ SPY form-options:', err);
        res.status(500).json({ error: 'Erro ao carregar opções' });
      });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/spy/keywords/preview', authenticateToken, isAdmin, async (req, res) => {
  try {
    const { country, language, nicho, produto, keywordSeed, brief, previousIntel, feedback } =
      req.body || {};
    if (!country && !language && !nicho && !produto && !brief) {
      return res.status(400).json({ error: 'Indica idioma, país, nicho ou brief.' });
    }
    const { countryCodeFromInput } = require('./meta-ads-library-options');
    const { runConsultantPreview } = require('./spy-deep-search');
    const countryCode = country ? countryCodeFromInput(country) : '';
    const intel = await runConsultantPreview({
      country: countryCode || country,
      language,
      nicho,
      produto,
      keywordSeed,
      brief,
      previousIntel,
      feedback,
    });
    res.json({ success: true, marketIntel: intel });
  } catch (error) {
    console.error('❌ SPY keywords preview:', error);
    res.status(500).json({ error: error.message || 'Erro ao gerar keywords com GPT' });
  }
});

// Spot de Tendências e Novidades — snapshot do que está a bater e do que vai bater.
app.get('/api/spy/trends', authenticateToken, isAdmin, async (req, res) => {
  try {
    const { getTrends } = require('./spy-trends');
    res.json(await getTrends());
  } catch (error) {
    res.status(500).json({ error: error.message || 'Erro ao obter tendências' });
  }
});

// Forçar recálculo imediato das tendências (debug / botão manual).
app.post('/api/spy/trends/refresh', authenticateToken, isAdmin, async (req, res) => {
  try {
    const { computeTrends, getTrends } = require('./spy-trends');
    await computeTrends();
    res.json(await getTrends());
  } catch (error) {
    res.status(500).json({ error: error.message || 'Erro ao recalcular tendências' });
  }
});

// Pré-visualização do Language Sweep: que países serão varridos para um dado idioma/país.
app.get('/api/spy/sweep-preview', authenticateToken, isAdmin, (req, res) => {
  try {
    const { country, language } = req.query || {};
    const { resolveTargetCountries } = require('./spy-language-markets');
    const { countryLabelFromCode } = require('./meta-ads-library-options');
    const codes = resolveTargetCountries({ country, language });
    const isSweep = codes.length > 1;
    res.json({
      isSweep,
      countries: codes.map((c) => ({ code: c, label: c === 'ALL' ? 'Todos os países' : (countryLabelFromCode(c) || c) })),
    });
  } catch (error) {
    res.status(500).json({ error: error.message || 'Erro no sweep preview' });
  }
});

app.post('/api/spy/sessions', authenticateToken, isAdmin, async (req, res) => {
  try {
    const {
      name,
      country,
      language,
      keywordSeed,
      nicho,
      produto,
      discoveryTarget,
      maxAdsLimit,
      minActiveAds,
      minDaysActive,
      maxDaysActive,
      maxHours,
      marketIntel,
      consultantBrief,
      ctaHunt,
      mobilePlatform,
    } = req.body;
    // CTA Hunt: tipos de funil selecionados → keywords de CTA que se somam ao marketIntel.
    // O bucket 'universal' é sempre incluído primeiro — padrões de copy DR reais sem nicho.
    const ctaTypes = Array.isArray(ctaHunt) ? ctaHunt : (ctaHunt?.types || []);
    let effectiveIntel = marketIntel;
    if (ctaTypes.length) {
      const { generateCtaKeywordsTagged } = require('./spy-cta-keywords');
      // Sempre incluir 'universal' no topo, mesmo que não tenha sido selecionado
      const typesWithUniversal = ['universal', ...ctaTypes.filter((t) => t !== 'universal')];
      const tagged = generateCtaKeywordsTagged({ language, types: typesWithUniversal, nicho });
      const existing = marketIntel?.keywords || [];
      const existingSet = new Set(existing.map((k) => k.toLowerCase()));
      // Separa genéricas das específicas para aplicar prioridade diferente no motor
      const specific = tagged.filter((t) => !t.generic && !existingSet.has(t.phrase.toLowerCase())).map((t) => t.phrase);
      const generic  = tagged.filter((t) =>  t.generic && !existingSet.has(t.phrase.toLowerCase())).map((t) => t.phrase);
      const merged = [...existing, ...specific, ...generic];
      // Log detalhado de inicialização
      console.log(`🎯 CTA Hunt: idioma=${language || 'auto'} tipos=${typesWithUniversal.join('+')} nicho=${nicho || '(vazio)'}`);
      console.log(`   📋 ${specific.length} universais/específicas: ${specific.slice(0, 5).join(', ')}${specific.length > 5 ? '…' : ''}`);
      console.log(`   🔅 ${generic.length} genéricas (prio baixa): ${generic.slice(0, 5).join(', ')}${generic.length > 5 ? '…' : ''}`);
      effectiveIntel = {
        ...(marketIntel || {}),
        keywords: merged,
        keywordsGeneric: generic,   // motor usa prioridade mais baixa para estas
        keywordsPreApproved: true,
        source: marketIntel?.source || 'cta',
        ctaTypes: typesWithUniversal,
        resumoMercado: marketIntel?.resumoMercado || `CTA Hunt (${typesWithUniversal.join(', ')}) — ${specific.length} DR patterns + ${generic.length} genéricas`,
        generatedAt: marketIntel?.generatedAt || new Date().toISOString(),
      };
    }
    if (!country && !language && !keywordSeed && !nicho && !produto && !(effectiveIntel?.keywords?.length)) {
      return res.status(400).json({ error: 'Indica idioma, país, nicho, keywords ou CTA Hunt.' });
    }
    const { ensureFilterOption } = require('./filter-helpers');
    const { countryCodeFromInput } = require('./meta-ads-library-options');
    const countryCode = country ? countryCodeFromInput(country) : '';
    if (nicho) await ensureFilterOption('nichos', String(nicho).trim().toUpperCase());
    if (produto) await ensureFilterOption('produtos', String(produto).trim());
    if (language) await ensureFilterOption('idiomas', String(language).trim());
    if (countryCode && countryCode !== 'ALL') {
      const { countryLabelFromCode } = require('./meta-ads-library-options');
      await ensureFilterOption('paises', countryLabelFromCode(countryCode));
    }
    const session = await createSpySession(req.user.userId, {
      name,
      country: countryCode || country,
      language,
      keywordSeed,
      nicho,
      produto,
      discoveryTarget: discoveryTarget ?? maxAdsLimit,
      minActiveAds,
      minDaysActive,
      maxDaysActive,
      maxHours,
      marketIntel: effectiveIntel,
      consultantBrief,
      mobilePlatform,
    });
    startSpySession(session.id);
    res.json({ success: true, session });
  } catch (error) {
    console.error('❌ SPY create session:', error);
    res.status(500).json({ error: error.message || 'Erro ao criar pesquisa SPY' });
  }
});

app.get('/api/spy/sessions/:id', authenticateToken, isAdmin, async (req, res) => {
  try {
    const session = await getSpySession(req.params.id, req.user.userId);
    if (!session) return res.status(404).json({ error: 'Pesquisa não encontrada' });
    res.json(session);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao carregar pesquisa' });
  }
});

app.delete('/api/spy/sessions/:id', authenticateToken, isAdmin, async (req, res) => {
  try {
    const ok = await deleteSpySession(req.params.id, req.user.userId);
    if (!ok) return res.status(404).json({ error: 'Pesquisa não encontrada' });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao apagar pesquisa' });
  }
});

app.post('/api/spy/sessions/:id/pause', authenticateToken, isAdmin, async (req, res) => {
  try {
    const session = await pauseSpySession(req.params.id, req.user.userId);
    if (!session) return res.status(404).json({ error: 'Pesquisa não encontrada' });
    res.json({ success: true, session });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao pausar pesquisa' });
  }
});

app.post('/api/spy/sessions/:id/cancel', authenticateToken, isAdmin, async (req, res) => {
  try {
    const session = await cancelSpySession(req.params.id, req.user.userId);
    if (!session) return res.status(404).json({ error: 'Pesquisa não encontrada' });
    res.json({ success: true, session });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao cancelar pesquisa' });
  }
});

app.post('/api/spy/sessions/:id/resume', authenticateToken, isAdmin, async (req, res) => {
  try {
    const session = await resumeSpySession(req.params.id, req.user.userId);
    if (!session) return res.status(404).json({ error: 'Pesquisa não encontrada' });
    res.json({ success: true, session });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao retomar pesquisa' });
  }
});

app.get('/api/spy/sessions/:id/discoveries', authenticateToken, isAdmin, async (req, res) => {
  try {
    const session = await getSpySession(req.params.id, req.user.userId);
    if (!session) return res.status(404).json({ error: 'Pesquisa não encontrada' });
    const discoveries = await listDiscoveries(req.params.id, {
      q: req.query.q,
      minAds: req.query.minAds,
      alreadyImported: req.query.alreadyImported,
      order: req.query.order,
      nicho: req.query.nicho,
      produto: req.query.produto,
    });
    const libIndex = await buildLibraryPageIdIndex();
    const hints = { country: session.country };
    res.json(
      discoveries.map((d) => {
        const patched = patchDiscoveryForDisplay(d, session);
        const hit = lookupExistingFromIndex(patched.sourceValue, libIndex, hints);
        if (!hit) return patched;
        return {
          ...patched,
          existingLibraryId: hit.library.id,
          existingLibraryName: hit.library.name,
          alreadyInLibraries: true,
        };
      })
    );
  } catch (error) {
    res.status(500).json({ error: 'Erro ao listar discoveries' });
  }
});

app.post('/api/spy/discoveries/import', authenticateToken, isAdmin, async (req, res) => {
  try {
    const { discoveryIds } = req.body;
    if (!Array.isArray(discoveryIds) || !discoveryIds.length) {
      return res.status(400).json({ error: 'Seleciona pelo menos um discovery' });
    }
    const { jobId, total } = startImportJob(discoveryIds, req.user.userId);
    res.status(202).json({ success: true, jobId, total, message: 'Importação em segundo plano' });
  } catch (error) {
    res.status(500).json({ error: 'Erro na importação' });
  }
});

app.get('/api/spy/import-jobs/:jobId', authenticateToken, isAdmin, async (req, res) => {
  try {
    const job = getImportJob(req.params.jobId, req.user.userId);
    if (!job) return res.status(404).json({ error: 'Job não encontrado' });
    res.json(job);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao consultar importação' });
  }
});

app.delete('/api/spy/sessions/:sessionId/discoveries/:discoveryId', authenticateToken, isAdmin, async (req, res) => {
  try {
    const ok = await deleteDiscoveryInSession(
      req.params.sessionId,
      req.params.discoveryId,
      req.user.userId
    );
    if (!ok) return res.status(404).json({ error: 'Discovery não encontrado' });
    console.log(`🗑️ SPY discovery eliminado: ${req.params.discoveryId}`);
    res.json({ success: true });
  } catch (error) {
    console.error('❌ DELETE spy discovery:', error);
    res.status(500).json({ error: 'Erro ao eliminar discovery' });
  }
});

app.delete('/api/spy/discoveries/:id', authenticateToken, isAdmin, async (req, res) => {
  try {
    const ok = await deleteDiscovery(req.params.id, req.user.userId);
    if (!ok) return res.status(404).json({ error: 'Discovery não encontrado' });
    console.log(`🗑️ SPY discovery eliminado: ${req.params.id}`);
    res.json({ success: true });
  } catch (error) {
    console.error('❌ DELETE spy discovery:', error);
    res.status(500).json({ error: 'Erro ao eliminar discovery' });
  }
});

// ==========================
// ROTAS DE SCRAPING
// ==========================

// Status do scraping automático
app.get('/api/scraping/status', authenticateToken, (req, res) => {
  try {
    const status = scraperScheduler.getStatus();
    res.json({
      success: true,
      ...status,
      message: status.isRunning 
        ? `Scraping automático ativo. ${status.totalExecutions} execuções realizadas.`
        : 'Sistema de scraping parado'
    });
  } catch (error) {
    console.error('❌ Erro ao verificar status:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Atualizar biblioteca específica (manual)
app.post('/api/libraries/:id/refresh', authenticateToken, async (req, res) => {
  try {
    console.log(`🔄 Refresh manual da biblioteca: ${req.params.id}`);
    
    const result = await updateSingleLibrary(req.params.id);
    
    if (result.success) {
      res.json({
        success: true,
        message: `Biblioteca atualizada: ${result.activeAds} anúncios ativos`,
        activeAds: result.activeAds,
        libraryName: result.libraryName
      });
    } else {
      res.status(500).json({
        success: false,
        error: result.error
      });
    }
  } catch (error) {
    console.error('❌ Erro ao atualizar biblioteca:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Atualizar todas bibliotecas do usuário (manual)
// Analytics das Bibliotecas — leituras (mais escaladas, por país/nicho, longevidade, duplicações)
app.get('/api/libraries/analytics', authenticateToken, async (req, res) => {
  try {
    const { getLibraryAnalytics } = require('./library-analytics');
    const data = await getLibraryAnalytics({
      limit: req.query.limit,
      country: req.query.country,
      niche: req.query.niche,
    });
    res.json(data);
  } catch (error) {
    console.error('❌ Library analytics:', error.message);
    res.status(500).json({ error: error.message || 'Erro nas analytics' });
  }
});

app.post('/api/libraries/refresh-all', authenticateToken, async (req, res) => {
  try {
    console.log(`🔄 Refresh manual de todas bibliotecas do usuário: ${req.user.userId}`);
    
    const result = await updateUserLibraries(req.user.userId);
    
    res.json({
      success: true,
      message: `${result.totalSuccess} bibliotecas atualizadas com sucesso`,
      ...result
    });
  } catch (error) {
    console.error('❌ Erro ao atualizar bibliotecas:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Executar atualização manual completa (apenas admin)
app.post('/api/scraping/execute', authenticateToken, isAdmin, async (req, res) => {
  try {
    console.log('🔧 Execução manual de scraping iniciada pelo admin');
    
    const result = await scraperScheduler.executeManualUpdate();
    
    res.json({
      success: true,
      message: 'Execução manual concluída',
      ...result
    });
  } catch (error) {
    console.error('❌ Erro na execução manual:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Estatísticas do scraping (apenas admin)
app.get('/api/scraping/stats', authenticateToken, isAdmin, (req, res) => {
  try {
    const stats = scraperScheduler.getStats();
    res.json(stats);
  } catch (error) {
    console.error('❌ Erro ao buscar estatísticas:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// ==========================
// ROTAS EXTRAS
// ==========================

app.get('/api/stripe/current-plan', authenticateToken, async (req, res) => {
  try {
    const plan = await getUserCurrentPlan(req.user.userId);
    res.json({ plan });
  } catch (error) {
    console.error('Erro ao buscar plano atual:', error);
    res.status(500).json({ error: 'Erro ao buscar plano atual' });
  }
});

// ==========================
// ROTAS DE HISTÓRICO
// ==========================

app.get('/api/libraries/:id/history', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const daysParam = req.query.days;
    const fetchAll = daysParam === 'all';

    let rows;
    if (fetchAll) {
      console.log(`📊 Buscando histórico completo da biblioteca: ${id}`);
      ({ rows } = await pool.query(
        `SELECT DISTINCT ON ((date AT TIME ZONE 'Europe/Lisbon')::date)
           ads_count,
           date,
           library_id
         FROM ad_history
         WHERE library_id = $1
         ORDER BY (date AT TIME ZONE 'Europe/Lisbon')::date DESC, date DESC`,
        [id]
      ));
    } else {
      const days = Math.min(Math.max(parseInt(daysParam, 10) || 8, 1), 365);
      console.log(`📊 Buscando histórico da biblioteca: ${id} (${days} dias)`);
      ({ rows } = await pool.query(
        `SELECT DISTINCT ON ((date AT TIME ZONE 'Europe/Lisbon')::date)
           ads_count,
           date,
           library_id
         FROM ad_history
         WHERE library_id = $1
           AND (date AT TIME ZONE 'Europe/Lisbon')::date >= (NOW() AT TIME ZONE 'Europe/Lisbon')::date - ($2::int - 1)
         ORDER BY (date AT TIME ZONE 'Europe/Lisbon')::date DESC, date DESC`,
        [id, days]
      ));
    }

    const { rows: libRows } = await pool.query(
      'SELECT active_ads FROM libraries WHERE id = $1',
      [id]
    );
    const activeAds = libRows[0]?.active_ads ?? 0;

    const formattedHistory = rows
      .map((item) => ({
        date: item.date.toISOString(),
        adsCount: item.ads_count,
        libraryId: item.library_id,
      }))
      .reverse();

    const todayKey = new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Lisbon' });
    const hasToday = formattedHistory.some((h) => {
      const d = new Date(h.date).toLocaleDateString('en-CA', { timeZone: 'Europe/Lisbon' });
      return d === todayKey;
    });

    if (activeAds > 0 && !hasToday) {
      formattedHistory.push({
        date: new Date().toISOString(),
        adsCount: activeAds,
        libraryId: id,
      });
    } else if (activeAds > 0 && hasToday) {
      const last = formattedHistory[formattedHistory.length - 1];
      if (last) last.adsCount = Math.max(last.adsCount, activeAds);
    }

    console.log(`✅ Encontrados ${formattedHistory.length} registros de histórico`);
    res.json(formattedHistory);
  } catch (error) {
    console.error('❌ Erro ao buscar histórico:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// ==========================
// TRATAMENTO DE ERROS
// ==========================

// Verifica se o IP do caller é dados móveis ou WiFi/fibra (só flag mobile do ip-api — sem fallback ASN)
let _networkCache = {};

async function probeClientNetwork(ip, opts = {}) {
  const now = Date.now();
  const fresh = opts.fresh === true || opts.fresh === '1' || opts.fresh === 1;
  if (!fresh && _networkCache[ip] && now - _networkCache[ip].ts < 30000) {
    return { ..._networkCache[ip].data, cached: true };
  }
  const r = await fetch(
    `http://ip-api.com/json/${ip}?fields=status,mobile,hosting,proxy,org,isp,as,query`,
    { signal: AbortSignal.timeout(8000) }
  );
  const d = await r.json();
  const asn = (d.as || '').split(' ')[0];
  const isMobile =
    d.status === 'success' &&
    d.mobile === true &&
    !d.hosting &&
    !d.proxy;
  const label = d.isp || d.org || asn || 'desconhecido';
  const data = {
    ip,
    mobile: isMobile,
    org: d.org || d.isp || '',
    isp: d.isp || d.org || '',
    asn,
    reason: isMobile ? `Dados móveis — ${label}` : `Wi-Fi/fibra — ${label}`,
  };
  _networkCache[ip] = { ts: now, data };
  Object.keys(_networkCache).forEach((k) => {
    if (now - _networkCache[k].ts > 120000) delete _networkCache[k];
  });
  console.log(`[network-check] ${ip} → mobile=${isMobile} asn=${asn} org=${data.org}`);
  return data;
}

app.get('/api/spy/network-check', authenticateToken, async (req, res) => {
  const ip = (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim();
  try {
    const data = await probeClientNetwork(ip, { fresh: req.query.fresh });
    res.json(data);
  } catch (e) {
    res.status(503).json({ error: 'Não foi possível verificar o IP', ip });
  }
});

// Recebe erros do frontend e loga no PM2
app.post('/api/client-error', (req, res) => {
  try {
    const e = req.body || {}
    console.error(`[CLIENT-ERROR] ${e.type || 'error'} | ${e.url || '?'} | ${e.message || '?'}${e.stack ? '\n' + e.stack.slice(0, 500) : ''}`)
  } catch {}
  res.status(204).end()
})

// ==========================
// INSTAGRAM TALKS (Fase 0)
// ==========================
const igSession = require('./ig-session');
const igDb = require('./ig-db');

// Gate de IP móvel: nenhuma ação de escrita (login/envio) em WiFi.
// IG_BYPASS_MOBILE_GATE=1 desativa (apenas para testes/dev).
async function igRequireMobile(req, res) {
  if (process.env.IG_BYPASS_MOBILE_GATE === '1') return true;
  const ip = (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim();
  let isMobile = false;
  try {
    const data = await probeClientNetwork(ip);
    isMobile = !!data.mobile;
  } catch {
    isMobile = false;
  }
  if (!isMobile) {
    res.status(412).json({ error: 'Liga os dados móveis para esta ação (gate de segurança da conta IG).', code: 'MOBILE_REQUIRED' });
    return false;
  }
  return true;
}

app.get('/api/ig/accounts', authenticateToken, async (req, res) => {
  try {
    res.json({ accounts: await igDb.listAccounts() });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/ig/accounts/login', authenticateToken, async (req, res) => {
  if (!(await igRequireMobile(req, res))) return;
  const { username, password } = req.body || {};
  if (!username || !password) return res.status(400).json({ error: 'username e password obrigatórios' });
  try {
    const r = await igSession.loginWithCredentials({ username, password });
    res.json(r);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Importa sessão via cookie sessionid (login feito pelo próprio utilizador no browser dele).
// Não passa pelo gate de IP móvel — não há login server-side, só validação da sessão.
app.post('/api/ig/accounts/session-import', authenticateToken, async (req, res) => {
  const { username, sessionid } = req.body || {};
  if (!username || !sessionid) return res.status(400).json({ error: 'username e sessionid obrigatórios' });
  try {
    res.json(await igSession.loginWithSessionId({ username, sessionid }));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/ig/accounts/2fa', authenticateToken, async (req, res) => {
  if (!(await igRequireMobile(req, res))) return;
  const { pendingId, code } = req.body || {};
  if (!pendingId || !code) return res.status(400).json({ error: 'pendingId e code obrigatórios' });
  try {
    res.json(await igSession.submitTwoFactor({ pendingId, code }));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/ig/accounts/:id/check', authenticateToken, async (req, res) => {
  try {
    res.json(await igSession.checkSession(Number(req.params.id)));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/ig/accounts/:id/disconnect', authenticateToken, async (req, res) => {
  try {
    await igDb.clearAccountSession(Number(req.params.id));
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/ig/accounts/:id/inbox', authenticateToken, async (req, res) => {
  try {
    res.json(await igSession.readInbox(Number(req.params.id), Number(req.query.limit) || 20));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/ig/accounts/:id/send', authenticateToken, async (req, res) => {
  if (!(await igRequireMobile(req, res))) return;
  const { username, text } = req.body || {};
  if (!username || !text) return res.status(400).json({ error: 'username e text obrigatórios' });
  try {
    res.json(await igSession.sendDirectMessage(Number(req.params.id), username, text));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.use((req, res) => {
  res.status(404).json({ error: 'Rota não encontrada' });
});

app.use((err, req, res, next) => {
  console.error('💥 Erro não tratado:', err);
  res.status(500).json({ error: 'Erro interno do servidor' });
});

// ==========================
// INICIALIZAÇÃO
// ==========================

// Função para tentar iniciar o servidor em uma porta
function startServer(port, attempt = 1) {
  const maxAttempts = 5;
  
  const server = app.listen(port, '0.0.0.0')
    .on('listening', () => {
      console.log('');
      console.log('═══════════════════════════════════════════════════════');
      console.log('🚀 Ecoom Task Force API v2.0');
      console.log('═══════════════════════════════════════════════════════');
      console.log(`📡 Servidor rodando em: http://localhost:${port}`);
      console.log(`🔗 API disponível em: http://localhost:${port}/api`);
      console.log(`🏥 Health check: http://localhost:${port}/api/health`);
      console.log(`💾 Banco de dados: Supabase`);
      console.log(`🌍 CORS: ${process.env.FRONTEND_URL || 'http://localhost:3000'}`);
      if (port !== PORT) {
        console.log(`⚠️  ATENÇÃO: Porta ${PORT} em uso, usando porta ${port}`);
      }
      console.log('═══════════════════════════════════════════════════════');
      console.log('');
      console.log('✅ Sistema pronto para receber requisições');
      console.log('');
    })
    .on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        console.log(`⚠️  Porta ${port} já está em uso`);
        
        if (attempt < maxAttempts) {
          const nextPort = port + 1;
          console.log(`🔄 Tentando porta ${nextPort}...\n`);
          startServer(nextPort, attempt + 1);
        } else {
          console.error(`❌ Não foi possível iniciar o servidor após ${maxAttempts} tentativas`);
          console.error('💡 Dica: Mate os processos Node rodando: taskkill /F /IM node.exe');
          process.exit(1);
        }
      } else {
        console.error('❌ Erro ao iniciar servidor:', err);
        process.exit(1);
      }
    });
}

// Iniciar servidor
console.log(`🚀 Iniciando servidor na porta ${PORT}...\n`);
resumeRunningSessions().catch((err) => console.error('❌ SPY resume:', err.message));
igDb.ensureIgTables()
  .then(() => console.log('✅ Instagram Talks: tabelas prontas'))
  .catch((err) => console.error('❌ IG ensureIgTables:', err.message));
startServer(PORT);

module.exports = app;

