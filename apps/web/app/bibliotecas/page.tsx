'use client'

import { useEffect, useState, useMemo } from 'react'
import { BookOpen, Plus, Search, Filter } from 'lucide-react'
import { LibraryCardNew } from '@/components/LibraryCardNew'
import { AddLibraryModal } from '@/components/AddLibraryModal'
import { ConfigModal } from '@/components/ConfigModal'
import { ManageableSelect } from '@/components/ManageableSelect'
import { StatusSelect } from '@/components/StatusSelect'
import { librariesApi, foldersApi, filterOptionsApi } from '@/lib/api'
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts'
import { useModal } from '@/contexts/ModalContext'

export default function BibliotecasPage() {
  const [libraries, setLibraries] = useState([])
  const [folders, setFolders] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedFolder, setSelectedFolder] = useState('')
  const [orderBy, setOrderBy] = useState('newest')
  const [showAddModal, setShowAddModal] = useState(false)
  
  const { isOpen, libraryId, closeModal } = useModal()
  
  // Novos filtros
  const [selectedStatus, setSelectedStatus] = useState('')
  const [selectedNicho, setSelectedNicho] = useState('')
  const [selectedEstrategia, setSelectedEstrategia] = useState('')
  const [selectedProduto, setSelectedProduto] = useState('')
  const [selectedIdioma, setSelectedIdioma] = useState('')
  const [selectedPais, setSelectedPais] = useState('')
  
  // Para atualizar opções quando mudarem
  const [optionsVersion, setOptionsVersion] = useState(0)
  const [searchInputRef, setSearchInputRef] = useState<HTMLInputElement | null>(null)
  
  // Para controlar expansão do card de filtros
  const [openFilters, setOpenFilters] = useState<Set<string>>(new Set())
  const isAnyFilterOpen = openFilters.size > 0
  
  const handleFilterOpenChange = (filterName: string, isOpen: boolean) => {
    setOpenFilters(prev => {
      const newSet = new Set(prev)
      if (isOpen) {
        newSet.add(filterName)
      } else {
        newSet.delete(filterName)
      }
      return newSet
    })
  }

  const handleOptionsChange = () => {
    setOptionsVersion(prev => prev + 1)
  }

  useEffect(() => {
    loadData()
  }, [])

  useEffect(() => {
    loadLibraries()
  }, [searchQuery, selectedFolder, orderBy, selectedStatus, selectedNicho, selectedEstrategia, selectedProduto, selectedIdioma, selectedPais])

  // Atalhos de teclado
  useKeyboardShortcuts([
    {
      key: 'n',
      ctrlKey: true,
      callback: () => setShowAddModal(true),
      description: 'Nova biblioteca'
    },
    {
      key: '/',
      callback: () => searchInputRef?.focus(),
      description: 'Focar na busca'
    },
    {
      key: 'f',
      ctrlKey: true,
      callback: () => searchInputRef?.focus(),
      description: 'Focar na busca'
    },
    {
      key: 'Escape',
      callback: () => {
        if (showAddModal) setShowAddModal(false)
        if (searchInputRef) searchInputRef.blur()
      },
      description: 'Fechar modal/busca'
    }
  ])

  const loadData = async () => {
    try {
      const [librariesData, foldersData] = await Promise.all([
        librariesApi.getAll({ order: orderBy }),
        foldersApi.getAll()
      ])
      setLibraries(librariesData)
      setFolders(foldersData)
    } catch (error) {
      console.error('Erro ao carregar dados:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadLibraries = async () => {
    try {
      const params: any = {
        order: orderBy
      }
      
      if (searchQuery) params.q = searchQuery
      if (selectedFolder) params.folderId = selectedFolder
      if (selectedStatus) params.status = selectedStatus
      if (selectedNicho) params.nichos = selectedNicho
      if (selectedEstrategia) params.estrategias = selectedEstrategia
      if (selectedProduto) params.produtos = selectedProduto
      if (selectedIdioma) params.idiomas = selectedIdioma
      if (selectedPais) params.paises = selectedPais
      
      const data = await librariesApi.getAll(params)
      setLibraries(data)
    } catch (error) {
      console.error('Erro ao carregar bibliotecas:', error)
    }
  }

  // Resumo dinâmico (total / ativas / inativas) baseado na lista carregada
  const summary = useMemo(() => {
    const total = libraries.length || 0
    const active = libraries.filter((lib: any) => (lib?.activeAds ?? 0) > 0 || lib?.calculatedStatus === 'ativo').length
    const inactive = total - active
    return { total, active, inactive }
  }, [libraries])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-pulse text-gold">Carregando bibliotecas...</div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-text flex items-center gap-3">
            <BookOpen className="h-8 w-8 text-gold" />
            Bibliotecas
          </h1>
          <p className="text-muted mt-2">
            Gerencie suas bibliotecas de anúncios
          </p>
        </div>
        <button 
          onClick={() => setShowAddModal(true)}
          className="btn-primary flex items-center gap-2 etf-btn etf-btn-primary h-11 px-5 text-[.98rem]"
        >
          <Plus className="h-4 w-4" />
          Adicionar Biblioteca
        </button>
      </div>

      {/* Filtros */}
      <div className={`card p-6 etf-section transition-all duration-300 ease-in-out overflow-visible ${
        isAnyFilterOpen ? 'min-h-[350px] pb-[200px]' : 'min-h-auto pb-6'
      }`}>
        {/* Busca */}
        <div className="relative mb-4">
          <Search className="h-5 w-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-muted" />
          <input
            ref={setSearchInputRef}
            type="text"
            placeholder="Pesquisar bibliotecas... (ou pressione '/')"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="input pl-10 w-full etf-input"
          />
        </div>

        {/* Linha de filtros */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4">
          {/* 📁 Pastas */}
          <select
            value={selectedFolder}
            onChange={(e) => setSelectedFolder(e.target.value)}
            className="input text-sm etf-input"
          >
            <option value="">📁 Pastas</option>
            {folders.map((folder: any) => (
              <option key={folder.id} value={folder.id}>
                {folder.name}
              </option>
            ))}
          </select>

          {/* 📊 Status */}
          <StatusSelect
            value={selectedStatus}
            onChange={setSelectedStatus}
            onOpenChange={(isOpen) => handleFilterOpenChange('status', isOpen)}
          />

          {/* ❤️ Nichos */}
          <ManageableSelect
            label="Nichos"
            emoji="❤️"
            type="nichos"
            value={selectedNicho}
            onChange={setSelectedNicho}
            onOptionsChange={handleOptionsChange}
            onOpenChange={(isOpen) => handleFilterOpenChange('nichos', isOpen)}
          />

          {/* 📈 Estratégias */}
          <ManageableSelect
            label="Estratégias"
            emoji="📈"
            type="estrategias"
            value={selectedEstrategia}
            onChange={setSelectedEstrategia}
            onOptionsChange={handleOptionsChange}
            onOpenChange={(isOpen) => handleFilterOpenChange('estrategias', isOpen)}
          />

          {/* 📦 Produto */}
          <ManageableSelect
            label="Produto"
            emoji="📦"
            type="produtos"
            value={selectedProduto}
            onChange={setSelectedProduto}
            onOptionsChange={handleOptionsChange}
            onOpenChange={(isOpen) => handleFilterOpenChange('produtos', isOpen)}
          />

          {/* 🌐 Idiomas */}
          <ManageableSelect
            label="Idiomas"
            emoji="🌐"
            type="idiomas"
            value={selectedIdioma}
            onChange={setSelectedIdioma}
            onOptionsChange={handleOptionsChange}
            onOpenChange={(isOpen) => handleFilterOpenChange('idiomas', isOpen)}
          />

          {/* 🌍 País */}
          <ManageableSelect
            label="País"
            emoji="🌍"
            type="paises"
            value={selectedPais}
            onChange={setSelectedPais}
            onOptionsChange={handleOptionsChange}
            onOpenChange={(isOpen) => handleFilterOpenChange('paises', isOpen)}
          />

          {/* 📊 Mais Anúncios */}
          <select
            value={orderBy}
            onChange={(e) => setOrderBy(e.target.value)}
            className="input text-sm etf-input"
          >
            <option value="newest">📊 Mais Anúncios</option>
            <option value="ads_desc">Mais anúncios</option>
            <option value="ads_asc">Menos anúncios</option>
            <option value="newest">Mais recentes</option>
            <option value="oldest">Mais antigas</option>
          </select>
        </div>

        {/* Limpar filtros */}
        <div className="mt-4 flex justify-end">
          <button
            onClick={() => {
              setSearchQuery('')
              setSelectedFolder('')
              setSelectedStatus('')
              setSelectedNicho('')
              setSelectedEstrategia('')
              setSelectedProduto('')
              setSelectedIdioma('')
              setSelectedPais('')
              setOrderBy('newest')
            }}
            className="btn-secondary flex items-center gap-2 text-sm"
          >
            <Filter className="h-4 w-4" />
            Limpar filtros
          </button>
        </div>
      </div>

      {/* Resumo dinâmico após filtros */}
      <div className="card p-4 flex flex-wrap items-center gap-4 etf-section">
        <div className="text-sm text-muted">Resumo</div>
        <div className="flex items-center gap-3 text-sm">
          <span className="px-3 py-1 rounded-full border border-gold/30 text-gold/90 bg-gold/10">Total: {summary.total}</span>
          <span className="px-3 py-1 rounded-full border border-green-500/30 text-green-400 bg-green-500/10">Ativas: {summary.active}</span>
          <span className="px-3 py-1 rounded-full border border-red-500/30 text-red-400 bg-red-500/10">Inativas: {summary.inactive}</span>
        </div>
      </div>

      {/* Grid de bibliotecas */}
      {libraries.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-3 gap-6 xl:gap-8">
          {libraries.map((library: any) => (
            <LibraryCardNew 
              key={library.id}
              library={library} 
              onUpdate={loadLibraries}
            />
          ))}
        </div>
      ) : (
        <div className="card p-12 text-center">
          <BookOpen className="h-16 w-16 text-muted mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-text mb-2">
            {searchQuery || selectedFolder ? 'Nenhuma biblioteca encontrada' : 'Nenhuma biblioteca cadastrada'}
          </h3>
          <p className="text-muted mb-6">
            {searchQuery || selectedFolder 
              ? 'Tente ajustar os filtros de busca.'
              : 'Comece adicionando sua primeira biblioteca de anúncios.'
            }
          </p>
          <button 
            onClick={() => setShowAddModal(true)}
            className="btn-primary flex items-center gap-2 mx-auto etf-btn etf-btn-primary h-11 px-5 text-[.98rem]"
          >
            <Plus className="h-4 w-4" />
            Adicionar Biblioteca
          </button>
        </div>
      )}

      {/* Modal de adicionar biblioteca */}
      <AddLibraryModal 
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        onSuccess={() => {
          loadLibraries()
          handleOptionsChange()
        }}
      />

      {/* Modal global de configurações */}
      <ConfigModal
        isOpen={isOpen}
        libraryId={libraryId}
        onClose={closeModal}
        onUpdate={() => {
          loadLibraries()
          handleOptionsChange()
        }}
        library={libraries.find((lib: any) => lib.id === libraryId)}
      />
    </div>
  )
}
