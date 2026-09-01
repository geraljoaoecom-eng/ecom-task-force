/**
 * Detecta interface iPhone USB / hotspot pessoal (IP local típico Apple).
 */
const os = require('os');

function listNetworkInterfaces() {
  return os.networkInterfaces();
}

function isLikelyIphoneUsb(name, info) {
  const n = String(name || '').toLowerCase();
  if (/iphone|ios|apple mobile|tether|usb/i.test(n)) return true;
  const ip = info.address || '';
  // Hotspot USB/iPhone: 172.20.10.x ou 169.254.x (link-local USB)
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(ip)) return true;
  if (/^169\.254\./.test(ip) && /en\d/i.test(n)) return true;
  return false;
}

function findIphoneUsbInterface(options = {}) {
  const ifaces = listNetworkInterfaces();
  const candidates = [];

  for (const [name, entries] of Object.entries(ifaces)) {
    if (!entries) continue;
    for (const info of entries) {
      if (info.internal || info.family !== 'IPv4') continue;
      if (!info.address) continue;
      const score =
        (isLikelyIphoneUsb(name, info) ? 10 : 0) +
        (/^172\.20\.10\./.test(info.address) ? 20 : 0) +
        (/^172\.(1[6-9]|2\d|3[01])\./.test(info.address) ? 5 : 0);
      if (score > 0 || options.includeAllExternal) {
        candidates.push({ name, address: info.address, score, mac: info.mac });
      }
    }
  }

  candidates.sort((a, b) => b.score - a.score);
  return candidates[0] || null;
}

module.exports = { findIphoneUsbInterface, listNetworkInterfaces };
