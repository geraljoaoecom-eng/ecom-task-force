const { buildPageLibraryUrl, resolveSpyMarketCountry, withLibraryCountry } = require('./spy-url-builder');

function mapEnrichedToSpyAds(enrichedAds, marketCountry) {
  const cc = resolveSpyMarketCountry(marketCountry);
  const byPage = new Map();

  for (const item of enrichedAds) {
    const fd = item.fullDetails || {};
    const pageId = String(item.pageId || '').replace(/\D/g, '');
    if (!pageId) continue;

    const adText = (fd.fullCopy || item.headline || '').slice(0, 800);
    const candidate = {
      pageId,
      libraryUrl:
        withLibraryCountry(item.libraryUrl, cc) ||
        buildPageLibraryUrl(pageId, cc),
      adText,
      imageUrl: fd.imageUrl || item.thumbnailUrl || null,
      videoUrl: fd.videoUrl || null,
      landingUrl: fd.landingUrl || item.landingUrl || null,
      pageName: fd.pageName || item.pageName || null,
      metaAdId: item.adId,
      relevanceScore: item.relevance?.score ?? 0.85,
      relevanceReason: item.relevance?.reason ?? 'mobile_library_verified',
      activeAdsEstimate: item.activeAds ?? fd.activeAds ?? null,
      rawMeta: {
        adId: item.adId,
        headline: item.headline,
        thumbnailUrl: item.thumbnailUrl,
        startDate: item.startDate,
        adStatus: item.adStatus,
        activeAds: item.activeAds,
        fullDetails: fd,
      },
    };

    const existing = byPage.get(pageId);
    if (!existing || (candidate.adText?.length || 0) > (existing.adText?.length || 0)) {
      byPage.set(pageId, { ...existing, ...candidate });
    }
  }

  return [...byPage.values()];
}

module.exports = { mapEnrichedToSpyAds };
