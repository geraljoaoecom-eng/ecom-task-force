export interface ChartPoint {
  dayLabel: string
  ads: number
  date: string
  isToday?: boolean
  daysAgo?: number
}

export interface AdChartData {
  /** Label fixo da barra de referência */
  averageLabel: string
  /** Média de anúncios/dia ao longo do histórico */
  averageValue: number
  /** Número de dias com registo (para tooltip) */
  historyDayCount: number
  /** 6d → Hoje (7 barras) */
  recentData: ChartPoint[]
  /** Todo o histórico ordenado (mais antigo → hoje) */
  fullHistory: ChartPoint[]
  totalDays: number
}

/** Chave YYYY-MM-DD no fuso horário local (evita off-by-one com UTC). */
export function localDateKey(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function readAdsCount(item: Record<string, unknown>): number {
  return Number(
    item.adsCount ??
      item.ads_count ??
      item.activeAds ??
      item.ads ??
      item.value ??
      0
  )
}

export function formatDayLabel(daysAgo: number): string {
  if (daysAgo <= 0) return 'Hoje'
  if (daysAgo === 1) return 'Ontem'
  return `${daysAgo}d`
}

function daysAgoFromToday(d: Date, today: Date): number {
  const diff = today.getTime() - d.getTime()
  return Math.max(0, Math.round(diff / (24 * 60 * 60 * 1000)))
}

function parseRawToByDay(raw: unknown[]): Map<string, number> {
  const byDay = new Map<string, number>()

  for (const item of raw) {
    if (!item || typeof item !== 'object') continue
    const record = item as Record<string, unknown>
    const date = new Date(String(record.date || record.day || record.createdAt || ''))
    if (Number.isNaN(date.getTime())) continue

    const key = localDateKey(date)
    const ads = readAdsCount(record)
    const existing = byDay.get(key)
    if (existing === undefined || ads > existing) {
      byDay.set(key, ads)
    }
  }

  return byDay
}

export function buildAdChartData(raw: unknown[], currentAds = 0): AdChartData {
  const byDay = parseRawToByDay(Array.isArray(raw) ? raw : [])

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const todayKey = localDateKey(today)

  if (currentAds > 0) {
    const existing = byDay.get(todayKey) ?? 0
    byDay.set(todayKey, Math.max(existing, currentAds))
  }

  const sortedKeys = [...byDay.keys()].sort()

  const fullHistory: ChartPoint[] = sortedKeys.map((key) => {
    const [y, m, day] = key.split('-').map(Number)
    const d = new Date(y, m - 1, day)
    d.setHours(0, 0, 0, 0)
    const daysAgo = daysAgoFromToday(d, today)
    return {
      dayLabel: formatDayLabel(daysAgo),
      ads: byDay.get(key) ?? 0,
      date: d.toISOString(),
      isToday: daysAgo === 0,
      daysAgo,
    }
  })

  if (fullHistory.length === 0 && currentAds > 0) {
    fullHistory.push({
      dayLabel: 'Hoje',
      ads: currentAds,
      date: today.toISOString(),
      isToday: true,
      daysAgo: 0,
    })
  }

  const oldest = fullHistory[0]
  const totalDays = oldest?.daysAgo ?? 0
  const historyDayCount = fullHistory.length

  const sumAds = fullHistory.reduce((acc, p) => acc + p.ads, 0)
  const averageValue =
    historyDayCount > 0 ? Math.round(sumAds / historyDayCount) : currentAds > 0 ? currentAds : 0
  const averageLabel = 'Média'

  const recentData: ChartPoint[] = []
  for (let daysAgo = 6; daysAgo >= 0; daysAgo--) {
    const d = new Date(today)
    d.setDate(d.getDate() - daysAgo)
    const key = localDateKey(d)
    let ads = byDay.get(key) ?? 0
    if (daysAgo === 0 && currentAds > 0) ads = Math.max(ads, currentAds)

    recentData.push({
      dayLabel: formatDayLabel(daysAgo),
      ads,
      date: d.toISOString(),
      isToday: daysAgo === 0,
      daysAgo,
    })
  }

  return { averageLabel, averageValue, historyDayCount, recentData, fullHistory, totalDays }
}

/** Labels no histórico completo: ~cada 7 dias + primeiro, Ontem e Hoje */
export function shouldShowFullHistoryLabel(
  index: number,
  total: number,
  daysAgo: number
): boolean {
  if (index === 0 || index === total - 1) return true
  if (daysAgo === 1) return true
  return daysAgo % 7 === 0
}

/** @deprecated Use buildAdChartData */
export function normalizeHistory(raw: unknown[], _days = 8, currentAds = 0): ChartPoint[] {
  const { averageLabel, averageValue, recentData } = buildAdChartData(raw, currentAds)
  if (recentData.length === 0 && averageValue === 0) return []
  return [
    { dayLabel: averageLabel, ads: averageValue, date: '', isToday: false },
    ...recentData,
  ]
}

export function buildFallbackChart(currentAds: number): AdChartData {
  return buildAdChartData([], currentAds)
}
