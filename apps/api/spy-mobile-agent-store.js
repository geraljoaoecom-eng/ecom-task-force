/**
 * Registo persistente de agentes móveis (sobrevive a restart da API).
 */
const fs = require('fs');
const path = require('path');

const STORE_PATH =
  process.env.SPY_MOBILE_AGENTS_FILE?.trim() ||
  path.join(__dirname, '../../data/spy-mobile-agents.json');

function readStore() {
  try {
    if (fs.existsSync(STORE_PATH)) {
      return JSON.parse(fs.readFileSync(STORE_PATH, 'utf8'));
    }
  } catch {
    // ignore
  }
  return { agents: {} };
}

function writeStore(data) {
  const dir = path.dirname(STORE_PATH);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(STORE_PATH, JSON.stringify(data, null, 2));
}

function getRegistryEntry(agentId) {
  const store = readStore();
  return store.agents[String(agentId)] || null;
}

function saveRegistryEntry(agent) {
  const store = readStore();
  store.agents[String(agent.id)] = {
    id: agent.id,
    agentKey: agent.agentKey,
    deviceName: agent.deviceName,
    platform: agent.platform || (/iPad/i.test(agent.deviceName || '') ? 'ipad' : /Win/i.test(agent.deviceName || '') ? 'windows' : 'mac'),
    userId: agent.userId,
    registeredAt: agent.registeredAt || Date.now(),
  };
  writeStore(store);
}

function loadAllRegistryAgents() {
  const store = readStore();
  return Object.values(store.agents || {});
}

module.exports = {
  STORE_PATH,
  getRegistryEntry,
  saveRegistryEntry,
  loadAllRegistryAgents,
};
