'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import Link from 'next/link'
import { ArrowLeft, Loader2, Download, CheckSquare, Square, Copy, AlertTriangle, Trash2 } from 'lucide-react'
import AdminGuard from '../../../components/AdminGuard'
import { LibraryCardNew } from '@/components/LibraryCardNew'
import { SpyAdAssets } from '@/components/SpyAdAssets'
import { SpyMarketIntel } from '@/components/SpyMarketIntel'
import { SpyLiveFeed, type SpyLiveState } from '@/components/SpyLiveFeed'
import { spyApi } from '@/lib/api'

const DEFAULT_NICHOS = [
  'EMAGRECIMENTO', 'DIABETES', 'SEXUAL', 'RELIGIOSO', 'RELACIONAMENTO', 'EDUCACIONAL',
  'TINNITUS', 'MEMÓRIA', 'VISÃO', 'SORTEIO E RIFAS',
]
const DEFAULT_PRODUTOS = ['INFO', 'NUTRA', 'APP', 'SORTEIOS', 'Store']

function canImportDiscovery(d: { alreadyImported?: boolean; alreadyInLibraries?: boolean }) {
  return !d.alreadyImported && !d.alreadyInLibraries
}

function discoveryToLibrary(d: any) {
  return {
    id: d.id,
    name: d.name,
    sourceType: d.sourceType || d.cardData?.sourceType || 'URL',
    sourceValue: d.sourceValue,
    notes: d.notes || d.cardData?.notes,
    activeAds: d.activeAds || d.activeAdsEstimate || 0,
    createdAt: d.createdAt,
    updatedAt: d.createdAt,
    nichos: d.nichos || d.cardData?.nichos,
    estrategias: d.estrategias || d.cardData?.estrategias,
    produtos: d.produtos || d.cardData?.produtos,
    idiomas: d.idiomas || d.cardData?.idiomas,
    paises: d.paises || d.cardData?.paises,
    pages: (d.pages || d.cardData?.pages || []).map((url: string, i: number) => ({ id: `p-${i}`, url })),
    status: 'active',
  }
}

export default function SpySessionPage({ params }: { params: { id: string } }) {
  const sessionId = params.id
  const [session, setSession] = useState<any>(null)
  const [discoveries, setDiscoveries] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [importing, setImporting] = useState(false)
  const [filterQ, setFilterQ] = useState('')
  const [filterImported, setFilterImported] = useState('false')
  const [importProgress, setImportProgress] = useState<{ done: number; total: number; status: string } | null>(null)
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set())
  const [filterOrder, setFilterOrder] = useState('ads_desc')
  const [filterNicho, setFilterNicho] = useState('')
  const [filterProduto, setFilterProduto] = useState('')
  const [minAds, setMinAds] = useState('25')
  const [filterNichos, setFilterNichos] = useState<string[]>(DEFAULT_NICHOS)
  const [filterProdutos, setFilterProdutos] = useState<string[]>(DEFAULT_PRODUTOS)
  const hiddenDeletedRef = useRef<Set<string>>(new Set())

  useEffect(() => {
    spyApi.getFormOptions().then((o) => {
      setFilterNichos([...new Set([...DEFAULT_NICHOS, ...(o.nichos || [])])])
      setFilterProdutos([...new Set([...DEFAULT_PRODUTOS, ...(o.produtos || [])])])
    }).catch(() => {})
  }, [])

  const load = useCallback(async () => {
    try {
      const [s, d] = await Promise.all([
        spyApi.getSession(sessionId),
        spyApi.listDiscoveries(sessionId, {
          q: filterQ || undefined,
          alreadyImported: filterImported || undefined,
          order: filterOrder,
          minAds: minAds || undefined,
          nicho: filterNicho || undefined,
          produto: filterProduto || undefined,
        } as Record<string, string>),
      ])
      setSession(s)
      const list = Array.isArray(d) ? d.filter((x: { id: string }) => !hiddenDeletedRef.current.has(x.id)) : []
      setDiscoveries(list)
    } catch (e) {
      console.error(e)
      try {
        const s = await spyApi.getSession(sessionId)
        setSession(s)
      } catch {
        // ignore
      }
    } finally {
      setLoading(false)
    }
  }, [sessionId, filterQ, filterImported, filterOrder, filterNicho, filterProduto, minAds])

  useEffect(() => {
    load()
    const ms = session?.status === 'running' || session?.status === 'queued' ? 3000 : 10000
    const t = setInterval(load, ms)
    return () => clearInterval(t)
  }, [load, session?.status])

  const toggleSelect = (id: string) => {
    const d = discoveries.find((x) => x.id === id)
    if (d && !canImportDiscovery(d)) return
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const pollImportJob = async (jobId: string, ids: string[]) => {
    const idSet = new Set(ids)
    setDiscoveries((prev) => prev.filter((d) => !idSet.has(d.id)))
    setSelected(new Set())

    while (true) {
      const job = await spyApi.getImportJob(jobId)
      setImportProgress({ done: job.done, total: job.total, status: job.status })
      if (job.status === 'completed' || job.status === 'failed') {
        const results = job.results || []
        const dupes = results.filter((r: { duplicate?: boolean }) => r.duplicate)
        const failed = results.filter((r: { success?: boolean; duplicate?: boolean }) => !r.success && !r.duplicate)
        if (dupes.length) {
          alert(
            `${dupes.length} biblioteca(s) já existiam no sistema — não foram duplicadas.`
          )
        }
        if (failed.length) {
          const msg = failed.map((r: { error?: string }) => r.error).filter(Boolean).slice(0, 3).join('; ')
          alert(`${failed.length} não importado(s)${msg ? `: ${msg}` : ''}`)
        }
        break
      }
      await new Promise((r) => setTimeout(r, 600))
    }
    await load()
  }

  const startImport = async (ids: string[]) => {
    if (!ids.length) return
    setImporting(true)
    setImportProgress({ done: 0, total: ids.length, status: 'running' })
    try {
      const res = await spyApi.importDiscoveries(ids)
      if (res.jobId) {
        await pollImportJob(res.jobId, ids)
      } else {
        throw new Error('Resposta inválida do servidor')
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Erro na importação'
      alert(msg)
      await load()
    } finally {
      setImporting(false)
      setImportProgress(null)
    }
  }

  const handleImportSelected = () => {
    const ids = [...selected].filter((id) => {
      const d = discoveries.find((x) => x.id === id)
      return d && canImportDiscovery(d)
    })
    if (!ids.length) {
      alert('Nenhuma biblioteca nova para importar — todas já existem no sistema ou foram importadas.')
      return
    }
    startImport(ids)
  }

  const handleImportOne = (id: string) => {
    const d = discoveries.find((x) => x.id === id)
    if (d && !canImportDiscovery(d)) {
      alert(
        d.alreadyInLibraries
          ? `Esta biblioteca já existe: ${d.existingLibraryName || 'ver Bibliotecas'}.`
          : 'Este discovery já foi importado.'
      )
      return
    }
    startImport([id])
  }

  const importableSelectedCount = [...selected].filter((id) => {
    const d = discoveries.find((x) => x.id === id)
    return d && canImportDiscovery(d)
  }).length

  const handleDeleteDiscovery = async (id: string) => {
    if (deletingIds.has(id)) return
    if (!window.confirm('Eliminar este discovery desta pesquisa SPY?')) return

    hiddenDeletedRef.current.add(id)
    setDeletingIds((prev) => new Set(prev).add(id))
    setDiscoveries((prev) => prev.filter((d) => d.id !== id))
    setSelected((prev) => {
      const next = new Set(prev)
      next.delete(id)
      return next
    })
    try {
      await spyApi.deleteDiscovery(sessionId, id)
    } catch (err: unknown) {
      hiddenDeletedRef.current.delete(id)
      const msg = err instanceof Error ? err.message : 'Erro ao eliminar discovery.'
      alert(msg)
      await load()
    } finally {
      setDeletingIds((prev) => {
        const next = new Set(prev)
        next.delete(id)
        return next
      })
    }
  }

  if (loading && !session) {
    return (
      <AdminGuard>
        <div style={{ color: '#94a3b8', padding: '2rem', textAlign: 'center' }}>
          <Loader2 size={24} style={{ animation: 'spin 1s linear infinite' }} />
        </div>
      </AdminGuard>
    )
  }

  const statsCount = session?.discoveriesCount ?? session?.stats?.discoveriesCount ?? 0

  return (
    <AdminGuard>
      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
        <Link href="/spy" style={{ color: '#94a3b8', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '0.375rem', marginBottom: '1rem', fontSize: '0.875rem' }}>
          <ArrowLeft size={16} /> Voltar às pesquisas
        </Link>

        <h1 style={{ color: '#F5D26C', fontSize: '1.5rem', margin: '0 0 0.5rem' }}>{session?.name}</h1>

        <SpyMarketIntel
          intel={session?.marketIntel || session?.stats?.marketIntel}
          status={session?.deepSearchStatus || session?.stats?.deepSearchStatus}
        />

        {(session?.status === 'running' || session?.status === 'queued') && (
          <SpyLiveFeed live={(session?.stats?.live || null) as SpyLiveState | null} />
        )}

        {(importing || importProgress) && (
          <div
            style={{
              marginBottom: '1rem',
              padding: '0.75rem 1rem',
              background: 'rgba(59,130,246,0.12)',
              border: '1px solid rgba(59,130,246,0.35)',
              borderRadius: '0.5rem',
              color: '#93c5fd',
              fontSize: '0.875rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
            }}
          >
            <Loader2 size={18} style={{ animation: 'spin 1s linear infinite', flexShrink: 0 }} />
            <span>
              A importar bibliotecas em segundo plano…{' '}
              {importProgress
                ? `${importProgress.done}/${importProgress.total}`
                : 'a iniciar'}
            </span>
            {importProgress && importProgress.total > 0 && (
              <div
                style={{
                  flex: 1,
                  maxWidth: '200px',
                  height: '6px',
                  background: 'rgba(0,0,0,0.3)',
                  borderRadius: '3px',
                  overflow: 'hidden',
                  marginLeft: 'auto',
                }}
              >
                <div
                  style={{
                    width: `${Math.round((importProgress.done / importProgress.total) * 100)}%`,
                    height: '100%',
                    background: '#3B82F6',
                    transition: 'width 0.3s',
                  }}
                />
              </div>
            )}
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem', flexWrap: 'wrap', marginBottom: '1.25rem' }}>
          <p style={{ color: '#64748b', margin: 0, fontSize: '0.875rem' }}>
            {discoveries.length} discoveries visíveis
            {statsCount > discoveries.length ? ` · ${statsCount} no total (filtros activos)` : ''}
            {' · '}Expiram aos 30 dias · Mín. 25 ads activos
          </p>
          <Link
            href={`/spy/${sessionId}/copy`}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '0.375rem', padding: '0.4rem 0.875rem',
              background: 'rgba(245,210,108,0.1)', border: '1px solid rgba(245,210,108,0.25)', borderRadius: '0.5rem',
              color: '#F5D26C', textDecoration: 'none', fontSize: '0.8125rem', fontWeight: 600,
            }}
          >
            <Copy size={14} /> Copy Bank
          </Link>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
          <input
            placeholder="Filtrar por nome..."
            value={filterQ}
            onChange={(e) => setFilterQ(e.target.value)}
            style={{ flex: 1, minWidth: '160px', padding: '0.5rem 0.75rem', background: '#0c0f14', border: '1px solid rgba(245,210,108,0.2)', borderRadius: '0.5rem', color: '#E8EDF2' }}
          />
          <select
            value={filterOrder}
            onChange={(e) => setFilterOrder(e.target.value)}
            style={{ padding: '0.5rem', background: '#0c0f14', border: '1px solid rgba(245,210,108,0.2)', borderRadius: '0.5rem', color: '#E8EDF2' }}
          >
            <option value="ads_desc">Mais anúncios</option>
            <option value="ads_asc">Menos anúncios</option>
          </select>
          <select
            value={minAds}
            onChange={(e) => setMinAds(e.target.value)}
            style={{ padding: '0.5rem', background: '#0c0f14', border: '1px solid rgba(245,210,108,0.2)', borderRadius: '0.5rem', color: '#E8EDF2' }}
          >
            <option value="25">Min. 25 ads</option>
            <option value="50">Min. 50 ads</option>
            <option value="100">Min. 100 ads</option>
            <option value="">Todos</option>
          </select>
          <input
            list="spy-filter-nicho"
            placeholder="Nicho"
            value={filterNicho}
            onChange={(e) => setFilterNicho(e.target.value.toUpperCase())}
            style={{ padding: '0.5rem', minWidth: '120px', background: '#0c0f14', border: '1px solid rgba(245,210,108,0.2)', borderRadius: '0.5rem', color: '#E8EDF2' }}
          />
          <datalist id="spy-filter-nicho">
            {filterNichos.map((n) => <option key={n} value={n} />)}
          </datalist>
          <input
            list="spy-filter-produto"
            placeholder="Produto"
            value={filterProduto}
            onChange={(e) => setFilterProduto(e.target.value)}
            style={{ padding: '0.5rem', minWidth: '100px', background: '#0c0f14', border: '1px solid rgba(245,210,108,0.2)', borderRadius: '0.5rem', color: '#E8EDF2' }}
          />
          <datalist id="spy-filter-produto">
            {filterProdutos.map((p) => <option key={p} value={p} />)}
          </datalist>
          <select
            value={filterImported}
            onChange={(e) => setFilterImported(e.target.value)}
            style={{ padding: '0.5rem', background: '#0c0f14', border: '1px solid rgba(245,210,108,0.2)', borderRadius: '0.5rem', color: '#E8EDF2' }}
          >
            <option value="">Todos</option>
            <option value="false">Por importar</option>
            <option value="true">Já importados</option>
          </select>
          {selected.size > 0 && (
            <button
              type="button"
              disabled={importing}
              onClick={handleImportSelected}
              style={{
                display: 'flex', alignItems: 'center', gap: '0.375rem', padding: '0.5rem 1rem',
                background: importing ? 'rgba(59,130,246,0.5)' : '#3B82F6',
                color: '#fff', border: 'none', borderRadius: '0.5rem', fontWeight: 600,
                cursor: importing ? 'wait' : 'pointer',
              }}
            >
              {importing ? (
                <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />
              ) : (
                <Download size={16} />
              )}
              {importing ? 'A importar…' : `Importar selecção (${importableSelectedCount})`}
            </button>
          )}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {discoveries.map((d) => (
            <div key={d.id} style={{ position: 'relative' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                <button
                  type="button"
                  onClick={() => toggleSelect(d.id)}
                  disabled={!canImportDiscovery(d)}
                  title={!canImportDiscovery(d) ? 'Já existe no sistema ou foi importado' : 'Selecionar'}
                  style={{
                    background: 'none', border: 'none',
                    cursor: canImportDiscovery(d) ? 'pointer' : 'not-allowed',
                    color: canImportDiscovery(d) ? '#F5D26C' : '#475569', padding: 0, opacity: canImportDiscovery(d) ? 1 : 0.5,
                  }}
                >
                  {selected.has(d.id) ? <CheckSquare size={18} /> : <Square size={18} />}
                </button>
                {d.alreadyInLibraries && (
                  <span style={{ background: 'rgba(239,68,68,0.12)', color: '#f87171', padding: '0.15rem 0.5rem', borderRadius: '999px', fontSize: '0.7rem', fontWeight: 600 }} title={d.existingLibraryName}>
                    Já em bibliotecas
                  </span>
                )}
                {d.alreadyImported && !d.alreadyInLibraries && (
                  <span style={{ background: 'rgba(245,158,11,0.15)', color: '#fcd34d', padding: '0.15rem 0.5rem', borderRadius: '999px', fontSize: '0.7rem', fontWeight: 600 }}>
                    Já importado
                  </span>
                )}
                {d.keywordOrigin && (
                  <span style={{ color: '#64748b', fontSize: '0.75rem' }}>via «{d.keywordOrigin}»</span>
                )}
                {d.expiresAt && (() => {
                  const days = Math.ceil((new Date(d.expiresAt).getTime() - Date.now()) / 86400000)
                  if (days > 7) return null
                  return (
                    <span style={{
                      display: 'inline-flex', alignItems: 'center', gap: '0.25rem',
                      background: days <= 3 ? 'rgba(239,68,68,0.12)' : 'rgba(245,158,11,0.12)',
                      color: days <= 3 ? '#f87171' : '#fcd34d',
                      padding: '0.15rem 0.5rem', borderRadius: '999px', fontSize: '0.65rem', fontWeight: 600,
                    }}>
                      <AlertTriangle size={10} /> Expira em {days}d
                    </span>
                  )
                })()}
                <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <button
                    type="button"
                    disabled={deletingIds.has(d.id)}
                    onClick={() => handleDeleteDiscovery(d.id)}
                    title="Eliminar discovery"
                    style={{
                      padding: '0.35rem 0.5rem', background: 'rgba(239,68,68,0.12)',
                      border: '1px solid rgba(239,68,68,0.35)', borderRadius: '0.375rem', color: '#f87171',
                      cursor: deletingIds.has(d.id) ? 'wait' : 'pointer', display: 'inline-flex', alignItems: 'center',
                    }}
                  >
                    {deletingIds.has(d.id) ? (
                      <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />
                    ) : (
                      <Trash2 size={14} />
                    )}
                  </button>
                  {canImportDiscovery(d) && (
                    <button
                      type="button"
                      disabled={importing}
                      onClick={() => handleImportOne(d.id)}
                      style={{
                        padding: '0.35rem 0.75rem', background: 'rgba(59,130,246,0.15)',
                        border: '1px solid rgba(59,130,246,0.35)', borderRadius: '0.375rem', color: '#60a5fa',
                        fontSize: '0.75rem', fontWeight: 600, cursor: importing ? 'wait' : 'pointer',
                        display: 'inline-flex', alignItems: 'center', gap: '0.25rem',
                      }}
                    >
                      {importing ? <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} /> : null}
                      Importar agora
                    </button>
                  )}
                </div>
              </div>
              <SpyAdAssets assets={d.adAssets || []} />
              <LibraryCardNew
                library={discoveryToLibrary(d)}
                onUpdate={load}
                discoveryMode
                onDelete={() => handleDeleteDiscovery(d.id)}
                deleting={deletingIds.has(d.id)}
              />
            </div>
          ))}
        </div>

        {!discoveries.length && (
          <div style={{ color: '#64748b', textAlign: 'center', padding: '3rem' }}>
            {statsCount > 0
              ? `${statsCount} discovery(s) encontrados — faz refresh ou limpa os filtros se não aparecerem.`
              : session?.status === 'running' || session?.status === 'queued'
                ? 'A pesquisar… os cards aparecem aqui quando estiverem completos (25+ ads).'
                : 'Nenhum discovery nesta pesquisa.'}
          </div>
        )}
        <style dangerouslySetInnerHTML={{ __html: '@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }' }} />
      </div>
    </AdminGuard>
  )
}
