'use client'

import { useCallback, useEffect, useState } from 'react'
import { ClipboardList, Copy, Loader2, Search, Flame, Clock, Layers } from 'lucide-react'
import AdminGuard from '../../components/AdminGuard'
import { copyApi } from '@/lib/api'

type CopyItem = {
  id: string
  language: string
  nicho: string
  produto: string
  headline?: string
  body_text?: string
  days_active: number
  duplicate_count: number
  rank_score: number
  media_type?: string
  image_path?: string
  page_name?: string
  library_url?: string
  pipeline_status?: string
}

type TaxRow = { language: string; nicho: string; produto: string; cnt: number }

function CopyImage({ path }: { path: string }) {
  const [src, setSrc] = useState<string | null>(null)
  useEffect(() => {
    let revoked: string | null = null
    const token = localStorage.getItem('authToken')
    fetch(`/api/copy/asset?path=${encodeURIComponent(path)}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then((r) => (r.ok ? r.blob() : null))
      .then((b) => {
        if (b) {
          revoked = URL.createObjectURL(b)
          setSrc(revoked)
        }
      })
      .catch(() => {})
    return () => {
      if (revoked) URL.revokeObjectURL(revoked)
    }
  }, [path])
  if (!src) return null
  return (
    <img
      src={src}
      alt=""
      style={{ maxWidth: '100%', maxHeight: 160, borderRadius: '0.375rem', objectFit: 'cover' }}
    />
  )
}

export default function CopyPage() {
  const [items, setItems] = useState<CopyItem[]>([])
  const [tree, setTree] = useState<TaxRow[]>([])
  const [hot, setHot] = useState<CopyItem[]>([])
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState('')
  const [language, setLanguage] = useState('')
  const [nicho, setNicho] = useState('')
  const [produto, setProduto] = useState('')
  const [sort, setSort] = useState('rank')
  const [range, setRange] = useState('')
  const [copied, setCopied] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const params: Record<string, string> = { sort, limit: '60' }
      if (language) params.language = language
      if (nicho) params.nicho = nicho
      if (produto) params.produto = produto
      if (range) params.range = range
      if (q.trim()) params.q = q.trim()

      const [listRes, taxRes, hotRes] = await Promise.all([
        copyApi.list(params),
        copyApi.taxonomy(),
        copyApi.rankings('hot', 10),
      ])
      setItems(listRes.items || [])
      setTree(taxRes.tree || [])
      setHot(hotRes.items || [])
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }, [language, nicho, produto, q, sort, range])

  useEffect(() => {
    setLoading(true)
    const t = setTimeout(load, q ? 300 : 0)
    return () => clearTimeout(t)
  }, [load, q])

  const languages = [...new Set(tree.map((t) => t.language).filter(Boolean))]
  const nichos = [...new Set(tree.filter((t) => !language || t.language === language).map((t) => t.nicho).filter(Boolean))]
  const produtos = [
    ...new Set(
      tree
        .filter((t) => (!language || t.language === language) && (!nicho || t.nicho === nicho))
        .map((t) => t.produto)
        .filter(Boolean)
    ),
  ]

  const copyText = async (id: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(id)
      setTimeout(() => setCopied(null), 1500)
    } catch {
      // ignore
    }
  }

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '0.5rem 0.75rem',
    background: '#0c0f14',
    border: '1px solid rgba(245,210,108,0.2)',
    borderRadius: '0.5rem',
    color: '#E8EDF2',
    fontSize: '0.8125rem',
    boxSizing: 'border-box',
  }

  return (
    <AdminGuard>
      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
        <h1 style={{ color: '#F5D26C', fontSize: '1.75rem', fontWeight: 700, margin: '0 0 0.35rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <ClipboardList size={28} /> Copy
        </h1>
        <p style={{ color: '#94a3b8', margin: '0 0 1.25rem', fontSize: '0.9rem' }}>
          Banco de copies das bibliotecas importadas · filtro: 5+ dias ativo <strong>ou</strong> 10+ duplicações · imagens guardadas localmente
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: '1rem', alignItems: 'start' }}>
          <aside style={{ background: '#141823', border: '1px solid rgba(245,210,108,0.2)', borderRadius: '0.75rem', padding: '0.75rem' }}>
            <div style={{ color: '#94a3b8', fontSize: '0.7rem', marginBottom: '0.5rem', textTransform: 'uppercase' }}>Idioma</div>
            <select style={inputStyle} value={language} onChange={(e) => { setLanguage(e.target.value); setNicho(''); setProduto('') }}>
              <option value="">Todos</option>
              {languages.map((l) => <option key={l} value={l}>{l}</option>)}
            </select>
            <div style={{ color: '#94a3b8', fontSize: '0.7rem', margin: '0.75rem 0 0.5rem', textTransform: 'uppercase' }}>Nicho</div>
            <select style={inputStyle} value={nicho} onChange={(e) => { setNicho(e.target.value); setProduto('') }}>
              <option value="">Todos</option>
              {nichos.map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
            <div style={{ color: '#94a3b8', fontSize: '0.7rem', margin: '0.75rem 0 0.5rem', textTransform: 'uppercase' }}>Produto</div>
            <select style={inputStyle} value={produto} onChange={(e) => setProduto(e.target.value)}>
              <option value="">Todos</option>
              {produtos.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </aside>

          <div>
            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: 180, position: 'relative' }}>
                <Search size={16} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} />
                <input placeholder="Pesquisar copy..." value={q} onChange={(e) => setQ(e.target.value)} style={{ ...inputStyle, paddingLeft: '2rem' }} />
              </div>
              <select style={{ ...inputStyle, width: 'auto' }} value={sort} onChange={(e) => setSort(e.target.value)}>
                <option value="rank">Mais escaladas</option>
                <option value="duplicates">Mais duplicações</option>
                <option value="days">Mais tempo ativo</option>
                <option value="recent">Recentes</option>
              </select>
              <select style={{ ...inputStyle, width: 'auto' }} value={range} onChange={(e) => setRange(e.target.value)} title="Filtrar por data de início do anúncio">
                <option value="">Qualquer data</option>
                <option value="7d">Últimos 7 dias</option>
                <option value="30d">Último mês</option>
                <option value="90d">Últimos 3 meses</option>
                <option value="year">Último ano</option>
              </select>
            </div>

            {hot.length > 0 && (
              <div style={{ marginBottom: '1rem', padding: '0.75rem', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: '0.625rem' }}>
                <div style={{ color: '#fca5a5', fontSize: '0.75rem', fontWeight: 600, marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <Flame size={14} /> Top escaldadas
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                  {hot.slice(0, 5).map((h) => (
                    <span key={h.id} style={{ fontSize: '0.7rem', color: '#fecaca', background: 'rgba(0,0,0,0.2)', padding: '0.2rem 0.5rem', borderRadius: 4 }}>
                      {h.page_name || h.nicho} · {h.duplicate_count} dup · {h.days_active}d
                    </span>
                  ))}
                </div>
              </div>
            )}

            {loading ? (
              <div style={{ color: '#94a3b8', textAlign: 'center', padding: '2rem' }}><Loader2 style={{ animation: 'spin 1s linear infinite' }} /></div>
            ) : !items.length ? (
              <div style={{ color: '#64748b', padding: '2rem', textAlign: 'center', border: '1px dashed rgba(245,210,108,0.2)', borderRadius: '0.75rem' }}>
                Sem copies ainda. Importa uma biblioteca a partir do SPY — o scan Copy arranca automaticamente.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {items.map((item) => {
                  const text = item.body_text || item.headline || ''
                  return (
                    <div key={item.id} style={{ background: '#141823', border: '1px solid rgba(245,210,108,0.15)', borderRadius: '0.75rem', padding: '1rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '0.5rem' }}>
                        <div>
                          <div style={{ color: '#E8EDF2', fontWeight: 600 }}>{item.page_name || 'Anunciante'}</div>
                          <div style={{ color: '#64748b', fontSize: '0.75rem' }}>
                            {item.language} · {item.nicho} · {item.produto}
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: '0.5rem', fontSize: '0.7rem', flexWrap: 'wrap' }}>
                          <span style={{ color: '#fcd34d', display: 'flex', alignItems: 'center', gap: 4 }}><Clock size={12} /> {item.days_active}d ativo</span>
                          <span style={{ color: '#f97316', display: 'flex', alignItems: 'center', gap: 4 }}><Layers size={12} /> {item.duplicate_count} dupes</span>
                          <span style={{ color: '#4ade80' }}>score {item.rank_score}</span>
                          {item.pipeline_status === 'pending_ai' && (
                            <span style={{ color: '#94a3b8' }}>IA pendente</span>
                          )}
                        </div>
                      </div>
                      {item.image_path && <div style={{ marginBottom: '0.5rem' }}><CopyImage path={item.image_path} /></div>}
                      <p style={{ color: '#cbd5e1', fontSize: '0.875rem', lineHeight: 1.5, whiteSpace: 'pre-wrap', margin: '0 0 0.75rem' }}>{text || '(sem texto)'}</p>
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button
                          type="button"
                          onClick={() => copyText(item.id, text)}
                          style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '0.35rem 0.75rem', background: '#F5D26C', color: '#0c0f14', border: 'none', borderRadius: 6, fontWeight: 600, fontSize: '0.75rem', cursor: 'pointer' }}
                        >
                          <Copy size={14} /> {copied === item.id ? 'Copiado!' : 'Copiar'}
                        </button>
                        {item.library_url && (
                          <a href={item.library_url} target="_blank" rel="noreferrer" style={{ color: '#60a5fa', fontSize: '0.75rem', alignSelf: 'center' }}>
                            Ver biblioteca Meta
                          </a>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>
      <style dangerouslySetInnerHTML={{ __html: '@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }' }} />
    </AdminGuard>
  )
}
