const { randomUUID } = require('crypto');

/** @type {Map<string, { userId: string, expiresAt: number }>} */
const pairingTokens = new Map();
const PAIRING_TTL_MS = parseInt(process.env.SPY_MOBILE_PAIRING_TTL_MS || '900000', 10) || 900000;

function prunePairingTokens() {
  const now = Date.now();
  for (const [token, entry] of pairingTokens) {
    if (now > entry.expiresAt) pairingTokens.delete(token);
  }
}

function createPairingToken(userId) {
  prunePairingTokens();
  const token = randomUUID();
  pairingTokens.set(token, { userId, expiresAt: Date.now() + PAIRING_TTL_MS });
  return token;
}

function validatePairingToken(token) {
  if (!token) return null;
  prunePairingTokens();
  const entry = pairingTokens.get(String(token));
  if (!entry || Date.now() > entry.expiresAt) return null;
  return entry.userId;
}

function revokePairingToken(token) {
  pairingTokens.delete(String(token));
}

module.exports = {
  createPairingToken,
  validatePairingToken,
  revokePairingToken,
};
