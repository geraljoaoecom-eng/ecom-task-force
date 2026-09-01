// Vertex AI — Gemini via Google Cloud (usa créditos Google Cloud €250)
const VERTEX_PROJECT = process.env.VERTEX_PROJECT || 'project-1f0c9cb1-6e86-47fe-a34';
const VERTEX_REGION  = process.env.VERTEX_REGION  || 'us-central1';
const VERTEX_BASE    = `https://${VERTEX_REGION}-aiplatform.googleapis.com/v1/projects/${VERTEX_PROJECT}/locations/${VERTEX_REGION}/publishers/google/models`;

// Alias legado
const GEMINI_BASE        = VERTEX_BASE;
const GEMINI_NATIVE_BASE = VERTEX_BASE;
const OPENROUTER_BASE    = process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1';

// Remove prefixo "google/" que é formato OpenRouter — Vertex AI usa só o nome do modelo
const ANALYSIS_MODEL = (process.env.SPY_ANALYSIS_MODEL || 'gemini-2.5-flash').replace(/^google\//, '');
const WHISPER_MODEL  = process.env.SPY_WHISPER_MODEL  || 'openai/whisper-large-v3';
const SITE_URL       = process.env.FRONTEND_URL       || 'https://ecoomtaskforce.site';

// Cache do token gcloud (expira em 1h)
let _cachedToken = null;
let _tokenExpiry = 0;

async function getAccessToken(force = false) {
  if (!force && _cachedToken && Date.now() < _tokenExpiry) return _cachedToken;
  const { execSync } = require('child_process');
  const token = execSync('/root/google-cloud-sdk/bin/gcloud auth print-access-token 2>/dev/null', { timeout: 10000 }).toString().trim();
  if (!token) throw new Error('token gcloud vazio');
  _cachedToken = token;
  // TTL conservador: o gcloud por vezes devolve um token já perto de expirar; cachear
  // 55min usava tokens expirados → 401. 4min batcheia rajadas sem arriscar expiração.
  _tokenExpiry = Date.now() + 4 * 60 * 1000;
  return token;
}

function invalidateAccessToken() {
  _cachedToken = null;
  _tokenExpiry = 0;
}

function getApiKey() {
  return process.env.GEMINI_API_KEY || 'vertex-ai';
}

function getOpenRouterKey() {
  return process.env.OPENROUTER_API_KEY || process.env.SPY_AI_API_KEY || null;
}

// Legado — retorna headers síncronos (sem token, para compatibilidade)
function openRouterHeaders() {
  return { 'Content-Type': 'application/json' };
}

// URL legada — retorna null para sinalizar uso de Vertex AI
function geminiUrl(path) {
  return null;
}

function isOpenRouterConfigured() {
  return true;
}

function isVertexModel(model) {
  const m = String(model || ANALYSIS_MODEL).replace(/^google\//, '').toLowerCase();
  return m.startsWith('gemini-') || (!m.includes('/') && !m.startsWith('openai') && !m.startsWith('anthropic'));
}

/**
 * OpenRouter chat/completions — modelos openai/*, anthropic/*, etc.
 */
async function callOpenRouterChat(messages, opts = {}) {
  const key = getOpenRouterKey();
  if (!key) throw new Error('OpenRouter API key em falta');

  const res = await fetch(`${OPENROUTER_BASE}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': SITE_URL,
      'X-Title': 'ECOOM TaskForce SPY',
    },
    body: JSON.stringify({
      model: opts.model,
      messages,
      max_tokens: opts.max_tokens || opts.maxTokens || 8000,
      temperature: opts.temperature ?? 0.4,
    }),
    signal: AbortSignal.timeout(opts.timeout || 90000),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`OpenRouter falhou (${res.status}): ${JSON.stringify(err).slice(0, 200)}`);
  }

  const data = await res.json();
  return String(data.choices?.[0]?.message?.content || '').trim();
}

/**
 * Roteamento unificado: Gemini no Vertex ou OpenRouter consoante o modelo.
 */
async function callSpyAi(messages, opts = {}) {
  const model = opts.model || ANALYSIS_MODEL;
  if (isVertexModel(model)) {
    return callGeminiVertex(messages, { ...opts, model: String(model).replace(/^google\//, '') });
  }
  if (getOpenRouterKey()) {
    return callOpenRouterChat(messages, { ...opts, model });
  }
  console.warn(`   ⚠️ Modelo ${model} requer OpenRouter — fallback gemini ${ANALYSIS_MODEL}`);
  return callGeminiVertex(messages, { ...opts, model: ANALYSIS_MODEL });
}

/**
 * Chama o Gemini via Vertex AI (formato nativo).
 * Aceita mensagens no formato OpenAI e devolve o texto da resposta.
 */
async function callGeminiVertex(messages, opts = {}) {
  const model   = opts.model       || ANALYSIS_MODEL;
  const maxTok  = opts.max_tokens  || opts.maxTokens || 2200;
  const temp    = opts.temperature ?? 0.4;
  const timeout = opts.timeout     || 90000;

  let token = await getAccessToken();

  // Converter mensagens OpenAI → Vertex AI
  const systemParts = [];
  const contents = [];
  for (const m of messages) {
    if (m.role === 'system') {
      systemParts.push({ text: m.content });
    } else {
      contents.push({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] });
    }
  }

  const body = {
    contents,
    generationConfig: { maxOutputTokens: maxTok, temperature: temp },
  };
  if (systemParts.length) body.systemInstruction = { parts: systemParts };

  const doFetch = () => fetch(`${VERTEX_BASE}/${model}:generateContent`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(timeout),
  });

  let res = await doFetch();

  // 401 = token expirado/inválido → invalidar cache, buscar token fresco e tentar 1×
  if (res.status === 401) {
    invalidateAccessToken();
    token = await getAccessToken(true);
    res = await doFetch();
  }

  // Retry automático em 429 com backoff — até 3 tentativas
  for (let attempt = 0; attempt < 3 && res.status === 429; attempt++) {
    const errData = await res.json().catch(() => ({}));
    const suggested = parseInt((errData?.error?.details?.find(d => d.retryDelay)?.retryDelay || '').replace('s','')) || 0;
    const waitMs = Math.max(suggested * 1000, (attempt + 1) * 20000); // min 20s, 40s, 60s
    console.log(`⏳ Vertex AI 429 — retry ${attempt + 1}/3 em ${Math.round(waitMs/1000)}s…`);
    await new Promise(r => setTimeout(r, Math.min(waitMs, 60000)));
    res = await doFetch();
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`Gemini Vertex falhou (${res.status}): ${JSON.stringify(err).slice(0, 200)}`);
  }

  const data = await res.json();
  // gemini-2.5-flash é thinking model — partes com thought:true são internas, pegar a última parte de texto
  const parts = data.candidates?.[0]?.content?.parts || [];
  const text = parts.filter(p => !p.thought).map(p => p.text || '').join('').trim()
    || parts.map(p => p.text || '').join('').trim();
  return text;
}

async function checkOpenRouterCredits() {
  try {
    await callGeminiVertex([{ role: 'user', content: 'ok' }], { max_tokens: 5, timeout: 12000 });
    return { configured: true, hasCredits: true, provider: 'vertex-ai' };
  } catch (err) {
    return { configured: true, hasCredits: false, error: err.message };
  }
}

function getMetaFilterBatchSize() {
  const n = parseInt(process.env.SPY_META_BATCH_SIZE || '50', 10);
  if (!Number.isFinite(n) || n < 1) return 50;
  return Math.min(n, 100);
}

module.exports = {
  GEMINI_BASE,
  GEMINI_NATIVE_BASE,
  OPENROUTER_BASE,
  ANALYSIS_MODEL,
  WHISPER_MODEL,
  SITE_URL,
  VERTEX_BASE,
  VERTEX_PROJECT,
  VERTEX_REGION,
  getApiKey,
  getOpenRouterKey,
  getAccessToken,
  openRouterHeaders,
  geminiUrl,
  callGeminiVertex,
  callOpenRouterChat,
  callSpyAi,
  isVertexModel,
  isOpenRouterConfigured,
  checkOpenRouterCredits,
  getMetaFilterBatchSize,
};
