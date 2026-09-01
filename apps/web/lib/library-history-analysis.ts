import { ChartPoint } from './chart-utils'

export interface LibraryHistoryAnalysis {
  activeSince: string
  maxDay: { date: string; dayLabel: string; ads: number }
  minDay: { date: string; dayLabel: string; ads: number }
  average: number
  todayAds: number
  recordCount: number
  summary: string
}

function formatDatePt(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('pt-PT', { day: 'numeric', month: 'long', year: 'numeric' })
}

function formatMonthYear(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  const month = d.toLocaleDateString('pt-PT', { month: 'long' })
  return `${month.charAt(0).toUpperCase()}${month.slice(1)} ${d.getFullYear()}`
}

function findExtreme(points: ChartPoint[], mode: 'max' | 'min'): ChartPoint {
  if (points.length === 0) {
    return { dayLabel: '—', ads: 0, date: '', isToday: false }
  }

  return points.reduce((best, p) => {
    if (mode === 'max') return p.ads > best.ads ? p : best
    return p.ads < best.ads ? p : best
  })
}

function trendPhrase(recentAvg: number, overallAvg: number): string {
  if (overallAvg === 0) return 'Dados insuficientes para avaliar tendência recente.'
  const diff = ((recentAvg - overallAvg) / overallAvg) * 100

  if (diff > 15) return 'Nos últimos 7 dias a biblioteca mostra tendência **ascendente** face à média histórica.'
  if (diff < -15) return 'Nos últimos 7 dias a biblioteca mostra tendência **descendente** face à média histórica.'
  return 'Nos últimos 7 dias o volume mantém-se **estável** em relação à média histórica.'
}

function peakMonthPhrase(points: ChartPoint[]): string {
  const byMonth = new Map<string, { sum: number; count: number; max: number }>()

  for (const p of points) {
    const d = new Date(p.date)
    if (Number.isNaN(d.getTime())) continue
    const key = `${d.getFullYear()}-${d.getMonth()}`
    const entry = byMonth.get(key) ?? { sum: 0, count: 0, max: 0 }
    entry.sum += p.ads
    entry.count += 1
    entry.max = Math.max(entry.max, p.ads)
    byMonth.set(key, entry)
  }

  if (byMonth.size === 0) return ''

  let bestKey = ''
  let bestMax = -1
  for (const [key, val] of byMonth) {
    if (val.max > bestMax) {
      bestMax = val.max
      bestKey = key
    }
  }

  if (!bestKey || byMonth.size < 2) return ''

  const [y, m] = bestKey.split('-').map(Number)
  const sampleDate = new Date(y, m, 15).toISOString()
  return `Os picos mais elevados concentraram-se em **${formatMonthYear(sampleDate)}** (até ${bestMax} anúncios).`
}

function qualityPhrase(todayAds: number, average: number): string {
  if (average === 0) return 'Ainda não há base suficiente para avaliar a qualidade geral da biblioteca.'
  const ratio = todayAds / average

  if (ratio >= 1.15) return 'O valor atual está **acima da média**, sinal de biblioteca forte neste momento.'
  if (ratio <= 0.7) return 'O valor atual está **abaixo da média**, o que pode indicar desaceleração ou sazonalidade.'
  return 'O valor atual está **próximo da média histórica**, com comportamento consistente.'
}

export function buildLibraryHistoryAnalysis(fullHistory: ChartPoint[]): LibraryHistoryAnalysis {
  if (fullHistory.length === 0) {
    return {
      activeSince: '—',
      maxDay: { date: '—', dayLabel: '—', ads: 0 },
      minDay: { date: '—', dayLabel: '—', ads: 0 },
      average: 0,
      todayAds: 0,
      recordCount: 0,
      summary: 'Sem histórico suficiente para gerar análise.',
    }
  }

  const first = fullHistory[0]
  const last = fullHistory[fullHistory.length - 1]
  const maxPoint = findExtreme(fullHistory, 'max')
  const minPoint = findExtreme(fullHistory, 'min')
  const sum = fullHistory.reduce((a, p) => a + p.ads, 0)
  const average = Math.round(sum / fullHistory.length)
  const todayAds = last?.ads ?? 0

  const recent = fullHistory.slice(-7)
  const recentAvg =
    recent.length > 0 ? Math.round(recent.reduce((a, p) => a + p.ads, 0) / recent.length) : todayAds

  const activeSince = formatDatePt(first.date)
  const spanDays = first.daysAgo ?? 0

  const parts = [
    `Biblioteca com **média de ${average} anúncios** ativos, com **${fullHistory.length} registos** ao longo de **${spanDays > 0 ? `${spanDays} dias` : 'período recente'}**.`,
    `Ativa desde **${activeSince}**.`,
    peakMonthPhrase(fullHistory),
    trendPhrase(recentAvg, average),
    qualityPhrase(todayAds, average),
  ].filter(Boolean)

  return {
    activeSince,
    maxDay: {
      date: formatDatePt(maxPoint.date),
      dayLabel: maxPoint.dayLabel,
      ads: maxPoint.ads,
    },
    minDay: {
      date: formatDatePt(minPoint.date),
      dayLabel: minPoint.dayLabel,
      ads: minPoint.ads,
    },
    average,
    todayAds,
    recordCount: fullHistory.length,
    summary: parts.join(' '),
  }
}
