'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import {
  ScanSearch,
  Plus,
  Loader2,
  Trash2,
  Pause,
  Play,
  XCircle,
  ChevronRight,
  Globe,
  Sparkles,
  List,
} from 'lucide-react'
import AdminGuard from '../../components/AdminGuard'
import SpyMobileBridge from '../../components/SpyMobileBridge'
import SpyTrendsPanel from '../../components/SpyTrendsPanel'
import { SpyKeywordPreviewPanel } from '@/components/SpyKeywordPreviewPanel'
import type { SpyMarketIntelData } from '@/components/SpyMarketIntel'
import { spyApi } from '@/lib/api'
import { getSpyDeviceChoice, spyStartBlockedMessage } from '@/lib/spy-device-mode'
import { useSpyJob } from '@/context/SpyJobContext'
import {
  SpyCountryMultiField,
  SpyCreatableField,
  SpyLanguageField,
  countryLabelFromOptions,
  type CountryOption,
} from '@/components/SpyFormFields'

const DEFAULT_NICHOS = [
  'EMAGRECIMENTO', 'DIABETES', 'SEXUAL', 'RELIGIOSO', 'RELACIONAMENTO', 'EDUCACIONAL',
  'TINNITUS', 'MEMÓRIA', 'VISÃO', 'SORTEIO E RIFAS',
]
const DEFAULT_PRODUTOS = ['INFO', 'NUTRA', 'APP', 'SORTEIOS', 'Store']

const CTA_FUNNEL_TYPES = [
  { id: 'quiz', label: 'Quiz', hint: 'faça o quiz / take the quiz' },
  { id: 'vsl', label: 'VSL', hint: 'assista ao vídeo' },
  { id: 'lead', label: 'Lead / Opt-in', hint: 'inscreva-se grátis' },
  { id: 'venda', label: 'Venda directa', hint: 'compre agora' },
  { id: 'sorteio', label: 'Sorteio', hint: 'participe / concorra' },
] as const

const DISCOVERY_TARGET_OPTIONS = [
  { value: '1', label: 'Parar ao 1º discovery' },
  { value: '3', label: 'Parar aos 3 discoveries' },
  { value: '5', label: 'Parar aos 5 discoveries' },
  { value: '10', label: 'Parar aos 10 discoveries' },
  { value: '25', label: 'Parar aos 25 discoveries' },
  { value: '50', label: 'Parar aos 50 discoveries' },
  { value: 'unlimited', label: 'Todos os resultados (sem limite)' },
]

function formatDiscoveryTarget(stats: Record<string, unknown> | undefined) {
  const raw = stats?.discoveryTarget ?? stats?.maxAdsLimit
  if (raw === 'unlimited' || raw === 0 || raw == null) return 'Todos os discoveries'
  const n = typeof raw === 'number' ? raw : parseInt(String(raw), 10)
  if (!Number.isFinite(n)) return String(raw)
  return `Meta: ${n} discovery${n === 1 ? '' : 's'}`
}

const LOCAL_PORT = 9780
const LOCAL_BASE = `http://127.0.0.1:${LOCAL_PORT}`
const MAX_MANUAL_KEYWORDS = 50

function parseBulkKeywords(raw: string): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const part of raw.split(/[\n,;]+/)) {
    const kw = part.trim()
    if (!kw) continue
    const key = kw.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push(kw)
    if (out.length >= MAX_MANUAL_KEYWORDS) break
  }
  return out
}

async function isOnIPhoneHotspot(): Promise<boolean> {
  const start = Date.now()
  try {
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), 900)
    await fetch('http://172.20.10.1', { mode: 'no-cors', signal: ctrl.signal, cache: 'no-store' })
    clearTimeout(timer)
    return true
  } catch (e: any) {
    if (e?.name === 'AbortError') return false
    return (Date.now() - start) < 600
  }
}

async function probeLocalBridge(): Promise<boolean> {
  try {
    const res = await fetch(`${LOCAL_BASE}/status`, { cache: 'no-store', mode: 'cors' })
    const data = await res.json()
    return !!(data.agentRunning && data.mobileCheck?.ok)
  } catch {
    return false
  }
}

async function assertMobileData(): Promise<void> {
  // Verifica em tempo real se o Mac está em dados móveis antes de iniciar SPY.
  // Lança erro se estiver em WiFi ou se não conseguir confirmar.
  let status: any = null
  try {
    const res = await fetch(`${LOCAL_BASE}/status`, { cache: 'no-store', mode: 'cors' })
    status = await res.json()
  } catch {
    throw new Error(
      '⚠️ Não foi possível verificar o tipo de ligação.\n\nAssegura que a ponte local está activa (porta 9780) e tenta novamente.'
    )
  }
  if (!status.agentRunning) {
    throw new Error('⚠️ Ponte local não está a correr. Clica «Activar» antes de pesquisar.')
  }
  if (!status.mobileCheck?.ok) {
    const reason = status.mobileCheck?.reason || 'ligação não identificada como dados móveis'
    throw new Error(
      `🚫 MAC EM WI-FI — PESQUISA BLOQUEADA\n\n${reason}\n\nTroca para o hotspot do iPhone (5G/MEO) antes de pesquisar.\nUsar o IP da fibra vai levar ao bloqueio imediato do Meta.`
    )
  }
}

async function ensureVpsBridgeReady(): Promise<boolean> {
  try {
    const st = await spyApi.getMobileStatus()
    if (st?.ready) return true
  } catch {
    // ignore
  }

  const localOk = await probeLocalBridge()
  if (!localOk) return false

  try {
    await fetch(`${LOCAL_BASE}/reconnect`, { method: 'POST', mode: 'cors' })
  } catch {
    // ignore
  }

  for (let i = 0; i < 25; i += 1) {
    await new Promise((r) => setTimeout(r, 1000))
    try {
      const st = await spyApi.getMobileStatus()
      if (st?.ready) return true
    } catch {
      // ignore
    }
  }
  return false
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '0.625rem',
  background: '#0c0f14',
  border: '1px solid rgba(245,210,108,0.2)',
  borderRadius: '0.5rem',
  color: '#E8EDF2',
  boxSizing: 'border-box',
  fontSize: '0.875rem',
}

const STATUS_LABEL: Record<string, { label: string; color: string }> = {
  queued: { label: 'Na fila', color: '#94a3b8' },
  running: { label: 'A pesquisar', color: '#F5D26C' },
  paused: { label: 'Pausada', color: '#fcd34d' },
  completed: { label: 'Concluída', color: '#4ade80' },
  cancelled: { label: 'Cancelada', color: '#f87171' },
  timeout: { label: 'Timeout (8h)', color: '#fb923c' },
}

export default function SpyPage() {
  const { startSpySearch, refreshSessions, pauseSession, cancelSession, resumeSession } = useSpyJob()
  const [sessions, setSessions] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [networkMobile, setNetworkMobile] = useState<boolean | null>(null)
  const [agentMobileOk, setAgentMobileOk] = useState(false)
  const [config, setConfig] = useState<{
    smtp: boolean
    ai: boolean
    mobileBridge?: {
      required: boolean
      ready: boolean
      agentCount: number
      agents: { id: string; deviceName: string; ip: string; isp: string; mobileValidated?: boolean }[]
      message: string
    }
  } | null>(null)
  const [formCountries, setFormCountries] = useState<string[]>([])
  const [form, setForm] = useState({
    name: '',
    language: '',
    keywordSeed: '',
    nicho: '',
    produto: '',
    discoveryTarget: 'unlimited',
    minActiveAds: '25',
    minDaysActive: '',
    maxDaysActive: '',
    maxHours: '8',
    brief: '',
    bulkKeywords: '',
  })
  const [keywordMode, setKeywordMode] = useState<'manual' | 'gpt'>('manual')
  const [ctaTypes, setCtaTypes] = useState<string[]>([])
  const [sweepInfo, setSweepInfo] = useState<{ isSweep: boolean; countries: { code: string; label: string }[] } | null>(null)
  const [previewIntel, setPreviewIntel] = useState<SpyMarketIntelData | null>(null)
  const [editableKeywords, setEditableKeywords] = useState<string[]>([])
  const [generatingPlan, setGeneratingPlan] = useState(false)
  const [refiningPlan, setRefiningPlan] = useState(false)
  const [formOptions, setFormOptions] = useState<{
    countries: CountryOption[]
    languages: { value: string; label: string }[]
    nichos: string[]
    produtos: string[]
  } | null>(null)

  const load = useCallback(async () => {
    try {
      const [data, cfg] = await Promise.all([
        spyApi.listSessions(),
        spyApi.getConfig().catch(() => null),
      ])
      setSessions(data)
      if (cfg) setConfig(cfg)
      await refreshSessions()
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }, [refreshSessions])

  useEffect(() => {
    load()
    const t = setInterval(load, 20000)
    return () => clearInterval(t)
  }, [load])

  useEffect(() => {
    spyApi.getFormOptions().then(setFormOptions).catch(() => {})
  }, [])

  // Multi-país / Language Sweep: banner quando vários países ou idioma sem país
  useEffect(() => {
    if (formCountries.length > 1) {
      setSweepInfo({
        isSweep: true,
        countries: formCountries.map((c) => ({
          code: c,
          label: countryLabelFromOptions(c, formOptions?.countries || []),
        })),
      })
      return
    }
    if (!formCountries.length && form.language.trim()) {
      spyApi
        .sweepPreview({ language: form.language.trim() })
        .then((data) => {
          if (data?.isSweep && data.countries?.length) {
            setSweepInfo({ isSweep: true, countries: data.countries })
          } else {
            setSweepInfo(null)
          }
        })
        .catch(() => setSweepInfo(null))
      return
    }
    setSweepInfo(null)
  }, [formCountries, form.language, formOptions?.countries])

  const [localBridgeOk, setLocalBridgeOk] = useState(false)

  const probeLocal = useCallback(async () => {
    const ok = await probeLocalBridge()
    setLocalBridgeOk(ok)
    return ok
  }, [])

  useEffect(() => {
    // Só faz sentido em Mac/Windows — no iPhone/iPad o probe localhost só gasta bateria/rede
    const choice = getSpyDeviceChoice()
    if (!isDesktopBridgeChoice(choice)) {
      setLocalBridgeOk(false)
      return undefined
    }
    probeLocal()
    const t = setInterval(probeLocal, 15000)
    return () => clearInterval(t)
  }, [probeLocal])

  const mobileRequired = config?.mobileBridge?.required !== false
  const canAttemptStart = !mobileRequired || agentMobileOk

  const resetForm = () => {
    setFormCountries([])
    setForm({
      name: '',
      language: '',
      keywordSeed: '',
      nicho: '',
      produto: '',
      discoveryTarget: 'unlimited',
      minActiveAds: '25',
      minDaysActive: '',
      maxDaysActive: '',
      maxHours: '8',
      brief: '',
      bulkKeywords: '',
    })
    setPreviewIntel(null)
    setEditableKeywords([])
    setKeywordMode('manual')
    setCtaTypes([])
  }

  const daysActiveParams = () => ({
    ...(form.minDaysActive.trim() ? { minDaysActive: form.minDaysActive.trim() } : {}),
    ...(form.maxDaysActive.trim() ? { maxDaysActive: form.maxDaysActive.trim() } : {}),
  })

  const manualKeywordList = parseBulkKeywords(form.bulkKeywords)

  const ensureBridgeForStart = async () => {
    const mode = getSpyDeviceChoice()
    if (mode === 'iphone' || mode === 'ipad') return true
    if (!mobileRequired) return true
    if (agentMobileOk) return true

    try {
      const net = await spyApi.checkNetwork({ fresh: true })
      setNetworkMobile(net.mobile)
    } catch {
      // ignore
    }

    const msg = spyStartBlockedMessage(mode)
    if (msg) alert(msg)
    return false
  }

  const blockedStartHint = () => {
    const mode = getSpyDeviceChoice()
    if (mode === 'iphone' || mode === 'ipad') return ''
    if (agentMobileOk) return ''
    return spyStartBlockedMessage(mode).split('\n\n')[0] || ''
  }

  const handleGeneratePlan = async () => {
    if (!canAttemptStart) {
      alert(blockedStartHint() || spyStartBlockedMessage(getSpyDeviceChoice()))
      return
    }
    const countryVal = formCountries.length === 1 ? formCountries[0] : formCountries.length > 1 ? formCountries.join(',') : ''
    if (!countryVal && !form.language && !form.nicho && !form.brief.trim()) {
      alert('Indica idioma, país, nicho ou brief para o GPT.')
      return
    }
    setGeneratingPlan(true)
    try {
      const res = await spyApi.previewKeywords({
        country: countryVal || undefined,
        language: form.language || undefined,
        nicho: form.nicho || undefined,
        produto: form.produto || undefined,
        keywordSeed: form.keywordSeed || undefined,
        brief: form.brief || undefined,
      })
      const intel = res.marketIntel as SpyMarketIntelData
      setPreviewIntel(intel)
      setEditableKeywords(intel.keywords || [])
    } catch (e: any) {
      alert(e.message || 'Erro ao gerar plano GPT')
    } finally {
      setGeneratingPlan(false)
    }
  }

  const handleRefinePlan = async (feedback: string) => {
    if (!previewIntel) return
    setRefiningPlan(true)
    try {
      const res = await spyApi.previewKeywords({
        country: (formCountries.length === 1 ? formCountries[0] : formCountries.length > 1 ? formCountries.join(',') : '') || undefined,
        language: form.language || undefined,
        nicho: form.nicho || undefined,
        produto: form.produto || undefined,
        keywordSeed: form.keywordSeed || undefined,
        brief: form.brief || undefined,
        previousIntel: previewIntel,
        feedback,
      })
      const intel = res.marketIntel as SpyMarketIntelData
      setPreviewIntel(intel)
      setEditableKeywords(intel.keywords || [])
    } catch (e: any) {
      alert(e.message || 'Erro ao refinar plano')
    } finally {
      setRefiningPlan(false)
    }
  }

  const handleAcceptAndSearch = async () => {
    if (!editableKeywords.length) {
      alert('Adiciona pelo menos uma keyword.')
      return
    }
    if (!canAttemptStart) {
      alert(blockedStartHint() || spyStartBlockedMessage(getSpyDeviceChoice()))
      return
    }
    setCreating(true)
    try {
      const bridgeOk = await ensureBridgeForStart()
      if (!bridgeOk) return

      const marketIntel = {
        ...(previewIntel || {}),
        keywords: editableKeywords,
        keywordsPreApproved: true,
      }

      await startSpySearch({
        name: form.name || undefined,
        country: (formCountries.length === 1 ? formCountries[0] : formCountries.length > 1 ? formCountries.join(',') : '') || undefined,
        language: form.language || undefined,
        keywordSeed: form.keywordSeed || undefined,
        nicho: form.nicho || undefined,
        produto: form.produto || undefined,
        discoveryTarget: form.discoveryTarget || 'unlimited',
        minActiveAds: form.minActiveAds || '25',
        maxHours: form.maxHours || '8',
        mobilePlatform: getSpyDeviceChoice(),
        ...daysActiveParams(),
        marketIntel,
        consultantBrief: form.brief || undefined,
        ctaHunt: ctaTypes.length ? ctaTypes : undefined,
      })
      setShowForm(false)
      resetForm()
      await load()
    } catch (e: any) {
      alert(e.message || 'Erro ao iniciar pesquisa')
    } finally {
      setCreating(false)
    }
  }

  const handleManualSearch = async () => {
    if (!canAttemptStart) {
      alert(blockedStartHint() || spyStartBlockedMessage(getSpyDeviceChoice()))
      return
    }
    if (!form.language && !formCountries.length && !form.nicho) {
      alert('Indica idioma, país ou nicho.')
      return
    }
    const keywords = manualKeywordList
    if (!keywords.length && !ctaTypes.length) {
      alert('Cola pelo menos uma keyword (uma por linha) ou seleciona um tipo de CTA.')
      return
    }
    setCreating(true)
    try {
      const bridgeOk = await ensureBridgeForStart()
      if (!bridgeOk) return

      await startSpySearch({
        name: form.name || undefined,
        country: (formCountries.length === 1 ? formCountries[0] : formCountries.length > 1 ? formCountries.join(',') : '') || undefined,
        language: form.language || undefined,
        nicho: form.nicho || undefined,
        produto: form.produto || undefined,
        discoveryTarget: form.discoveryTarget || 'unlimited',
        minActiveAds: form.minActiveAds || '25',
        maxHours: form.maxHours || '8',
        mobilePlatform: getSpyDeviceChoice(),
        ...daysActiveParams(),
        marketIntel: keywords.length
          ? {
              keywords,
              source: 'manual',
              resumoMercado: `${keywords.length} keywords manuais — sem deep search GPT`,
              generatedAt: new Date().toISOString(),
            }
          : undefined,
        ctaHunt: ctaTypes.length ? ctaTypes : undefined,
      })
      setShowForm(false)
      resetForm()
      await load()
    } catch (e: any) {
      alert(e.message || 'Erro ao iniciar pesquisa')
    } finally {
      setCreating(false)
    }
  }

  const handleCreate = async () => {
    if (!canAttemptStart) {
      alert(blockedStartHint() || spyStartBlockedMessage(getSpyDeviceChoice()))
      return
    }
    if (!formCountries.length && !form.language && !form.keywordSeed && !form.nicho && !form.produto && !ctaTypes.length) {
      alert('Indica pelo menos um critério.')
      return
    }
    setCreating(true)
    try {
      const bridgeOk = await ensureBridgeForStart()
      if (!bridgeOk) return

      await startSpySearch({
        name: form.name || undefined,
        country: (formCountries.length === 1 ? formCountries[0] : formCountries.length > 1 ? formCountries.join(',') : '') || undefined,
        language: form.language || undefined,
        keywordSeed: form.keywordSeed || undefined,
        nicho: form.nicho || undefined,
        produto: form.produto || undefined,
        discoveryTarget: form.discoveryTarget || 'unlimited',
        minActiveAds: form.minActiveAds || '25',
        maxHours: form.maxHours || '8',
        mobilePlatform: getSpyDeviceChoice(),
        ...daysActiveParams(),
        ctaHunt: ctaTypes.length ? ctaTypes : undefined,
      })
      setShowForm(false)
      resetForm()
      await load()
    } catch (e: any) {
      alert(e.message || 'Erro ao iniciar pesquisa')
    } finally {
      setCreating(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Apagar esta pesquisa e todos os discoveries?')) return
    await spyApi.deleteSession(id)
    load()
  }

  return (
    <AdminGuard>
      <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem', gap: '1rem', flexWrap: 'wrap' }}>
          <div>
            <h1 style={{ color: '#F5D26C', fontSize: '1.75rem', fontWeight: 700, margin: '0 0 0.5rem', display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
              <ScanSearch size={28} /> SPY
            </h1>
            <p style={{ color: '#94a3b8', margin: 0, fontSize: '0.9375rem' }}>
              Pesquisa na Ads Library com plano GPT — revês as keywords antes do scroll.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowForm(!showForm)}
            style={{
              display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.625rem 1rem',
              background: '#F5D26C', color: '#0c0f14', border: 'none', borderRadius: '0.5rem',
              fontWeight: 600, cursor: 'pointer',
            }}
          >
            <Plus size={18} /> Nova pesquisa
          </button>
        </div>

        {config?.mobileBridge && (
          <SpyMobileBridge
            bridge={config.mobileBridge}
            localBridgeOk={localBridgeOk}
            onRefresh={load}
            onNetworkStatus={setNetworkMobile}
            onAgentMobile={(ok) => {
              setAgentMobileOk(ok)
              if (ok) setNetworkMobile(true)
            }}
          />
        )}

        {showForm && (
          <div style={{ background: '#141823', border: '1px solid rgba(245,210,108,0.25)', borderRadius: '0.75rem', padding: '1.25rem', marginBottom: '1.5rem' }}>
            <h2 style={{ color: '#E8EDF2', fontSize: '1rem', margin: '0 0 1rem' }}>Nova pesquisa SPY</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem', marginBottom: '0.75rem' }}>

              {/* Linha 1: Nome, País, Idioma */}
              <div>
                <label style={{ color: '#94a3b8', fontSize: '0.75rem' }}>Nome (opcional)</label>
                <input style={inputStyle} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Auto se vazio" />
              </div>
              {!formOptions ? (
                <div style={{ gridColumn: '2 / -1', color: '#64748b', fontSize: '0.8125rem', alignSelf: 'center' }}>
                  A carregar países e idiomas…
                </div>
              ) : (
                <>
                  <SpyCountryMultiField
                    label="País (vazio = Todos)"
                    values={formCountries}
                    onChange={setFormCountries}
                    countries={formOptions.countries}
                    inputStyle={inputStyle}
                  />
                  <SpyLanguageField
                    label="Idioma"
                    value={form.language}
                    onChange={(language) => setForm({ ...form, language })}
                    languages={formOptions.languages}
                    inputStyle={inputStyle}
                  />

                  {/* Linha 2: Nicho, Tipo produto, (vazio) */}
                  <SpyCreatableField
                    label="Nicho"
                    value={form.nicho}
                    onChange={(nicho) => setForm({ ...form, nicho })}
                    suggestions={[...new Set([...DEFAULT_NICHOS, ...formOptions.nichos])]}
                    placeholder="Ex.: EMAGRECIMENTO ou nicho novo"
                    inputStyle={inputStyle}
                    uppercase
                  />
                  <SpyCreatableField
                    label="Tipo produto"
                    value={form.produto}
                    onChange={(produto) => setForm({ ...form, produto })}
                    suggestions={[...new Set([...DEFAULT_PRODUTOS, ...formOptions.produtos])]}
                    placeholder="Ex.: NUTRA ou tipo novo"
                    inputStyle={inputStyle}
                  />
                  <div /> {/* espaço vazio para manter grid 3 colunas */}
                </>
              )}

              {/* Linha 3: Objectivo, Mínimo ads, Duração */}
              <div>
                <label style={{ color: '#94a3b8', fontSize: '0.75rem' }}>Objectivo de discoveries</label>
                <select style={inputStyle} value={form.discoveryTarget} onChange={(e) => setForm({ ...form, discoveryTarget: e.target.value })}>
                  {DISCOVERY_TARGET_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={{ color: '#94a3b8', fontSize: '0.75rem' }}>Mínimo de ads activos</label>
                <select style={inputStyle} value={form.minActiveAds} onChange={(e) => setForm({ ...form, minActiveAds: e.target.value })}>
                  <option value="1">1+ ads activos</option>
                  <option value="5">5+ ads activos</option>
                  <option value="10">10+ ads activos</option>
                  <option value="25">25+ ads activos (padrão)</option>
                  <option value="50">50+ ads activos</option>
                  <option value="100">100+ ads activos</option>
                  <option value="250">250+ ads activos</option>
                  <option value="500">500+ ads activos</option>
                  <option value="1000">1000+ ads activos</option>
                </select>
              </div>
              <div>
                <label style={{ color: '#94a3b8', fontSize: '0.75rem' }}>Duração máxima</label>
                <select style={inputStyle} value={form.maxHours} onChange={(e) => setForm({ ...form, maxHours: e.target.value })}>
                  <option value="1">1 hora</option>
                  <option value="2">2 horas</option>
                  <option value="5">5 horas</option>
                  <option value="8">8 horas (padrão)</option>
                  <option value="12">12 horas</option>
                  <option value="24">24 horas</option>
                </select>
              </div>

              {/* Linha 4: intervalo de dias activos (opcional) */}
              <div>
                <label style={{ color: '#94a3b8', fontSize: '0.75rem' }}>Mín. dias activo (opcional)</label>
                <input
                  type="number"
                  min={0}
                  style={inputStyle}
                  value={form.minDaysActive}
                  onChange={(e) => setForm({ ...form, minDaysActive: e.target.value })}
                  placeholder="Ex.: 10"
                />
              </div>
              <div>
                <label style={{ color: '#94a3b8', fontSize: '0.75rem' }}>Máx. dias activo (opcional)</label>
                <input
                  type="number"
                  min={0}
                  style={inputStyle}
                  value={form.maxDaysActive}
                  onChange={(e) => setForm({ ...form, maxDaysActive: e.target.value })}
                  placeholder="Ex.: 20"
                />
              </div>
              <div style={{ display: 'flex', alignItems: 'flex-end', paddingBottom: '0.35rem' }}>
                <span style={{ color: '#64748b', fontSize: '0.72rem', lineHeight: 1.35 }}>
                  Só puxa a biblioteca se houver ≥1 ad activo neste intervalo (ex.: 10–20 dias).
                </span>
              </div>

              {/* Multi-país: aviso que vai pesquisar em cada país seleccionado */}
              {sweepInfo?.isSweep && (
                <div style={{ gridColumn: '1 / -1', background: 'rgba(56,189,248,0.08)', border: '1px solid rgba(56,189,248,0.3)', borderRadius: '0.5rem', padding: '0.625rem 0.75rem', fontSize: '0.8125rem', color: '#7dd3fc' }}>
                  🌍 <strong>Multi-país</strong> — vai pesquisar em {sweepInfo.countries.length} mercados por ordem:{' '}
                  <span style={{ color: '#bae6fd' }}>{sweepInfo.countries.map((c) => c.label).join(' → ')}</span>
                  <div style={{ color: '#64748b', marginTop: '0.25rem', fontSize: '0.75rem' }}>
                    Cada keyword é pesquisada em cada país. A duração máxima é o travão.
                  </div>
                </div>
              )}

              {/* CTA Hunt — tipos de funil opcionais (somam keywords de CTA à pesquisa) */}
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={{ color: '#94a3b8', fontSize: '0.75rem', display: 'block', marginBottom: '0.375rem' }}>
                  Caçar por CTA (opcional) — frases de chamada-à-acção típicas de cada funil
                </label>
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  {CTA_FUNNEL_TYPES.map(({ id, label, hint }) => {
                    const active = ctaTypes.includes(id)
                    return (
                      <button
                        key={id}
                        type="button"
                        title={hint}
                        onClick={() => toggleCta(id)}
                        style={{
                          flex: '1 1 120px',
                          padding: '0.5rem 0.75rem',
                          borderRadius: '0.5rem',
                          border: active ? '1px solid rgba(16,185,129,0.6)' : '1px solid rgba(100,116,139,0.35)',
                          background: active ? 'rgba(16,185,129,0.14)' : 'transparent',
                          color: active ? '#34d399' : '#94a3b8',
                          cursor: 'pointer',
                          textAlign: 'left',
                        }}
                      >
                        <div style={{ fontWeight: 600, fontSize: '0.8125rem' }}>{label}</div>
                        <div style={{ fontSize: '0.6875rem', marginTop: '0.125rem', opacity: 0.8 }}>{hint}</div>
                      </button>
                    )
                  })}
                </div>
                {ctaTypes.length > 0 && (
                  <p style={{ color: '#64748b', fontSize: '0.75rem', margin: '0.375rem 0 0' }}>
                    {ctaTypes.length} tipo{ctaTypes.length === 1 ? '' : 's'} de CTA — as frases somam-se às keywords da pesquisa
                  </p>
                )}
              </div>

              <div style={{ gridColumn: '1 / -1', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                {(
                  [
                    { id: 'manual' as const, label: 'Keywords em massa', sub: '0€ GPT', icon: List },
                    { id: 'gpt' as const, label: 'Plano GPT', sub: 'consultor IA', icon: Sparkles },
                  ] as const
                ).map(({ id, label, sub, icon: Icon }) => {
                  const active = keywordMode === id
                  return (
                    <button
                      key={id}
                      type="button"
                      onClick={() => {
                        setKeywordMode(id)
                        setPreviewIntel(null)
                      }}
                      style={{
                        flex: '1 1 140px',
                        padding: '0.625rem 0.875rem',
                        borderRadius: '0.5rem',
                        border: active ? '1px solid rgba(245,210,108,0.5)' : '1px solid rgba(100,116,139,0.35)',
                        background: active ? 'rgba(245,210,108,0.12)' : 'transparent',
                        color: active ? '#F5D26C' : '#94a3b8',
                        cursor: 'pointer',
                        textAlign: 'left',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', fontWeight: 600, fontSize: '0.8125rem' }}>
                        <Icon size={15} /> {label}
                      </div>
                      <div style={{ fontSize: '0.6875rem', marginTop: '0.125rem', opacity: 0.85 }}>{sub}</div>
                    </button>
                  )
                })}
              </div>

              {keywordMode === 'manual' ? (
                <div style={{ gridColumn: '1 / -1' }}>
                  <label style={{ color: '#94a3b8', fontSize: '0.75rem' }}>
                    Keywords em massa (uma por linha — até {MAX_MANUAL_KEYWORDS}, sem gastar GPT)
                  </label>
                  <textarea
                    style={{ ...inputStyle, minHeight: '90px', resize: 'vertical', lineHeight: 1.5, fontFamily: 'inherit', fontSize: '0.75rem' }}
                    value={form.bulkKeywords}
                    onChange={(e) => setForm({ ...form, bulkKeywords: e.target.value })}
                    placeholder={'chá seca barriga\ndesinchar em 7 dias\nmétodo seca barriga\nprotocolo de emagrecimento\ndesafio 21 dias emagrecimento\n…'}
                  />
                  <p style={{ color: '#64748b', fontSize: '0.75rem', margin: '0.375rem 0 0' }}>
                    {manualKeywordList.length} keyword{manualKeywordList.length === 1 ? '' : 's'} na fila
                    {manualKeywordList.length > 0 ? ' · ordem = ordem de pesquisa' : ''}
                  </p>
                </div>
              ) : (
                <>
                  <div style={{ gridColumn: '1 / -1' }}>
                    <label style={{ color: '#94a3b8', fontSize: '0.75rem' }}>
                      Brief para o GPT (como no ChatGPT)
                    </label>
                    <textarea
                      style={{ ...inputStyle, minHeight: '88px', resize: 'vertical', lineHeight: 1.45 }}
                      value={form.brief}
                      onChange={(e) => setForm({ ...form, brief: e.target.value })}
                      placeholder="Ex.: EMAGRECIMENTO BR, quero funis VSL e quiz, só direct response escalado. Evita institucional e marcas grandes. Foca mecanismos naturais tipo GLP-1/caneta emagrecedora."
                    />
                  </div>
                  <div>
                    <label style={{ color: '#94a3b8', fontSize: '0.75rem' }}>Palavra-chave semente (opcional)</label>
                    <input style={inputStyle} value={form.keywordSeed} onChange={(e) => setForm({ ...form, keywordSeed: e.target.value })} placeholder="Ex.: chá seca barriga" />
                  </div>
                </>
              )}
            </div>

            {keywordMode === 'manual' ? (
              (() => {
                const canManual = manualKeywordList.length > 0 || ctaTypes.length > 0
                const blocked = creating || !canAttemptStart || !canManual
                return (
              <button
                type="button"
                disabled={blocked}
                onClick={handleManualSearch}
                style={{
                  width: '100%', padding: '0.75rem', background: blocked ? '#666' : '#10B981',
                  color: '#fff', border: 'none', borderRadius: '0.5rem', fontWeight: 600,
                  cursor: blocked ? 'not-allowed' : 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
                }}
              >
                {creating ? (
                  <><Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> A iniciar…</>
                ) : manualKeywordList.length ? (
                  <><List size={16} /> Pesquisar com {manualKeywordList.length} keyword{manualKeywordList.length === 1 ? '' : 's'}{ctaTypes.length ? ` + ${ctaTypes.length} CTA` : ''}</>
                ) : ctaTypes.length ? (
                  <><List size={16} /> Pesquisar só por CTA ({ctaTypes.length})</>
                ) : (
                  <><List size={16} /> Adiciona keywords ou CTA</>
                )}
              </button>
                )
              })()
            ) : !previewIntel ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <button
                  type="button"
                  disabled={generatingPlan || !canAttemptStart}
                  onClick={handleGeneratePlan}
                  style={{
                    width: '100%', padding: '0.75rem', background: generatingPlan || !canAttemptStart ? '#666' : '#F5D26C',
                    color: '#0c0f14', border: 'none', borderRadius: '0.5rem', fontWeight: 600,
                    cursor: generatingPlan || !canAttemptStart ? 'not-allowed' : 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
                  }}
                >
                  {generatingPlan ? (
                    <><Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> GPT a pesquisar… (~30–60s)</>
                  ) : (
                    <><Sparkles size={16} /> Gerar plano com GPT</>
                  )}
                </button>
                <button
                  type="button"
                  disabled={creating || !canAttemptStart}
                  onClick={handleCreate}
                  style={{
                    width: '100%', padding: '0.625rem', background: 'transparent',
                    color: '#64748b', border: '1px solid rgba(100,116,139,0.35)', borderRadius: '0.5rem',
                    fontSize: '0.8125rem', cursor: creating || !canAttemptStart ? 'not-allowed' : 'pointer',
                  }}
                >
                  Saltar preview — modo automático (legacy)
                </button>
              </div>
            ) : (
              <SpyKeywordPreviewPanel
                intel={previewIntel}
                keywords={editableKeywords}
                onKeywordsChange={setEditableKeywords}
                onRegenerate={handleGeneratePlan}
                onRefine={handleRefinePlan}
                onAccept={handleAcceptAndSearch}
                loading={generatingPlan}
                refineLoading={refiningPlan}
              />
            )}
          </div>
        )}

        {loading ? (
          <div style={{ color: '#94a3b8', textAlign: 'center', padding: '2rem' }}><Loader2 size={24} style={{ animation: 'spin 1s linear infinite' }} /></div>
        ) : sessions.length === 0 ? (
          <div style={{ color: '#64748b', textAlign: 'center', padding: '3rem', border: '1px dashed rgba(245,210,108,0.2)', borderRadius: '0.75rem' }}>
            Nenhuma pesquisa SPY ainda. Cria a primeira acima.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {sessions.map((s) => {
              const st = STATUS_LABEL[s.status] || STATUS_LABEL.queued
              const stats = s.stats || {}
              const livePhase = stats.live?.phase || ''
              const kwActive = s.status === 'running' && ['keyword','meta_collect','meta_filter','meta_library'].includes(livePhase)
              const kwDisplay = kwActive ? (stats.keywordsDone ?? 0) + 1 : (stats.keywordsDone ?? 0)
              return (
                <div
                  key={s.id}
                  style={{
                    background: '#141823',
                    border: '1px solid rgba(245,210,108,0.2)',
                    borderRadius: '0.75rem',
                    padding: '1rem 1.25rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '1rem',
                    flexWrap: 'wrap',
                  }}
                >
                  <div style={{ flex: 1, minWidth: '200px' }}>
                    <Link href={`/spy/${s.id}`} style={{ color: '#E8EDF2', fontWeight: 600, textDecoration: 'none', fontSize: '1rem' }}>
                      {s.name}
                    </Link>
                    <div style={{ color: '#64748b', fontSize: '0.75rem', marginTop: '0.25rem', display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                      {s.country && (
                        <span>
                          <Globe size={12} style={{ verticalAlign: 'middle' }} />{' '}
                          {countryLabelFromOptions(s.country, formOptions?.countries || []) || s.country}
                        </span>
                      )}
                      {s.nicho && <span>{s.nicho}</span>}
                      {s.language && <span>{s.language}</span>}
                      {formatDiscoveryTarget(s.stats) && <span>{formatDiscoveryTarget(s.stats)}</span>}
                      <span>{new Date(s.createdAt).toLocaleString('pt-PT')}</span>
                    </div>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ color: '#F5D26C', fontWeight: 700, fontSize: '1.25rem' }}>{s.discoveriesCount ?? stats.discoveriesCount ?? 0}</div>
                    <div style={{ color: '#64748b', fontSize: '0.7rem' }}>discoveries</div>
                    {(s.status === 'running' || s.status === 'queued') && (
                      <div style={{ color: '#64748b', fontSize: '0.65rem', marginTop: '0.25rem' }}>
                        {kwDisplay}/{stats.keywordsQueued ?? 0} kw · {stats.adsScanned ?? 0} ads
                        {formatDiscoveryTarget(stats) ? ` · ${formatDiscoveryTarget(stats)}` : ''}
                      </div>
                    )}
                  </div>
                  <span style={{ color: st.color, fontSize: '0.8rem', fontWeight: 600 }}>{st.label}</span>
                  <div style={{ display: 'flex', gap: '0.375rem' }}>
                    {s.status === 'running' && (
                      <button type="button" title="Pausar" onClick={() => pauseSession(s.id).then(load)} style={iconBtnStyle}>
                        <Pause size={16} />
                      </button>
                    )}
                    {s.status === 'paused' && (
                      <button type="button" title="Retomar" onClick={() => resumeSession(s.id).then(load)} style={iconBtnStyle}>
                        <Play size={16} />
                      </button>
                    )}
                    {(s.status === 'running' || s.status === 'paused' || s.status === 'queued') && (
                      <button type="button" title="Cancelar" onClick={() => cancelSession(s.id).then(load)} style={{ ...iconBtnStyle, color: '#f87171' }}>
                        <XCircle size={16} />
                      </button>
                    )}
                    <button type="button" title="Apagar" onClick={() => handleDelete(s.id)} style={{ ...iconBtnStyle, color: '#f87171' }}>
                      <Trash2 size={16} />
                    </button>
                    <Link href={`/spy/${s.id}`} style={{ ...iconBtnStyle, color: '#F5D26C', display: 'flex', alignItems: 'center' }}>
                      <ChevronRight size={16} />
                    </Link>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        <SpyTrendsPanel />

        <style dangerouslySetInnerHTML={{ __html: '@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }' }} />
      </div>
    </AdminGuard>
  )
}

const iconBtnStyle: React.CSSProperties = {
  background: 'rgba(245,210,108,0.08)',
  border: '1px solid rgba(245,210,108,0.2)',
  borderRadius: '0.375rem',
  padding: '0.375rem',
  cursor: 'pointer',
  color: '#94a3b8',
}
