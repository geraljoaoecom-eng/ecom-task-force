const {
  isMobileBridgeRequired,
  isBridgeReady,
  submitMobileJob,
} = require('./spy-mobile-bridge');

async function tryDelegateMobile(type, payload, timeoutMs, opts = {}) {
  if (!isMobileBridgeRequired() || !isBridgeReady()) return null;
  try {
    return await submitMobileJob(type, payload, timeoutMs, opts);
  } catch (err) {
    console.error(`   ❌ SPY mobile delegate (${type}):`, err.message);
    throw err;
  }
}

module.exports = { tryDelegateMobile };
