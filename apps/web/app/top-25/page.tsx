'use client'

import { useEffect, useState } from 'react'
import { TrendingUp, Trophy, Target } from 'lucide-react'
import { LibraryCardNew } from '@/components/LibraryCardNew'
import { librariesApi } from '@/lib/api'

export default function Top25Page() {
  const [libraries, setLibraries] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadLibraries()
  }, [])

  const loadLibraries = async () => {
    try {
      const data = await librariesApi.getAll({ order: 'ads_desc' })
      setLibraries(data.slice(0, 25)) // Top 25
    } catch (error) {
      console.error('Erro ao carregar bibliotecas:', error)
    } finally {
      setLoading(false)
    }
  }

  const totalAds = libraries.reduce((sum: number, lib: any) => sum + lib.activeAds, 0)

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-pulse text-gold">Carregando TOP 25...</div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="etf-h1 text-text flex items-center gap-3">
            <Trophy className="h-8 w-8 text-gold" />
            TOP 25 Bibliotecas
          </h1>
          <p className="text-muted mt-2">
            As bibliotecas com mais anúncios ativos no momento
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 xl:gap-8 etf-section">
        <div className="etf-card p-5 md:p-6 xl:p-7 shadow-etf">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-gold/10 rounded-lg">
              <Target className="h-6 w-6 text-gold" />
            </div>
            <div>
              <p className="text-sm text-muted">Total de Bibliotecas</p>
              <p className="text-2xl font-bold text-text">{libraries.length}</p>
            </div>
          </div>
        </div>

        <div className="etf-card p-5 md:p-6 xl:p-7 shadow-etf">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-gold/10 rounded-lg">
              <TrendingUp className="h-6 w-6 text-gold" />
            </div>
            <div>
              <p className="text-sm text-muted">Total de Anúncios</p>
              <p className="text-2xl font-bold text-text">{totalAds.toLocaleString()}</p>
            </div>
          </div>
        </div>

        <div className="etf-card p-5 md:p-6 xl:p-7 shadow-etf">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-gold/10 rounded-lg">
              <Trophy className="h-6 w-6 text-gold" />
            </div>
            <div>
              <p className="text-sm text-muted">Média por Biblioteca</p>
              <p className="text-2xl font-bold text-text">
                {libraries.length > 0 ? Math.round(totalAds / libraries.length).toLocaleString() : 0}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Grid de bibliotecas */}
      {libraries.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-3 gap-6 xl:gap-8">
          {libraries.map((library: any, index) => (
            <div key={library.id} className="relative">
              {/* Ranking badge */}
              <div className="absolute -top-3 -left-3 z-10 w-10 h-10 bg-gradient-to-br from-yellow-400 to-gold border-2 border-white text-background rounded-full flex items-center justify-center text-sm font-bold shadow-lg">
                {index + 1}
              </div>
              <LibraryCardNew 
                library={library} 
                onUpdate={loadLibraries}
              />
            </div>
          ))}
        </div>
      ) : (
        <div className="etf-card p-12 text-center shadow-etf">
          <Trophy className="h-16 w-16 text-muted mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-text mb-2">
            Nenhuma biblioteca encontrada
          </h3>
          <p className="text-muted">
            Adicione algumas bibliotecas para ver o ranking aqui.
          </p>
        </div>
      )}
    </div>
  )
}
