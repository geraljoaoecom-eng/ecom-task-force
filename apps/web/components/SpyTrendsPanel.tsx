'use client'

import { useEffect, useState, useCallback } from 'react'
import { Flame, Sprout, RefreshCw } from 'lucide-react'
import { spyApi } from '@/lib/api'

type TrendItem = { title: string; why: string }
type TrendsData = { trends: TrendItem[]; novelties: TrendItem[]; updatedAt: string | null }

function Column({
  icon, title, color, items, emptyHint,
}: {
  icon: React.ReactNode; title: string; color: string; items: TrendItem[]; emptyHint: string
}) {
  return (
    <div style={{ flex: '1 1 320px', minWidth: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color, fontWeight: 700, fontSize: '0.9375rem', marginBottom: '0.75rem' }}>
        {icon} {title}
      </div>
      {items.length === 0 ? (
        <div style={{ color: '#64748b', fontSize: '0.8125rem', fontStyle: 'italic' }}>{emptyHint}</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {items.map((it, i) => (
            <div key={i} style={{ background: '#0c0f14', border: `1px solid ${color}33`, borderRadius: '0.5rem', padding: '0.625rem 0.75rem' }}>
              <div style={{ color: '#E8EDF2', fontWeight: 600, fontSize: '0.8125rem' }}>{it.title}</div>
              {it.why && <div style={{ color: '#94a3b8', fontSize: '0.75rem', marginTop: '0.25rem', lineHeight: 1.4 }}>{it.why}</div>}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default function SpyTrendsPanel() {
  const [data, setData] = useState<TrendsData | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    try {
      const d = await spyApi.getTrends()
      setData(d)
    } catch {
      // silencioso — painel é secundário
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
    const t = setInterval(load, 60000)
    return () => clearInterval(t)
  }, [load])

  const hasData = (data?.trends?.length || 0) + (data?.novelties?.length || 0) > 0
  if (loading && !data) return null
  if (!hasData) return null

  const updated = data?.updatedAt ? new Date(data.updatedAt).toLocaleString('pt-PT') : null

  return (
    <div style={{ background: '#141823', border: '1px solid rgba(245,210,108,0.25)', borderRadius: '0.75rem', padding: '1.25rem', marginTop: '1.5rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
        <h2 style={{ color: '#F5D26C', fontSize: '1rem', margin: 0 }}>📡 Spot de Tendências e Novidades</h2>
        {updated && <span style={{ color: '#64748b', fontSize: '0.7rem', display: 'flex', alignItems: 'center', gap: '0.375rem' }}><RefreshCw size={11} /> {updated}</span>}
      </div>
      <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
        <Column
          icon={<Flame size={16} />} title="A bater agora" color="#fb923c"
          items={data?.trends || []}
          emptyHint="Ainda sem tendências — faz algumas pesquisas SPY."
        />
        <Column
          icon={<Sprout size={16} />} title="Novidades a emergir" color="#34d399"
          items={data?.novelties || []}
          emptyHint="Ainda sem novidades detectadas."
        />
      </div>
    </div>
  )
}
