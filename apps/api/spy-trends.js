/**
 * Spot de Tendências e Novidades — avalia continuamente os discoveries recentes do
 * SPY e produz duas listas: o que está A BATER agora (tendências) e o que VAI BATER
 * (novidades emergentes). Guardado em spy_trends; servido em GET /api/spy/trends.
 */
const { pool } = require('./db');
const {
  ANALYSIS_MODEL,
  callGeminiVertex,
  isOpenRouterConfigured,
} = require('./spy-openrouter-shared');

const RECENT_DAYS = parseInt(process.env.SPY_TRENDS_WINDOW_DAYS || '7', 10) || 7;
const SAMPLE_LIMIT = parseInt(process.env.SPY_TRENDS_SAMPLE || '120', 10) || 120;
const MIN_DISCOVERIES = parseInt(process.env.SPY_TRENDS_MIN || '8', 10) || 8;

let _tableReady = false;
async function ensureTrendsTable() {
  if (_tableReady) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS spy_trends (
      scope TEXT PRIMARY KEY DEFAULT 'global',
      trends JSONB NOT NULL DEFAULT '[]',
      novelties JSONB NOT NULL DEFAULT '[]',
      sample_size INTEGER NOT NULL DEFAULT 0,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )
  `).catch(() => {});
  _tableReady = true;
}

function snippetFromCard(card) {
  if (!card || typeof card !== 'object') return '';
  const parts = [card.headline, card.fullCopy, card.copy, card.adText, card.body]
    .filter(Boolean)
    .map((s) => String(s));
  return parts.join(' ').slice(0, 200);
}

async function loadRecentDiscoveries() {
  const { rows } = await pool.query(
    `SELECT d.name, d.active_ads, d.keyword_origin, d.card_data, d.created_at,
            s.nicho, s.country, s.language
     FROM spy_discoveries d
     JOIN spy_sessions s ON s.id = d.session_id
     WHERE d.created_at > NOW() - ($1 || ' days')::interval
     ORDER BY d.active_ads DESC, d.created_at DESC
     LIMIT $2`,
    [String(RECENT_DAYS), SAMPLE_LIMIT]
  );
  return rows;
}

function buildPrompt(rows) {
  const lines = rows.map((r, i) => {
    const parts = [
      `[${i}] ${r.name || '?'}`,
      `nicho=${r.nicho || '?'}`,
      `país=${r.country || '?'}`,
      `ads=${r.active_ads}`,
      `kw=${r.keyword_origin || ''}`,
      `copy=${snippetFromCard(r.card_data)}`,
    ];
    return parts.filter((p) => !p.endsWith('=')).join(' | ');
  });

  return `És um analista de mercado de Direct Response (infoprodutos, nutra, apps) que observa a Meta Ads Library.

Abaixo está uma amostra de anunciantes DR descobertos nos últimos ${RECENT_DAYS} dias (ordenados por nº de anúncios activos).

A partir DESTES dados, identifica:
1. TENDÊNCIAS ("o que está a bater agora") — ângulos, mecanismos, nichos ou formatos com forte presença/escala.
2. NOVIDADES ("o que vai bater") — sinais emergentes, ângulos novos ou pouco saturados que parecem estar a começar.

Sê concreto e accionável (não genérico). Cada item: título curto + porquê (1 frase).

Responde APENAS JSON válido:
{"trends":[{"title":"...","why":"..."}],"novelties":[{"title":"...","why":"..."}]}

Máx 6 tendências e 6 novidades. Em português europeu.

DADOS:
${lines.join('\n')}`;
}

function parseTrendsJson(text) {
  let raw = String(text || '').trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim();
  const m = raw.match(/\{[\s\S]*\}/);
  if (!m) return null;
  try {
    const obj = JSON.parse(m[0]);
    const clean = (arr) =>
      Array.isArray(arr)
        ? arr
            .filter((x) => x && (x.title || x.titulo))
            .map((x) => ({ title: String(x.title || x.titulo).slice(0, 120), why: String(x.why || x.porque || x.motivo || '').slice(0, 240) }))
            .slice(0, 6)
        : [];
    return { trends: clean(obj.trends || obj.tendencias), novelties: clean(obj.novelties || obj.novidades) };
  } catch {
    return null;
  }
}

let _computing = false;
async function computeTrends() {
  if (_computing) return null;
  if (!isOpenRouterConfigured()) return null;
  _computing = true;
  try {
    await ensureTrendsTable();
    const rows = await loadRecentDiscoveries();
    if (rows.length < MIN_DISCOVERIES) {
      console.log(`📊 SPY Trends: só ${rows.length} discoveries recentes (mín ${MIN_DISCOVERIES}) — skip`);
      return null;
    }
    const prompt = buildPrompt(rows);
    const raw = await callGeminiVertex(
      [
        { role: 'system', content: 'Respondes só com JSON. Sem markdown.' },
        { role: 'user', content: prompt },
      ],
      { model: ANALYSIS_MODEL, temperature: 0.4, max_tokens: 2000, timeout: 120000 }
    );
    const parsed = parseTrendsJson(raw);
    if (!parsed) {
      console.warn('⚠️ SPY Trends: resposta IA não parseável');
      return null;
    }
    await pool.query(
      `INSERT INTO spy_trends (scope, trends, novelties, sample_size, updated_at)
       VALUES ('global', $1::jsonb, $2::jsonb, $3, NOW())
       ON CONFLICT (scope) DO UPDATE SET
         trends = EXCLUDED.trends,
         novelties = EXCLUDED.novelties,
         sample_size = EXCLUDED.sample_size,
         updated_at = NOW()`,
      [JSON.stringify(parsed.trends), JSON.stringify(parsed.novelties), rows.length]
    );
    console.log(`📊 SPY Trends actualizado: ${parsed.trends.length} tendências, ${parsed.novelties.length} novidades (${rows.length} discoveries)`);
    return parsed;
  } catch (err) {
    console.error('❌ SPY Trends compute:', err.message);
    return null;
  } finally {
    _computing = false;
  }
}

async function getTrends() {
  await ensureTrendsTable();
  const { rows } = await pool.query(`SELECT trends, novelties, updated_at FROM spy_trends WHERE scope = 'global'`);
  if (!rows.length) return { trends: [], novelties: [], updatedAt: null };
  return { trends: rows[0].trends || [], novelties: rows[0].novelties || [], updatedAt: rows[0].updated_at };
}

// Recompute debounced — chamado ao gravar discoveries; evita martelar o LLM.
let _dirtyTimer = null;
function markTrendsDirty() {
  if (_dirtyTimer) return;
  const delay = parseInt(process.env.SPY_TRENDS_DEBOUNCE_MS || '300000', 10) || 300000; // 5 min
  _dirtyTimer = setTimeout(() => {
    _dirtyTimer = null;
    computeTrends().catch(() => {});
  }, delay);
}

module.exports = { computeTrends, getTrends, markTrendsDirty, ensureTrendsTable };
