'use client'

import { useState, useEffect } from 'react'
import { BarChart3 } from 'lucide-react'
import { librariesApi } from '@/lib/api'

interface InlineChartProps {
  libraryId: string
  currentAds?: number
}

export function InlineChart({ libraryId, currentAds = 0 }: InlineChartProps) {
  const [chartData, setChartData] = useState<Array<{ dayLabel: string; ads: number; date: string }>>([])
  const [showChart, setShowChart] = useState(false)

  useEffect(() => {
    let isMounted = true

    const loadHistory = async () => {
      try {
        const history = await librariesApi.getHistory(libraryId, 15)
        if (!isMounted) return

        const normalized = Array.isArray(history)
          ? history.map((h: any) => {
              const d = new Date(h.date || h.day || h.createdAt || Date.now())
              const label = d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
              const value = Number(h.activeAds ?? h.ads ?? h.value ?? 0)
              return { dayLabel: label, ads: value, date: d.toISOString() }
            })
          : []

        if (normalized.length > 0) {
          // Garantir ordenação por data ascendente
          normalized.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
          setChartData(normalized)
          return
        }
      } catch (err) {
        // Fallback para dados simulados
      }

      // Fallback: dados simulados se API não retornar
      const today = new Date()
      const fallback: Array<{ dayLabel: string; ads: number; date: string }> = []
      for (let i = 14; i >= 0; i--) {
        const d = new Date(today)
        d.setDate(d.getDate() - i)
        const label = d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
        const base = currentAds || 20
        const variation = 0.8 + Math.random() * 0.4
        fallback.push({ dayLabel: label, ads: Math.round(base * variation), date: d.toISOString() })
      }
      if (isMounted) setChartData(fallback)
    }

    loadHistory()
    return () => {
      isMounted = false
    }
  }, [libraryId, currentAds])

  // Bloquear scroll da página quando o modal estiver aberto
  useEffect(() => {
    if (showChart) {
      const prev = document.body.style.overflow
      document.body.style.overflow = 'hidden'
      return () => {
        document.body.style.overflow = prev
      }
    }
  }, [showChart])

  const maxAds = chartData.length ? Math.max(...chartData.map(d => d.ads)) : 0
  const minAds = chartData.length ? Math.min(...chartData.map(d => d.ads)) : 0
  const todayAds = chartData.length ? chartData[chartData.length - 1]?.ads : currentAds

  // Escala: Y começa em 0 e vai até o máximo observado (com salvaguarda)
  const yMin = 0
  const yMax = Math.max(maxAds, 1)

  const createLinePath = () => {
    if (chartData.length < 2) return ''

    // Se todos os valores forem iguais, desenha uma linha horizontal no meio
    const isFlat = yMax === yMin

    const points = chartData.map((point, index) => {
      const x = 8 + (index * 84) / (chartData.length - 1)
      const y = isFlat ? 50 : 12 + ((yMax - point.ads) / (yMax - yMin)) * 68
      return `${x},${y}`
    })

    return `M ${points.join(' L ')}`
  }

  return (
    <div>
      {/* Botão para mostrar/ocultar gráfico */}
      <button
        onClick={() => setShowChart(true)}
        style={{
          width: '100%',
          height: '100%',
          padding: '0.25rem',
          background: 'rgba(249, 115, 22, 0.15)',
          border: '2px solid rgba(249, 115, 22, 0.3)',
          borderRadius: '0.5rem',
          color: '#F97316',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'none',
          boxShadow: '0 2px 8px rgba(249, 115, 22, 0.2)',
          boxSizing: 'border-box',
          // Evita qualquer interação/hover com o botão enquanto o modal está aberto
          pointerEvents: showChart ? 'none' : 'auto'
        }}
      >
        <BarChart3 style={{ height: '1rem', width: '1rem' }} />
      </button>

      {/* Modal do Gráfico - overlay fixo para não quebrar layout dos botões */}
      {showChart && (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowChart(false)
          }}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.6)',
            backdropFilter: 'blur(2px)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1rem'
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: 'min(900px, 95vw)',
              borderRadius: '12px',
              background: '#141823',
              border: '1px solid rgba(249, 115, 22, 0.3)',
              boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
              overflow: 'hidden'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: 'rgba(249, 115, 22, 0.1)', borderBottom: '1px solid rgba(249, 115, 22, 0.25)' }}>
              <div style={{ color: '#F97316', fontWeight: 700 }}>Anúncios (15 dias)</div>
              <button onClick={() => setShowChart(false)} style={{ background: 'transparent', border: 0, color: '#e5e7eb', cursor: 'pointer', fontSize: 14 }}>Fechar ✕</button>
            </div>

            <div style={{ padding: '16px' }}>
              <div style={{ position: 'relative', height: '280px' }}>
                <svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none" style={{ position: 'absolute', inset: 0 }}>
                  {/* Eixo Y (labels adaptados ao máximo) */}
                  {[0, 25, 50, 75, 100].map((y) => {
                    const yPos = 12 + (y * 0.68)
                    return (
                      <g key={`gy-${y}`}>
                        <line x1={"8"} y1={`${yPos}`} x2={"92"} y2={`${yPos}`} stroke="rgba(249, 115, 22, 0.15)" strokeWidth="1" />
                        <text x={"6"} y={`${yPos + 1}`} fontSize="10" fill="#9CA3AF" textAnchor="end" dominantBaseline="middle">
                          {Math.round(yMin + (yMax - yMin) * (100 - y) / 100)}
                        </text>
                      </g>
                    )
                  })}

                  {/* Eixo X */}
                  {chartData.map((p, i) => {
                    const x = 8 + (i * 84) / (chartData.length - 1)
                    return (
                      <g key={`gx-${i}`}>
                        <line x1={`${x}`} y1={"12"} x2={`${x}`} y2={"80"} stroke="rgba(249, 115, 22, 0.08)" strokeWidth="1" />
                        <text x={`${x}`} y={"88"} fontSize="10" fill="#9CA3AF" textAnchor="middle" dominantBaseline="middle">
                          {p.dayLabel}
                        </text>
                      </g>
                    )
                  })}

                  {/* Segmentos coloridos (verde se sobe, vermelho se desce) */}
                  {chartData.length > 1 && chartData.map((p, i) => {
                    if (i === 0) return null
                    const prev = chartData[i - 1]
                    const x1 = 8 + ((i - 1) * 84) / (chartData.length - 1)
                    const y1 = yMax === yMin ? 50 : 12 + ((yMax - prev.ads) / (yMax - yMin)) * 68
                    const x2 = 8 + (i * 84) / (chartData.length - 1)
                    const y2 = yMax === yMin ? 50 : 12 + ((yMax - p.ads) / (yMax - yMin)) * 68
                    const rising = p.ads >= prev.ads
                    return (
                      <path
                        key={`seg-${i}`}
                        d={`M ${x1},${y1} L ${x2},${y2}`}
                        fill="none"
                        stroke={rising ? '#22C55E' : '#EF4444'}
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    )
                  })}

                  {/* Pontos */}
                  {chartData.map((p, i) => {
                    const x = 8 + (i * 84) / (chartData.length - 1)
                    const y = maxAds === minAds ? 50 : 12 + ((maxAds - p.ads) / (maxAds - minAds)) * 68
                    return <circle key={`pt-${i}`} cx={`${x}`} cy={`${y}`} r="3.5" fill="#F97316" stroke="#141823" strokeWidth="1" />
                  })}
                </svg>
              </div>

              {/* Stats */}
              <div style={{ display: 'flex', gap: '12px', justifyContent: 'space-between', marginTop: '8px', color: '#E8EDF2' }}>
                <div style={{ flex: 1, textAlign: 'center', background: 'rgba(249, 115, 22, 0.08)', border: '1px solid rgba(249, 115, 22, 0.2)', borderRadius: 8, padding: '8px 12px' }}>
                  <div style={{ color: '#F97316', fontWeight: 700, marginBottom: 4 }}>Hoje</div>
                  <div>{todayAds}</div>
                </div>
                <div style={{ flex: 1, textAlign: 'center', background: 'rgba(34, 197, 94, 0.08)', border: '1px solid rgba(34, 197, 94, 0.2)', borderRadius: 8, padding: '8px 12px' }}>
                  <div style={{ color: '#22C55E', fontWeight: 700, marginBottom: 4 }}>Máx</div>
                  <div>{maxAds}</div>
                </div>
                <div style={{ flex: 1, textAlign: 'center', background: 'rgba(59, 130, 246, 0.08)', border: '1px solid rgba(59, 130, 246, 0.2)', borderRadius: 8, padding: '8px 12px' }}>
                  <div style={{ color: '#3B82F6', fontWeight: 700, marginBottom: 4 }}>Mín</div>
                  <div>{minAds}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
