'use client'

import { useState, useEffect } from 'react'
import { 
  ExternalLink, 
  Settings,
  FolderOpen, 
  StickyNote, 
  BarChart3, 
  Trash2, 
  Edit2, 
  Plus, 
  X,
  TrendingUp,
  TrendingDown,
  RotateCcw,
  Check,
  Link,
  FileText,
  AlertTriangle
} from 'lucide-react'
import { librariesApi, pagesApi } from '@/lib/api'
import { HistoryChart } from './HistoryChart'
import { LoadingSpinner } from './LoadingSpinner'
import { useModal } from '@/contexts/ModalContext'
import { ErrorBoundary } from './ErrorBoundary'
import { getFilterColors } from '@/lib/filterColors'

export interface Library {
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
  // Filtros estruturados
  status?: string
  nichos?: string
  estrategias?: string
  produtos?: string
  tipos?: string
  idiomas?: string
  paises?: string
  calculatedStatus?: string // Status automático baseado em activeAds
}

interface LibraryCardProps {
  library: Library
  onUpdate: () => void
}

export function LibraryCardNew({ library, onUpdate }: LibraryCardProps) {
  const [editingField, setEditingField] = useState<string | null>(null)
  const [tempValue, setTempValue] = useState('')
  const [showChart, setShowChart] = useState(false)
  const [loading, setLoading] = useState(false)
  const [trend, setTrend] = useState<'up' | 'down' | 'stable'>('stable')
  const [editingPageId, setEditingPageId] = useState<string | null>(null)
  const [newPageUrl, setNewPageUrl] = useState('')
  const [showAddPage, setShowAddPage] = useState(false)
  const [pageLoading, setPageLoading] = useState(false)
  
  const { openModal } = useModal()

  // Função para scroll com botão do meio do mouse
  const handleMiddleClick = (e: React.MouseEvent, action: () => void) => {
    if (e.button === 1) { // Botão do meio do mouse
      e.preventDefault()
      e.stopPropagation()
      action()
    }
  }

  // Função específica para abrir link em nova aba sem perder foco
  const handleOpenLink = (url: string) => {
    // Abre em nova aba mas mantém foco na janela atual
    const newWindow = window.open(url, '_blank', 'noopener,noreferrer')
    // Foca de volta na janela atual
    if (newWindow) {
      newWindow.blur()
      window.focus()
    }
  }

  // Verificar se é nova (menos de 24h)
  const isNew = () => {
    const now = new Date()
    const created = new Date(library.createdAt)
    const diffHours = (now.getTime() - created.getTime()) / (1000 * 60 * 60)
    return diffHours < 24
  }


  // Carregar tendência real do histórico
  const loadTrend = async () => {
    try {
      const history = await librariesApi.getHistory(library.id, 7) // últimos 7 dias
      if (history.length >= 2) {
        const oldest = history[0]
        const newest = history[history.length - 1]
        if (newest.adsCount > oldest.adsCount) {
          setTrend('up')
        } else if (newest.adsCount < oldest.adsCount) {
          setTrend('down')
        } else {
          setTrend('stable')
        }
      }
    } catch (error) {
      // Se falhar, manter como stable
      setTrend('stable')
    }
  }

  // Carregar tendência quando o componente montar
  useEffect(() => {
    loadTrend()
  }, [library.id])


  // Função para encurtar URLs
  const shortenUrl = (url: string, maxLength: number = 40) => {
    if (url.length <= maxLength) return url
    
    try {
      const urlObj = new URL(url)
      const domain = urlObj.hostname.replace('www.', '')
      const path = urlObj.pathname + urlObj.search
      
      if (path === '/' || path === '') {
        return domain
      }
      
      const shortened = `${domain}${path}`
      if (shortened.length <= maxLength) return shortened
      
      return `${domain}${path.substring(0, maxLength - domain.length - 3)}...`
    } catch {
      return url.length > maxLength ? `${url.substring(0, maxLength - 3)}...` : url
    }
  }

  const handleEdit = (field: string, currentValue: string) => {
    setEditingField(field)
    setTempValue(currentValue || '')
  }

  const handleSave = async (field: string) => {
    if (!tempValue.trim() && field !== 'notes') return

    try {
      await librariesApi.update(library.id, { [field]: tempValue })
      setEditingField(null)
      onUpdate()
    } catch (error) {
      console.error('Erro ao salvar:', error)
      alert('Erro ao salvar alteração')
    }
  }




  const handleDelete = async () => {
    if (!confirm('Tem certeza que deseja deletar esta biblioteca?')) return

    try {
      await librariesApi.delete(library.id)
      onUpdate()
    } catch (error) {
      console.error('Erro ao deletar:', error)
      alert('Erro ao deletar biblioteca')
    }
  }

  // Funções para CRUD de páginas
  const handleAddPage = async () => {
    if (!newPageUrl.trim()) return

    setPageLoading(true)
    try {
      await pagesApi.create(library.id, { url: newPageUrl })
      setNewPageUrl('')
      setShowAddPage(false)
      onUpdate()
    } catch (error) {
      console.error('Erro ao adicionar página:', error)
      alert('Erro ao adicionar página')
    } finally {
      setPageLoading(false)
    }
  }

  const handleEditPage = async (pageId: string, newUrl: string) => {
    if (!newUrl.trim()) return

    try {
      await pagesApi.update(pageId, { url: newUrl })
      setEditingPageId(null)
      setTempValue('')
      onUpdate()
    } catch (error) {
      console.error('Erro ao editar página:', error)
      alert('Erro ao editar página')
    }
  }

  const handleDeletePage = async (pageId: string) => {
    if (!confirm('Tem certeza que deseja deletar esta página?')) return

    try {
      await pagesApi.delete(pageId)
      onUpdate()
    } catch (error) {
      console.error('Erro ao deletar página:', error)
      alert('Erro ao deletar página')
    }
  }

  const formatFilters = (filters: Record<string, string | undefined>) => {
    const singleValuePerKey: Record<string, string> = {};

    Object.entries(filters).forEach(([key, value]) => {
      if (!value) return;
      // pegar apenas o primeiro token antes de vírgula
      const first = value.split(',').map(v => v.trim()).filter(Boolean)[0];
      if (first) singleValuePerKey[key] = first;
    });

    return Object.entries(singleValuePerKey).map(([key, value]) => ({ key, value }));
  }

  const filterColors = {
    status: 'bg-orange-500/10 text-orange-400 border-orange-500/30',
    nichos: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
    estrategias: 'bg-green-500/10 text-green-400 border-green-500/30',
    produtos: 'bg-purple-500/10 text-purple-400 border-purple-500/30',
    // tipos removido para evitar duplicidade com produtos
    idiomas: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30',
    paises: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30'
  }

  const filters = formatFilters({
    status: library.status,
    nichos: library.nichos,
    estrategias: library.estrategias,
    produtos: library.produtos,
    // tipos removido
    idiomas: library.idiomas,
    paises: library.paises
  })

  return (
    <div className="bg-gray-900 border border-gray-700 rounded-lg p-6 hover:shadow-lg transition-all duration-300 space-y-4 etf-card p-5 md:p-6 xl:p-7 shadow-etf">
      
      {/* 1. NÚMERO DE ANÚNCIOS ATIVOS EM AZUL (lado esquerdo) */}
      <div className="flex items-center gap-3 mb-4">
        <span className={`inline-block px-4 py-2 text-sm font-bold rounded-lg ${
          library.calculatedStatus === 'em_atualizacao' 
            ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30' 
            : 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
        }`}>
          📊 {library.calculatedStatus === 'em_atualizacao' 
            ? 'Em atualização...' 
            : `${library.activeAds} anúncios ativos`
          }
        </span>
        
        {/* Status automático */}
        <span className={`inline-block px-3 py-1 text-xs font-medium rounded-full ${
          library.calculatedStatus === 'em_atualizacao'
            ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30'
            : library.activeAds > 0 
              ? 'bg-green-500/20 text-green-400 border border-green-500/30' 
              : 'bg-red-500/20 text-red-400 border border-red-500/30'
        }`}>
          {library.calculatedStatus === 'em_atualizacao' 
            ? '🟡 ATUALIZANDO' 
            : library.activeAds > 0 ? '🟢 ATIVO' : '🔴 INATIVO'
          }
        </span>
        
        {isNew() && (
          <span className="px-2 py-1 text-xs bg-blue-600 text-white rounded font-bold">
            NEW
            </span>
          )}
          {trend === 'up' && <TrendingUp className="h-5 w-5 text-green-400" />}
          {trend === 'down' && <TrendingDown className="h-5 w-5 text-red-400" />}
        </div>

      {/* 2. NOME DA BIBLIOTECA */}
      <div className="mb-3">
        {editingField === 'name' ? (
          <div className="flex gap-2">
            <input
              type="text"
              value={tempValue}
              onChange={(e) => setTempValue(e.target.value)}
              className="input flex-1 text-2xl font-bold etf-input"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSave('name')
                if (e.key === 'Escape') setEditingField(null)
              }}
            />
            <button onClick={() => handleSave('name')} className="btn-icon text-green-400">
              <Check className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <h3 
            className="text-2xl font-bold text-white cursor-pointer hover:text-gold transition-colors etf-h2"
            onClick={() => handleEdit('name', library.name)}
          >
            {library.name}
          </h3>
        )}
      </div>

      {/* 3. NOTA (logo após o nome) */}
      <div className="mb-3">
        {editingField === 'nota' ? (
          <div className="flex gap-2">
            <input
              type="text"
              value={tempValue}
              onChange={(e) => setTempValue(e.target.value)}
              className="input flex-1 etf-input"
              placeholder="Adicionar nota..."
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSave('nota')
                if (e.key === 'Escape') setEditingField(null)
              }}
            />
            <button onClick={() => handleSave('nota')} className="btn-icon text-green-400">
              <Check className="h-4 w-4" />
            </button>
          </div>
        ) : library.nota ? (
          <div className="flex items-center justify-between">
            <span 
              className="text-gray-300 italic cursor-pointer hover:text-white transition-colors"
              onClick={() => handleEdit('nota', library.nota || '')}
            >
              <strong>Nota:</strong> {library.nota}
            </span>
            <button 
              onClick={() => handleEdit('nota', library.nota || '')}
              className="text-gray-500 hover:text-gold transition-colors"
            >
              <Edit2 className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <button
            onClick={() => handleEdit('nota', '')}
            className="text-sm text-gray-500 hover:text-gold transition-colors italic"
          >
            + Adicionar nota
          </button>
        )}
      </div>

      {/* 4. LINK DA BIBLIOTECA (encurtado e editável) */}
      <div className="mb-3">
        {editingField === 'sourceValue' ? (
          <div className="flex gap-2">
            <input
              type="text"
              value={tempValue}
              onChange={(e) => setTempValue(e.target.value)}
              className="input flex-1 etf-input"
              placeholder="URL da biblioteca..."
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSave('sourceValue')
                if (e.key === 'Escape') setEditingField(null)
              }}
            />
            <button onClick={() => handleSave('sourceValue')} className="btn-icon text-green-400">
              <Check className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <div className="flex items-center justify-between group">
            <a 
              href={library.sourceValue} 
              target="_blank" 
              rel="noopener noreferrer"
              onClick={(e) => {
                e.preventDefault()
                handleOpenLink(library.sourceValue)
              }}
              className="text-blue-400 hover:text-blue-300 transition-colors text-sm flex-1 truncate"
              title={library.sourceValue}
            >
              🔗 {shortenUrl(library.sourceValue)}
            </a>
            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <button 
                onClick={() => handleEdit('sourceValue', library.sourceValue)}
                className="text-gray-500 hover:text-gold transition-colors p-1"
                title="Editar link"
              >
                <Edit2 className="h-3 w-3" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 5. FILTROS (TAGS) */}
      {filters.length > 0 && (
        <div className="mb-4">
          <div className="flex flex-wrap gap-2">
            {filters.map(({ key, value }) => {
              let flag = '';
              let displayValue = value.toUpperCase();
              
              // Bandeiras para países
              if (key === 'paises') {
                if (value.toLowerCase().includes('brasil')) flag = '🇧🇷 ';
                if (value.toLowerCase().includes('portugal')) flag = '🇵🇹 ';
                if (value.toLowerCase().includes('eua') || value.toLowerCase().includes('usa')) flag = '🇺🇸 ';
              }
              
              return (
                <span
                  key={key}
                  className={`inline-flex items-center px-3 py-1.5 text-xs rounded-full border font-medium transition-all hover:scale-105 ${getFilterColors(key)}`}
                >
                  {flag}{displayValue}
                </span>
              );
            })}
          </div>
        </div>
      )}

      {/* 6. PÁGINAS DE VENDAS (editáveis com CRUD) */}
      <div>
        <div className="text-white font-medium mb-2 flex items-center justify-between">
          <span>Páginas de Vendas:</span>
          <button 
            onClick={() => setShowAddPage(!showAddPage)}
            onMouseDown={(e) => handleMiddleClick(e, () => setShowAddPage(!showAddPage))}
            className="text-sm text-green-400 hover:text-green-300 transition-colors"
            title="Adicionar página (Clique esquerdo ou botão do meio)"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>

        {/* Formulário para adicionar nova página */}
        {showAddPage && (
          <div className="mb-3 p-3 bg-gray-800 rounded border border-gray-600">
            <div className="flex gap-2">
              <input
                type="text"
                value={newPageUrl}
                onChange={(e) => setNewPageUrl(e.target.value)}
                className="input flex-1 text-sm etf-input"
                placeholder="URL da página de vendas..."
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleAddPage()
                  if (e.key === 'Escape') {
                    setShowAddPage(false)
                    setNewPageUrl('')
                  }
                }}
              />
              <button
                onClick={handleAddPage}
                disabled={pageLoading}
                className="px-3 py-1 bg-green-600 text-white text-sm rounded hover:bg-green-700 transition-colors etf-btn etf-btn-primary disabled:opacity-50"
              >
                {pageLoading ? 'Adicionando...' : 'Adicionar'}
              </button>
              <button
                onClick={() => {
                  setShowAddPage(false)
                  setNewPageUrl('')
                }}
                className="px-3 py-1 bg-gray-600 text-white text-sm rounded hover:bg-gray-700 transition-colors etf-btn etf-btn-ghost"
              >
                Cancelar
              </button>
            </div>
          </div>
        )}

        {/* Lista de páginas existentes */}
        {library.pages && library.pages.length > 0 ? (
          <div className="space-y-2">
            {library.pages.map((page) => (
              <div key={page.id} className="flex items-center justify-between group">
                {editingPageId === page.id ? (
                  <div className="flex gap-2 flex-1">
                    <input
                      type="text"
                      value={tempValue}
                      onChange={(e) => setTempValue(e.target.value)}
                      className="input flex-1 text-sm etf-input"
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleEditPage(page.id, tempValue)
                        if (e.key === 'Escape') {
                          setEditingPageId(null)
                          setTempValue('')
                        }
                      }}
                    />
                    <button
                      onClick={() => handleEditPage(page.id, tempValue)}
                      className="btn-icon text-green-400"
                      title="Salvar"
                    >
                      <Check className="h-3 w-3" />
                    </button>
                    <button
                      onClick={() => {
                        setEditingPageId(null)
                        setTempValue('')
                      }}
                      className="btn-icon text-gray-400"
                      title="Cancelar"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ) : (
                  <>
                    <a
                      href={page.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => {
                        e.preventDefault()
                        handleOpenLink(page.url)
                      }}
                      className="text-yellow-400 hover:text-yellow-300 transition-colors text-sm flex-1 truncate"
                      title={page.url}
                    >
                      {shortenUrl(page.url)}
                    </a>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button 
                        onClick={() => {
                          setEditingPageId(page.id)
                          setTempValue(page.url)
                        }}
                        className="text-gray-500 hover:text-gold transition-colors p-1"
                        title="Editar página"
                      >
                        <Edit2 className="h-3 w-3" />
                      </button>
                      <button 
                        onClick={() => handleDeletePage(page.id)}
                        className="text-gray-500 hover:text-red-400 transition-colors p-1"
                        title="Eliminar página"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="text-sm text-gray-500 italic">Nenhuma página de vendas</div>
        )}
      </div>

      {/* 7. OBSERVAÇÕES (editáveis com múltiplas linhas) */}
      <div>
        <div className="text-white font-medium mb-2">Observações:</div>
        {editingField === 'notes' ? (
          <div className="space-y-2">
            <textarea
              value={tempValue}
              onChange={(e) => setTempValue(e.target.value)}
            className="w-full p-3 text-sm bg-gray-800 border border-gray-600 rounded text-white resize-none etf-textarea"
            rows={4}
            placeholder="Adicionar observações..."
              autoFocus
            />
            <div className="flex gap-2">
              <button 
                onClick={() => handleSave('notes')} 
                onMouseDown={(e) => handleMiddleClick(e, () => handleSave('notes'))}
                className="px-3 py-1 bg-green-600 text-white text-sm rounded etf-btn etf-btn-primary"
                title="Salvar (Clique esquerdo ou botão do meio)"
              >
                Salvar
              </button>
              <button 
                onClick={() => setEditingField(null)} 
                onMouseDown={(e) => handleMiddleClick(e, () => setEditingField(null))}
                className="px-3 py-1 bg-gray-600 text-white text-sm rounded etf-btn etf-btn-ghost"
                title="Cancelar (Clique esquerdo ou botão do meio)"
              >
                Cancelar
              </button>
            </div>
          </div>
        ) : (
          <div
            className="text-sm text-gray-400 cursor-pointer hover:text-white transition-colors min-h-[80px] p-3 border border-gray-600 rounded bg-gray-800"
            onClick={() => handleEdit('notes', library.notes || '')}
          >
            {library.notes ? (
              library.notes.split('\n').map((line, index) => (
                <div key={index} className="mb-1">{line || '\u00A0'}</div>
              ))
            ) : (
              <span className="text-gray-500 italic">Clique para adicionar observações...</span>
            )}
          </div>
        )}
      </div>

      {/* 7. BOTÕES DE AÇÃO */}
      <div className="flex items-center justify-center gap-3 pt-6 border-t border-gray-700/50">
        <button
          onClick={() => handleOpenLink(library.sourceValue)}
          className="group relative w-12 h-12 rounded-2xl bg-gray-800/60 hover:bg-blue-600/20 border border-gray-700/50 hover:border-blue-500/30 flex items-center justify-center transition-all duration-300 hover:scale-105 hover:shadow-lg hover:shadow-blue-500/20"
          title="Aceder à biblioteca - Abre em nova aba mantendo foco aqui"
          aria-label={`Abrir biblioteca ${library.name} em nova aba`}
        >
          <ExternalLink className="h-5 w-5 text-gray-400 group-hover:text-blue-400 transition-colors duration-300" aria-hidden="true" />
        </button>


        <button
          onClick={(e) => {
            e.stopPropagation()
            e.preventDefault()
            openModal(library.id)
          }}
          onMouseDown={(e) => handleMiddleClick(e, () => openModal(library.id))}
          className="group relative w-12 h-12 rounded-2xl bg-gray-800/60 hover:bg-purple-600/20 border border-gray-700/50 hover:border-purple-500/30 flex items-center justify-center transition-all duration-300 hover:scale-105 hover:shadow-lg hover:shadow-purple-500/20"
          title="Configurações (Clique esquerdo ou botão do meio)"
        >
          <Settings className="h-5 w-5 text-gray-400 group-hover:text-purple-400 transition-colors duration-300" />
        </button>

        <button
          className="group relative w-12 h-12 rounded-2xl bg-gray-800/60 hover:bg-green-600/20 border border-gray-700/50 hover:border-green-500/30 flex items-center justify-center transition-all duration-300 hover:scale-105 hover:shadow-lg hover:shadow-green-500/20"
          title="Escolher pasta"
        >
          <FolderOpen className="h-5 w-5 text-gray-400 group-hover:text-green-400 transition-colors duration-300" />
        </button>

        <button
          onClick={() => handleEdit('notes', library.notes || '')}
          onMouseDown={(e) => handleMiddleClick(e, () => handleEdit('notes', library.notes || ''))}
          className="group relative w-12 h-12 rounded-2xl bg-gray-800/60 hover:bg-orange-600/20 border border-gray-700/50 hover:border-orange-500/30 flex items-center justify-center transition-all duration-300 hover:scale-105 hover:shadow-lg hover:shadow-orange-500/20"
          title="Observações (Clique esquerdo ou botão do meio)"
        >
          <FileText className="h-5 w-5 text-gray-400 group-hover:text-orange-400 transition-colors duration-300" />
        </button>

        <button
          onClick={() => setShowChart(!showChart)}
          onMouseDown={(e) => handleMiddleClick(e, () => setShowChart(!showChart))}
          className="group relative w-12 h-12 rounded-2xl bg-gray-800/60 hover:bg-yellow-600/20 border border-gray-700/50 hover:border-yellow-500/30 flex items-center justify-center transition-all duration-300 hover:scale-105 hover:shadow-lg hover:shadow-yellow-500/20"
          title="Gráfico (Clique esquerdo ou botão do meio)"
        >
          <BarChart3 className="h-5 w-5 text-gray-400 group-hover:text-yellow-400 transition-colors duration-300" />
        </button>

        <button
          onClick={handleDelete}
          onMouseDown={(e) => handleMiddleClick(e, handleDelete)}
          className="group relative w-12 h-12 rounded-2xl bg-gray-800/60 hover:bg-red-600/20 border border-gray-700/50 hover:border-red-500/30 flex items-center justify-center transition-all duration-300 hover:scale-105 hover:shadow-lg hover:shadow-red-500/20"
          title="Eliminar biblioteca (Clique esquerdo ou botão do meio)"
        >
          <Trash2 className="h-5 w-5 text-gray-400 group-hover:text-red-400 transition-colors duration-300" />
        </button>
      </div>


      {/* PAINEL EXPANDIDO - GRÁFICO */}
      {showChart && (
        <div className="mt-4 p-4 bg-black/20 rounded-lg border border-gold/10">
          <h4 className="text-sm font-medium text-gold mb-3">📈 Histórico de Anúncios (15 dias)</h4>
          <ErrorBoundary fallback={
            <div className="h-32 flex items-center justify-center text-gray-400">
              <div className="text-center">
                <AlertTriangle className="h-6 w-6 mx-auto mb-2" />
                <p className="text-sm">Erro ao carregar gráfico</p>
              </div>
            </div>
          }>
            <HistoryChart libraryId={library.id} currentAds={library.activeAds} />
          </ErrorBoundary>
        </div>
      )}
    </div>
  )
}
