'use client'

import { useState, useEffect } from 'react'
import { X, Folder, Plus, Edit2, Trash2, Check } from 'lucide-react'
import { foldersApi } from '@/lib/api'

interface FolderConfigModalProps {
  isOpen: boolean
  onClose: () => void
  libraryId: string
  currentFolderId?: string
  onFolderChange: (folderId: string | null) => void
}

export function FolderConfigModal({ 
  isOpen, 
  onClose, 
  libraryId, 
  currentFolderId, 
  onFolderChange 
}: FolderConfigModalProps) {
  const [folders, setFolders] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddModal, setShowAddModal] = useState(false)
  const [newFolderName, setNewFolderName] = useState('')
  const [editingFolder, setEditingFolder] = useState<string | null>(null)
  const [editingName, setEditingName] = useState('')

  useEffect(() => {
    if (isOpen) {
      loadFolders()
    }
  }, [isOpen])

  const loadFolders = async () => {
    try {
      setLoading(true)
      const data = await foldersApi.getAll()
      setFolders(data)
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

  const handleEditFolder = async (folderId: string) => {
    if (!editingName.trim()) return

    try {
      await foldersApi.update(folderId, { name: editingName.trim() })
      setEditingFolder(null)
      setEditingName('')
      loadFolders()
    } catch (error) {
      console.error('Erro ao editar pasta:', error)
    }
  }

  const handleDeleteFolder = async (folderId: string) => {
    try {
      await foldersApi.delete(folderId)
      loadFolders()
      // Se a pasta excluída era a atual, remove a seleção
      if (currentFolderId === folderId) {
        onFolderChange(null)
      }
    } catch (error) {
      console.error('Erro ao excluir pasta:', error)
    }
  }

  const handleSelectFolder = (folderId: string) => {
    onFolderChange(folderId)
    onClose()
  }

  const handleRemoveFromFolder = () => {
    onFolderChange(null)
    onClose()
  }

  if (!isOpen) return null

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: '1rem'
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose()
        }
      }}
    >
      <div
        style={{
          background: '#1A202C',
          borderRadius: '0.75rem',
          border: '1px solid #2D3748',
          padding: '1rem',
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.2)',
          maxWidth: '500px',
          width: '90%',
          maxHeight: '70vh',
          overflow: 'auto',
          position: 'relative'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '1rem',
          paddingBottom: '0.75rem',
          borderBottom: '1px solid #2D3748'
        }}>
          <h2 style={{ 
            fontSize: '1.25rem', 
            fontWeight: '700', 
            color: '#F5D26C',
            margin: 0,
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem'
          }}>
            <Folder style={{ height: '1.25rem', width: '1.25rem' }} />
            Gerir Pasta
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
              alignItems: 'center',
              justifyContent: 'center'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.1)'
              e.currentTarget.style.color = '#EF4444'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent'
              e.currentTarget.style.color = '#9CA3AF'
            }}
          >
            <X style={{ height: '1.25rem', width: '1.25rem' }} />
          </button>
        </div>

        {/* Content */}
        {loading ? (
          <div style={{ 
            display: 'flex', 
            justifyContent: 'center', 
            alignItems: 'center', 
            height: '200px',
            color: '#E8EDF2' 
          }}>
            Carregando pastas...
          </div>
        ) : (
          <>
            {/* Current Selection */}
            <div style={{ marginBottom: '1.5rem' }}>
              <h3 style={{ 
                fontSize: '1rem', 
                fontWeight: '600', 
                color: '#E8EDF2',
                marginBottom: '0.75rem'
              }}>
                Pasta Atual
              </h3>
              {currentFolderId ? (
                <div style={{
                  background: 'rgba(34, 197, 94, 0.1)',
                  border: '1px solid rgba(34, 197, 94, 0.2)',
                  borderRadius: '0.5rem',
                  padding: '0.75rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Folder style={{ height: '1rem', width: '1rem', color: '#22C55E' }} />
                    <span style={{ color: '#E8EDF2' }}>
                      {folders.find(f => f.id === currentFolderId)?.name || 'Pasta não encontrada'}
                    </span>
                  </div>
                  <button
                    onClick={handleRemoveFromFolder}
                    style={{
                      background: 'rgba(239, 68, 68, 0.1)',
                      border: '1px solid rgba(239, 68, 68, 0.2)',
                      borderRadius: '0.25rem',
                      padding: '0.25rem 0.5rem',
                      color: '#EF4444',
                      cursor: 'pointer',
                      fontSize: '0.875rem'
                    }}
                  >
                    Remover
                  </button>
                </div>
              ) : (
                <div style={{
                  background: 'rgba(107, 114, 128, 0.1)',
                  border: '1px solid rgba(107, 114, 128, 0.2)',
                  borderRadius: '0.5rem',
                  padding: '0.75rem',
                  color: '#9CA3AF',
                  textAlign: 'center'
                }}>
                  Nenhuma pasta selecionada
                </div>
              )}
            </div>

            {/* Available Folders */}
            <div style={{ marginBottom: '1.5rem' }}>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '0.75rem'
              }}>
                <h3 style={{ 
                  fontSize: '1rem', 
                  fontWeight: '600', 
                  color: '#E8EDF2'
                }}>
                  Pastas Disponíveis
                </h3>
                <button
                  onClick={() => setShowAddModal(true)}
                  style={{
                    background: 'rgba(34, 197, 94, 0.1)',
                    border: '1px solid rgba(34, 197, 94, 0.2)',
                    borderRadius: '0.25rem',
                    padding: '0.25rem 0.5rem',
                    color: '#22C55E',
                    cursor: 'pointer',
                    fontSize: '0.875rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.25rem'
                  }}
                >
                  <Plus style={{ height: '0.875rem', width: '0.875rem' }} />
                  Nova
                </button>
              </div>

              <p style={{ 
                fontSize: '0.875rem', 
                color: '#9CA3AF', 
                marginBottom: '0.75rem',
                fontStyle: 'italic'
              }}>
                Clique numa pasta para mover esta biblioteca para lá
              </p>

              <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
                {folders.map((folder) => (
                  <div
                    key={folder.id}
                    style={{
                      background: currentFolderId === folder.id ? 'rgba(34, 197, 94, 0.1)' : 'rgba(107, 114, 128, 0.05)',
                      border: currentFolderId === folder.id ? '1px solid rgba(34, 197, 94, 0.3)' : '1px solid rgba(107, 114, 128, 0.1)',
                      borderRadius: '0.5rem',
                      padding: '0.75rem',
                      marginBottom: '0.5rem',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      cursor: currentFolderId !== folder.id ? 'pointer' : 'default'
                    }}
                    onClick={() => {
                      if (currentFolderId !== folder.id) {
                        handleSelectFolder(folder.id)
                      }
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: 1 }}>
                      <Folder style={{ height: '1rem', width: '1rem', color: '#22C55E' }} />
                      {editingFolder === folder.id ? (
                        <input
                          type="text"
                          value={editingName}
                          onChange={(e) => setEditingName(e.target.value)}
                          onBlur={() => handleEditFolder(folder.id)}
                          onKeyPress={(e) => {
                            if (e.key === 'Enter') {
                              handleEditFolder(folder.id)
                            }
                          }}
                          style={{
                            background: 'transparent',
                            border: '1px solid rgba(34, 197, 94, 0.3)',
                            borderRadius: '0.25rem',
                            padding: '0.25rem 0.5rem',
                            color: '#E8EDF2',
                            outline: 'none',
                            flex: 1
                          }}
                          autoFocus
                        />
                      ) : (
                        <span 
                          style={{ 
                            color: '#E8EDF2',
                            flex: 1,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            maxWidth: '200px',
                            cursor: 'help'
                          }}
                          title={folder.name}
                        >
                          {folder.name.length > 25 ? `${folder.name.substring(0, 25)}...` : folder.name}
                          {currentFolderId === folder.id && (
                            <span style={{ 
                              color: '#22C55E', 
                              fontSize: '0.75rem', 
                              marginLeft: '0.5rem',
                              fontWeight: '600'
                            }}>
                              (Atual)
                            </span>
                          )}
                        </span>
                      )}
                    </div>
                    
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                      {editingFolder === folder.id ? (
                        <button
                          onClick={() => handleEditFolder(folder.id)}
                          style={{
                            background: 'rgba(34, 197, 94, 0.1)',
                            border: '1px solid rgba(34, 197, 94, 0.2)',
                            borderRadius: '0.25rem',
                            padding: '0.25rem',
                            color: '#22C55E',
                            cursor: 'pointer'
                          }}
                        >
                          <Check style={{ height: '0.875rem', width: '0.875rem' }} />
                        </button>
                      ) : (
                        <>
                          <button
                            onClick={() => {
                              setEditingFolder(folder.id)
                              setEditingName(folder.name)
                            }}
                            style={{
                              background: 'rgba(245, 210, 108, 0.1)',
                              border: '1px solid rgba(245, 210, 108, 0.2)',
                              borderRadius: '0.25rem',
                              padding: '0.25rem',
                              color: '#F5D26C',
                              cursor: 'pointer'
                            }}
                          >
                            <Edit2 style={{ height: '0.875rem', width: '0.875rem' }} />
                          </button>
                          <button
                            onClick={() => handleDeleteFolder(folder.id)}
                            style={{
                              background: 'rgba(239, 68, 68, 0.1)',
                              border: '1px solid rgba(239, 68, 68, 0.2)',
                              borderRadius: '0.25rem',
                              padding: '0.25rem',
                              color: '#EF4444',
                              cursor: 'pointer'
                            }}
                          >
                            <Trash2 style={{ height: '0.875rem', width: '0.875rem' }} />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {/* Add Folder Modal */}
        {showAddModal && (
          <div style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.8)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: '0.75rem'
          }}>
            <div style={{
              background: '#1A202C',
              border: '1px solid #2D3748',
              borderRadius: '0.5rem',
              padding: '1rem',
              width: '90%',
              maxWidth: '300px'
            }}>
              <h3 style={{ 
                fontSize: '1rem', 
                fontWeight: '600', 
                color: '#E8EDF2', 
                marginBottom: '0.75rem' 
              }}>
                Nova Pasta
              </h3>
              <form onSubmit={handleAddFolder} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <input
                  type="text"
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  style={{
                    background: '#0c0f14',
                    border: '1px solid rgba(34, 197, 94, 0.2)',
                    borderRadius: '0.25rem',
                    padding: '0.5rem',
                    color: '#E8EDF2',
                    outline: 'none'
                  }}
                  placeholder="Nome da pasta"
                  required
                />
                <div style={{ display: 'flex', gap: '0.5rem' }}>
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
                      padding: '0.5rem',
                      borderRadius: '0.25rem',
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
                      background: '#22C55E',
                      color: '#ffffff',
                      padding: '0.5rem',
                      borderRadius: '0.25rem',
                      border: 'none',
                      cursor: 'pointer'
                    }}
                  >
                    Criar
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
