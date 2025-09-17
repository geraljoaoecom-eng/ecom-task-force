'use client'

import { useState, useEffect } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { librariesApi } from '@/lib/api'

interface HistoryData {
  id: string
  libraryId: string
  adsCount: number
  date: string
}

interface HistoryChartProps {
  libraryId: string
  currentAds: number
}

export function HistoryChart({ libraryId, currentAds }: HistoryChartProps) {
  const [data, setData] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    loadHistory()
  }, [libraryId])

  // Cleanup para evitar vazamentos de memória
  useEffect(() => {
    return () => {
      setData([])
      setLoading(false)
      setError('')
    }
  }, [])

  const loadHistory = async () => {
    try {
      setLoading(true)
      const historyData = await librariesApi.getHistory(libraryId, 15)
      
      // Formatar dados para o gráfico
      const chartData = historyData.map((item: HistoryData) => ({
        date: new Date(item.date).toLocaleDateString('pt-BR', { 
          day: '2-digit', 
          month: '2-digit' 
        }),
        ads: item.adsCount,
        fullDate: new Date(item.date).toLocaleDateString('pt-BR')
      }))

      // Se não há dados históricos, criar um ponto com o valor atual
      if (chartData.length === 0) {
        chartData.push({
          date: new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
          ads: currentAds,
          fullDate: new Date().toLocaleDateString('pt-BR')
        })
      }

      setData(chartData)
    } catch (err) {
      console.error('Erro ao carregar histórico:', err)
      setError('Erro ao carregar histórico')
      
      // Fallback: mostrar apenas o valor atual
      setData([{
        date: new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
        ads: currentAds,
        fullDate: new Date().toLocaleDateString('pt-BR')
      }])
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="h-32 flex items-center justify-center">
        <div className="animate-pulse text-gray-400">Carregando gráfico...</div>
      </div>
    )
  }

  if (error && data.length === 0) {
    return (
      <div className="h-32 flex items-center justify-center">
        <div className="text-red-400 text-sm">{error}</div>
      </div>
    )
  }

  // Calcular tendência
  const getTrend = () => {
    if (data.length < 2) return 'stable'
    const first = data[0].ads
    const last = data[data.length - 1].ads
    if (last > first) return 'up'
    if (last < first) return 'down'
    return 'stable'
  }

  const trend = getTrend()
  const trendColor = trend === 'up' ? '#10b981' : trend === 'down' ? '#ef4444' : '#6b7280'

  return (
    <div className="space-y-3">
      {/* Estatísticas rápidas */}
      <div className="flex items-center justify-between text-sm">
        <div className="text-gray-300">
          <span className="text-white font-medium">Últimos 15 dias:</span> {data.length} registros
        </div>
        <div className="flex items-center gap-2">
          <span className="text-gray-400">Tendência:</span>
          <span 
            className="font-medium"
            style={{ color: trendColor }}
          >
            {trend === 'up' ? '↗ Crescendo' : trend === 'down' ? '↘ Diminuindo' : '→ Estável'}
          </span>
        </div>
      </div>

      {/* Gráfico */}
      <div className="h-40">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
            <CartesianGrid 
              strokeDasharray="3 3" 
              stroke="#374151" 
              horizontal={true}
              vertical={false}
            />
            <XAxis 
              dataKey="date" 
              stroke="#9ca3af"
              fontSize={11}
              tickLine={false}
              axisLine={false}
            />
            <YAxis 
              stroke="#9ca3af"
              fontSize={11}
              tickLine={false}
              axisLine={false}
              width={30}
            />
            <Tooltip 
              contentStyle={{
                backgroundColor: '#1f2937',
                border: '1px solid #374151',
                borderRadius: '6px',
                color: '#fff',
                fontSize: '12px'
              }}
              labelStyle={{ color: '#9ca3af' }}
              formatter={(value: any, name: any) => [
                `${value} anúncios`, 
                'Ativos'
              ]}
              labelFormatter={(label: any) => {
                const item = data.find(d => d.date === label)
                return item ? `Data: ${item.fullDate}` : label
              }}
            />
            <Line 
              type="monotone" 
              dataKey="ads" 
              stroke={trendColor}
              strokeWidth={2}
              dot={{ fill: trendColor, strokeWidth: 0, r: 3 }}
              activeDot={{ r: 4, stroke: trendColor, strokeWidth: 2, fill: '#1f2937' }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Estatísticas detalhadas */}
      {data.length > 1 && (
        <div className="grid grid-cols-3 gap-4 text-xs text-gray-400 pt-2 border-t border-gray-700">
          <div className="text-center">
            <div className="text-white font-medium">{Math.min(...data.map(d => d.ads))}</div>
            <div>Mínimo</div>
          </div>
          <div className="text-center">
            <div className="text-white font-medium">{Math.max(...data.map(d => d.ads))}</div>
            <div>Máximo</div>
          </div>
          <div className="text-center">
            <div className="text-white font-medium">
              {Math.round(data.reduce((sum, d) => sum + d.ads, 0) / data.length)}
            </div>
            <div>Média</div>
          </div>
        </div>
      )}
    </div>
  )
}
