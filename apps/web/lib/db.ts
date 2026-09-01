import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20,
});

export function getPool() {
  return pool;
}

function mapLibrary(row: any, pages: any[] = []) {
  return {
    ...row,
    activeAds: row.active_ads,
    sourceValue: row.source_value,
    sourceType: row.source_type,
    lastCheckedAt: row.last_checked_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    folderId: row.folder_id,
    userId: row.user_id,
    pages: pages.map((p) => ({ url: p.url })),
  };
}

export async function getUserByEmail(email: string) {
  const { rows } = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
  return rows[0] || null;
}

export async function getUserById(userId: string) {
  const { rows } = await pool.query(
    'SELECT id, email, name, role, created_at, updated_at FROM users WHERE id = $1',
    [userId]
  );
  return rows[0] || null;
}

export async function getAllUsers() {
  const { rows } = await pool.query(
    'SELECT id, email, name, role, created_at, updated_at FROM users ORDER BY created_at DESC'
  );
  return rows;
}

export async function createUser(data: {
  email: string;
  password: string;
  name?: string | null;
  role?: string;
}) {
  const { rows } = await pool.query(
    `INSERT INTO users (email, password, name, role) VALUES ($1, $2, $3, $4)
     RETURNING id, email, name, role, created_at, updated_at`,
    [data.email, data.password, data.name || null, data.role || 'user']
  );
  return rows[0];
}

export async function updateUser(userId: string, data: Record<string, unknown>) {
  const fields: string[] = [];
  const values: unknown[] = [];
  let i = 1;

  for (const [key, value] of Object.entries(data)) {
    if (value !== undefined) {
      fields.push(`${key} = $${i++}`);
      values.push(value);
    }
  }

  if (fields.length === 0) return null;

  fields.push(`updated_at = NOW()`);
  values.push(userId);

  const { rows } = await pool.query(
    `UPDATE users SET ${fields.join(', ')} WHERE id = $${i} RETURNING id, email, name, role, created_at, updated_at`,
    values
  );
  return rows[0] || null;
}

export async function deleteUser(userId: string) {
  await pool.query('DELETE FROM libraries WHERE user_id = $1', [userId]);
  await pool.query('DELETE FROM folders WHERE user_id = $1', [userId]);
  await pool.query('DELETE FROM users WHERE id = $1', [userId]);
}

export async function createLibrary(userId: string, libraryData: any) {
  if (libraryData.sourceValue) {
    const existing = await pool.query(
      'SELECT id FROM libraries WHERE source_value = $1 LIMIT 1',
      [libraryData.sourceValue.trim()]
    );
    if (existing.rows.length > 0) {
      throw new Error('Essa biblioteca já existe em sistema');
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
      libraryData.name,
      libraryData.sourceType,
      libraryData.sourceValue,
      libraryData.country || '',
      libraryData.language || '',
      libraryData.notes || '',
      libraryData.tags || '',
      userId,
      libraryData.folderId || null,
      libraryData.estrategias || '',
      libraryData.idiomas || '',
      libraryData.nichos || '',
      libraryData.paises || '',
      libraryData.produtos || '',
      libraryData.tipos || '',
      libraryData.nota || '',
    ]
  );
  return rows[0];
}

export async function getUserLibraries(userId: string, filters: any = {}, options: { showAll?: boolean } = {}) {
  const conditions = options.showAll ? [] : ['user_id = $1'];
  const params: unknown[] = options.showAll ? [] : [userId];
  let idx = options.showAll ? 1 : 2;

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

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const { rows } = await pool.query(
    `SELECT * FROM libraries ${whereClause} ORDER BY active_ads DESC`,
    params
  );

  const libraries = await Promise.all(
    rows.map(async (library) => {
      const pages = await pool.query('SELECT url FROM pages WHERE library_id = $1', [library.id]);
      return mapLibrary(library, pages.rows);
    })
  );

  return libraries;
}

export async function getAllLibraries() {
  const { rows } = await pool.query('SELECT * FROM libraries ORDER BY active_ads DESC, created_at DESC');
  return rows;
}

export async function getUserFolders(userId: string) {
  const { rows } = await pool.query(
    'SELECT * FROM folders WHERE user_id = $1 ORDER BY name ASC',
    [userId]
  );

  return Promise.all(
    rows.map(async (folder) => {
      const count = await pool.query('SELECT id FROM libraries WHERE folder_id = $1', [folder.id]);
      return {
        ...folder,
        createdAt: folder.created_at,
        libraryCount: count.rows.length,
        libraries: count.rows.map((r) => r.id),
      };
    })
  );
}

export async function createFolder(userId: string, name: string) {
  const { rows } = await pool.query(
    'INSERT INTO folders (name, user_id) VALUES ($1, $2) RETURNING *',
    [name, userId]
  );
  return rows[0];
}

export async function updateFolder(folderId: string, userId: string, name: string) {
  const { rows } = await pool.query(
    'UPDATE folders SET name = $1 WHERE id = $2 AND user_id = $3 RETURNING *',
    [name, folderId, userId]
  );
  if (!rows[0]) throw new Error('Pasta não encontrada');
  return rows[0];
}

export async function deleteFolder(folderId: string, userId: string) {
  await pool.query('UPDATE libraries SET folder_id = NULL WHERE folder_id = $1 AND user_id = $2', [
    folderId,
    userId,
  ]);
  await pool.query('DELETE FROM folders WHERE id = $1 AND user_id = $2', [folderId, userId]);
  return { success: true };
}

export async function updateLibrary(libraryId: string, userId: string, updateData: any) {
  const fieldMap: Record<string, string> = {
    name: 'name',
    notes: 'notes',
    tags: 'tags',
    estrategias: 'estrategias',
    idiomas: 'idiomas',
    nichos: 'nichos',
    paises: 'paises',
    produtos: 'produtos',
    tipos: 'tipos',
    nota: 'nota',
    status: 'status',
    folderId: 'folder_id',
  };

  const sets: string[] = [];
  const values: unknown[] = [];
  let i = 1;

  for (const [key, col] of Object.entries(fieldMap)) {
    if (updateData[key] !== undefined) {
      sets.push(`${col} = $${i++}`);
      values.push(updateData[key]);
    }
  }

  if (sets.length === 0) throw new Error('Nada para atualizar');

  sets.push('updated_at = NOW()');
  values.push(libraryId, userId);

  const { rows } = await pool.query(
    `UPDATE libraries SET ${sets.join(', ')} WHERE id = $${i++} AND user_id = $${i} RETURNING *`,
    values
  );

  if (!rows[0]) throw new Error('Biblioteca não encontrada ou não foi atualizada');
  return rows[0];
}

export async function deleteLibrary(libraryId: string, userId: string) {
  await pool.query('DELETE FROM pages WHERE library_id = $1', [libraryId]);
  await pool.query('DELETE FROM ad_history WHERE library_id = $1', [libraryId]);
  const result = await pool.query('DELETE FROM libraries WHERE id = $1 AND user_id = $2', [
    libraryId,
    userId,
  ]);
  if (result.rowCount === 0) throw new Error('Biblioteca não encontrada');
  return { success: true };
}

export async function getLibraryById(libraryId: string, userId?: string) {
  const query = userId
    ? 'SELECT * FROM libraries WHERE id = $1 AND user_id = $2'
    : 'SELECT * FROM libraries WHERE id = $1';
  const params = userId ? [libraryId, userId] : [libraryId];
  const { rows } = await pool.query(query, params);
  return rows[0] || null;
}

export async function getAdHistory(libraryId: string, days = 30) {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const { rows } = await pool.query(
    'SELECT * FROM ad_history WHERE library_id = $1 AND date >= $2 ORDER BY date DESC',
    [libraryId, since]
  );
  return rows;
}

export async function insertAdHistory(libraryId: string, adsCount: number) {
  await pool.query(
    'INSERT INTO ad_history (library_id, ads_count) VALUES ($1, $2)',
    [libraryId, adsCount]
  );
}

export async function updateLibraryScrapeResult(libraryId: string, activeAds: number) {
  await pool.query(
    `UPDATE libraries SET active_ads = $1, last_checked_at = NOW(), updated_at = NOW() WHERE id = $2`,
    [activeAds, libraryId]
  );
  await insertAdHistory(libraryId, activeAds);
}

export async function getLibrariesForScraping(userId?: string) {
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

export async function getScrapingStats() {
  const { rows } = await pool.query(
    'SELECT id, active_ads, last_checked_at, created_at FROM libraries'
  );
  return rows;
}

export async function getUserCurrentPlan(userId: string) {
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

export async function getFilterOptions(type: string) {
  const { rows } = await pool.query(
    'SELECT value FROM filter_options WHERE type = $1 ORDER BY value ASC',
    [type]
  );
  return rows.map((r) => r.value);
}
