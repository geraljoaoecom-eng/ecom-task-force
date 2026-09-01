'use client'

import { useState, useEffect } from 'react'
import { X } from 'lucide-react'
import { librariesApi } from '@/lib/api'
import { AdHistoryBarChart } from './AdHistoryBarChart'
import { AdChartData, buildAdChartData, buildFallbackChart } from '@/lib/chart-utils'

interface ChartModalProps {
  libraryId: string
  libraryName: string
  isOpen: boolean
  onClose: () => void
  currentAds?: number
}

export function ChartModal({ libraryId, libraryName, isOpen, onClose, currentAds = 0 }: ChartModalProps) {
  const [chartData, setChartData] = useState<AdChartData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!isOpen || !libraryId) return

    const loadHistory = async () => {
      setLoading(true)
      setError(null)
      try {
        const history = await librariesApi.getHistory(libraryId, 'all')
        const built = buildAdChartData(history, currentAds)

        if (built.fullHistory.length > 0 || currentAds > 0) {
          setChartData(built)
        } else {
          setChartData(null)
        }
      } catch (err) {
        console.error('Erro ao carregar histórico:', err)
        if (currentAds > 0) {
          setChartData(buildFallbackChart(currentAds))
          setError(null)
        } else {
          setError('Não foi possível carregar o histórico de anúncios.')
          setChartData(null)
        }
      } finally {
        setLoading(false)
      }
    }

    loadHistory()
  }, [isOpen, libraryId, currentAds])

  const allValues = chartData
    ? [chartData.averageValue, ...chartData.recentData.map((d) => d.ads), ...chartData.fullHistory.map((d) => d.ads)]
    : []
  const positiveValues = allValues.filter((v) => v > 0)
  const maxAds = allValues.length ? Math.max(...allValues) : 0
  const minAds = positiveValues.length ? Math.min(...positiveValues) : 0
  const todayAds = chartData?.recentData.find((d) => d.isToday)?.ads ?? currentAds

  if (!isOpen) return null

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: '1rem',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        style={{
          background: '#1a1d2e',
          borderRadius: '0.75rem',
          border: '1px solid rgba(139, 92, 246, 0.25)',
          padding: '1.25rem',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
          maxWidth: '640px',
          width: '100%',
          maxHeight: '85vh',
          overflow: 'auto',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '1rem',
            paddingBottom: '0.75rem',
            borderBottom: '1px solid rgba(255,255,255,0.08)',
          }}
        >
          <h2 style={{ fontSize: '1.125rem', fontWeight: 700, color: '#F5D26C', margin: 0 }}>
            Histórico de Anúncios — {libraryName}
          </h2>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#9CA3AF',
              cursor: 'pointer',
              padding: '0.5rem',
              borderRadius: '0.25rem',
              display: 'flex',
            }}
          >
            <X style={{ height: '1.25rem', width: '1.25rem' }} />
          </button>
        </div>

        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '260px', color: '#94a3b8' }}>
            A carregar gráfico...
          </div>
        ) : error ? (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '260px', color: '#EF4444' }}>
            {error}
          </div>
        ) : chartData ? (
          <>
            <AdHistoryBarChart data={chartData} height={260} libraryName={libraryName} />

            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'space-between', marginTop: '1rem', color: '#E8EDF2' }}>
              <div style={{ flex: 1, textAlign: 'center', background: 'rgba(245, 210, 108, 0.1)', border: '1px solid rgba(245, 210, 108, 0.2)', borderRadius: '0.5rem', padding: '0.5rem' }}>
                <div style={{ color: '#F5D26C', fontWeight: 700, fontSize: '0.8rem', marginBottom: '0.25rem' }}>Hoje</div>
                <div style={{ fontSize: '1rem' }}>{todayAds}</div>
              </div>
              <div style={{ flex: 1, textAlign: 'center', background: 'rgba(139, 92, 246, 0.1)', border: '1px solid rgba(139, 92, 246, 0.2)', borderRadius: '0.5rem', padding: '0.5rem' }}>
                <div style={{ color: '#A78BFA', fontWeight: 700, fontSize: '0.8rem', marginBottom: '0.25rem' }}>Máx</div>
                <div style={{ fontSize: '1rem' }}>{maxAds}</div>
              </div>
              <div style={{ flex: 1, textAlign: 'center', background: 'rgba(100, 116, 139, 0.1)', border: '1px solid rgba(100, 116, 139, 0.2)', borderRadius: '0.5rem', padding: '0.5rem' }}>
                <div style={{ color: '#94a3b8', fontWeight: 700, fontSize: '0.8rem', marginBottom: '0.25rem' }}>Mín</div>
                <div style={{ fontSize: '1rem' }}>{minAds || 0}</div>
              </div>
            </div>
          </>
        ) : null}
      </div>
    </div>
  )
}
