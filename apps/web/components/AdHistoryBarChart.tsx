'use client'

import { useEffect, useMemo, useState } from 'react'
import { Sparkles, X } from 'lucide-react'
import { AdChartData, ChartPoint } from '@/lib/chart-utils'
import { buildLibraryHistoryAnalysis } from '@/lib/library-history-analysis'

interface AdHistoryBarChartProps {
  data: AdChartData
  height?: number
  libraryName?: string
}

interface BarProps {
  point: ChartPoint
  maxAds: number
  variant: 'average' | 'recent'
  historyDayCount?: number
  onClick?: () => void
}

function MainBar({ point, maxAds, variant, historyDayCount = 0, onClick }: BarProps) {
  const [hover, setHover] = useState(false)
  const isToday = point.isToday ?? point.dayLabel === 'Hoje'
  const isAverage = variant === 'average'
  const barHeight = Math.max((point.ads / maxAds) * 100, point.ads > 0 ? 8 : 4)

  let background = 'linear-gradient(180deg, #A78BFA 0%, #5B21B6 100%)'
  let boxShadow = 'none'
  let border = 'none'
  let cursor = 'default'

  if (isToday) {
    background = 'linear-gradient(180deg, #F5D26C 0%, #F97316 100%)'
    boxShadow = '0 0 16px rgba(245, 210, 108, 0.45)'
  } else if (isAverage) {
    background = 'linear-gradient(180deg, rgba(56,189,248,0.45) 0%, rgba(14,116,144,0.35) 100%)'
    border = '2px dashed rgba(56, 189, 248, 0.55)'
    cursor = 'pointer'
  }

  if (hover && isAverage) {
    boxShadow = '0 0 12px rgba(56, 189, 248, 0.35)'
  }

  return (
    <div
      style={{
        flex: 1,
        minWidth: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        height: '100%',
        justifyContent: 'flex-end',
        position: 'relative',
      }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onClick={onClick}
    >
      <span
        style={{
          color: isToday ? '#F5D26C' : isAverage ? '#38bdf8' : '#94a3b8',
          fontSize: '0.72rem',
          marginBottom: '6px',
          fontWeight: isToday || isAverage ? 700 : 500,
        }}
      >
        {point.ads}
      </span>

      <div
        style={{
          width: '100%',
          maxWidth: '44px',
          height: `${barHeight}%`,
          minHeight: point.ads > 0 ? '12px' : '4px',
          borderRadius: '10px 10px 4px 4px',
          background,
          border,
          boxShadow,
          cursor,
          transition: 'height 0.3s ease, box-shadow 0.2s',
        }}
      />

      <span
        style={{
          color: isToday ? '#F5D26C' : isAverage ? '#38bdf8' : '#64748b',
          fontSize: isAverage ? '0.62rem' : '0.68rem',
          marginTop: '10px',
          fontWeight: isToday || isAverage ? 700 : 400,
          whiteSpace: 'nowrap',
        }}
      >
        {point.dayLabel}
      </span>

      {hover && (
        <div
          style={{
            position: 'absolute',
            bottom: '100%',
            marginBottom: '4px',
            background: '#0c0f14',
            border: '1px solid rgba(245,210,108,0.3)',
            borderRadius: '6px',
            padding: '4px 8px',
            fontSize: '0.7rem',
            color: '#E8EDF2',
            whiteSpace: 'nowrap',
            zIndex: 10,
            pointerEvents: 'none',
          }}
        >
          {isAverage ? (
            <>
              Média: <strong style={{ color: '#38bdf8' }}>{point.ads}</strong> anúncios/dia
              {historyDayCount > 0 && (
                <span style={{ color: '#94a3b8' }}> · {historyDayCount} dias</span>
              )}
            </>
          ) : (
            <>
              {point.dayLabel}: <strong style={{ color: '#F5D26C' }}>{point.ads}</strong>
            </>
          )}
        </div>
      )}
    </div>
  )
}

interface FullHistoryScreenProps {
  fullHistory: ChartPoint[]
  totalDays: number
  libraryName?: string
  onClose: () => void
}

function renderSummaryText(text: string) {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, index) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return (
        <strong key={index} style={{ color: '#F5D26C', fontWeight: 600 }}>
          {part.slice(2, -2)}
        </strong>
      )
    }
    return part
  })
}

function AnalysisRow({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
      <span style={{ color: '#64748b', fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
        {label}
      </span>
      <span style={{ color: accent ?? '#E8EDF2', fontSize: '0.875rem', fontWeight: 600 }}>{value}</span>
    </div>
  )
}

function FullHistoryScreen({ fullHistory, totalDays, libraryName, onClose }: FullHistoryScreenProps) {
  const count = fullHistory.length
  const analysis = useMemo(() => buildLibraryHistoryAnalysis(fullHistory), [fullHistory])

  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 10000,
        background: 'rgba(0, 0, 0, 0.85)',
        backdropFilter: 'blur(6px)',
        display: 'flex',
        flexDirection: 'column',
        padding: 'clamp(1rem, 3vw, 2rem)',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          background: '#1a1d2e',
          border: '1px solid rgba(139, 92, 246, 0.3)',
          borderRadius: '1rem',
          overflow: 'hidden',
          overflowY: 'auto',
          maxWidth: '720px',
          width: '100%',
          margin: '0 auto',
          maxHeight: '100%',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '1rem 1.25rem',
            borderBottom: '1px solid rgba(255,255,255,0.08)',
            flexShrink: 0,
          }}
        >
          <div>
            <h3 style={{ margin: 0, color: '#F5D26C', fontSize: 'clamp(1rem, 2.5vw, 1.25rem)', fontWeight: 700 }}>
              Análise da biblioteca — {totalDays > 0 ? `${totalDays} dias` : `${count} registos`}
            </h3>
            {libraryName && (
              <p style={{ margin: '4px 0 0', color: '#94a3b8', fontSize: '0.875rem' }}>{libraryName}</p>
            )}
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '8px',
              color: '#E8EDF2',
              cursor: 'pointer',
              padding: '8px 12px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '0.875rem',
            }}
          >
            <X size={18} /> Fechar
          </button>
        </div>

        <div
          style={{
            padding: '1.25rem',
            flexShrink: 0,
            background: '#141823',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              marginBottom: '1rem',
              color: '#F5D26C',
              fontWeight: 700,
              fontSize: '0.875rem',
            }}
          >
            <Sparkles size={16} />
            Análise IA
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
              gap: '1rem',
              marginBottom: '1rem',
            }}
          >
            <AnalysisRow label="Ativa desde" value={analysis.activeSince} accent="#38bdf8" />
            <AnalysisRow
              label="Máximo"
              value={`${analysis.maxDay.date} — ${analysis.maxDay.ads} ads`}
              accent="#A78BFA"
            />
            <AnalysisRow
              label="Mínimo"
              value={`${analysis.minDay.date} — ${analysis.minDay.ads} ads`}
              accent="#94a3b8"
            />
            <AnalysisRow label="Média histórica" value={`${analysis.average} ads/dia`} accent="#38bdf8" />
          </div>

          <p
            style={{
              margin: 0,
              color: '#94a3b8',
              fontSize: '0.875rem',
              lineHeight: 1.65,
            }}
          >
            {renderSummaryText(analysis.summary)}
          </p>
        </div>
      </div>
    </div>
  )
}

export function AdHistoryBarChart({ data, height = 260, libraryName }: AdHistoryBarChartProps) {
  const [showFullHistory, setShowFullHistory] = useState(false)

  const { averageLabel, averageValue, historyDayCount, recentData, fullHistory, totalDays } = data

  const averageBar: ChartPoint = {
    dayLabel: averageLabel,
    ads: averageValue,
    date: '',
    isToday: false,
  }

  const mainBars: ChartPoint[] = [averageBar, ...recentData]

  const mainMax = Math.max(...mainBars.map((d) => d.ads), 1)

  if (!fullHistory.length && averageValue === 0 && recentData.every((d) => d.ads === 0)) {
    return (
      <div style={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b' }}>
        Sem dados de histórico
      </div>
    )
  }

  return (
    <>
      <div style={{ position: 'relative', height }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-end',
            height: 'calc(100% - 24px)',
            gap: '4px',
            padding: '0 4px',
          }}
        >
          <MainBar
            point={mainBars[0]}
            maxAds={mainMax}
            variant="average"
            historyDayCount={historyDayCount}
            onClick={() => fullHistory.length > 0 && setShowFullHistory(true)}
          />

          <div
            style={{
              width: '2px',
              alignSelf: 'stretch',
              margin: '0 6px 28px',
              background: 'repeating-linear-gradient(180deg, rgba(148,163,184,0.3) 0 4px, transparent 4px 8px)',
              flexShrink: 0,
            }}
            aria-hidden
          />

          {mainBars.slice(1).map((point, index) => (
            <MainBar key={`recent-${point.date}-${index}`} point={point} maxAds={mainMax} variant="recent" />
          ))}
        </div>

        <div style={{ position: 'absolute', bottom: 0, right: 0, color: '#64748b', fontSize: '0.68rem' }}>
          Escala: 0 – {mainMax}
        </div>

        {fullHistory.length > 0 && (
          <div style={{ position: 'absolute', bottom: 0, left: 0, color: '#64748b', fontSize: '0.62rem' }}>
            Clica em Média para análise completa
          </div>
        )}
      </div>

      {showFullHistory && fullHistory.length > 0 && (
        <FullHistoryScreen
          fullHistory={fullHistory}
          totalDays={totalDays}
          libraryName={libraryName}
          onClose={() => setShowFullHistory(false)}
        />
      )}
    </>
  )
}
