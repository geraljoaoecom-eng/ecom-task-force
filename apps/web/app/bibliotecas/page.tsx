'use client'

import { useEffect, useState } from 'react'
import { BookOpen, Plus, Search, Filter, RotateCcw, Settings, Sparkles } from 'lucide-react'
import { LibraryCardNew } from '@/components/LibraryCardNew'
import { AddLibraryModal } from '@/components/AddLibraryModal'
import { ImportLibraryModal } from '@/components/ImportLibraryModal'
import { FilterManager } from '@/components/FilterManager'
import { ElegantFilter } from '@/components/ElegantFilter'
import LibraryAnalyticsPanel from '@/components/LibraryAnalyticsPanel'
import { librariesApi, filterOptionsApi } from '@/lib/api'
import AuthGuard from '../../components/AuthGuard'

export default function BibliotecasPage() {
  const [libraries, setLibraries] = useState([])
  const [loading, setLoading] = useState(true)
  const [showAddModal, setShowAddModal] = useState(false)
  const [showImportModal, setShowImportModal] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)
  const [showFilterManager, setShowFilterManager] = useState(false)
  const [hasRecentLibraries, setHasRecentLibraries] = useState(false)
  const [availableFilters, setAvailableFilters] = useState([
    { id: 'status', name: 'Status', type: 'status', emoji: '📊', enabled: true },
    { id: 'nichos', name: 'Nicho', type: 'nichos', emoji: '❤️', enabled: true },
    { id: 'estrategias', name: 'Estratégia', type: 'estrategias', emoji: '📈', enabled: true },
    { id: 'produtos', name: 'Produto', type: 'produtos', emoji: '📦', enabled: true },
    { id: 'idiomas', name: 'Idioma', type: 'idiomas', emoji: '🌐', enabled: true },
    { id: 'paises', name: 'País', type: 'paises', emoji: '🌍', enabled: true }
  ])
  const [filteredCount, setFilteredCount] = useState(0)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedFolder, setSelectedFolder] = useState('')
  const [selectedStatus, setSelectedStatus] = useState('')
  const [selectedNicho, setSelectedNicho] = useState('')
  const [selectedEstrategia, setSelectedEstrategia] = useState('')
  const [selectedProduto, setSelectedProduto] = useState('')
  const [selectedIdioma, setSelectedIdioma] = useState('')
  const [selectedPais, setSelectedPais] = useState('')
  const [filterOptions, setFilterOptions] = useState({
    status: [],
    nichos: [],
    estrategias: [],
    produtos: [],
    idiomas: [],
    paises: []
  })
  const [isRefreshingAll, setIsRefreshingAll] = useState(false)
  const [showAll, setShowAll] = useState(false)

  useEffect(() => {
    loadLibraries()
    loadFilterOptions()

    const user = localStorage.getItem('user')
    if (user) {
      try {
        setIsAdmin(JSON.parse(user).role === 'admin')
      } catch {
        setIsAdmin(false)
      }
    }
    
    const savedFilters = localStorage.getItem('availableFilters')
    if (savedFilters) {
      try {
        setAvailableFilters(JSON.parse(savedFilters))
      } catch (error) {
        console.error('Erro ao carregar filtros salvos:', error)
      }
    }

    const onLibrariesChanged = () => {
      setTimeout(() => loadLibraries(false), 1000)
    }
    window.addEventListener('libraries-changed', onLibrariesChanged)
    return () => window.removeEventListener('libraries-changed', onLibrariesChanged)
  }, [])

  // Polling para bibliotecas em scraping
  useEffect(() => {
    if (!hasRecentLibraries) return
    
    console.log('🔄 Polling ativo: atualizando bibliotecas em scraping...')
    
    // Primeira atualização rápida após 5 segundos
    const quickCheck = setTimeout(() => {
      console.log('⚡ Quick check - atualizando após 5s')
      loadLibraries(false)
    }, 5000)
    
    // Polling regular a cada 15 segundos
    const interval = setInterval(() => {
      console.log('🔄 Polling: atualizando bibliotecas...')
      loadLibraries(false)
    }, 15000)
    
    return () => {
      clearTimeout(quickCheck)
      clearInterval(interval)
    }
  }, [hasRecentLibraries])

  // Aplicar filtros automaticamente quando mudarem (sem loading visual)
  useEffect(() => {
    loadLibraries(false) // false = sem loading visual
  }, [selectedStatus, selectedNicho, selectedEstrategia, selectedProduto, selectedIdioma, selectedPais, showAll, isAdmin])

  // Aplicar busca quando o termo de busca mudar (com debounce)
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      loadLibraries(false) // false = sem loading visual
    }, 500) // Debounce de 500ms

    return () => clearTimeout(timeoutId)
  }, [searchTerm])

  const loadLibraries = async (showLoading = true) => {
    try {
      if (showLoading) {
        setLoading(true)
      }
      const params: any = {
        q: searchTerm,
        folderId: selectedFolder,
        status: selectedStatus,
        nichos: selectedNicho,
        estrategias: selectedEstrategia,
        produtos: selectedProduto,
        idiomas: selectedIdioma,
        paises: selectedPais
      }
      if (isAdmin && showAll) params.showAll = 'true'
      const data = await librariesApi.getAll(params)
      setLibraries(data)
      setFilteredCount(data.length)

      // Polling activo se alguma biblioteca tem scan em curso (status da fila de cópia)
      const hasScrapingLibraries = data.some((lib: any) =>
        lib.scanStatus === 'queued' || lib.scanStatus === 'scanning'
      )
      setHasRecentLibraries(hasScrapingLibraries)
      
    } catch (error) {
      console.error('Erro ao carregar bibliotecas:', error)
    } finally {
      if (showLoading) {
        setLoading(false)
      }
    }
  }

  const loadFilterOptions = async () => {
    try {
      const [status, nichos, estrategias, produtos, idiomas, paises] = await Promise.all([
        filterOptionsApi.getByType('status'),
        filterOptionsApi.getByType('nichos'),
        filterOptionsApi.getByType('estrategias'),
        filterOptionsApi.getByType('produtos'),
        filterOptionsApi.getByType('idiomas'),
        filterOptionsApi.getByType('paises')
      ])
      setFilterOptions({
        status: status || [],
        nichos: nichos || [],
        estrategias: estrategias || [],
        produtos: produtos || [],
        idiomas: idiomas || [],
        paises: paises || []
      })
    } catch (error) {
      console.error('Erro ao carregar opções de filtro:', error)
    }
  }

  const handleSearch = () => {
    loadLibraries(false) // false = sem loading visual para busca manual
  }

  const handleAddLibrary = () => {
    console.log('🔧 Botão Adicionar Biblioteca clicado!')
    console.log('🔧 showAddModal antes:', showAddModal)
    setShowAddModal(true)
    console.log('🔧 showAddModal depois:', true)
  }

  const clearFilters = () => {
    setSearchTerm('')
    setSelectedFolder('')
    setSelectedStatus('')
    setSelectedNicho('')
    setSelectedEstrategia('')
    setSelectedProduto('')
    setSelectedIdioma('')
    setSelectedPais('')
    setFilteredCount(0)
    loadLibraries(false) // false = sem loading visual
  }

  const handleLibraryUpdate = () => {
    loadLibraries(false) // false = sem loading visual para atualizações
  }

  const handleFiltersChange = (newFilters: any[]) => {
    setAvailableFilters(newFilters)
    // Salvar no localStorage para persistir
    localStorage.setItem('availableFilters', JSON.stringify(newFilters))
  }

  const handleFilterOptionsChange = (type: string, newOptions: string[]) => {
    console.log(`Opções de ${type} atualizadas:`, newOptions)
    // Recarregar opções de filtro para atualizar a interface
    loadFilterOptions()
  }

  const handleRefreshAll = async () => {
    setIsRefreshingAll(true)
    try {
      console.log('🔄 Atualizando todas as bibliotecas...')
      const result = await librariesApi.refreshAll()
      console.log('✅ Todas as bibliotecas atualizadas:', result)
      alert(`✅ ${result.message || 'Todas as bibliotecas foram atualizadas com sucesso!'}`)
      loadLibraries(false) // false = sem loading visual após refresh
    } catch (error) {
      console.error('❌ Erro ao atualizar todas as bibliotecas:', error)
      alert('❌ Erro ao atualizar bibliotecas. Tente novamente.')
    } finally {
      setIsRefreshingAll(false)
    }
  }

  if (loading) {
    return (
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center', 
        minHeight: '400px',
        background: '#0c0f14',
        color: '#F5D26C'
      }}>
        <div>Carregando bibliotecas...</div>
      </div>
    )
  }

         return (
           <AuthGuard>
          <div style={{ 
            background: '#0c0f14', 
            color: '#E8EDF2', 
            minHeight: '100vh',
            padding: 'clamp(1rem, 3vw, 2rem)',
            boxSizing: 'border-box',
            overflow: 'hidden'
          }}>
             {/* Header */}
             <div style={{ 
               display: 'flex', 
               alignItems: 'center', 
               justifyContent: 'space-between',
               marginBottom: 'clamp(1rem, 3vw, 2rem)',
               flexWrap: 'wrap',
               gap: '1rem'
             }}>
               <div style={{ flex: 1, minWidth: '200px' }}>
                 <h1 style={{ 
                   fontSize: 'clamp(1.5rem, 4vw, 2rem)', 
                   fontWeight: 'bold', 
                   color: '#E8EDF2',
                   display: 'flex',
                   alignItems: 'center',
                   gap: 'clamp(0.5rem, 2vw, 0.75rem)',
                   marginBottom: '0.5rem',
                   flexWrap: 'wrap'
                 }}>
                   <BookOpen style={{ height: 'clamp(1.5rem, 4vw, 2rem)', width: 'clamp(1.5rem, 4vw, 2rem)', color: '#F5D26C' }} />
                   Bibliotecas
                 </h1>
                 <p style={{ color: '#94a3b8', fontSize: 'clamp(0.875rem, 2.5vw, 1rem)' }}>
                   Gerencie suas bibliotecas de anúncios
                 </p>
               </div>
               <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
               {isAdmin && (
                 <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', backgroundColor: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '0.5rem', padding: '0.4rem 0.75rem' }}>
                   <span style={{ fontSize: '0.8rem', color: '#aaa', whiteSpace: 'nowrap' }}>
                     {showAll ? 'Todas as contas' : 'Minha conta'}
                   </span>
                   <button
                     onClick={() => setShowAll(v => !v)}
                     style={{
                       width: '2.5rem', height: '1.25rem', borderRadius: '9999px', border: 'none', cursor: 'pointer',
                       backgroundColor: showAll ? '#F5D26C' : 'rgba(255,255,255,0.15)',
                       position: 'relative', transition: 'background-color 0.2s', flexShrink: 0
                     }}
                   >
                     <span style={{
                       position: 'absolute', top: '0.125rem', left: showAll ? '1.25rem' : '0.125rem',
                       width: '1rem', height: '1rem', borderRadius: '50%',
                       backgroundColor: 'white', transition: 'left 0.2s', display: 'block'
                     }} />
                   </button>
                 </div>
               )}
               {isAdmin && (
                 <button
                   onClick={() => setShowImportModal(true)}
                   style={{
                     backgroundColor: 'rgba(245, 210, 108, 0.1)',
                     color: '#F5D26C',
                     padding: 'clamp(0.5rem, 2vw, 0.75rem) clamp(1rem, 3vw, 1.5rem)',
                     borderRadius: '0.5rem',
                     fontWeight: '600',
                     display: 'flex',
                     alignItems: 'center',
                     gap: 'clamp(0.25rem, 1vw, 0.5rem)',
                     border: '1px solid rgba(245, 210, 108, 0.3)',
                     cursor: 'pointer',
                     fontSize: 'clamp(0.875rem, 2.5vw, 1rem)',
                     whiteSpace: 'nowrap',
                   }}
                 >
                   <Sparkles style={{ height: 'clamp(1rem, 3vw, 1.25rem)', width: 'clamp(1rem, 3vw, 1.25rem)' }} />
                   Importar Links
                 </button>
               )}
               <button
                 onClick={handleAddLibrary}
                 style={{
                   backgroundColor: '#F5D26C',
                   color: '#0c0f14',
                   padding: 'clamp(0.5rem, 2vw, 0.75rem) clamp(1rem, 3vw, 1.5rem)',
                   borderRadius: '0.5rem',
                   fontWeight: '600',
                   display: 'flex',
                   alignItems: 'center',
                   gap: 'clamp(0.25rem, 1vw, 0.5rem)',
                   border: 'none',
                   cursor: 'pointer',
                   transition: 'background-color 0.2s',
                   fontSize: 'clamp(0.875rem, 2.5vw, 1rem)',
                   whiteSpace: 'nowrap',
                   flexShrink: 0
                 }}
                 onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#e0c05c')}
                 onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#F5D26C')}
               >
                 <Plus style={{ height: 'clamp(1rem, 3vw, 1.25rem)', width: 'clamp(1rem, 3vw, 1.25rem)' }} />
                 <span style={{ display: window.innerWidth < 400 ? 'none' : 'inline' }}>Adicionar Biblioteca</span>
                 <span style={{ display: window.innerWidth < 400 ? 'inline' : 'none' }}>+</span>
               </button>
               </div>
      </div>

             {/* Summary */}
             <div style={{ display: 'flex', gap: 'clamp(0.5rem, 2vw, 1rem)', marginBottom: 'clamp(1rem, 3vw, 2rem)', flexWrap: 'wrap' }}>
               <div style={{
                 background: '#141823',
                 border: '1px solid rgba(245, 210, 108, 0.2)',
                 borderRadius: '0.75rem',
                 padding: 'clamp(0.75rem, 2vw, 1rem)',
                 boxShadow: '0 6px 24px rgba(0, 0, 0, 0.35)',
                 flex: '1 1 150px',
                 minWidth: '120px'
               }}>
                 <div style={{ fontSize: 'clamp(0.75rem, 2vw, 0.875rem)', color: '#94a3b8' }}>Total</div>
                 <div style={{ fontSize: 'clamp(1.25rem, 3vw, 1.5rem)', fontWeight: 'bold', color: '#F5D26C' }}>{libraries.length}</div>
               </div>
               <div style={{
                 background: '#141823',
                 border: '1px solid rgba(245, 210, 108, 0.2)',
                 borderRadius: '0.75rem',
                 padding: 'clamp(0.75rem, 2vw, 1rem)',
                 boxShadow: '0 6px 24px rgba(0, 0, 0, 0.35)',
                 flex: '1 1 150px',
                 minWidth: '120px'
               }}>
                 <div style={{ fontSize: 'clamp(0.75rem, 2vw, 0.875rem)', color: '#94a3b8' }}>Ativas</div>
                 <div style={{ fontSize: 'clamp(1.25rem, 3vw, 1.5rem)', fontWeight: 'bold', color: '#10B981' }}>
                   {libraries.filter((lib: any) => lib.activeAds > 0).length}
                 </div>
               </div>
      </div>

             {/* Search and Filters */}
             <div style={{
               background: '#141823',
               border: '1px solid rgba(245, 210, 108, 0.2)',
               borderRadius: '0.75rem',
               padding: 'clamp(1rem, 3vw, 1.5rem)',
               marginBottom: 'clamp(1rem, 3vw, 2rem)',
               boxShadow: '0 6px 24px rgba(0, 0, 0, 0.35)',
               boxSizing: 'border-box'
             }}>
              {/* Filter Results Counter */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '1rem',
                padding: '0.75rem',
                background: 'rgba(245, 210, 108, 0.05)',
                border: '1px solid rgba(245, 210, 108, 0.1)',
                borderRadius: '0.5rem'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Filter style={{ height: '1.25rem', width: '1.25rem', color: '#F5D26C' }} />
                  <span style={{ fontSize: '0.875rem', color: '#94a3b8' }}>
                    Resultados dos filtros:
                  </span>
                </div>
                <div style={{
                  fontSize: '1.125rem',
                  fontWeight: 'bold',
                  color: '#F5D26C',
                  padding: '0.25rem 0.75rem',
                  background: 'rgba(245, 210, 108, 0.1)',
                  borderRadius: '0.375rem',
                  border: '1px solid rgba(245, 210, 108, 0.2)'
                }}>
                  {loading ? '...' : filteredCount} biblioteca{filteredCount !== 1 ? 's' : ''}
                </div>
              </div>
               {isAdmin && <LibraryAnalyticsPanel />}

               <div style={{ display: 'flex', alignItems: 'center', gap: 'clamp(0.5rem, 2vw, 1rem)', marginBottom: '1rem', flexWrap: 'wrap' }}>
                 <div style={{ position: 'relative', flex: 1, minWidth: '200px' }}>
                   <Search style={{
                     position: 'absolute', 
                     left: 'clamp(0.5rem, 2vw, 0.75rem)', 
                     top: '50%', 
                     transform: 'translateY(-50%)', 
                     height: 'clamp(1rem, 3vw, 1.25rem)', 
                     width: 'clamp(1rem, 3vw, 1.25rem)', 
                     color: '#94a3b8' 
                   }} />
                   <input
                     type="text"
                     placeholder="Buscar bibliotecas..."
                     value={searchTerm}
                     onChange={(e) => setSearchTerm(e.target.value)}
                     style={{
                       width: '100%',
                       padding: `clamp(0.5rem, 2vw, 0.75rem) clamp(0.5rem, 2vw, 0.75rem) clamp(0.5rem, 2vw, 0.75rem) clamp(2.5rem, 6vw, 3rem)`,
                       background: '#0c0f14',
                       border: '1px solid rgba(245, 210, 108, 0.2)',
                       borderRadius: '0.5rem',
                       color: '#E8EDF2',
                       fontSize: 'clamp(0.75rem, 2vw, 0.875rem)',
                       boxSizing: 'border-box'
                     }}
                   />
                 </div>
                 <button
                   onClick={handleSearch}
                   style={{
                     backgroundColor: '#F5D26C',
                     color: '#0c0f14',
                     padding: 'clamp(0.5rem, 2vw, 0.75rem) clamp(1rem, 3vw, 1.5rem)',
                     borderRadius: '0.5rem',
                     fontWeight: '600',
                     border: 'none',
                     cursor: 'pointer',
                     display: 'flex',
                     alignItems: 'center',
                     gap: 'clamp(0.25rem, 1vw, 0.5rem)',
                     transition: 'background-color 0.2s',
                     fontSize: 'clamp(0.75rem, 2vw, 0.875rem)',
                     whiteSpace: 'nowrap',
                     flexShrink: 0
                   }}
                   onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#e0c05c')}
                   onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#F5D26C')}
                 >
                   <Search style={{ height: 'clamp(0.875rem, 2.5vw, 1rem)', width: 'clamp(0.875rem, 2.5vw, 1rem)' }} />
                   <span style={{ display: window.innerWidth < 300 ? 'none' : 'inline' }}>Pesquisar</span>
                 </button>
        </div>

               {/* Filters */}
               <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 'clamp(0.5rem, 2vw, 1rem)', marginBottom: '1rem' }}>
          {availableFilters.filter(filter => filter.enabled).map(filter => {
            const getFilterValue = () => {
              switch (filter.id) {
                case 'status': return selectedStatus
                case 'nichos': return selectedNicho
                case 'estrategias': return selectedEstrategia
                case 'produtos': return selectedProduto
                case 'idiomas': return selectedIdioma
                case 'paises': return selectedPais
                default: return ''
              }
            }

            const setFilterValue = (value: string) => {
              switch (filter.id) {
                case 'status': setSelectedStatus(value); break
                case 'nichos': setSelectedNicho(value); break
                case 'estrategias': setSelectedEstrategia(value); break
                case 'produtos': setSelectedProduto(value); break
                case 'idiomas': setSelectedIdioma(value); break
                case 'paises': setSelectedPais(value); break
              }
            }

            return (
              <ElegantFilter
                key={filter.id}
                label={filter.name}
                emoji={filter.emoji}
                type={filter.type}
                value={getFilterValue()}
                onChange={setFilterValue}
                allowAdd={true}
                onOptionsChange={handleFilterOptionsChange}
              />
            )
          })}
        </div>

        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <button
            onClick={handleRefreshAll}
            disabled={isRefreshingAll}
            style={{
              backgroundColor: 'rgba(34, 197, 94, 0.1)',
              color: '#22C55E',
              padding: '0.5rem 1rem',
              borderRadius: '0.5rem',
              fontWeight: '500',
              border: '1px solid rgba(34, 197, 94, 0.2)',
              cursor: isRefreshingAll ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              opacity: isRefreshingAll ? 0.7 : 1
            }}
          >
            <RotateCcw style={{ 
              height: '1rem', 
              width: '1rem',
              animation: isRefreshingAll ? 'spin 1s linear infinite' : 'none'
            }} />
            {isRefreshingAll ? 'Atualizando...' : 'Atualizar Todas'}
          </button>
          <button
            onClick={loadLibraries}
            style={{
              backgroundColor: 'rgba(245, 210, 108, 0.1)',
              color: '#F5D26C',
              padding: '0.5rem 1rem',
              borderRadius: '0.5rem',
              fontWeight: '500',
              border: '1px solid rgba(245, 210, 108, 0.2)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}
          >
            <RotateCcw style={{ height: '1rem', width: '1rem' }} />
            Recarregar Lista
          </button>
          <button
            onClick={() => setShowFilterManager(true)}
            style={{
              backgroundColor: 'rgba(59, 130, 246, 0.1)',
              color: '#3B82F6',
              padding: '0.5rem 1rem',
              borderRadius: '0.5rem',
              fontWeight: '500',
              border: '1px solid rgba(59, 130, 246, 0.2)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}
          >
            <Settings style={{ height: '1rem', width: '1rem' }} />
            Gerenciar Filtros
          </button>
          <button
            onClick={clearFilters}
            style={{
              backgroundColor: 'rgba(239, 68, 68, 0.1)',
              color: '#EF4444',
              padding: '0.5rem 1rem',
              borderRadius: '0.5rem',
              fontWeight: '500',
              border: '1px solid rgba(239, 68, 68, 0.2)',
              cursor: 'pointer'
            }}
          >
            Limpar Filtros
          </button>
        </div>
      </div>

             {/* Libraries List */}
             {libraries.length > 0 ? (
               <div style={{
                 display: 'flex',
                 flexDirection: 'column',
                 gap: '24px',
                 boxSizing: 'border-box',
               }}>
                 {libraries.map((library: any) => (
                   <LibraryCardNew 
                     key={library.id} 
                     library={library} 
                     onUpdate={handleLibraryUpdate}
                   />
                 ))}
               </div>
             ) : (
        <div style={{
          background: '#141823',
          border: '1px solid rgba(245, 210, 108, 0.2)',
          borderRadius: '0.75rem',
          padding: '3rem',
          textAlign: 'center',
          boxShadow: '0 6px 24px rgba(0, 0, 0, 0.35)',
        }}>
          <BookOpen style={{ height: '4rem', width: '4rem', color: '#94a3b8', margin: '0 auto 1rem auto' }} />
          <h3 style={{ fontSize: '1.25rem', fontWeight: '600', color: '#E8EDF2', marginBottom: '0.5rem' }}>
            Nenhuma biblioteca encontrada
          </h3>
          <p style={{ color: '#94a3b8' }}>
            Tente ajustar os filtros ou adicionar uma nova biblioteca
          </p>
        </div>
      )}

      {/* Add Library Modal */}
      {showAddModal && (
        <>
          {console.log('🔧 Renderizando AddLibraryModal com showAddModal:', showAddModal)}
          <AddLibraryModal
            isOpen={showAddModal}
            onClose={() => {
              console.log('🔧 Fechando modal')
              setShowAddModal(false)
            }}
            onSuccess={() => {
              console.log('🔧 Biblioteca criada com sucesso!')
              setShowAddModal(false)
              
              // Aguardar um momento para garantir que o backend salvou
              setTimeout(() => {
                console.log('🔄 Recarregando bibliotecas após criação...')
                loadLibraries(false)
              }, 1000)
            }}
          />
        </>
      )}

      {showImportModal && (
        <ImportLibraryModal
          isOpen={showImportModal}
          onClose={() => setShowImportModal(false)}
          onSuccess={() => {
            setShowImportModal(false)
            setTimeout(() => loadLibraries(false), 1000)
          }}
        />
      )}

      {/* Filter Manager Modal */}
      <FilterManager
        isOpen={showFilterManager}
        onClose={() => setShowFilterManager(false)}
        onFiltersChange={handleFiltersChange}
        currentFilters={availableFilters}
      />
    </div>
    </AuthGuard>
  )
}