/**
 * Estado em tempo real da sessão SPY (stats.live na BD).
 */
const { patchSessionStats } = require('./spy-db');

async function pushLiveStats(sessionId, partial) {
  if (!sessionId) return;
  const live = {
    ...partial,
    updatedAt: new Date().toISOString(),
  };
  await patchSessionStats(sessionId, { live });
}

function formatKeywordLive(keyword, pagesFound, relevant, libraryVisits, goldCached, discoveries) {
  const parts = [`«${keyword}»`];
  if (pagesFound != null) parts.push(`→ ${pagesFound} páginas`);
  if (relevant != null) parts.push(`${relevant} relevantes`);
  if (libraryVisits != null && libraryVisits > 0) parts.push(`${libraryVisits} biblioteca(s)`);
  if (goldCached != null && goldCached > 0) parts.push(`${goldCached} ouro cache`);
  if (discoveries != null && discoveries > 0) {
    parts.push(`${discoveries} discovery${discoveries === 1 ? '' : 's'}`);
  }
  return parts.join(' · ');
}

module.exports = {
  pushLiveStats,
  formatKeywordLive,
};
