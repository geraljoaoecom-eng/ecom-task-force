const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20,
});

function mapLibrary(row, pages = []) {
  return {
    ...row,
    activeAds: row.active_ads,
    sourceValue: row.source_value,
    sourceType: row.source_type,
    lastCheckedAt: row.last_checked_at,
    pages: pages.map((p) => ({ url: p.url })),
  };
}

async function getUserByEmail(email) {
  const { rows } = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
  return rows[0] || null;
}

async function getUserById(userId) {
  const { rows } = await pool.query(
    'SELECT id, email, name, role, created_at, updated_at FROM users WHERE id = $1',
    [userId]
  );
  return rows[0] || null;
}

async function getUserLibraries(userId, filters = {}) {
  // userId = null → admin "todas as contas" (sem filtro por utilizador)
  const conditions = userId != null ? ['user_id = $1'] : [];
  const params = userId != null ? [userId] : [];
  let idx = userId != null ? 2 : 1;

  if (filters.q?.trim()) {
    conditions.push(`name ILIKE $${idx++}`);
    params.push(`%${filters.q.trim()}%`);
  }
  if (filters.folderId) {
    conditions.push(`folder_id = $${idx++}`);
    params.push(filters.folderId);
  }
  if (filters.status === 'ativo') {
    conditions.push(`status = 'active'`);
  } else if (filters.status === 'inativo') {
    conditions.push(`status IS DISTINCT FROM 'active'`);
  }
  if (filters.nichos) {
    conditions.push(`nichos ILIKE $${idx++}`);
    params.push(`%${filters.nichos}%`);
  }
  if (filters.estrategias) {
    conditions.push(`estrategias ILIKE $${idx++}`);
    params.push(`%${filters.estrategias}%`);
  }
  if (filters.produtos) {
    conditions.push(`produtos ILIKE $${idx++}`);
    params.push(`%${filters.produtos}%`);
  }
  if (filters.idiomas) {
    conditions.push(`idiomas ILIKE $${idx++}`);
    params.push(`%${filters.idiomas}%`);
  }
  if (filters.paises) {
    conditions.push(`paises ILIKE $${idx++}`);
    params.push(`%${filters.paises}%`);
  }

  const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const { rows } = await pool.query(
    `SELECT l.*, lcj.status AS scan_status
     FROM libraries l
     LEFT JOIN library_copy_jobs lcj ON lcj.library_id = l.id
     ${whereClause}
     ORDER BY l.active_ads DESC`,
    params
  );

  return Promise.all(
    rows.map(async (library) => {
      const pages = await pool.query('SELECT url FROM pages WHERE library_id = $1', [library.id]);
      const mapped = mapLibrary(library, pages.rows);
      mapped.scanStatus = library.scan_status || null;
      return mapped;
    })
  );
}

async function getUserFolders(userId) {
  const { rows } = await pool.query(
    'SELECT * FROM folders WHERE user_id = $1 ORDER BY name ASC',
    [userId]
  );

  return Promise.all(
    rows.map(async (folder) => {
      const libs = await pool.query('SELECT id FROM libraries WHERE folder_id = $1', [folder.id]);
      return {
        ...folder,
        libraryCount: libs.rows.length,
        libraries: libs.rows.map((r) => r.id),
      };
    })
  );
}

async function createFolder(userId, name) {
  const { rows } = await pool.query(
    'INSERT INTO folders (name, user_id) VALUES ($1, $2) RETURNING *',
    [name.trim(), userId]
  );
  return rows[0];
}

async function updateFolder(id, userId, name) {
  const { rows } = await pool.query(
    'UPDATE folders SET name = $1 WHERE id = $2 AND user_id = $3 RETURNING *',
    [name.trim(), id, userId]
  );
  return rows[0] || null;
}

async function deleteFolder(id, userId) {
  await pool.query('UPDATE libraries SET folder_id = NULL WHERE folder_id = $1 AND user_id = $2', [id, userId]);
  await pool.query('DELETE FROM folders WHERE id = $1 AND user_id = $2', [id, userId]);
  return true;
}

async function getFilterOptions(field) {
  const { rows } = await pool.query(
    'SELECT value FROM filter_options WHERE type = $1 ORDER BY value ASC',
    [field]
  );
  return rows.map((r) => r.value);
}

async function updateLibraryScrapeResult(libraryId, activeAds) {
  await pool.query(
    `UPDATE libraries SET active_ads = $1, last_checked_at = NOW(), updated_at = NOW() WHERE id = $2`,
    [activeAds, libraryId]
  );
  await pool.query('INSERT INTO ad_history (library_id, ads_count) VALUES ($1, $2)', [
    libraryId,
    activeAds,
  ]);
}

async function getLibrariesForScraping(userId) {
  if (userId) {
    const { rows } = await pool.query(
      'SELECT id, name, source_value, user_id FROM libraries WHERE user_id = $1',
      [userId]
    );
    return rows;
  }
  const { rows } = await pool.query(
    'SELECT id, name, source_value, user_id FROM libraries ORDER BY created_at DESC'
  );
  return rows;
}

async function getUserCurrentPlan(userId) {
  const { rows } = await pool.query(
    `SELECT p.id, p.name, p.description, p.libraries_limit, p.price_monthly, p.price_annual, p.features
     FROM users u
     JOIN plans p ON p.id = u.current_plan_id
     WHERE u.id = $1 AND p.is_active = true`,
    [userId]
  );
  if (rows[0]) {
    const plan = rows[0];
    return {
      ...plan,
      features: Array.isArray(plan.features) ? plan.features : [],
    };
  }

  const { rows: adminRows } = await pool.query(
    `SELECT p.id, p.name, p.description, p.libraries_limit, p.price_monthly, p.price_annual, p.features
     FROM users u
     CROSS JOIN plans p
     WHERE u.id = $1 AND u.role = 'admin' AND p.name = 'Enterprise' AND p.is_active = true
     LIMIT 1`,
    [userId]
  );
  if (!adminRows[0]) return null;
  const plan = adminRows[0];
  return {
    ...plan,
    features: Array.isArray(plan.features) ? plan.features : [],
  };
}

module.exports = {
  pool,
  getUserByEmail,
  getUserById,
  getUserCurrentPlan,
  getUserLibraries,
  getUserFolders,
  createFolder,
  updateFolder,
  deleteFolder,
  getFilterOptions,
  updateLibraryScrapeResult,
  getLibrariesForScraping,
};
