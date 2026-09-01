const { computeDaysActive, parseMetaStartDate } = require('./copy-eligibility');

const MONTHS = {
  jan: 0, january: 0, ene: 0, janv: 0,
  feb: 1, february: 1, fev: 1, febrero: 1, fév: 1, fevr: 1,
  mar: 2, march: 2, março: 2, marzo: 2, mars: 2,
  apr: 3, april: 3, abr: 3, avr: 3,
  may: 4, mai: 4, mayo: 4,
  jun: 5, june: 5, junho: 5, junio: 5, juin: 5,
  jul: 6, july: 6, julho: 6, julio: 6, juil: 6,
  aug: 7, august: 7, ago: 7, août: 7,
  sep: 8, sept: 8, september: 8, set: 8, septiembre: 8,
  oct: 9, october: 9, out: 9, octubre: 9, octobre: 9,
  nov: 10, november: 10, novembro: 10, noviembre: 10, novembre: 10,
  dec: 11, december: 11, dez: 11, diciembre: 11, décembre: 11, decembre: 11,
};

function parseAdStartDate(raw) {
  if (raw == null || raw === '') return null;
  const direct = parseMetaStartDate(raw);
  if (direct && !Number.isNaN(direct.getTime())) return direct;

  const s = String(raw).trim().replace(/\s+/g, ' ');
  const m = s.match(/^(\d{1,2})\s+(?:de\s+)?([a-záàâãéêíóôõúç.]{3,12})\.?\s+(?:de\s+)?(\d{4})$/i);
  if (m) {
    const day = parseInt(m[1], 10);
    const monKey = m[2].toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').slice(0, 12);
    const year = parseInt(m[3], 10);
    const month = MONTHS[monKey] ?? MONTHS[monKey.slice(0, 3)];
    if (Number.isFinite(day) && Number.isFinite(year) && month != null) {
      const d = new Date(Date.UTC(year, month, day));
      if (!Number.isNaN(d.getTime())) return d;
    }
  }
  return null;
}

/**
 * @returns {null | { enabled: true, minDays: number, maxDays: number | null }}
 */
function parseDaysActiveFilter(minRaw, maxRaw) {
  const minParsed = minRaw != null && minRaw !== '' ? parseInt(String(minRaw), 10) : null;
  const maxParsed = maxRaw != null && maxRaw !== '' ? parseInt(String(maxRaw), 10) : null;
  const hasMin = Number.isFinite(minParsed) && minParsed >= 0;
  const hasMax = Number.isFinite(maxParsed) && maxParsed >= 0;
  if (!hasMin && !hasMax) return null;

  let minDays = hasMin ? minParsed : 0;
  let maxDays = hasMax ? maxParsed : null;
  if (maxDays != null && minDays > maxDays) {
    [minDays, maxDays] = [maxDays, minDays];
  }
  return { enabled: true, minDays, maxDays };
}

function daysActiveFilterFromSession(session) {
  return parseDaysActiveFilter(session?.stats?.minDaysActive, session?.stats?.maxDaysActive);
}

function getAdDaysActive(ad) {
  if (!ad || typeof ad !== 'object') return null;
  if (Number.isFinite(ad.daysActive)) return ad.daysActive;
  const raw = ad.startDate || ad.startDateRaw || ad.start_date;
  const started = parseAdStartDate(raw);
  if (!started) return null;
  const isActive = ad.isActive !== false && ad.adStatus !== 'inactive';
  const ended = ad.endDate ? parseAdStartDate(ad.endDate) : null;
  return computeDaysActive(started, isActive, ended);
}

function adInDaysActiveRange(ad, filter) {
  if (!filter?.enabled) return true;
  const days = getAdDaysActive(ad);
  if (days == null) return false;
  const lo = filter.minDays ?? 0;
  const hi = filter.maxDays ?? Infinity;
  return days >= lo && days <= hi;
}

function libraryHasAdInAgeRange(ads, filter) {
  if (!filter?.enabled) return true;
  if (!Array.isArray(ads) || !ads.length) return false;
  return ads.some((ad) => adInDaysActiveRange(ad, filter));
}

function formatDaysActiveFilter(filter) {
  if (!filter?.enabled) return '';
  const lo = filter.minDays ?? 0;
  const hi = filter.maxDays;
  if (hi == null) return `${lo}+ dias activos`;
  if (lo === hi) return `${lo} dias activos`;
  return `${lo}–${hi} dias activos`;
}

function mergeDomAds(existing, incoming) {
  const byId = new Map();
  for (const ad of [...(existing || []), ...(incoming || [])]) {
    const id = ad?.adId || ad?.meta_ad_id;
    if (id) byId.set(String(id), ad);
    else if (ad) byId.set(`_${byId.size}`, ad);
  }
  return Array.from(byId.values());
}

module.exports = {
  parseAdStartDate,
  parseDaysActiveFilter,
  daysActiveFilterFromSession,
  getAdDaysActive,
  adInDaysActiveRange,
  libraryHasAdInAgeRange,
  formatDaysActiveFilter,
  mergeDomAds,
};
