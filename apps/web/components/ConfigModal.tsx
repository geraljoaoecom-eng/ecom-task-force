'use client'

import { useState, useEffect } from 'react'
import { X, Settings, BarChart3 } from 'lucide-react'
import { librariesApi } from '@/lib/api'
import { LoadingSpinner } from './LoadingSpinner'
import { getFilterColors } from '@/lib/filterColors'
import { SimpleSelect } from './SimpleSelect'

interface Library {
  id: string
  name: string
  nota?: string
  sourceType: string
  sourceValue: string
  country?: string
  language?: string
  notes?: string
  activeAds: number
  lastCheckedAt?: string
  createdAt: string
  updatedAt: string
  folder?: { id: string; name: string }
  pages?: { id: string; url: string }[]
  folderId?: string
  status?: string
  nichos?: string
  estrategias?: string
  produtos?: string
  tipos?: string
  idiomas?: string
  paises?: string
  calculatedStatus?: string
}

interface ConfigModalProps {
  isOpen: boolean
  libraryId: string | null
  onClose: () => void
  onUpdate: () => void
  library?: Library
}

export function ConfigModal({ isOpen, libraryId, onClose, onUpdate, library }: ConfigModalProps) {
  const [fieldLoading, setFieldLoading] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)

  const handleOptionsChange = () => {
    setRefreshKey(prev => prev + 1)
  }

  const handleSaveField = async (field: string, value: string) => {
    if (!libraryId) return
    
    setFieldLoading(field)
    try {
      await librariesApi.update(libraryId, { [field]: value })
      onUpdate()
    } catch (error) {
      console.error('Erro ao salvar campo:', error)
      alert('Erro ao salvar alteração')
    } finally {
      setFieldLoading(null)
    }
  }

  const handleRefresh = async () => {
    if (!libraryId) return
    
    setLoading(true)
    try {
      await librariesApi.refresh(libraryId)
      onUpdate()
    } catch (error) {
      console.error('Erro ao atualizar:', error)
      alert('Erro ao atualizar biblioteca')
    } finally {
      setLoading(false)
    }
  }

  // Fechar com ESC
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose()
      }
    }

    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown)
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen, onClose])

  if (!isOpen || !library) return null

  return (
    <div 
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose()
        }
      }}
      style={{ 
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        padding: '24px'
      }}
    >
      <div 
        onClick={(e) => e.stopPropagation()}
        style={{ 
          backgroundColor: '#111827',
          borderRadius: '24px',
          border: '1px solid #374151',
          overflow: 'hidden',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          width: '800px',
          height: '800px',
          maxWidth: 'calc(100vw - 48px)',
          maxHeight: 'calc(100vh - 48px)',
          aspectRatio: '1 / 1',
          minWidth: '800px',
          minHeight: '800px',
          flexShrink: 0,
          flexGrow: 0
        }}
      >
        {/* Header do Modal */}
        <div className="flex items-center justify-between p-6 border-b border-gray-700">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-600/20 border border-purple-500/30 flex items-center justify-center">
              <Settings className="h-5 w-5 text-purple-400" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Configurações da Biblioteca</h2>
              <p className="text-sm text-gray-400">{library.name}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-10 h-10 rounded-xl bg-gray-800 hover:bg-gray-700 border border-gray-600 flex items-center justify-center transition-colors"
          >
            <X className="h-5 w-5 text-gray-400" />
          </button>
        </div>

        {/* Conteúdo do Modal */}
        <div className="p-8 overflow-y-auto h-[calc(800px-180px)]">
          <div className="space-y-8">
            {/* Nome e Nota */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div>
                <label className="block text-lg font-medium text-gray-200 mb-3">📚 Nome da Biblioteca</label>
                <div className="relative">
                  <input
                    type="text"
                    defaultValue={library.name}
                    onBlur={(e) => {
                      if (e.target.value !== library.name) {
                        handleSaveField('name', e.target.value)
                      }
                    }}
                    disabled={fieldLoading === 'name'}
                    className="w-full px-5 py-4 text-lg bg-gray-800 border border-gray-600 rounded-xl text-white focus:border-purple-500 focus:outline-none etf-input disabled:opacity-50"
                  />
                  {fieldLoading === 'name' && (
                    <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                      <LoadingSpinner size="sm" />
                    </div>
                  )}
                </div>
              </div>
              <div>
                <label className="block text-lg font-medium text-gray-200 mb-3">🗒️ Nota</label>
                <input
                  type="text"
                  defaultValue={library.nota || ''}
                  onBlur={(e) => {
                    if (e.target.value !== (library.nota || '')) {
                      handleSaveField('nota', e.target.value)
                    }
                  }}
                  placeholder="Adicionar nota..."
                  className="w-full px-5 py-4 text-lg bg-gray-800 border border-gray-600 rounded-xl text-white focus:border-purple-500 focus:outline-none etf-input"
                />
              </div>
            </div>

            {/* URL da Biblioteca */}
            <div>
              <label className="block text-lg font-medium text-gray-200 mb-3">🔗 URL da Biblioteca</label>
              <input
                type="text"
                defaultValue={library.sourceValue}
                onBlur={(e) => {
                  if (e.target.value !== library.sourceValue) {
                    handleSaveField('sourceValue', e.target.value)
                  }
                }}
                className="w-full px-5 py-4 text-lg bg-gray-800 border border-gray-600 rounded-xl text-white focus:border-purple-500 focus:outline-none etf-input"
              />
            </div>

            {/* Filtros Estruturados */}
            <div>
              <label className="block text-lg font-medium text-gray-200 mb-6">🏷️ Filtros e Tags</label>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Status (Automático)</label>
                  <div className="w-full px-4 py-3 bg-gray-800 border border-gray-600 rounded-lg text-white flex items-center gap-2">
                    <span className={`inline-block w-3 h-3 rounded-full ${
                      library.activeAds > 0 ? 'bg-green-500' : 'bg-red-500'
                    }`}></span>
                    <span className="text-sm">
                      {library.activeAds > 0 ? '🟢 ATIVO' : '🔴 INATIVO'} 
                      <span className="text-gray-400 ml-2">({library.activeAds} anúncios)</span>
                    </span>
                  </div>
                  <p className="text-xs text-gray-400 mt-1">
                    Status calculado automaticamente baseado no número de anúncios ativos
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">❤️ Nichos</label>
                  <SimpleSelect
                    key={`nichos-${refreshKey}`}
                    label="Nichos"
                    emoji="❤️"
                    type="nichos"
                    value={library.nichos || ''}
                    onChange={(value) => handleSaveField('nichos', value)}
                    allowAdd={true}
                    onOptionsChange={handleOptionsChange}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">📈 Estratégias</label>
                  <SimpleSelect
                    key={`estrategias-${refreshKey}`}
                    label="Estratégias"
                    emoji="📈"
                    type="estrategias"
                    value={library.estrategias || ''}
                    onChange={(value) => handleSaveField('estrategias', value)}
                    allowAdd={true}
                    onOptionsChange={handleOptionsChange}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">📦 Produtos</label>
                  <SimpleSelect
                    key={`produtos-${refreshKey}`}
                    label="Produtos"
                    emoji="📦"
                    type="produtos"
                    value={library.produtos || ''}
                    onChange={(value) => handleSaveField('produtos', value)}
                    allowAdd={true}
                    onOptionsChange={handleOptionsChange}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">🌐 Idiomas</label>
                  <SimpleSelect
                    key={`idiomas-${refreshKey}`}
                    label="Idiomas"
                    emoji="🌐"
                    type="idiomas"
                    value={library.idiomas || ''}
                    onChange={(value) => handleSaveField('idiomas', value)}
                    allowAdd={true}
                    onOptionsChange={handleOptionsChange}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">🌍 Países</label>
                  <SimpleSelect
                    key={`paises-${refreshKey}`}
                    label="Países"
                    emoji="🌍"
                    type="paises"
                    value={library.paises || ''}
                    onChange={(value) => handleSaveField('paises', value)}
                    allowAdd={true}
                    onOptionsChange={handleOptionsChange}
                  />
                </div>
              </div>
              
              {/* Preview dos Filtros Selecionados */}
              <div className="mt-6 p-4 bg-gray-800/50 rounded-xl border border-gray-700">
                <h4 className="text-sm font-medium text-gray-300 mb-3">Preview dos Filtros:</h4>
                <div className="flex flex-wrap gap-2">
                  {[
                    { key: 'status', value: library.activeAds > 0 ? '🟢 ATIVO' : '🔴 INATIVO', type: 'status' as const },
                    { key: 'nichos', value: library.nichos, type: 'nichos' as const },
                    { key: 'estrategias', value: library.estrategias, type: 'estrategias' as const },
                    { key: 'produtos', value: library.produtos, type: 'produtos' as const },
                    { key: 'idiomas', value: library.idiomas, type: 'idiomas' as const },
                    { key: 'paises', value: library.paises, type: 'paises' as const }
                  ].filter(filter => filter.value).map(({ key, value, type }) => (
                    <span
                      key={key}
                      className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium border etf-chip ${getFilterColors(type)}`}
                    >
                      {value}
                    </span>
                  ))}
                  {![library.nichos, library.estrategias, library.produtos, library.idiomas, library.paises].some(Boolean) && (
                    <span className="text-gray-500 text-sm italic">Nenhum filtro selecionado (Status é automático)</span>
                  )}
                </div>
              </div>
            </div>

            {/* Observações */}
            <div>
              <label className="block text-lg font-medium text-gray-200 mb-3">📝 Observações</label>
              <textarea
                defaultValue={library.notes || ''}
                onBlur={(e) => {
                  if (e.target.value !== (library.notes || '')) {
                    handleSaveField('notes', e.target.value)
                  }
                }}
                placeholder="Notas adicionais sobre esta biblioteca..."
                rows={6}
                className="w-full px-5 py-4 text-lg bg-gray-800 border border-gray-600 rounded-xl text-white focus:border-purple-500 focus:outline-none resize-none etf-textarea"
              />
            </div>

            {/* Ações Rápidas */}
            <div>
              <label className="block text-lg font-medium text-gray-200 mb-4">⚡ Ações Rápidas</label>
              <div className="flex gap-4">
                <button
                  onClick={handleRefresh}
                  disabled={loading}
                  className="flex-1 px-6 py-4 text-lg bg-blue-600 hover:bg-blue-700 text-white rounded-xl transition-colors disabled:opacity-50 etf-btn etf-btn-primary flex items-center justify-center gap-3"
                >
                  <BarChart3 className="h-5 w-5" />
                  {loading ? 'Atualizando...' : 'Atualizar Anúncios'}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Footer do Modal */}
        <div className="flex justify-end gap-4 p-8 border-t border-gray-700">
          <button
            onClick={onClose}
            className="px-8 py-3 text-lg text-gray-400 hover:text-white transition-colors etf-btn etf-btn-ghost"
          >
            Fechar
          </button>
          <button
            onClick={() => {
              onClose()
              onUpdate()
            }}
            className="px-8 py-3 text-lg bg-purple-600 hover:bg-purple-700 text-white rounded-xl transition-colors etf-btn etf-btn-primary"
          >
            Salvar Alterações
          </button>
        </div>
      </div>
    </div>
  )
}

