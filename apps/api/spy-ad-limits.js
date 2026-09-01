/**
 * SPY — scroll sempre até esgotar (por keyword).
 * A UI define objectivo de DISCOVERIES (bibliotecas ouro validadas), não limite de scroll.
 */
const UNLIMITED_CAP = 100000;

const SPY_DISCOVERY_TARGET_PRESETS = [
  { value: '1', label: 'Parar ao 1º discovery', max: 1 },
  { value: '3', label: 'Parar aos 3 discoveries', max: 3 },
  { value: '5', label: 'Parar aos 5 discoveries', max: 5 },
  { value: '10', label: 'Parar aos 10 discoveries', max: 10 },
  { value: '25', label: 'Parar aos 25 discoveries', max: 25 },
  { value: '50', label: 'Parar aos 50 discoveries', max: 50 },
  { value: 'unlimited', label: 'Todos os resultados (sem limite)', max: null },
];

/** Scroll keyword: sempre até esgotar GraphQL (só estagnação para). */
function resolveScrollCollectCap() {
  return UNLIMITED_CAP;
}

function parseDiscoveryTargetInput(input) {
  if (input === null || input === undefined || input === '') return null;
  if (input === 'unlimited' || input === 0 || input === '0') return null;
  const preset = SPY_DISCOVERY_TARGET_PRESETS.find((p) => p.value === String(input));
  if (preset) return preset.max;
  const n = parseInt(String(input), 10);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.min(n, 1000);
}

function resolveDiscoveryTarget(session) {
  const raw = session?.stats?.discoveryTarget ?? session?.stats?.maxAdsLimit;
  if (raw === null || raw === undefined || raw === 'unlimited' || raw === 0) return null;
  const n = parseInt(String(raw), 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function formatDiscoveryTarget(session) {
  const target = resolveDiscoveryTarget(session);
  if (!target) return 'Objectivo: todos os discoveries possíveis';
  return `Objectivo: ${target} discovery${target === 1 ? '' : 's'}`;
}

function shouldStopForDiscoveryTarget(session) {
  const target = resolveDiscoveryTarget(session);
  if (!target) return false;
  return (session?.stats?.discoveriesCount ?? 0) >= target;
}

/** @deprecated Legado — ignorado; scroll é sempre até esgotar */
function parseMaxAdsLimitInput(input) {
  return parseDiscoveryTargetInput(input);
}

/** @deprecated */
function resolveMaxAdsPerKeyword() {
  return resolveScrollCollectCap();
}

/** @deprecated */
function formatMaxAdsLimit() {
  return 'Scroll até esgotar em cada keyword';
}

/** @deprecated */
function shouldStopSessionForTotalAdCap(session) {
  return shouldStopForDiscoveryTarget(session);
}

module.exports = {
  SPY_DISCOVERY_TARGET_PRESETS,
  SPY_AD_LIMIT_PRESETS: SPY_DISCOVERY_TARGET_PRESETS,
  UNLIMITED_CAP,
  resolveScrollCollectCap,
  parseDiscoveryTargetInput,
  resolveDiscoveryTarget,
  formatDiscoveryTarget,
  shouldStopForDiscoveryTarget,
  parseMaxAdsLimitInput,
  resolveMaxAdsPerKeyword,
  formatMaxAdsLimit,
  shouldStopSessionForTotalAdCap,
};
