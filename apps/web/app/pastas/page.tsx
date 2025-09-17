'use client'

import { useEffect, useState } from 'react'
import { Folder, Plus, Edit, Trash2, BookOpen } from 'lucide-react'
import { foldersApi } from '@/lib/api'

export default function PastasPage() {
  const [folders, setFolders] = useState([])
  const [loading, setLoading] = useState(true)
  const [isCreating, setIsCreating] = useState(false)
  const [newFolderName, setNewFolderName] = useState('')

  useEffect(() => {
    loadFolders()
  }, [])

  const loadFolders = async () => {
    try {
      const data = await foldersApi.getAll()
      setFolders(data)
    } catch (error) {
      console.error('Erro ao carregar pastas:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleCreateFolder = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newFolderName.trim()) return

    try {
      await foldersApi.create({ name: newFolderName.trim() })
      setNewFolderName('')
      setIsCreating(false)
      loadFolders()
    } catch (error) {
      console.error('Erro ao criar pasta:', error)
    }
  }

  const handleDeleteFolder = async (id: string, name: string) => {
    if (confirm(`Tem certeza que deseja deletar a pasta "${name}"?`)) {
      try {
        await foldersApi.delete(id)
        loadFolders()
      } catch (error) {
        console.error('Erro ao deletar pasta:', error)
      }
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-pulse text-gold">Carregando pastas...</div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-text flex items-center gap-3">
            <Folder className="h-8 w-8 text-gold" />
            Pastas
          </h1>
          <p className="text-muted mt-2">
            Organize suas bibliotecas em pastas
          </p>
        </div>
        <button 
          onClick={() => setIsCreating(true)}
          className="btn-primary flex items-center gap-2"
        >
          <Plus className="h-4 w-4" />
          Nova Pasta
        </button>
      </div>

      {/* Formulário de nova pasta */}
      {isCreating && (
        <div className="card p-6">
          <form onSubmit={handleCreateFolder} className="flex gap-4">
            <input
              type="text"
              placeholder="Nome da pasta..."
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              className="input flex-1"
              autoFocus
            />
            <button type="submit" className="btn-primary">
              Criar
            </button>
            <button 
              type="button"
              onClick={() => {
                setIsCreating(false)
                setNewFolderName('')
              }}
              className="btn-secondary"
            >
              Cancelar
            </button>
          </form>
        </div>
      )}

      {/* Grid de pastas */}
      {folders.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {folders.map((folder: any) => (
            <div key={folder.id} className="card p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-gold/10 rounded-lg">
                    <Folder className="h-6 w-6 text-gold" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-text">{folder.name}</h3>
                    <p className="text-sm text-muted">
                      {folder.libraries?.length || 0} bibliotecas
                    </p>
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  <button
                    className="p-2 text-muted hover:text-gold transition-colors rounded-lg hover:bg-gold/10"
                    title="Editar"
                  >
                    <Edit className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => handleDeleteFolder(folder.id, folder.name)}
                    className="p-2 text-muted hover:text-red-400 transition-colors rounded-lg hover:bg-red-400/10"
                    title="Deletar"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* Lista de bibliotecas na pasta */}
              {folder.libraries && folder.libraries.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-sm font-medium text-muted flex items-center gap-2">
                    <BookOpen className="h-4 w-4" />
                    Bibliotecas:
                  </h4>
                  <div className="space-y-1">
                    {folder.libraries.slice(0, 3).map((lib: any) => (
                      <div key={lib.id} className="text-sm text-text bg-background/50 p-2 rounded">
                        {lib.name}
                      </div>
                    ))}
                    {folder.libraries.length > 3 && (
                      <div className="text-xs text-muted">
                        +{folder.libraries.length - 3} mais
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="card p-12 text-center">
          <Folder className="h-16 w-16 text-muted mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-text mb-2">
            Nenhuma pasta criada
          </h3>
          <p className="text-muted mb-6">
            Crie pastas para organizar suas bibliotecas por categoria.
          </p>
          <button 
            onClick={() => setIsCreating(true)}
            className="btn-primary flex items-center gap-2 mx-auto"
          >
            <Plus className="h-4 w-4" />
            Criar Primeira Pasta
          </button>
        </div>
      )}
    </div>
  )
}
