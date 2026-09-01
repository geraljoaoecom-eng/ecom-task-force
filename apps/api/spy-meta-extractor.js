/**

 * SPY Fase 3 — extracção completa só dos anúncios relevantes.

 * Visita biblioteca page_id via proxy + scroll guiado por Gemini.

 */

const {

  scrapeLibraryPagePhase,

  randomDelay,

  getMetaConfig,

} = require('./spy-meta-scraper');



function decodeUrl(url) {

  if (!url || typeof url !== 'string') return null;

  return url

    .replace(/&amp;/g, '&')

    .replace(/\\u0026/g, '&')

    .replace(/\\\//g, '/')

    .trim();

}



function extractFullFromSnapshot(snapshot = {}) {

  const card = Array.isArray(snapshot.cards) && snapshot.cards[0] ? snapshot.cards[0] : {};

  const body = snapshot.body?.text || card.body || '';

  const title = snapshot.title || card.title || '';

  const fullCopy = [title, body].filter(Boolean).join('\n\n').trim();



  return {

    fullCopy,

    headline: title || body.slice(0, 150),

    imageUrl:

      card.originalImageUrl ||

      card.resizedImageUrl ||

      (Array.isArray(snapshot.images) && snapshot.images[0]?.originalImageUrl) ||

      null,

    videoUrl: card.videoSdUrl || card.videoHdUrl || card.videoUrl || null,

    landingUrl: decodeUrl(snapshot.linkUrl || card.linkUrl),

    pageName: snapshot.pageName || null,

    targeting: snapshot.targetedOrReachedCountries || snapshot.deliveryByRegion || null,

    impressions: snapshot.impressionsWithIndex || snapshot.impressions || null,

    reach: snapshot.reachEstimate || snapshot.euTotalReach || null,

    startDate: snapshot.startDate || snapshot.start_date || null,

    endDate: snapshot.endDate || snapshot.end_date || null,

    isActive: snapshot.isActive !== false,

  };

}



function enrichFromRawMetadata(metaAd) {

  const snap = metaAd.rawMetadata?.snapshot || metaAd.rawMetadata?.raw?.snapshot || {};

  const fromSnap = extractFullFromSnapshot(snap);

  return {

    ...metaAd,

    fullDetails: {

      ...fromSnap,

      adId: metaAd.adId,

      pageId: metaAd.pageId,

      pageName: metaAd.pageName || fromSnap.pageName,

      thumbnailUrl: metaAd.thumbnailUrl || fromSnap.imageUrl,

      scrapePhase: 'full',

      extractedAt: new Date().toISOString(),

    },

  };

}



function getDefaultMaxDetailFetches() {

  const n = parseInt(process.env.SPY_LIBRARY_MAX_DETAIL_FETCHES || '100', 10);

  return Number.isFinite(n) && n >= 0 ? Math.min(n, 500) : 100;

}



function getLibraryScrapeMaxAds() {

  const n = parseInt(process.env.SPY_LIBRARY_AI_MAX_ADS || '800', 10);

  return Number.isFinite(n) && n > 0 ? n : 800;

}



async function scrapeLibraryForDetails(libraryUrl, options = {}) {

  const maxAds = options.maxAds ?? getLibraryScrapeMaxAds();

  return scrapeLibraryPagePhase(libraryUrl, {

    maxAds,

    aiGuided: true,

    scrollToEnd: options.scrollToEnd !== false,

    onScrollProgress: options.onScrollProgress,

  });

}



/**

 * Fase 3 — detalhes completos para lista relevante.

 */

async function extractFullDetailsPhase(relevantAds, options = {}) {

  const maxDetailFetches = options.maxDetailFetches ?? getDefaultMaxDetailFetches();

  const enriched = [];

  let detailFetches = 0;

  const onProgress = options.onLibraryProgress;



  console.log(`   🔬 SPY Meta Fase 3: ${relevantAds.length} anúncios relevantes`);



  for (const ad of relevantAds) {

    let item = enrichFromRawMetadata(ad);

    const fd = item.fullDetails || {};

    const needsVisit =

      (!fd.fullCopy || fd.fullCopy.length < 40) && ad.libraryUrl && detailFetches < maxDetailFetches;



    if (needsVisit) {

      try {

        detailFetches += 1;

        if (onProgress) {

          await onProgress({

            libraryVisits: detailFetches,

            message: `Biblioteca ${detailFetches}/${Math.min(maxDetailFetches, relevantAds.length)} — ${ad.pageName || ad.pageId}`,

            pageName: ad.pageName || ad.pageId,

          });

        }



        const scraped = await scrapeLibraryForDetails(ad.libraryUrl, {

          onScrollProgress: async (p) => {

            if (onProgress) {

              await onProgress({

                libraryVisits: detailFetches,

                adsCollected: p.adsCollected,

                aiAction: p.aiAction,

                message: `Biblioteca: ${p.adsCollected ?? 0} ads · ${p.aiAction || 'scroll'}`,

              });

            }

          },

        });



        const best = scraped.ads?.[0];

        const bodyFromPage = scraped.bodyText || '';

        item.fullDetails = {

          ...fd,

          fullCopy:

            fd.fullCopy ||

            best?.adText ||

            best?.headline ||

            bodyFromPage.slice(0, 4000),

          landingUrl: fd.landingUrl || best?.landingUrl,

          pageScrapeNote: 'library_ai_scrape',

          libraryAdsCollected: scraped.rawCount,

        };

        await new Promise((r) =>

          setTimeout(r, randomDelay(getMetaConfig().delayMin, getMetaConfig().delayMax))

        );

      } catch (err) {

        item.fullDetails = { ...fd, extractError: err.message };

      }

    }



    enriched.push(item);

  }



  console.log(`   ✅ SPY Meta Fase 3: ${enriched.length} enriquecidos (${detailFetches} visitas biblioteca AI)`);



  return enriched;

}



module.exports = {

  extractFullDetailsPhase,

  enrichFromRawMetadata,

  extractFullFromSnapshot,

  scrapeLibraryForDetails,

};

