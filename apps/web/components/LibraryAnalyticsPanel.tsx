'use client'

import { useEffect, useState, useCallback } from 'react'
import { BarChart3, Flame, Clock, Copy, Globe, Heart } from 'lucide-react'
import { librariesApi } from '@/lib/api'

type Analytics = Awaited<ReturnType<typeof librariesApi.analytics>>

const row: React.CSSProperties = { display: 'flex', justifyContent: 'space-between', gap: '0.5rem', padding: '0.3rem 0', borderBottom: '1px solid rgba(255,255,255,0.04)', fontSize: '0.8125rem' }

function SubCard({ color, icon, label, children }: { color: string; icon: React.ReactNode; label: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false)
  return (
    <div style={{ flex: '1 1 300px', minWidth: 0, background: '#0c0f14', border: `1px solid rgba(245,210,108,0.18)`, borderRadius: '0.625rem', overflow: 'hidden' }}>
      <div
        onClick={() => setOpen(o => !o)}
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.6rem 0.875rem', cursor: 'pointer', userSelect: 'none' }}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 700, fontSize: '0.875rem', color }}>{icon} {label}</span>
        <span style={{ color: '#64748b', fontSize: '0.7rem' }}>{open ? '▲' : '▼'}</span>
      </div>
      {open && <div style={{ padding: '0 0.875rem 0.75rem' }}>{children}</div>}
    </div>
  )
}

export default function LibraryAnalyticsPanel() {
  const [data, setData] = useState<Analytics | null>(null)
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)

  const load = useCallback(async () => {
    try { setData(await librariesApi.analytics({ limit: 10 })) }
    catch { /* silencioso */ }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { load(); const t = setInterval(load, 60000); return () => clearInterval(t) }, [load])

  if (loading && !data) return null
  if (!data) return null

  return (
    <div style={{ background: '#141823', border: '1px solid rgba(245,210,108,0.25)', borderRadius: '0.75rem', marginBottom: '1.25rem', overflow: 'hidden' }}>
      <div
        onClick={() => setOpen(o => !o)}
        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem 1.1rem', cursor: 'pointer', userSelect: 'none' }}
      >
        <h2 style={{ color: '#F5D26C', fontSize: '1rem', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <BarChart3 size={18} /> Análise de Bibliotecas
        </h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <span style={{ color: '#64748b', fontSize: '0.75rem' }}>
            {data.totals.libraries} bibliotecas · {data.totals.ads_ativos} ads ativos · {data.totals.libs_com_ads} analisadas
          </span>
          <span style={{ color: '#64748b', fontSize: '0.75rem' }}>{open ? '▲' : '▼'}</span>
        </div>
      </div>

      {open && (
        <div style={{ padding: '0 1.1rem 1.1rem', display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          <SubCard color="#fb923c" icon={<Flame size={15} />} label="Mais escaladas">
            {data.scaled.map((s) => (
              <div key={s.id} style={row}>
                <span style={{ color: '#E8EDF2', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.name}</span>
                <span style={{ color: '#fb923c', fontWeight: 600, whiteSpace: 'nowrap' }}>{s.active_ads}</span>
              </div>
            ))}
          </SubCard>

          <SubCard color="#34d399" icon={<Clock size={15} />} label="Há mais tempo ativas">
            {data.longevity.map((s) => (
              <div key={s.library_id} style={row}>
                <span style={{ color: '#E8EDF2', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.name}</span>
                <span style={{ color: '#34d399', fontWeight: 600, whiteSpace: 'nowrap' }}>{s.max_dias}d</span>
              </div>
            ))}
          </SubCard>

          <SubCard color="#7dd3fc" icon={<Globe size={15} />} label="Por país">
            {data.byCountry.map((s) => (
              <div key={s.pais} style={row}>
                <span style={{ color: '#E8EDF2', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.pais}</span>
                <span style={{ color: '#7dd3fc', whiteSpace: 'nowrap' }}>{s.libs} libs · {s.total_ads}</span>
              </div>
            ))}
          </SubCard>

          <SubCard color="#f472b6" icon={<Heart size={15} />} label="Por nicho">
            {data.byNiche.map((s) => (
              <div key={s.nicho} style={row}>
                <span style={{ color: '#E8EDF2', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.nicho}</span>
                <span style={{ color: '#f472b6', whiteSpace: 'nowrap' }}>{s.libs} libs · {s.total_ads}</span>
              </div>
            ))}
          </SubCard>

          {data.duplicated.length > 0 && (
            <SubCard color="#c084fc" icon={<Copy size={15} />} label="Mais duplicados">
              {data.duplicated.map((s, i) => (
                <div key={i} style={row}>
                  <span style={{ color: '#E8EDF2', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.name}</span>
                  <span style={{ color: '#c084fc', whiteSpace: 'nowrap' }}>×{s.dup} · {s.dias}d</span>
                </div>
              ))}
            </SubCard>
          )}
        </div>
      )}
    </div>
  )
}
