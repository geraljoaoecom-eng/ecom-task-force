#!/usr/bin/env node
/**
 * Migrate data from legacy SQLite (VPS backup) to PostgreSQL
 */
const { execSync } = require('child_process');
const { Pool } = require('pg');

const SQLITE_DB = process.env.SQLITE_DB || '/root/apps/api/prisma/prisma/atlas.db';
const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://taskforce:TaskForce_PG_2026!@localhost:5432/taskforce';

const pool = new Pool({ connectionString: DATABASE_URL });

function toTimestamp(val) {
  if (!val) return new Date();
  if (typeof val === 'number') return new Date(val);
  const n = Number(val);
  if (!Number.isNaN(n) && String(val).length >= 10) return new Date(n > 1e12 ? n : n * 1000);
  const d = new Date(val);
  return Number.isNaN(d.getTime()) ? new Date() : d;
}

function sqliteQuery(sql) {
  const escaped = sql.replace(/"/g, '""');
  try {
    const out = execSync(`sqlite3 -json "${SQLITE_DB}" "${escaped}"`, { encoding: 'utf8', maxBuffer: 50 * 1024 * 1024 });
    return out.trim() ? JSON.parse(out) : [];
  } catch (e) {
    if (e.stdout?.trim()) return JSON.parse(e.stdout);
    return [];
  }
}

async function migrate() {
  console.log('📦 Migrating from:', SQLITE_DB);

  const users = sqliteQuery('SELECT * FROM users');
  const folders = sqliteQuery('SELECT * FROM folders');
  const libraries = sqliteQuery('SELECT * FROM libraries');
  const pages = sqliteQuery('SELECT * FROM pages');
  const adHistory = sqliteQuery('SELECT * FROM ad_history');
  const filterOptions = sqliteQuery('SELECT * FROM filter_options');

  console.log(`Found: ${users.length} users, ${libraries.length} libraries, ${folders.length} folders, ${adHistory.length} ad_history`);

  await pool.query('BEGIN');

  // Clear existing data (keep structure)
  await pool.query('DELETE FROM ad_history');
  await pool.query('DELETE FROM pages');
  await pool.query('DELETE FROM libraries');
  await pool.query('DELETE FROM folders');
  await pool.query('DELETE FROM users');

  for (const u of users) {
    await pool.query(
      `INSERT INTO users (id, email, password, name, role, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [u.id, u.email, u.password, u.name || null, u.role || 'user', toTimestamp(u.createdAt), toTimestamp(u.updatedAt)]
    );
  }
  console.log(`✅ ${users.length} users imported`);

  for (const f of folders) {
    await pool.query(
      `INSERT INTO folders (id, name, user_id, created_at) VALUES ($1, $2, $3, $4)`,
      [f.id, f.name, f.userId, toTimestamp(f.createdAt)]
    );
  }
  console.log(`✅ ${folders.length} folders imported`);

  for (const l of libraries) {
    await pool.query(
      `INSERT INTO libraries (
        id, name, source_type, source_value, country, language, notes, tags,
        active_ads, last_checked_at, created_at, updated_at, user_id, folder_id,
        estrategias, idiomas, nichos, paises, produtos, status, tipos, nota
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22)`,
      [
        l.id, l.name, l.sourceType, l.sourceValue, l.country, l.language,
        l.notes, l.tags, l.activeAds || 0, toTimestamp(l.lastCheckedAt), toTimestamp(l.createdAt), toTimestamp(l.updatedAt),
        l.userId, l.folderId, l.estrategias, l.idiomas, l.nichos, l.paises,
        l.produtos, l.status, l.tipos, l.nota,
      ]
    );
  }
  console.log(`✅ ${libraries.length} libraries imported`);

  for (const p of pages) {
    await pool.query(`INSERT INTO pages (id, url, library_id) VALUES ($1, $2, $3)`, [p.id, p.url, p.libraryId]);
  }
  console.log(`✅ ${pages.length} pages imported`);

  let historyCount = 0;
  for (const h of adHistory) {
    await pool.query(
      `INSERT INTO ad_history (id, library_id, ads_count, date) VALUES ($1, $2, $3, $4)`,
      [h.id, h.libraryId, h.adsCount, toTimestamp(h.date)]
    );
    historyCount++;
    if (historyCount % 5000 === 0) console.log(`   ... ${historyCount} history records`);
  }
  console.log(`✅ ${adHistory.length} ad_history imported`);

  for (const fo of filterOptions) {
    await pool.query(
      `INSERT INTO filter_options (id, type, value, created_at) VALUES ($1, $2, $3, $4) ON CONFLICT (type, value) DO NOTHING`,
      [fo.id, fo.type, fo.value, toTimestamp(fo.createdAt)]
    );
  }
  console.log(`✅ filter_options merged`);

  // Ensure admins
  await pool.query(`UPDATE users SET role = 'admin' WHERE email IN ('directbpsquad@gmail.com', 'geral.joaoecoom@gmail.com')`);

  await pool.query('COMMIT');

  const counts = await pool.query(`
    SELECT 
      (SELECT COUNT(*) FROM users) as users,
      (SELECT COUNT(*) FROM libraries) as libraries,
      (SELECT COUNT(*) FROM folders) as folders
  `);
  console.log('🎉 Done:', counts.rows[0]);
  await pool.end();
}

migrate().catch(async (e) => {
  console.error('❌ Migration failed:', e);
  try { await pool.query('ROLLBACK'); } catch {}
  process.exit(1);
});
