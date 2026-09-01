/**
 * Scan de ads numa biblioteca importada → library_ads → copy_vault (elegíveis).
 * Fase 1: scrape Meta + filtro OR + download imagens. Whisper/IA = fase seguinte.
 */
const { scrapeLibraryPagePhase } = require('./spy-meta-scraper');
const { extractPageIdFromUrl, buildPageLibraryUrl } = require('./spy-url-builder');
const { creativeHash: hashCreative } = require('./copy-eligibility');
const { downloadCopyImage } = require('./copy-assets');
const {
  getLibraryForCopy,
  upsertCopyJob,
  updateCopyJob,
  upsertLibraryAd,
  updateLibraryAdImagePath,
  markMissingAdsInactive,
  upsertCopyVaultFromLibraryAd,
} = require('./copy-vault-db');

const activeScans = new Set();

function resolveLibraryScanUrl(library) {
  const raw = library.sourceValue?.trim();
  if (!raw) return null;
  if (/facebook\.com\/ads\/library/i.test(raw)) return raw;
  const pageId = extractPageIdFromUrl(raw);
  if (pageId) return buildPageLibraryUrl(pageId, library.paises || 'BR');
  // Rejeitar valores que não são URLs válidas em vez de passar lixo ao scraper
  if (!/^https?:\/\//i.test(raw)) return null;
  return raw;
}

function detectMediaType(ad) {
  // Prioridade: video_url directo (DOM extractor) → snapshot GraphQL (camelCase e snake_case) → thumbnail
  if (ad.videoUrl) return { type: 'video', videoUrl: ad.videoUrl };
  const snap = ad.rawMetadata?.snapshot || ad.rawMetadata?.raw?.snapshot || {};
  const card = Array.isArray(snap.cards) && snap.cards[0] ? snap.cards[0] : {};
  const videoUrl = card.videoSdUrl || card.videoHdUrl || card.videoUrl
    || card.video_sd_url || card.video_hd_url || card.video_url || null;
  if (videoUrl) return { type: 'video', videoUrl };
  if (ad.thumbnailUrl) return { type: 'image', imageUrl: ad.thumbnailUrl };
  return { type: 'text' };
}

async function processLibraryCopyScan(libraryId) {
  if (activeScans.has(libraryId)) return;
  activeScans.add(libraryId);

  try {
    await upsertCopyJob(libraryId, { status: 'queued' });
    const library = await getLibraryForCopy(libraryId);
    if (!library) throw new Error('Biblioteca não encontrada');

    const scanUrl = resolveLibraryScanUrl(library);
    if (!scanUrl) throw new Error('URL da biblioteca inválida');

    await updateCopyJob(libraryId, {
      status: 'scanning',
      started_at: new Date(),
      error_message: null,
    });

    console.log(`📋 Copy scan: ${library.name} — ${scanUrl.slice(0, 80)}...`);

    const maxAds = parseInt(process.env.COPY_SCAN_MAX_ADS || '80', 10) || 80;
    // BIBLIOTECAS = IP DIRECTO DA CONTABO (sem proxy, sem mobile). O VPS trabalha 24/7
    // sozinho. directScrape → browser directo na VPS. (Mobile é EXCLUSIVO do SPY.)
    const phase1 = await scrapeLibraryPagePhase(scanUrl, { maxAds, directScrape: true, aiGuided: false });

    const hashCounts = new Map();
    for (const ad of phase1.ads) {
      const h = hashCreative(ad);
      hashCounts.set(h, (hashCounts.get(h) || 0) + 1);
    }

    let eligibleCount = 0;
    let copiesCreated = 0;
    const seenAdIds = [];

    for (const ad of phase1.ads) {
      if (ad.adId) seenAdIds.push(String(ad.adId));
      const h = hashCreative(ad);
      const duplicateCount = hashCounts.get(h) || 1;
      const media = detectMediaType(ad);

      const row = await upsertLibraryAd(
        libraryId,
        {
          ...ad,
          bodyText: ad.bodyText || ad.headline || null,
          videoUrl: media.videoUrl || null,
          thumbnailUrl: media.imageUrl || ad.thumbnailUrl,
        },
        { duplicateCount, creativeHash: h }
      );

      if (!row.eligible_for_copy) continue;
      eligibleCount += 1;

      if (media.type === 'image' && (media.imageUrl || ad.thumbnailUrl)) {
        const rel = await downloadCopyImage(media.imageUrl || ad.thumbnailUrl, {
          libraryId,
          metaAdId: ad.adId,
        });
        if (rel) {
          await updateLibraryAdImagePath(row.id, rel);
          row.image_local_path = rel;
        }
      }

      const vault = await upsertCopyVaultFromLibraryAd(row, library);
      if (vault) copiesCreated += 1;
    }

    // Ads que já não aparecem no scan → marcar inativos (congela days_active)
    const inactivated = await markMissingAdsInactive(libraryId, seenAdIds);

    await updateCopyJob(libraryId, {
      status: 'done',
      ads_scanned: phase1.ads.length,
      ads_eligible: eligibleCount,
      copies_created: copiesCreated,
      completed_at: new Date(),
    });

    if (inactivated > 0) console.log(`   🔻 ${inactivated} ads marcados inativos (deixaram de circular)`);

    // Auto-classificação IA: corrige país/nicho/produto/idioma com base na copy real
    try {
      const { classifyLibrary } = require('./library-classifier');
      await classifyLibrary(libraryId, { apply: true });
    } catch (e) {
      console.warn(`⚠️ auto-classify ${libraryId}:`, e.message);
    }

    console.log(
      `   ✅ Copy scan ${library.name}: ${phase1.ads.length} ads → ${eligibleCount} elegíveis → ${copiesCreated} no vault`
    );
  } catch (err) {
    console.error(`❌ Copy scan ${libraryId}:`, err.message);
    await updateCopyJob(libraryId, {
      status: 'error',
      error_message: err.message?.slice(0, 500),
      completed_at: new Date(),
    });
  } finally {
    activeScans.delete(libraryId);
  }
}

function enqueueLibraryCopyScan(libraryId) {
  if (!libraryId) return;
  upsertCopyJob(libraryId, { status: 'queued' }).catch((err) =>
    console.warn('⚠️ copy job queue:', err.message)
  );
  setImmediate(() => {
    processLibraryCopyScan(libraryId).catch((err) =>
      console.error(`❌ Copy scan background ${libraryId}:`, err.message)
    );
  });
}

module.exports = {
  enqueueLibraryCopyScan,
  processLibraryCopyScan,
};
