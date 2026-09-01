/**
 * URL pública da API — sempre HTTPS em produção (evita redirect 301 que quebra POST).
 */
function getPublicApiUrl(req) {
  const fromEnv = process.env.SPY_PUBLIC_API_URL?.trim();
  if (fromEnv) return fromEnv.replace(/\/$/, '');

  const host = req?.get?.('host') || 'ecoomtaskforce.site';
  let proto = 'https';
  if (req) {
    const forwarded = req.get('x-forwarded-proto');
    if (forwarded) proto = forwarded.split(',')[0].trim();
    else if (req.protocol) proto = req.protocol;
  }
  if (host.includes('ecoomtaskforce.site') || host.includes('localhost') === false) {
    proto = 'https';
  }
  return `${proto}://${host}/api`.replace(/\/api\/api$/, '/api');
}

function normalizeApiBase(url) {
  let base = String(url || 'https://ecoomtaskforce.site/api').trim().replace(/\/$/, '');
  if (/^http:\/\/ecoomtaskforce\.site/i.test(base)) {
    base = base.replace(/^http:\/\//i, 'https://');
  }
  return base;
}

module.exports = { getPublicApiUrl, normalizeApiBase };
