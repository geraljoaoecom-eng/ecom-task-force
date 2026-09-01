'use client'

import { useEffect, useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { librariesApi } from '@/lib/api'
import { ArrowLeft } from 'lucide-react'

interface Point { dayLabel: string; ads: number; date: string }

export default function GraficoBibliotecaPage() {
  const params = useParams() as { id: string }
  const router = useRouter()
  const libraryId = params?.id

  const [data, setData] = useState<Point[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!libraryId) return
    const load = async () => {
      setLoading(true)
      setError(null)
      try {
        const history = await librariesApi.getHistory(libraryId, 15)
        const normalized: Point[] = Array.isArray(history)
          ? history.map((h: any) => {
              const d = new Date(h.date || h.day || h.createdAt || Date.now())
              return {
                dayLabel: d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
                ads: Number(h.activeAds ?? h.ads ?? h.value ?? 0) || 0,
                date: d.toISOString()
              }
            })
          : []
        normalized.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
        setData(normalized)
      } catch (e: any) {
        setError('Falha ao carregar histórico')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [libraryId])

  const stats = useMemo(() => {
    const values = data.map(d => d.ads)
    const max = values.length ? Math.max(...values) : 0
    const min = 0
    return { min, max: Math.max(max, 1) }
  }, [data])

  return (
    <div style={{ padding: 16 }}>
      <button
        onClick={() => router.back()}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 8,
          background: 'transparent', border: '1px solid #374151', color: '#E5E7EB',
          padding: '8px 12px', borderRadius: 8, cursor: 'pointer'
        }}
      >
        <ArrowLeft size={16} /> Voltar
      </button>

      <h1 style={{ color: '#E8EDF2', fontWeight: 700, fontSize: 20, marginTop: 16 }}>Anúncios (últimos 15 dias)</h1>

      <div style={{
        marginTop: 16,
        background: '#0F172A',
        border: '1px solid #374151',
        borderRadius: 12,
        padding: 16
      }}>
        {loading && <div style={{ color: '#9CA3AF' }}>Carregando…</div>}
        {error && <div style={{ color: '#EF4444' }}>{error}</div>}

        {!loading && !error && (
          <div style={{ position: 'relative', height: 360 }}>
            <svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none" style={{ position: 'absolute', inset: 0 }}>
              {[0, 25, 50, 75, 100].map((y) => {
                const yPos = 8 + (y * 0.74)
                const label = Math.round(stats.min + (stats.max - stats.min) * (100 - y) / 100)
                return (
                  <g key={`gy-${y}`}>
                    <line x1={"8"} y1={`${yPos}`} x2={"96"} y2={`${yPos}`} stroke="rgba(148,163,184,0.18)" strokeWidth="1" />
                    <text x={"6"} y={`${yPos + 1}`} fontSize="9" fill="#94A3B8" textAnchor="end" dominantBaseline="middle">{label}</text>
                  </g>
                )
              })}

              {data.map((p, i) => {
                const x = 8 + (i * 88) / (Math.max(data.length - 1, 1))
                return (
                  <g key={`gx-${i}`}>
                    <line x1={`${x}`} y1={"8"} x2={`${x}`} y2={"82"} stroke="rgba(148,163,184,0.12)" strokeWidth="1" />
                    <text x={`${x}`} y={"90"} fontSize="9" fill="#9CA3AF" textAnchor="middle" dominantBaseline="middle">{p.dayLabel}</text>
                  </g>
                )
              })}

              {data.length > 1 && data.map((p, i) => {
                if (i === 0) return null
                const prev = data[i - 1]
                const x1 = 8 + ((i - 1) * 88) / (Math.max(data.length - 1, 1))
                const y1 = 8 + ((stats.max - prev.ads) / (stats.max - stats.min)) * 74
                const x2 = 8 + (i * 88) / (Math.max(data.length - 1, 1))
                const y2 = 8 + ((stats.max - p.ads) / (stats.max - stats.min)) * 74
                const rising = p.ads >= prev.ads
                return (
                  <path key={`seg-${i}`} d={`M ${x1},${y1} L ${x2},${y2}`} fill="none" stroke={rising ? '#22C55E' : '#EF4444'} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                )
              })}

              {data.map((p, i) => {
                const x = 8 + (i * 88) / (Math.max(data.length - 1, 1))
                const y = 8 + ((stats.max - p.ads) / (stats.max - stats.min)) * 74
                return <circle key={`pt-${i}`} cx={`${x}`} cy={`${y}`} r="2.8" fill="#F97316" stroke="#0F172A" strokeWidth="1" />
              })}
            </svg>
          </div>
        )}
      </div>
    </div>
  )
}


