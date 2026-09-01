/**
 * Ponte SPY Mac ↔ VPS — jobs Meta via dados móveis.
 */
const { randomUUID } = require('crypto');
const { detectMobileConnection } = require('./spy-mobile-connect');
const {
  getRegistryEntry,
  saveRegistryEntry,
  loadAllRegistryAgents,
} = require('./spy-mobile-agent-store');

const HEARTBEAT_TTL_MS = parseInt(process.env.SPY_MOBILE_HEARTBEAT_TTL_MS || '120000', 10) || 120000;
const JOB_TIMEOUT_MS = parseInt(process.env.SPY_MOBILE_JOB_TIMEOUT_MS || '600000', 10) || 600000;
const NO_PARTIAL_MS = parseInt(process.env.SPY_MOBILE_NO_PARTIAL_MS || '120000', 10) || 120000;
const CLAIM_LIVENESS_MS = parseInt(process.env.SPY_MOBILE_CLAIM_LIVENESS_MS || '20000', 10) || 20000;

/** @type {Map<string, object>} */
const agents = new Map();
/** @type {Map<string, object>} */
const jobs = new Map();
/** @type {string[]} */
const jobQueue = [];
/** @type {Map<string, function>} callbacks de resultados parciais por jobId */
const partialHandlers = new Map();
let claimRoundRobin = 0;

function hydrateAgentsFromDisk() {
  for (const reg of loadAllRegistryAgents()) {
    if (!reg?.id || agents.has(reg.id)) continue;
    agents.set(reg.id, {
      id: reg.id,
      agentKey: reg.agentKey,
      deviceName: reg.deviceName || 'Mac',
      platform: reg.platform || inferPlatformFromPayload({ deviceName: reg.deviceName }),
      userId: reg.userId || null,
      ip: null,
      isp: null,
      mobileValidated: false,
      validationReason: 'Aguarda heartbeat do Mac',
      lastSeenAt: 0,
      registeredAt: reg.registeredAt || Date.now(),
      mobileFailStreak: 0,
      hydrated: true,
    });
  }
}

hydrateAgentsFromDisk();

function inferPlatformFromPayload(payload = {}) {
  const explicit = String(payload.platform || '').toLowerCase();
  if (explicit === 'ipad' || explicit === 'iphone' || explicit === 'mac' || explicit === 'windows') {
    return explicit;
  }
  if (explicit === 'win32' || explicit === 'win') return 'windows';
  const name = String(payload.deviceName || '');
  if (/iPad/i.test(name)) return 'ipad';
  if (/iPhone/i.test(name)) return 'iphone';
  if (/Win/i.test(name)) return 'windows';
  if (/Mac/i.test(name)) return 'mac';
  return 'mac';
}

function isMobileBridgeRequired() {
  return process.env.SPY_REQUIRE_MOBILE_BRIDGE !== 'false';
}

function getAgentSecret() {
  return process.env.SPY_MOBILE_AGENT_SECRET?.trim() || '';
}

function verifyAgentSecret(header) {
  const secret = getAgentSecret();
  if (!secret) return false;
  return header === secret;
}

function verifyAgentKey(agentId, agentKey) {
  if (!agentId || !agentKey) return false;
  const agent = agents.get(String(agentId));
  if (agent?.agentKey === agentKey) return true;
  const reg = getRegistryEntry(agentId);
  return !!reg && reg.agentKey === agentKey;
}

function verifyMobileAgentRequest(req) {
  const agentId = req.body?.agentId || req.query?.agentId;
  const agentKey = req.headers['x-spy-agent-key'];
  if (agentId && agentKey && verifyAgentKey(String(agentId), String(agentKey))) return true;
  return verifyAgentSecret(req.headers['x-spy-mobile-secret']);
}

function pruneStaleAgents() {
  const now = Date.now();
  for (const [id, a] of agents) {
    // lastSeenAt 0 = hidratado do disco após restart — aguarda heartbeat, não expulsar
    if (!a.lastSeenAt) continue;
    if (now - a.lastSeenAt > HEARTBEAT_TTL_MS * 2) agents.delete(id);
  }
}

function agentHasRunningJob(agentId) {
  for (const job of jobs.values()) {
    if (job.status === 'running' && job.agentId === agentId) return true;
  }
  return false;
}

function listLiveAgents() {
  pruneStaleAgents();
  const now = Date.now();
  return [...agents.values()].filter(
    (a) => now - a.lastSeenAt <= HEARTBEAT_TTL_MS || agentHasRunningJob(a.id)
  );
}

/** Preferir iPad/dados móveis — Mac em Wi-Fi não deve roubar jobs Meta. */
function normalizeAgentPlatform(agent) {
  const platform = String(agent?.platform || '').toLowerCase();
  const name = String(agent?.deviceName || '');
  if (platform === 'ipad' || platform === 'iphone' || platform === 'mac' || platform === 'windows') {
    return platform;
  }
  if (platform === 'win32' || platform === 'win') return 'windows';
  if (/iPad/i.test(name)) return 'ipad';
  if (/iPhone/i.test(name)) return 'iphone';
  if (/Win/i.test(name)) return 'windows';
  if (/Mac/i.test(name)) return 'mac';
  return 'mac';
}

function agentPlatformMatches(agent, platform) {
  if (!platform) return true;
  return normalizeAgentPlatform(agent) === String(platform).toLowerCase();
}

function agentClaimScore(agent, targetPlatform = null) {
  let score = 0;
  const platform = normalizeAgentPlatform(agent);
  const name = String(agent.deviceName || '');
  if (targetPlatform && agentPlatformMatches(agent, targetPlatform)) score += 500;
  if (platform === 'ipad' || /iPad/i.test(name)) score += 120;
  if (platform === 'iphone' || /iPhone/i.test(name)) score += 120;
  if (agent.mobileValidated) score += 80;
  if (platform === 'mac' && /Mac/i.test(name) && !agent.mobileValidated) score -= 200;
  if (platform === 'windows' && !agent.mobileValidated) score -= 200;
  return score;
}

function pickPreferredClaimAgent(liveAgents, targetPlatform = null) {
  if (!liveAgents.length) return null;
  const eligible = targetPlatform
    ? liveAgents.filter((a) => agentPlatformMatches(a, targetPlatform))
    : liveAgents;
  const pool = eligible.length ? eligible : liveAgents;
  return [...pool].sort((a, b) => agentClaimScore(b, targetPlatform) - agentClaimScore(a, targetPlatform))[0];
}

function isBridgeReady() {
  if (!isMobileBridgeRequired()) return true;
  return listLiveAgents().length > 0;
}

function hasFreshClaim(agent) {
  if (!agent?.lastClaimAt) return false;
  return Date.now() - agent.lastClaimAt <= CLAIM_LIVENESS_MS;
}

function isBridgeReadyForPlatform(platform) {
  if (!isMobileBridgeRequired()) return true;
  if (!platform) return isBridgeReady();
  const target = String(platform).toLowerCase();
  const live = listLiveAgents().filter((a) => agentPlatformMatches(a, target));
  if (!live.length) return false;
  if (target === 'iphone' || target === 'ipad') {
    // Browser agent só está realmente pronto se /jobs/claim está a correr (runner aberto).
    return live.some((a) => hasFreshClaim(a));
  }
  return true;
}

function getBridgeStatus() {
  const live = listLiveAgents();
  return {
    required: isMobileBridgeRequired(),
    ready: live.length > 0,
    agentCount: live.length,
    agents: live.map((a) => ({
      id: a.id,
      deviceName: a.deviceName,
      platform: normalizeAgentPlatform(a),
      ip: a.ip,
      isp: a.isp,
      lastSeenAt: a.lastSeenAt,
      mobileValidated: a.mobileValidated,
      claimFresh: hasFreshClaim(a),
      lastClaimAt: a.lastClaimAt || 0,
    })),
    message:
      live.length > 0
        ? `${live[0].deviceName || 'Mac'} — ${live[0].isp || live[0].ip || 'MEO'}`
        : isMobileBridgeRequired()
          ? 'Liga o iPhone por USB e clica «Activar ponte móvel» abaixo'
          : 'Ponte móvel opcional (desactivada)',
  };
}

async function registerAgent(payload = {}) {
  const check = payload.connectionCheck || { ok: false, reason: 'Teste de ligação em falta' };
  const id = payload.agentId || randomUUID();
  const existing = getRegistryEntry(id);
  let agentKey = existing?.agentKey;
  if (payload.agentKey && existing && payload.agentKey !== existing.agentKey) {
    agentKey = randomUUID();
  }
  if (!agentKey) agentKey = randomUUID();

  const agent = {
    id,
    agentKey,
    deviceName: payload.deviceName || existing?.deviceName || 'Mac',
    platform: payload.platform || existing?.platform || inferPlatformFromPayload(payload),
    userId: payload.userId || existing?.userId || null,
    ip: check.ip || null,
    isp: check.isp || check.org || null,
    mobileValidated: !!check.ok,
    validationReason: check.reason || '',
    lastSeenAt: Date.now(),
    lastClaimAt: existing?.lastClaimAt || 0,
    registeredAt: existing?.registeredAt || Date.now(),
    mobileFailStreak: 0,
  };
  agents.set(id, agent);
  saveRegistryEntry(agent);
  return { agent, check, agentKey };
}

function reconnectAgent(payload = {}) {
  const id = String(payload.agentId || '');
  const agentKey = String(payload.agentKey || '');
  let reg = getRegistryEntry(id);
  if (!reg || reg.agentKey !== agentKey) return null;

  const check = payload.connectionCheck || { ok: false, reason: 'Teste em falta' };
  const agent = {
    id,
    agentKey,
    deviceName: payload.deviceName || reg.deviceName || 'Mac',
    platform: payload.platform || reg.platform || inferPlatformFromPayload({ deviceName: reg.deviceName }),
    userId: reg.userId || null,
    ip: check.ip || null,
    isp: check.isp || check.org || null,
    mobileValidated: !!check.ok,
    validationReason: check.reason || '',
    lastSeenAt: Date.now(),
    lastClaimAt: existing?.lastClaimAt || 0,
    registeredAt: reg.registeredAt || Date.now(),
    mobileFailStreak: 0,
  };
  agents.set(id, agent);
  saveRegistryEntry(agent);
  return { agent, check };
}

function ensureAgentInMemory(agentId, agentKey = null) {
  let a = agents.get(agentId);
  if (a) return a;
  const reg = getRegistryEntry(agentId);
  if (!reg) return null;
  if (agentKey && reg.agentKey !== agentKey) return null;
  a = {
    id: reg.id,
    agentKey: reg.agentKey,
    deviceName: reg.deviceName || 'Mac',
    platform: reg.platform || inferPlatformFromPayload({ deviceName: reg.deviceName }),
    userId: reg.userId || null,
    ip: null,
    isp: null,
    mobileValidated: false,
    validationReason: 'Aguarda heartbeat',
    lastSeenAt: Date.now(),
    lastClaimAt: reg.lastClaimAt || 0,
    registeredAt: reg.registeredAt || Date.now(),
    mobileFailStreak: 0,
    hydrated: true,
  };
  agents.set(agentId, a);
  return a;
}

function heartbeatAgent(agentId, patch = {}) {
  const keyFromPatch = patch.agentKey || null;
  let a = agents.get(agentId);
  if (!a) a = ensureAgentInMemory(agentId, keyFromPatch);
  if (!a && keyFromPatch) {
    const reg = getRegistryEntry(agentId);
    if (reg && reg.agentKey === keyFromPatch) {
      agents.set(agentId, {
        id: reg.id,
        agentKey: reg.agentKey,
        deviceName: reg.deviceName || 'Mac',
        userId: reg.userId || null,
        ip: null,
        isp: null,
        mobileValidated: false,
        validationReason: 'Rehydrate via heartbeat',
        lastSeenAt: Date.now(),
        lastClaimAt: reg.lastClaimAt || 0,
        registeredAt: reg.registeredAt || Date.now(),
        mobileFailStreak: 0,
      });
      a = agents.get(agentId);
    }
  }
  if (!a) return null;
  a.lastSeenAt = Date.now();
  const check = patch.connectionCheck;
  if (check) {
    if (check.ip) a.ip = check.ip;
    a.isp = check.isp || check.org || a.isp;
    if (check.ok) {
      a.mobileValidated = true;
      a.mobileFailStreak = 0;
      a.validationReason = check.reason || '';
    } else {
      a.mobileFailStreak = (a.mobileFailStreak || 0) + 1;
      if (a.mobileFailStreak >= 8) {
        a.mobileValidated = false;
        a.validationReason = check.reason || '';
      }
    }
  }
  if (patch.ip) a.ip = patch.ip;
  if (patch.isp) a.isp = patch.isp;
  if (patch.platform) a.platform = patch.platform;
  if (typeof patch.mobileValidated === 'boolean') a.mobileValidated = patch.mobileValidated;
  return a;
}

function createJob(type, payload, targetPlatform = null) {
  const id = randomUUID();
  const job = {
    id,
    type,
    payload,
    targetPlatform: targetPlatform || null,
    status: 'pending',
    createdAt: Date.now(),
    result: null,
    error: null,
  };
  jobs.set(id, job);
  jobQueue.push(id);
  return job;
}

function claimJob(agentId) {
  pruneStaleAgents();
  let agent = agents.get(agentId);
  if (!agent) agent = ensureAgentInMemory(agentId);
  if (!agent) return null;

  // Cooldown após timeout — agent deve reiniciar browser antes de aceitar novo job
  if (isAgentInCooldown(agentId)) return null;

  const liveAgents = listLiveAgents();
  if (!liveAgents.some((a) => a.id === agentId)) return null;

  // Qualquer poll de claim prova que o runner (/spy/ipad-agent ou Mac) está activo.
  // Sem isto, iPhone/iPad nunca ficavam "prontos" até haver job — e o /spy deixava lançar à toa.
  agent.lastSeenAt = Date.now();
  agent.lastClaimAt = Date.now();

  // UMA passagem pela fila. Re-enfileirar + continue no mesmo while
  // bloqueava a API a 100% CPU (Mac a pedir jobs de iPhone em loop).
  const skipped = [];
  const pending = jobQueue.length;
  for (let i = 0; i < pending; i += 1) {
    const jobId = jobQueue.shift();
    const job = jobs.get(jobId);
    if (!job || job.status !== 'pending') continue;

    if (job.targetPlatform && !agentPlatformMatches(agent, job.targetPlatform)) {
      skipped.push(jobId);
      continue;
    }

    // Quem faz match da plataforma e está a pedir o job, fica com ele.
    // O round-robin antigo preferia o Mac / iPhone morto e o job nunca era entregue.

    job.status = 'running';
    job.agentId = agentId;
    job.startedAt = Date.now();
    job.hasPartial = false;
    jobQueue.push(...skipped);
    return job;
  }
  jobQueue.push(...skipped);
  return null;
}

function registerJobPartialHandler(jobId, fn) {
  partialHandlers.set(jobId, fn);
}

function handleJobPartial(jobId, agentId, data) {
  const job = jobs.get(jobId);
  if (!job || job.agentId !== agentId) return false;
  job.hasPartial = true;
  const handler = partialHandlers.get(jobId);
  if (handler) {
    Promise.resolve()
      .then(() => handler(data))
      .catch((e) => console.warn(`   ⚠️ SPY partial handler (${jobId.slice(0, 8)}):`, e.message));
  }
  return true;
}

function completeJob(jobId, agentId, result, error = null) {
  const job = jobs.get(jobId);
  if (!job || job.agentId !== agentId) return false;
  job.status = error ? 'failed' : 'done';
  job.result = result;
  job.error = error;
  job.finishedAt = Date.now();
  partialHandlers.delete(jobId);
  return true;
}

function getRunningJobForAgent(agentId) {
  if (!agentId) return null;
  for (const job of jobs.values()) {
    if (job.status === 'running' && job.agentId === agentId) {
      return job;
    }
  }
  return null;
}

// Cooldown por agente após timeout — impede claim de novos jobs enquanto browser recupera
const agentCooldownUntil = new Map(); // agentId → timestamp
const AGENT_COOLDOWN_MS = parseInt(process.env.SPY_MOBILE_COOLDOWN_MS || '20000', 10) || 20000;

function setAgentCooldown(agentId) {
  if (!agentId) return;
  agentCooldownUntil.set(agentId, Date.now() + AGENT_COOLDOWN_MS);
  console.log(`   ⏳ SPY mobile: agente ${String(agentId).slice(0, 8)} em cooldown ${AGENT_COOLDOWN_MS / 1000}s (browser a recuperar)`);
}

function isAgentInCooldown(agentId) {
  const until = agentCooldownUntil.get(agentId);
  if (!until) return false;
  if (Date.now() >= until) { agentCooldownUntil.delete(agentId); return false; }
  return true;
}

function waitForJob(jobId, timeoutMs = JOB_TIMEOUT_MS) {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const tick = () => {
      const job = jobs.get(jobId);
      if (!job) return reject(new Error('Job não encontrado'));
      if (job.status === 'done') return resolve(job.result);
      if (job.status === 'failed') return reject(new Error(job.error || 'Job falhou no agente móvel'));
      if (job.status === 'cancelled') return reject(new Error('Job cancelado — agente a reiniciar browser'));
      if (!job.hasPartial && Date.now() - start > NO_PARTIAL_MS) {
        job.status = 'cancelled';
        job.error = 'Sem scroll na Meta — toca o favorito «SPY Meta» no Safari (tab Facebook)';
        if (job.agentId) setAgentCooldown(job.agentId);
        return reject(new Error(job.error));
      }
      if (timeoutMs > 0 && Date.now() - start > timeoutMs) {
        // Marcar como cancelado para o agente saber que deve resetar o browser
        job.status = 'cancelled';
        job.error = 'Timeout no servidor — browser a recuperar';
        if (job.agentId) setAgentCooldown(job.agentId);
        return reject(new Error('Timeout à espera do Mac/telemóvel'));
      }
      setTimeout(tick, 500);
    };
    tick();
  });
}

async function submitMobileJob(type, payload, timeoutMs, opts = {}) {
  const targetPlatform = opts.targetPlatform || null;
  if (targetPlatform && !isBridgeReadyForPlatform(targetPlatform)) {
    const label =
      targetPlatform === 'mac'
        ? 'Mac'
        : targetPlatform === 'windows'
          ? 'Windows'
          : targetPlatform === 'ipad'
            ? 'iPad'
            : 'iPhone';
    throw new Error(`Agente ${label} offline — activa o dispositivo seleccionado`);
  }
  if (!isBridgeReady()) {
    throw new Error('Ponte móvel offline — activa o agente do dispositivo escolhido');
  }
  const job = createJob(type, payload, targetPlatform);
  console.log(
    `   📱 SPY job móvel ${type} → ${job.id.slice(0, 8)}…` +
    (targetPlatform ? ` [${targetPlatform}]` : '')
  );
  if (typeof opts.onPartial === 'function') {
    registerJobPartialHandler(job.id, opts.onPartial);
  }
  return waitForJob(job.id, timeoutMs);
}

module.exports = {
  isMobileBridgeRequired,
  verifyAgentSecret,
  verifyAgentKey,
  verifyMobileAgentRequest,
  getAgentSecret,
  getBridgeStatus,
  isBridgeReady,
  isBridgeReadyForPlatform,
  normalizeAgentPlatform,
  agentPlatformMatches,
  listLiveAgents,
  registerAgent,
  reconnectAgent,
  heartbeatAgent,
  claimJob,
  completeJob,
  submitMobileJob,
  registerJobPartialHandler,
  handleJobPartial,
  getRunningJobForAgent,
  detectMobileConnection,
  setAgentCooldown,
  isAgentInCooldown,
};
