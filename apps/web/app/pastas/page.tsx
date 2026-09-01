'use client'

import { useEffect, useState } from 'react'
import { Folder, Plus, Edit2, Trash2, BookOpen } from 'lucide-react'
import { foldersApi, librariesApi } from '@/lib/api'

export default function PastasPage() {
  const [folders, setFolders] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddModal, setShowAddModal] = useState(false)
  const [editingFolder, setEditingFolder] = useState(null)
  const [newFolderName, setNewFolderName] = useState('')

  useEffect(() => {
    loadFolders()
  }, [])

  const loadFolders = async () => {
    try {
      setLoading(true)
      const data = await foldersApi.getAll()
      
      // Buscar contagem de bibliotecas para cada pasta
      const foldersWithCount = await Promise.all(
        data.map(async (folder: any) => {
          try {
            const libraries = await librariesApi.getAll({ folderId: folder.id })
            return {
              ...folder,
              librariesCount: libraries.length
            }
          } catch (error) {
            console.error(`Erro ao buscar bibliotecas da pasta ${folder.id}:`, error)
            return {
              ...folder,
              librariesCount: 0
            }
          }
        })
      )
      
      setFolders(foldersWithCount)
    } catch (error) {
      console.error('Erro ao carregar pastas:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleAddFolder = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newFolderName.trim()) return

    try {
      await foldersApi.create({ name: newFolderName.trim() })
      setNewFolderName('')
      setShowAddModal(false)
      loadFolders()
    } catch (error) {
      console.error('Erro ao criar pasta:', error)
    }
  }

  const handleEditFolder = async (id: string, newName: string) => {
    try {
      await foldersApi.update(id, { name: newName })
      setEditingFolder(null)
      loadFolders()
    } catch (error) {
      console.error('Erro ao editar pasta:', error)
    }
  }

  const handleDeleteFolder = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir esta pasta?')) return

    try {
      await foldersApi.delete(id)
      loadFolders()
    } catch (error) {
      console.error('Erro ao excluir pasta:', error)
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
        <div style={{ animation: 'pulse 2s infinite' }}>
          Carregando pastas...
        </div>
      </div>
    )
  }

  return (
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
        marginBottom: '2rem'
      }}>
        <div>
          <h1 style={{ 
            fontSize: '2rem', 
            fontWeight: 'bold', 
            color: '#E8EDF2',
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            marginBottom: '0.5rem'
          }}>
            <Folder style={{ height: '2rem', width: '2rem', color: '#F5D26C' }} />
            Pastas
          </h1>
          <p style={{ color: '#94a3b8' }}>
            Organize suas bibliotecas em pastas
          </p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          style={{
            background: '#F5D26C',
            color: '#0c0f14',
            padding: '0.75rem 1rem',
            borderRadius: '0.5rem',
            fontWeight: '500',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            border: 'none',
            cursor: 'pointer'
          }}
        >
          <Plus style={{ height: '1rem', width: '1rem' }} />
          Nova Pasta
        </button>
      </div>

      {/* Stats */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', 
        gap: '1.5rem',
        marginBottom: '2rem'
      }}>
        <div style={{
          background: '#141823',
          border: '1px solid rgba(245, 210, 108, 0.2)',
          borderRadius: '0.75rem',
          padding: '1.5rem',
          boxShadow: '0 6px 24px rgba(0, 0, 0, 0.35)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{ 
              padding: '0.75rem', 
              background: 'rgba(245, 210, 108, 0.1)', 
              borderRadius: '0.5rem' 
            }}>
              <Folder style={{ height: '1.5rem', width: '1.5rem', color: '#F5D26C' }} />
            </div>
            <div>
              <p style={{ fontSize: '0.875rem', color: '#94a3b8' }}>Total de Pastas</p>
              <p style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#E8EDF2' }}>
                {folders.length}
              </p>
            </div>
          </div>
        </div>

        <div style={{
          background: '#141823',
          border: '1px solid rgba(245, 210, 108, 0.2)',
          borderRadius: '0.75rem',
          padding: '1.5rem',
          boxShadow: '0 6px 24px rgba(0, 0, 0, 0.35)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{ 
              padding: '0.75rem', 
              background: 'rgba(245, 210, 108, 0.1)', 
              borderRadius: '0.5rem' 
            }}>
              <BookOpen style={{ height: '1.5rem', width: '1.5rem', color: '#F5D26C' }} />
            </div>
            <div>
              <p style={{ fontSize: '0.875rem', color: '#94a3b8' }}>Bibliotecas Organizadas</p>
              <p style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#E8EDF2' }}>
                {folders.reduce((sum: number, folder: any) => sum + (folder.libraries?.length || 0), 0)}
              </p>
            </div>
          </div>
        </div>

        <div style={{
          background: '#141823',
          border: '1px solid rgba(245, 210, 108, 0.2)',
          borderRadius: '0.75rem',
          padding: '1.5rem',
          boxShadow: '0 6px 24px rgba(0, 0, 0, 0.35)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{ 
              padding: '0.75rem', 
              background: 'rgba(245, 210, 108, 0.1)', 
              borderRadius: '0.5rem' 
            }}>
              <Folder style={{ height: '1.5rem', width: '1.5rem', color: '#F5D26C' }} />
            </div>
            <div>
              <p style={{ fontSize: '0.875rem', color: '#94a3b8' }}>Média por Pasta</p>
              <p style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#E8EDF2' }}>
                {folders.length > 0 ? Math.round(folders.reduce((sum: number, folder: any) => sum + (folder.libraries?.length || 0), 0) / folders.length) : 0}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Folders Grid */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', 
        gap: '1rem' 
      }}>
        {folders.map((folder: any) => (
          <div 
            key={folder.id} 
            style={{
              background: '#141823',
              border: '1px solid rgba(245, 210, 108, 0.2)',
              borderRadius: '0.5rem',
              padding: '1rem',
              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.25)',
              minHeight: '120px',
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
            onClick={() => window.location.href = `/pastas/${folder.id}`}
            onMouseOver={(e) => {
              e.currentTarget.style.borderColor = 'rgba(245, 210, 108, 0.4)'
              e.currentTarget.style.transform = 'translateY(-2px)'
              e.currentTarget.style.boxShadow = '0 6px 20px rgba(0, 0, 0, 0.35)'
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.borderColor = 'rgba(245, 210, 108, 0.2)'
              e.currentTarget.style.transform = 'translateY(0)'
              e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.25)'
            }}
          >
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'space-between', 
              marginBottom: '0.75rem' 
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: 1, minWidth: 0 }}>
                <Folder style={{ height: '1.25rem', width: '1.25rem', color: '#F5D26C', flexShrink: 0 }} />
                <h3 
                  style={{ 
                    fontSize: '1rem', 
                    fontWeight: '600', 
                    color: '#E8EDF2',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    flex: 1,
                    minWidth: 0,
                    cursor: 'help'
                  }}
                  title={folder.name}
                >
                  {editingFolder === folder.id ? (
                    <input
                      type="text"
                      defaultValue={folder.name}
                      onBlur={(e) => handleEditFolder(folder.id, e.target.value)}
                      onKeyPress={(e) => {
                        if (e.key === 'Enter') {
                          handleEditFolder(folder.id, e.currentTarget.value)
                        }
                      }}
                      style={{
                        background: 'transparent',
                        border: '1px solid rgba(245, 210, 108, 0.3)',
                        borderRadius: '0.25rem',
                        padding: '0.25rem 0.5rem',
                        color: '#E8EDF2',
                        outline: 'none',
                        width: '100%'
                      }}
                      autoFocus
                    />
                  ) : (
                    folder.name.length > 30 ? `${folder.name.substring(0, 30)}...` : folder.name
                  )}
                </h3>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', flexShrink: 0 }}>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    setEditingFolder(folder.id)
                  }}
                  style={{
                    padding: '0.375rem',
                    color: '#94a3b8',
                    background: 'none',
                    border: 'none',
                    borderRadius: '0.375rem',
                    cursor: 'pointer'
                  }}
                  onMouseOver={(e) => {
                    e.currentTarget.style.color = '#F5D26C'
                    e.currentTarget.style.background = 'rgba(245, 210, 108, 0.1)'
                  }}
                  onMouseOut={(e) => {
                    e.currentTarget.style.color = '#94a3b8'
                    e.currentTarget.style.background = 'none'
                  }}
                >
                  <Edit2 style={{ height: '0.875rem', width: '0.875rem' }} />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    handleDeleteFolder(folder.id)
                  }}
                  style={{
                    padding: '0.375rem',
                    color: '#94a3b8',
                    background: 'none',
                    border: 'none',
                    borderRadius: '0.5rem',
                    cursor: 'pointer'
                  }}
                  onMouseOver={(e) => {
                    e.currentTarget.style.color = '#f87171'
                    e.currentTarget.style.background = 'rgba(248, 113, 113, 0.1)'
                  }}
                  onMouseOut={(e) => {
                    e.currentTarget.style.color = '#94a3b8'
                    e.currentTarget.style.background = 'none'
                  }}
                >
                  <Trash2 style={{ height: '0.875rem', width: '0.875rem' }} />
                </button>
              </div>
            </div>
            
            <div style={{ fontSize: '0.875rem', color: '#94a3b8' }}>
              <p>Criada em: {new Date(folder.created_at || folder.createdAt).toLocaleDateString('pt-BR')}</p>
              <p>Bibliotecas: {folder.librariesCount || 0}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Empty State */}
      {folders.length === 0 && (
        <div style={{
          background: '#141823',
          border: '1px solid rgba(245, 210, 108, 0.2)',
          borderRadius: '0.75rem',
          padding: '3rem',
          boxShadow: '0 6px 24px rgba(0, 0, 0, 0.35)',
          textAlign: 'center'
        }}>
          <Folder style={{ 
            height: '4rem', 
            width: '4rem', 
            color: '#94a3b8', 
            margin: '0 auto 1rem' 
          }} />
          <h3 style={{ 
            fontSize: '1.25rem', 
            fontWeight: '600', 
            color: '#E8EDF2', 
            marginBottom: '0.5rem' 
          }}>
            Nenhuma pasta encontrada
          </h3>
          <p style={{ color: '#94a3b8', marginBottom: '1rem' }}>
            Crie sua primeira pasta para organizar suas bibliotecas.
          </p>
          <button
            onClick={() => setShowAddModal(true)}
            style={{
              background: '#F5D26C',
              color: '#0c0f14',
              padding: '0.75rem 1rem',
              borderRadius: '0.5rem',
              fontWeight: '500',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              border: 'none',
              cursor: 'pointer',
              margin: '0 auto'
            }}
          >
            <Plus style={{ height: '1rem', width: '1rem' }} />
            Criar Primeira Pasta
          </button>
        </div>
      )}

      {/* Add Folder Modal */}
      {showAddModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 50,
          padding: '1rem'
        }}>
          <div style={{
            background: '#141823',
            border: '1px solid rgba(245, 210, 108, 0.2)',
            borderRadius: '0.75rem',
            padding: '1.5rem',
            width: '100%',
            maxWidth: '28rem',
            boxShadow: '0 6px 24px rgba(0, 0, 0, 0.35)'
          }}>
            <h2 style={{ 
              fontSize: '1.25rem', 
              fontWeight: 'bold', 
              color: '#E8EDF2', 
              marginBottom: '1rem' 
            }}>
              Nova Pasta
            </h2>
            <form onSubmit={handleAddFolder} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ 
                  display: 'block', 
                  fontSize: '0.875rem', 
                  fontWeight: '500', 
                  color: '#E8EDF2', 
                  marginBottom: '0.5rem' 
                }}>
                  Nome da Pasta
                </label>
                <input
                  type="text"
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  style={{
                    width: '100%',
                    background: '#0c0f14',
                    border: '1px solid rgba(245, 210, 108, 0.2)',
                    borderRadius: '0.5rem',
                    padding: '0.75rem',
                    color: '#E8EDF2',
                    outline: 'none'
                  }}
                  placeholder="Ex: E-commerce Brasil"
                  required
                />
              </div>
              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <button
                  type="button"
                  onClick={() => {
                    setShowAddModal(false)
                    setNewFolderName('')
                  }}
                  style={{
                    flex: 1,
                    background: '#6b7280',
                    color: '#ffffff',
                    padding: '0.75rem',
                    borderRadius: '0.5rem',
                    border: 'none',
                    cursor: 'pointer'
                  }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  style={{
                    flex: 1,
                    background: '#F5D26C',
                    color: '#0c0f14',
                    padding: '0.75rem',
                    borderRadius: '0.5rem',
                    border: 'none',
                    cursor: 'pointer'
                  }}
                >
                  Criar Pasta
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}