// Instagram Talks — schema + helpers de base de dados.
// Schema completo criado já na Fase 0 (JSONB nos funis evita migrações nas fases seguintes).
const { pool } = require('./db');
const { encryptJson, decryptJson } = require('./ig-crypto');

async function ensureIgTables() {
  // Contas IG geridas pelo sistema (sessão cifrada, caps, warmup, estado).
  await pool.query(`
    CREATE TABLE IF NOT EXISTS ig_accounts (
      id              SERIAL PRIMARY KEY,
      username        TEXT NOT NULL UNIQUE,
      ig_user_id      TEXT,
      status          TEXT NOT NULL DEFAULT 'disconnected',
      status_detail   TEXT,
      session_enc     TEXT,
      daily_cap       INTEGER NOT NULL DEFAULT 20,
      warmup_day      INTEGER NOT NULL DEFAULT 1,
      sent_today      INTEGER NOT NULL DEFAULT 0,
      sent_today_date DATE,
      last_login_at   TIMESTAMP WITH TIME ZONE,
      last_active_at  TIMESTAMP WITH TIME ZONE,
      created_at      TIMESTAMP WITH TIME ZONE DEFAULT now(),
      updated_at      TIMESTAMP WITH TIME ZONE DEFAULT now()
    )
  `);

  // Perfis descobertos (Fase 1).
  await pool.query(`
    CREATE TABLE IF NOT EXISTS ig_prospects (
      id            SERIAL PRIMARY KEY,
      username      TEXT NOT NULL UNIQUE,
      ig_user_id    TEXT,
      full_name     TEXT,
      bio           TEXT,
      followers     INTEGER,
      following     INTEGER,
      posts         INTEGER,
      niche         TEXT,
      contact       TEXT,
      score         REAL,
      source        TEXT,
      source_term   TEXT,
      status        TEXT NOT NULL DEFAULT 'new',
      tags          TEXT[],
      meta          JSONB,
      created_at    TIMESTAMP WITH TIME ZONE DEFAULT now(),
      updated_at    TIMESTAMP WITH TIME ZONE DEFAULT now()
    )
  `);

  // Funis (steps em JSONB).
  await pool.query(`
    CREATE TABLE IF NOT EXISTS ig_funnels (
      id          SERIAL PRIMARY KEY,
      name        TEXT NOT NULL,
      steps       JSONB NOT NULL DEFAULT '[]',
      is_active   BOOLEAN NOT NULL DEFAULT true,
      created_at  TIMESTAMP WITH TIME ZONE DEFAULT now(),
      updated_at  TIMESTAMP WITH TIME ZONE DEFAULT now()
    )
  `);

  // Campanhas (seleção de prospects + funil + conta).
  await pool.query(`
    CREATE TABLE IF NOT EXISTS ig_campaigns (
      id          SERIAL PRIMARY KEY,
      name        TEXT NOT NULL,
      account_id  INTEGER REFERENCES ig_accounts(id) ON DELETE SET NULL,
      funnel_id   INTEGER REFERENCES ig_funnels(id) ON DELETE SET NULL,
      status      TEXT NOT NULL DEFAULT 'draft',
      filters     JSONB,
      created_at  TIMESTAMP WITH TIME ZONE DEFAULT now(),
      updated_at  TIMESTAMP WITH TIME ZONE DEFAULT now()
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS ig_campaign_targets (
      id           SERIAL PRIMARY KEY,
      campaign_id  INTEGER REFERENCES ig_campaigns(id) ON DELETE CASCADE,
      prospect_id  INTEGER REFERENCES ig_prospects(id) ON DELETE CASCADE,
      status       TEXT NOT NULL DEFAULT 'queued',
      created_at   TIMESTAMP WITH TIME ZONE DEFAULT now(),
      UNIQUE (campaign_id, prospect_id)
    )
  `);

  // Conversas (uma thread por prospect numa campanha).
  await pool.query(`
    CREATE TABLE IF NOT EXISTS ig_conversations (
      id            SERIAL PRIMARY KEY,
      account_id    INTEGER REFERENCES ig_accounts(id) ON DELETE SET NULL,
      prospect_id   INTEGER REFERENCES ig_prospects(id) ON DELETE SET NULL,
      campaign_id   INTEGER REFERENCES ig_campaigns(id) ON DELETE SET NULL,
      thread_id     TEXT,
      funnel_id     INTEGER REFERENCES ig_funnels(id) ON DELETE SET NULL,
      current_step  INTEGER NOT NULL DEFAULT 0,
      state         TEXT NOT NULL DEFAULT 'active',
      last_msg_at   TIMESTAMP WITH TIME ZONE,
      created_at    TIMESTAMP WITH TIME ZONE DEFAULT now(),
      updated_at    TIMESTAMP WITH TIME ZONE DEFAULT now()
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS ig_messages (
      id               SERIAL PRIMARY KEY,
      conversation_id  INTEGER REFERENCES ig_conversations(id) ON DELETE CASCADE,
      direction        TEXT NOT NULL,
      text             TEXT,
      step_index       INTEGER,
      ig_item_id       TEXT,
      created_at       TIMESTAMP WITH TIME ZONE DEFAULT now()
    )
  `);

  // Fila de ações agendadas (envios com jitter).
  await pool.query(`
    CREATE TABLE IF NOT EXISTS ig_send_queue (
      id               SERIAL PRIMARY KEY,
      account_id       INTEGER REFERENCES ig_accounts(id) ON DELETE CASCADE,
      conversation_id  INTEGER REFERENCES ig_conversations(id) ON DELETE CASCADE,
      prospect_id      INTEGER REFERENCES ig_prospects(id) ON DELETE SET NULL,
      text             TEXT NOT NULL,
      step_index       INTEGER,
      run_at           TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
      status           TEXT NOT NULL DEFAULT 'pending',
      attempts         INTEGER NOT NULL DEFAULT 0,
      last_error       TEXT,
      created_at       TIMESTAMP WITH TIME ZONE DEFAULT now()
    )
  `);

  await pool.query(
    `CREATE INDEX IF NOT EXISTS idx_ig_queue_due ON ig_send_queue (status, run_at)`
  );
}

// ---------- Contas ----------

function publicAccount(row) {
  if (!row) return null;
  // Nunca devolver a sessão cifrada para o frontend.
  const { session_enc, ...rest } = row;
  return { ...rest, connected: !!session_enc && row.status === 'connected' };
}

async function listAccounts() {
  const { rows } = await pool.query(
    'SELECT * FROM ig_accounts ORDER BY created_at DESC'
  );
  return rows.map(publicAccount);
}

async function getAccountRow(id) {
  const { rows } = await pool.query('SELECT * FROM ig_accounts WHERE id = $1', [id]);
  return rows[0] || null;
}

async function getAccountByUsername(username) {
  const { rows } = await pool.query(
    'SELECT * FROM ig_accounts WHERE username = $1',
    [String(username).toLowerCase()]
  );
  return rows[0] || null;
}

async function upsertAccount(username) {
  const u = String(username).toLowerCase().replace(/^@/, '').trim();
  const { rows } = await pool.query(
    `INSERT INTO ig_accounts (username, status)
     VALUES ($1, 'disconnected')
     ON CONFLICT (username) DO UPDATE SET updated_at = now()
     RETURNING *`,
    [u]
  );
  return rows[0];
}

async function setAccountStatus(id, status, detail = null) {
  await pool.query(
    `UPDATE ig_accounts SET status = $2, status_detail = $3, updated_at = now() WHERE id = $1`,
    [id, status, detail]
  );
}

// Guarda a sessão (objeto -> cifrado) e marca como conectada.
async function saveAccountSession(id, sessionObj, igUserId = null) {
  await pool.query(
    `UPDATE ig_accounts
        SET session_enc = $2,
            ig_user_id = COALESCE($3, ig_user_id),
            status = 'connected',
            status_detail = NULL,
            last_login_at = now(),
            last_active_at = now(),
            updated_at = now()
      WHERE id = $1`,
    [id, encryptJson(sessionObj), igUserId]
  );
}

async function getAccountSession(id) {
  const row = await getAccountRow(id);
  if (!row || !row.session_enc) return null;
  return decryptJson(row.session_enc);
}

async function clearAccountSession(id) {
  await pool.query(
    `UPDATE ig_accounts SET session_enc = NULL, status = 'disconnected', updated_at = now() WHERE id = $1`,
    [id]
  );
}

async function touchAccountActive(id) {
  await pool.query(
    `UPDATE ig_accounts SET last_active_at = now() WHERE id = $1`,
    [id]
  );
}

module.exports = {
  ensureIgTables,
  publicAccount,
  listAccounts,
  getAccountRow,
  getAccountByUsername,
  upsertAccount,
  setAccountStatus,
  saveAccountSession,
  getAccountSession,
  clearAccountSession,
  touchAccountActive,
};
