/**
 * CORS para agente SPY no browser (Safari iPad / extensão).
 * Auth via X-Spy-Agent-Key — não expor endpoints admin.
 */
const BROWSER_AGENT_PATHS = [
  '/api/spy/mobile/heartbeat',
  '/api/spy/mobile/jobs/claim',
  '/api/spy/mobile/jobs/current',
  '/api/spy/mobile/jobs/',
  '/api/spy/mobile/reconnect',
];

function isBrowserAgentPath(path) {
  const p = String(path || '');
  return BROWSER_AGENT_PATHS.some(
    (prefix) => p === prefix || p.startsWith(prefix)
  );
}

function spyMobileBrowserCors(req, res, next) {
  if (!isBrowserAgentPath(req.path)) return next();

  const origin = req.headers.origin;
  if (origin) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  } else {
    res.setHeader('Access-Control-Allow-Origin', '*');
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'Content-Type, X-Spy-Agent-Key, X-Spy-Mobile-Secret'
  );
  res.setHeader('Access-Control-Max-Age', '86400');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }
  next();
}

module.exports = { spyMobileBrowserCors, isBrowserAgentPath };
