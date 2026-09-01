'use client'

import { useState, useEffect } from 'react'
import { BarChart3 } from 'lucide-react'

interface SimpleChartProps {
  libraryId: string
  currentAds: number
}

export function SimpleChart({ libraryId, currentAds }: SimpleChartProps) {
  const [chartData, setChartData] = useState<Array<{day: number, ads: number, date: string}>>([])
  const [showChart, setShowChart] = useState(false)

  useEffect(() => {
    // Gerar dados simulados para os últimos 15 dias
    const generateMockData = () => {
      const data = []
      const today = new Date()
      
      for (let i = 14; i >= 0; i--) {
        const date = new Date(today)
        date.setDate(date.getDate() - i)
        
        // Simular variação realística baseada no valor atual
        const baseValue = currentAds
        const variation = Math.random() * 0.4 + 0.8 // Entre 80% e 120% do valor base
        const adsCount = Math.round(baseValue * variation)
        
        data.push({
          day: date.getDate(),
          ads: adsCount,
          date: date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
        })
      }
      
      return data
    }
    
    setChartData(generateMockData())
  }, [currentAds])

  const maxAds = Math.max(...chartData.map(d => d.ads))
  const minAds = Math.min(...chartData.map(d => d.ads))
  const todayAds = chartData[chartData.length - 1]?.ads || currentAds

  // Função para criar pontos da linha
  const createLinePath = () => {
    if (chartData.length === 0) return ''
    
    const points = chartData.map((point, index) => {
      const x = 15 + (index * 80) / (chartData.length - 1)
      const y = 20 + ((maxAds - point.ads) / (maxAds - minAds)) * 60
      return `${x}%,${y}%`
    })
    
    return points.join(' L')
  }

  return (
    <div style={{ position: 'relative' }}>
      <button
        onClick={() => setShowChart(!showChart)}
        style={{
          padding: '0.75rem',
          background: 'rgba(16, 185, 129, 0.15)',
          border: '2px solid rgba(16, 185, 129, 0.3)',
          borderRadius: '0.5rem',
          color: '#10B981',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          fontSize: '0.875rem',
          fontWeight: '600',
          transition: 'all 0.2s',
          minWidth: '120px',
          justifyContent: 'center',
          boxShadow: '0 2px 8px rgba(16, 185, 129, 0.2)'
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = 'rgba(16, 185, 129, 0.25)'
          e.currentTarget.style.borderColor = 'rgba(16, 185, 129, 0.5)'
          e.currentTarget.style.transform = 'translateY(-1px)'
          e.currentTarget.style.boxShadow = '0 4px 12px rgba(16, 185, 129, 0.3)'
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = 'rgba(16, 185, 129, 0.15)'
          e.currentTarget.style.borderColor = 'rgba(16, 185, 129, 0.3)'
          e.currentTarget.style.transform = 'translateY(0)'
          e.currentTarget.style.boxShadow = '0 2px 8px rgba(16, 185, 129, 0.2)'
        }}
      >
        <BarChart3 style={{ height: '1rem', width: '1rem' }} />
        📊 Gráfico 15d
      </button>

      {showChart && (
        <div style={{
          position: 'absolute',
          bottom: '100%',
          left: '0',
          right: '0',
          background: '#141823',
          border: '1px solid rgba(245, 210, 108, 0.3)',
          borderRadius: '0.75rem',
          padding: '1.5rem',
          marginBottom: '0.5rem',
          zIndex: 1000,
          minWidth: '280px',
          boxShadow: '0 10px 25px rgba(0, 0, 0, 0.5)'
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '1rem'
          }}>
            <h4 style={{
              fontSize: '1rem',
              fontWeight: '600',
              color: '#F5D26C',
              margin: 0
            }}>
              Anúncios (15 dias)
            </h4>
            <button
              onClick={() => setShowChart(false)}
              style={{
                background: 'none',
                border: 'none',
                color: '#94a3b8',
                cursor: 'pointer',
                fontSize: '1rem',
                padding: '0.25rem',
                borderRadius: '0.25rem',
                transition: 'color 0.2s'
              }}
              onMouseEnter={(e) => e.currentTarget.style.color = '#E8EDF2'}
              onMouseLeave={(e) => e.currentTarget.style.color = '#94a3b8'}
            >
              ✕
            </button>
          </div>
          
          {/* Gráfico de Linha */}
          <div style={{
            position: 'relative',
            height: '120px',
            marginBottom: '1rem',
            background: 'rgba(245, 210, 108, 0.05)',
            borderRadius: '0.5rem',
            border: '1px solid rgba(245, 210, 108, 0.2)',
            padding: '1rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <svg
              width="100%"
              height="100%"
              style={{ position: 'absolute', top: 0, left: 0 }}
            >
              {/* Eixo Y - Linhas horizontais */}
              {[0, 25, 50, 75, 100].map((y, index) => {
                const yPos = 20 + (y * 0.6) // 20% padding top, 60% chart area
                return (
                  <g key={y}>
                    <line
                      x1="15%"
                      y1={`${yPos}%`}
                      x2="95%"
                      y2={`${yPos}%`}
                      stroke="rgba(245, 210, 108, 0.2)"
                      strokeWidth="1"
                    />
                    {/* Labels do eixo Y */}
                    <text
                      x="10%"
                      y={`${yPos + 1}%`}
                      fontSize="10"
                      fill="#94a3b8"
                      textAnchor="end"
                      dominantBaseline="middle"
                    >
                      {Math.round(minAds + (maxAds - minAds) * (100 - y) / 100)}
                    </text>
                  </g>
                )
              })}
              
              {/* Eixo X - Linhas verticais */}
              {chartData.map((point, index) => {
                const x = 15 + (index * 80) / (chartData.length - 1)
                return (
                  <g key={`x-${index}`}>
                    <line
                      x1={`${x}%`}
                      y1="20%"
                      x2={`${x}%`}
                      y2="80%"
                      stroke="rgba(245, 210, 108, 0.1)"
                      strokeWidth="1"
                    />
                    {/* Labels do eixo X */}
                    <text
                      x={`${x}%`}
                      y="95%"
                      fontSize="9"
                      fill="#94a3b8"
                      textAnchor="middle"
                      dominantBaseline="middle"
                    >
                      {point.day}
                    </text>
                  </g>
                )
              })}
              
              {/* Linha principal */}
              <path
                d={`M ${createLinePath()}`}
                fill="none"
                stroke="#F5D26C"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              
              {/* Pontos */}
              {chartData.map((point, index) => {
                const x = 15 + (index * 80) / (chartData.length - 1)
                const y = 20 + ((maxAds - point.ads) / (maxAds - minAds)) * 60
                
                return (
                  <circle
                    key={index}
                    cx={`${x}%`}
                    cy={`${y}%`}
                    r="4"
                    fill="#F5D26C"
                    stroke="#141823"
                    strokeWidth="2"
                  />
                )
              })}
            </svg>
          </div>
          
          {/* Estatísticas */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            fontSize: '0.75rem',
            color: '#E8EDF2',
            background: 'rgba(245, 210, 108, 0.1)',
            padding: '0.75rem',
            borderRadius: '0.5rem',
            border: '1px solid rgba(245, 210, 108, 0.2)'
          }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ color: '#F5D26C', fontWeight: '600' }}>Hoje</div>
              <div>{todayAds}</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ color: '#F5D26C', fontWeight: '600' }}>Máx</div>
              <div>{maxAds}</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ color: '#F5D26C', fontWeight: '600' }}>Mín</div>
              <div>{minAds}</div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}