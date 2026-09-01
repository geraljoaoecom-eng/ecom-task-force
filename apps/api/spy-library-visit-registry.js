/**
 * Registo in-session de bibliotecas Meta já visitadas numa keyword.
 * Evita entrar 2× na mesma biblioteca (ex.: falhou <25 ads → skip ads seguintes do mesmo page_id).
 */
const { normPageId } = require('./spy-page-intel');

const STATUS = {
  PULLED: 'pulled',
  LOW_ADS: 'low_ads',
  VISIT_ERROR: 'visit_error',
  GOLD_CACHE: 'gold_cache',
};

function getMinActiveAds() {
  const n = parseInt(process.env.SPY_MIN_ACTIVE_ADS || '25', 10);
  return Number.isFinite(n) && n >= 1 ? n : 25;
}

class LibraryVisitRegistry {
  /**
   * @param {object} [pageIntel] — loadFilterIntel()
   * @param {number} [minActiveAds]
   */
  constructor(pageIntel = null, minActiveAds = getMinActiveAds()) {
    this.minActiveAds = minActiveAds;
    /** @type {Map<string, { status: string, activeAds?: number, reason?: string }>} */
    this.byPage = new Map();
    this.pageIntel = pageIntel;
    this.stats = {
      libraryVisits: 0,
      pulled: 0,
      skippedDuplicate: 0,
      skippedLowAds: 0,
      skippedIntel: 0,
    };
  }

  _seedFromIntel(pageId) {
    const pid = normPageId(pageId);
    if (!pid || this.byPage.has(pid) || !this.pageIntel) return;

    if (this.pageIntel.rejectedPageIds?.has(pid)) {
      const row = this.pageIntel.rejectedPages?.find((r) => r.page_id === pid);
      const activeAds = row?.active_ads;
      if (typeof activeAds === 'number' && activeAds > 0 && activeAds < this.minActiveAds) {
        this.byPage.set(pid, {
          status: STATUS.LOW_ADS,
          activeAds,
          reason: 'cache: biblioteca com poucos ads',
        });
      }
    }
  }

  /** Já decidimos esta biblioteca nesta keyword — não voltar a entrar. */
  shouldSkipLibraryVisit(pageId) {
    const pid = normPageId(pageId);
    if (!pid) return true;

    this._seedFromIntel(pid);

    const row = this.byPage.get(pid);
    if (!row) return false;

    if (
      row.status === STATUS.LOW_ADS ||
      row.status === STATUS.PULLED ||
      row.status === STATUS.VISIT_ERROR ||
      row.status === STATUS.GOLD_CACHE
    ) {
      this.stats.skippedDuplicate += 1;
      return true;
    }
    return false;
  }

  markGoldCache(pageId, activeAds) {
    const pid = normPageId(pageId);
    if (!pid) return;
    this.byPage.set(pid, { status: STATUS.GOLD_CACHE, activeAds, reason: 'ouro cache' });
  }

  markLowAds(pageId, activeAds, reason = 'menos ads activos que o mínimo') {
    const pid = normPageId(pageId);
    if (!pid) return;
    this.byPage.set(pid, { status: STATUS.LOW_ADS, activeAds, reason });
    this.stats.skippedLowAds += 1;
  }

  markPulled(pageId, activeAds) {
    const pid = normPageId(pageId);
    if (!pid) return;
    this.byPage.set(pid, { status: STATUS.PULLED, activeAds });
    this.stats.pulled += 1;
  }

  markVisitError(pageId, message) {
    const pid = normPageId(pageId);
    if (!pid) return;
    this.byPage.set(pid, { status: STATUS.VISIT_ERROR, reason: message?.slice(0, 120) });
  }

  bumpLibraryVisit() {
    this.stats.libraryVisits += 1;
  }

  getStatus(pageId) {
    return this.byPage.get(normPageId(pageId)) || null;
  }
}

module.exports = {
  LibraryVisitRegistry,
  STATUS,
  getMinActiveAds,
};
