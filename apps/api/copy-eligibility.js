const MIN_DAYS_ACTIVE = parseInt(process.env.COPY_MIN_DAYS_ACTIVE || '3', 10) || 3;
const MIN_DUPLICATE_COUNT = parseInt(process.env.COPY_MIN_DUPLICATES || '3', 10) || 3;

function computeDaysActive(startedAt, isActive = true, endedAt = null) {
  if (!startedAt) return 0;
  const start = startedAt instanceof Date ? startedAt : new Date(startedAt);
  if (Number.isNaN(start.getTime())) return 0;
  // Ads inativos: usar ended_at se disponível, senão now()
  const end = (!isActive && endedAt)
    ? (endedAt instanceof Date ? endedAt : new Date(endedAt))
    : new Date();
  const ms = Math.max(0, end.getTime() - start.getTime());
  return Math.floor(ms / (24 * 60 * 60 * 1000));
}

function parseMetaStartDate(raw) {
  if (!raw) return null;
  if (typeof raw === 'number') return new Date(raw * 1000);
  const s = String(raw).trim();
  const ts = Date.parse(s);
  if (!Number.isNaN(ts)) return new Date(ts);
  return null;
}

function isEligibleForCopy(daysActive, duplicateCount) {
  const days = Number(daysActive) || 0;
  const dupes = Number(duplicateCount) || 0;
  if (days >= MIN_DAYS_ACTIVE) return { eligible: true, reason: 'days_active' };
  if (dupes >= MIN_DUPLICATE_COUNT) return { eligible: true, reason: 'duplicates' };
  return { eligible: false, reason: null };
}

function computeRankScore(daysActive, duplicateCount, activeAdsSnapshot = 0) {
  const days = Math.max(0, Number(daysActive) || 0);
  const dupes = Math.max(1, Number(duplicateCount) || 1);
  const ads = Math.max(0, Number(activeAdsSnapshot) || 0);
  return Math.round((days * dupes * Math.log10(ads + 10)) * 100) / 100;
}

function creativeHash(ad) {
  const crypto = require('crypto');
  const payload = [
    ad.headline || '',
    ad.thumbnailUrl || ad.image_url || '',
    ad.adId || ad.meta_ad_id || '',
  ].join('|');
  return crypto.createHash('sha256').update(payload).digest('hex').slice(0, 24);
}

module.exports = {
  MIN_DAYS_ACTIVE,
  MIN_DUPLICATE_COUNT,
  computeDaysActive,
  parseMetaStartDate,
  isEligibleForCopy,
  computeRankScore,
  creativeHash,
};
