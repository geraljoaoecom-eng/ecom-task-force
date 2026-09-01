#!/usr/bin/env node
/**
 * Seed admin users and optional Supabase data migration
 */
const bcrypt = require('bcryptjs');
const axios = require('axios');
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://taskforce:TaskForce_PG_2026!@localhost:5432/taskforce',
});

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function seedAdmins() {
  const admins = [
    { email: 'directbpsquad@gmail.com', password: 'Direct123456.', name: 'Admin', role: 'admin' },
    { email: 'geral.joaoecoom@gmail.com', password: 'Cursor2020.', name: 'João Admin', role: 'admin' },
  ];

  for (const admin of admins) {
    const existing = await pool.query('SELECT id FROM users WHERE email = $1', [admin.email]);
    const hash = await bcrypt.hash(admin.password, 10);

    if (existing.rows.length === 0) {
      await pool.query(
        'INSERT INTO users (email, password, name, role) VALUES ($1, $2, $3, $4)',
        [admin.email, hash, admin.name, admin.role]
      );
      console.log(`✅ Admin criado: ${admin.email}`);
    } else {
      await pool.query(
        'UPDATE users SET password = $1, role = $2, name = $3, updated_at = NOW() WHERE email = $4',
        [hash, admin.role, admin.name, admin.email]
      );
      console.log(`✅ Admin atualizado: ${admin.email}`);
    }
  }
}

async function migrateFromSupabase() {
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.log('⏭️ Sem credenciais Supabase — skip migração');
    return;
  }

  const headers = {
    apikey: SUPABASE_KEY,
    Authorization: `Bearer ${SUPABASE_KEY}`,
  };

  try {
    const usersRes = await axios.get(`${SUPABASE_URL}/rest/v1/users?select=*`, { headers });
    for (const u of usersRes.data || []) {
      const exists = await pool.query('SELECT id FROM users WHERE email = $1', [u.email]);
      if (exists.rows.length === 0) {
        await pool.query(
          `INSERT INTO users (id, email, password, name, role, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7) ON CONFLICT (email) DO NOTHING`,
          [u.id, u.email, u.password, u.name, u.role || 'user', u.created_at, u.updated_at]
        );
      }
    }
    console.log(`✅ Users migrados: ${(usersRes.data || []).length}`);

    const libsRes = await axios.get(`${SUPABASE_URL}/rest/v1/libraries?select=*`, { headers });
    for (const lib of libsRes.data || []) {
      await pool.query(
        `INSERT INTO libraries (
          id, name, source_type, source_value, country, language, notes, tags, active_ads,
          last_checked_at, created_at, updated_at, user_id, folder_id, estrategias, idiomas,
          nichos, paises, produtos, status, tipos, nota
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22)
        ON CONFLICT (id) DO NOTHING`,
        [
          lib.id, lib.name, lib.source_type, lib.source_value, lib.country, lib.language,
          lib.notes, lib.tags, lib.active_ads, lib.last_checked_at, lib.created_at,
          lib.updated_at, lib.user_id, lib.folder_id, lib.estrategias, lib.idiomas,
          lib.nichos, lib.paises, lib.produtos, lib.status, lib.tipos, lib.nota,
        ]
      );
    }
    console.log(`✅ Libraries migradas: ${(libsRes.data || []).length}`);

    const foldersRes = await axios.get(`${SUPABASE_URL}/rest/v1/folders?select=*`, { headers });
    for (const f of foldersRes.data || []) {
      await pool.query(
        `INSERT INTO folders (id, name, user_id, created_at) VALUES ($1,$2,$3,$4) ON CONFLICT (id) DO NOTHING`,
        [f.id, f.name, f.user_id, f.created_at]
      );
    }
    console.log(`✅ Folders migradas: ${(foldersRes.data || []).length}`);
  } catch (err) {
    console.log('⚠️ Migração Supabase falhou (continuando):', err.message);
  }
}

async function main() {
  await migrateFromSupabase();
  await seedAdmins();
  await pool.end();
  console.log('🎉 Seed concluído');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
