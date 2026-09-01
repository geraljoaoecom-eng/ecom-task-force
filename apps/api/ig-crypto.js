// Cifra/decifra de cookies de sessão IG — AES-256-GCM.
// Chave em process.env.IG_SESSION_KEY (idealmente 32 bytes em hex/base64).
// Fallback derivado para dev (com aviso) para nunca partir o boot.
const crypto = require('crypto');

const STATIC_SALT = 'ecoom-ig-talks-v1';
let _warned = false;

function deriveKey() {
  const raw = process.env.IG_SESSION_KEY;
  if (raw && raw.trim()) {
    const trimmed = raw.trim();
    // hex de 64 chars → 32 bytes
    if (/^[0-9a-fA-F]{64}$/.test(trimmed)) return Buffer.from(trimmed, 'hex');
    // base64 que dá 32 bytes
    try {
      const b = Buffer.from(trimmed, 'base64');
      if (b.length === 32) return b;
    } catch {
      /* ignore */
    }
    // qualquer outra string → derivar 32 bytes via scrypt
    return crypto.scryptSync(trimmed, STATIC_SALT, 32);
  }
  if (!_warned) {
    console.warn(
      '⚠️  [ig-crypto] IG_SESSION_KEY não definida — a usar chave derivada de DATABASE_URL (NÃO ideal). Define IG_SESSION_KEY (32 bytes) em produção.'
    );
    _warned = true;
  }
  const fallback = process.env.DATABASE_URL || 'ecoom-ig-fallback';
  return crypto.scryptSync(fallback, STATIC_SALT, 32);
}

function encrypt(plain) {
  const key = deriveKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const enc = Buffer.concat([cipher.update(String(plain), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  // formato: iv.tag.ciphertext (todos base64)
  return `${iv.toString('base64')}.${tag.toString('base64')}.${enc.toString('base64')}`;
}

function decrypt(payload) {
  if (!payload) return null;
  try {
    const [ivB64, tagB64, dataB64] = String(payload).split('.');
    const key = deriveKey();
    const decipher = crypto.createDecipheriv(
      'aes-256-gcm',
      key,
      Buffer.from(ivB64, 'base64')
    );
    decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
    const dec = Buffer.concat([
      decipher.update(Buffer.from(dataB64, 'base64')),
      decipher.final(),
    ]);
    return dec.toString('utf8');
  } catch (e) {
    console.error('[ig-crypto] decrypt falhou:', e.message);
    return null;
  }
}

function encryptJson(obj) {
  return encrypt(JSON.stringify(obj));
}

function decryptJson(payload) {
  const s = decrypt(payload);
  if (!s) return null;
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}

module.exports = { encrypt, decrypt, encryptJson, decryptJson };
