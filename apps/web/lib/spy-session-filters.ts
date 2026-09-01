const CTA_LABELS: Record<string, string> = {
  quiz: 'Quiz',
  vsl: 'VSL',
  lead: 'Lead / Opt-in',
  venda: 'Venda directa',
  sorteio: 'Sorteio',
  universal: 'Universal',
}

export function formatDiscoveryTarget(stats?: Record<string, unknown>): string | null {
  const raw = stats?.discoveryTarget ?? stats?.maxAdsLimit
  if (raw === 'unlimited' || raw === 0 || raw == null) return 'Sem limite de discoveries'
  const n = typeof raw === 'number' ? raw : parseInt(String(raw), 10)
  if (!Number.isFinite(n)) return null
  return `Parar aos ${n} discovery${n === 1 ? '' : 's'}`
}

export function formatMinActiveAds(stats?: Record<string, unknown>): string | null {
  const raw = stats?.minActiveAds
  if (raw == null) return null
  const n = typeof raw === 'number' ? raw : parseInt(String(raw), 10)
  if (!Number.isFinite(n) || n < 1) return null
  return `${n}+ ads activos`
}

export function formatDaysActiveFilter(stats?: Record<string, unknown>): string | null {
  const minN = parseInt(String(stats?.minDaysActive ?? ''), 10)
  const maxN = parseInt(String(stats?.maxDaysActive ?? ''), 10)
  const hasMin = Number.isFinite(minN) && minN > 0
  const hasMax = Number.isFinite(maxN) && maxN > 0
  if (hasMin && hasMax) return `${minN}–${maxN} dias activos`
  if (hasMin) return `≥${minN} dias activos`
  if (hasMax) return `≤${maxN} dias activos`
  return null
}

export function formatCtaHunt(
  stats?: Record<string, unknown>,
  marketIntel?: Record<string, unknown> | null
): string | null {
  const intel = marketIntel || (stats?.marketIntel as Record<string, unknown> | undefined)
  const types = intel?.ctaTypes as string[] | undefined
  if (!types?.length) return null
  const filtered = types.filter((t) => t !== 'universal')
  if (!filtered.length) return null
  return `CTA: ${filtered.map((t) => CTA_LABELS[t] || t).join(', ')}`
}

export interface SpyFilterSession {
  country?: string
  language?: string
  nicho?: string
  produto?: string
  keywordSeed?: string
  stats?: Record<string, unknown>
  marketIntel?: Record<string, unknown> | null
}

/** Filtros escolhidos no formulário antes de iniciar a pesquisa. */
export function buildSpyFilterChips(session: SpyFilterSession): string[] {
  const stats = session.stats || {}
  const chips: string[] = []

  const minAds = formatMinActiveAds(stats)
  if (minAds) chips.push(minAds)

  const discovery = formatDiscoveryTarget(stats)
  if (discovery) chips.push(discovery)

  const days = formatDaysActiveFilter(stats)
  if (days) chips.push(days)

  if (session.nicho) chips.push(session.nicho)
  if (session.produto) chips.push(session.produto)
  if (session.keywordSeed) chips.push(`Seed: ${session.keywordSeed}`)

  const cta = formatCtaHunt(stats, session.marketIntel)
  if (cta) chips.push(cta)

  return chips
}

export function formatSpyFilterSummary(session: SpyFilterSession): string {
  return buildSpyFilterChips(session).join(' · ')
}
