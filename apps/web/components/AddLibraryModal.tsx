'use client'

import { useState, useEffect } from 'react'
import { X, Plus, Trash2 } from 'lucide-react'
import { librariesApi, foldersApi, filterOptionsApi } from '@/lib/api'
import { getApiErrorMessage, isLibraryDuplicateError, LIBRARY_DUPLICATE_MESSAGE } from '@/lib/library-messages'
import { ElegantFilter } from './ElegantFilter'

interface AddLibraryModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}

export function AddLibraryModal({ isOpen, onClose, onSuccess }: AddLibraryModalProps) {
  const [loading, setLoading] = useState(false)
  const [folders, setFolders] = useState([])
  const [refreshKey, setRefreshKey] = useState(0)
  const [showCreateFolder, setShowCreateFolder] = useState(false)
  const [newFolderName, setNewFolderName] = useState('')
  const [creatingFolder, setCreatingFolder] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    nota: '',
    sourceType: 'URL',
    sourceValue: '',
    country: '',
    language: '',
    notes: '',
    folderId: '',
    pages: [''],
    status: 'ativo',
    nichos: '',
    estrategias: '',
    produtos: '',
    idiomas: '',
    paises: ''
  })

  useEffect(() => {
    if (isOpen) {
      loadFolders()
    }
  }, [isOpen])

  const loadFolders = async () => {
    try {
      const data = await foldersApi.getAll()
      setFolders(data)
    } catch (error) {
      console.error('Erro ao carregar pastas:', error)
    }
  }

  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) return

    setCreatingFolder(true)
    try {
      await foldersApi.create({ name: newFolderName.trim() })
      setNewFolderName('')
      setShowCreateFolder(false)
      await loadFolders() // Recarregar lista de pastas
    } catch (error) {
      console.error('Erro ao criar pasta:', error)
      alert('Erro ao criar pasta. Verifique o console para mais detalhes.')
    } finally {
      setCreatingFolder(false)
    }
  }

  const handleOptionsChange = () => {
    setRefreshKey(prev => prev + 1)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.name.trim() || !formData.sourceValue.trim()) return

    setLoading(true)
    try {
      const payload = {
        ...formData,
        folderId: formData.folderId || null,
        pages: formData.pages.filter(page => page.trim())
      }

      await librariesApi.create(payload)
      
      onSuccess()
      onClose()
      
      // Reset form
      setFormData({
        name: '',
        nota: '',
        sourceType: 'URL',
        sourceValue: '',
        country: '',
        language: '',
        notes: '',
        folderId: '',
        pages: [''],
        status: 'ativo',
        nichos: '',
        estrategias: '',
        produtos: '',
        idiomas: '',
        paises: ''
      })
    } catch (error: any) {
      console.error('Erro ao criar biblioteca:', error)
      if (isLibraryDuplicateError(error)) {
        alert(LIBRARY_DUPLICATE_MESSAGE)
      } else {
        alert(getApiErrorMessage(error, 'Erro ao criar biblioteca. Tente novamente.'))
      }
    } finally {
      setLoading(false)
    }
  }

  const addPage = () => {
    setFormData(prev => ({
      ...prev,
      pages: [...prev.pages, '']
    }))
  }

  const removePage = (index: number) => {
    setFormData(prev => ({
      ...prev,
      pages: prev.pages.filter((_, i) => i !== index)
    }))
  }

  const updatePage = (index: number, value: string) => {
    setFormData(prev => ({
      ...prev,
      pages: prev.pages.map((page, i) => i === index ? value : page)
    }))
  }

  if (!isOpen) return null

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 9999,
            padding: '0.5rem',
            width: '100%',
            boxSizing: 'border-box',
            overflowX: 'hidden'
    }}>
             <div style={{
               background: '#141823',
               border: '1px solid rgba(245, 210, 108, 0.2)',
               borderRadius: '0.75rem',
               maxWidth: '600px',
               width: '85%',
               maxHeight: '95vh',
               overflow: 'hidden',
               overflowX: 'hidden',
               display: 'flex',
               flexDirection: 'column',
               boxShadow: '0 6px 24px rgba(0, 0, 0, 0.35)',
               boxSizing: 'border-box'
             }}>
               <div style={{
                 flex: 1,
                 overflowY: 'auto',
                 padding: '0.5rem',
                 overflowX: 'hidden',
                 boxSizing: 'border-box'
               }}>
          {/* Header */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '0.5rem'
          }}>
            <h2 style={{
              fontSize: '1.125rem',
              fontWeight: 'bold',
              color: '#E8EDF2',
              margin: 0
            }}>Adicionar Biblioteca</h2>
            <button
              onClick={onClose}
              style={{
                padding: '0.5rem',
                color: '#94a3b8',
                backgroundColor: 'transparent',
                border: 'none',
                borderRadius: '0.5rem',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = '#F5D26C'
                e.currentTarget.style.backgroundColor = 'rgba(245, 210, 108, 0.1)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = '#94a3b8'
                e.currentTarget.style.backgroundColor = 'transparent'
              }}
            >
              <X style={{ height: '1.25rem', width: '1.25rem' }} />
            </button>
          </div>

          {/* Form */}
                 <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'clamp(0.5rem, 1.5vw, 1rem)' }}>
            
            {/* SEÇÃO 1: INFORMAÇÕES BÁSICAS */}
            <div style={{
              background: 'rgba(245, 210, 108, 0.05)',
              border: '1px solid rgba(245, 210, 108, 0.1)',
              borderRadius: '0.75rem',
              padding: '1.5rem'
            }}>
              <h3 style={{
                fontSize: '0.875rem',
                fontWeight: '600',
                color: '#F5D26C',
                margin: '0 0 1.5rem 0',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem'
              }}>
                📚 Informações Básicas
              </h3>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                {/* Nome */}
                <div>
                  <label style={{
                    display: 'block',
                    fontSize: '0.875rem',
                    fontWeight: '500',
                    color: '#E8EDF2',
                    marginBottom: '0.125rem'
                  }}>
                    Nome da Biblioteca *
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    style={{
                      width: '100%',
                      padding: '0.375rem',
                      background: '#0c0f14',
                      border: '1px solid rgba(245, 210, 108, 0.2)',
                      borderRadius: '0.5rem',
                      color: '#E8EDF2',
                      fontSize: '0.875rem'
                    }}
                    placeholder="Ex: Nike Dropshipping Brasil"
                    required
                  />
                </div>

                {/* URL */}
                <div>
                  <label style={{
                    display: 'block',
                    fontSize: '0.875rem',
                    fontWeight: '500',
                    color: '#E8EDF2',
                    marginBottom: '0.125rem'
                  }}>
                    URL *
                  </label>
                  <input
                    type="url"
                    value={formData.sourceValue}
                    onChange={(e) => setFormData(prev => ({ ...prev, sourceValue: e.target.value }))}
                    style={{
                      width: '100%',
                      padding: '0.375rem',
                      background: '#0c0f14',
                      border: '1px solid rgba(245, 210, 108, 0.2)',
                      borderRadius: '0.5rem',
                      color: '#E8EDF2',
                      fontSize: '0.875rem'
                    }}
                    placeholder="https://www.facebook.com/ads/library"
                    required
                  />
                </div>

              </div>
            </div>


            {/* SEÇÃO 2: PÁGINAS DE VENDAS */}
            <div style={{
              background: 'rgba(245, 210, 108, 0.05)',
              border: '1px solid rgba(245, 210, 108, 0.1)',
              borderRadius: '0.75rem',
              padding: '1.5rem'
            }}>
              <h3 style={{
                fontSize: '0.875rem',
                fontWeight: '600',
                color: '#F5D26C',
                margin: '0 0 1.5rem 0',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem'
              }}>
                🔗 Páginas de Vendas
              </h3>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {formData.pages.map((page, index) => (
                  <div key={index} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    <input
                      type="url"
                      value={page}
                      onChange={(e) => updatePage(index, e.target.value)}
                      style={{
                        flex: 1,
                        padding: '0.375rem',
                        background: '#0c0f14',
                        border: '1px solid rgba(245, 210, 108, 0.2)',
                        borderRadius: '0.5rem',
                        color: '#E8EDF2',
                        fontSize: '0.875rem'
                      }}
                      placeholder="https://exemplo.com/produto"
                    />
                    {formData.pages.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removePage(index)}
                        style={{
                          padding: '0.375rem',
                          color: '#EF4444',
                          backgroundColor: 'transparent',
                          border: 'none',
                          borderRadius: '0.5rem',
                          cursor: 'pointer',
                          transition: 'all 0.2s'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.1)'
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = 'transparent'
                        }}
                      >
                        <Trash2 style={{ height: '1rem', width: '1rem' }} />
                      </button>
                    )}
                  </div>
                ))}
                <button
                  type="button"
                  onClick={addPage}
                  style={{
                    backgroundColor: 'rgba(245, 210, 108, 0.1)',
                    color: '#F5D26C',
                    padding: '0.75rem 1rem',
                    borderRadius: '0.5rem',
                    fontWeight: '500',
                    border: '1px solid rgba(245, 210, 108, 0.2)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    transition: 'all 0.2s'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = 'rgba(245, 210, 108, 0.2)'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'rgba(245, 210, 108, 0.1)'
                  }}
                >
                  <Plus style={{ height: '1rem', width: '1rem' }} />
                  Adicionar Página
                </button>
              </div>
            </div>
            {/* SEÇÃO 3: FILTROS AVANÇADOS */}
            <div style={{
              background: 'rgba(245, 210, 108, 0.05)',
              border: '1px solid rgba(245, 210, 108, 0.1)',
              borderRadius: '0.75rem',
              padding: '1.5rem'
            }}>
              <h3 style={{
                fontSize: '0.875rem',
                fontWeight: '600',
                color: '#F5D26C',
                margin: '0 0 1.5rem 0',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem'
              }}>
                🎯 Filtros Avançados
              </h3>
              
                     <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 'clamp(0.5rem, 2vw, 1rem)' }}>
                <ElegantFilter
                  key={`nichos-${refreshKey}`}
                  label="Nicho"
                  emoji="❤️"
                  type="nichos"
                  value={formData.nichos}
                  onChange={(value) => setFormData(prev => ({ ...prev, nichos: value }))}
                  allowAdd={true}
                  onOptionsChange={handleOptionsChange}
                />
                
                <ElegantFilter
                  key={`estrategias-${refreshKey}`}
                  label="Estratégia"
                  emoji="📈"
                  type="estrategias"
                  value={formData.estrategias}
                  onChange={(value) => setFormData(prev => ({ ...prev, estrategias: value }))}
                  allowAdd={true}
                  onOptionsChange={handleOptionsChange}
                />
                
                <ElegantFilter
                  key={`produtos-${refreshKey}`}
                  label="Produto"
                  emoji="📦"
                  type="produtos"
                  value={formData.produtos}
                  onChange={(value) => setFormData(prev => ({ ...prev, produtos: value }))}
                  allowAdd={true}
                  onOptionsChange={handleOptionsChange}
                />
                
                <ElegantFilter
                  key={`idiomas-${refreshKey}`}
                  label="Idioma (Filtro)"
                  emoji="🌐"
                  type="idiomas"
                  value={formData.idiomas}
                  onChange={(value) => setFormData(prev => ({ ...prev, idiomas: value }))}
                  allowAdd={true}
                  onOptionsChange={handleOptionsChange}
                />
                
                <ElegantFilter
                  key={`paises-${refreshKey}`}
                  label="País (Filtro)"
                  emoji="🌍"
                  type="paises"
                  value={formData.paises}
                  onChange={(value) => setFormData(prev => ({ ...prev, paises: value }))}
                  allowAdd={true}
                  onOptionsChange={handleOptionsChange}
                />
              </div>
            </div>

            {/* SEÇÃO 4: OBSERVAÇÕES */}
            <div style={{
              background: 'rgba(245, 210, 108, 0.05)',
              border: '1px solid rgba(245, 210, 108, 0.1)',
              borderRadius: '0.75rem',
              padding: '1.5rem'
            }}>
              <h3 style={{
                fontSize: '0.875rem',
                fontWeight: '600',
                color: '#F5D26C',
                margin: '0 0 1.5rem 0',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem'
              }}>
                📝 Observações
              </h3>
              
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                style={{
                  width: '100%',
                  padding: '0.5rem',
                  background: '#0c0f14',
                  border: '1px solid rgba(245, 210, 108, 0.2)',
                  borderRadius: '0.5rem',
                  color: '#E8EDF2',
                  fontSize: '0.875rem',
                  resize: 'vertical',
                  minHeight: '80px'
                }}
                rows={2}
                placeholder="Anotações sobre a biblioteca..."
              />
            </div>

            {/* SEÇÃO 5: ORGANIZAÇÃO */}
            <div style={{
              background: 'rgba(245, 210, 108, 0.05)',
              border: '1px solid rgba(245, 210, 108, 0.1)',
              borderRadius: '0.75rem',
              padding: '1.5rem'
            }}>
              <h3 style={{
                fontSize: '0.875rem',
                fontWeight: '600',
                color: '#F5D26C',
                margin: '0 0 1.5rem 0',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem'
              }}>
                📁 Organização
              </h3>
              
              {/* Pasta */}
              <div>
                <label style={{
                  display: 'block',
                  fontSize: '0.875rem',
                  fontWeight: '500',
                  color: '#E8EDF2',
                  marginBottom: '0.5rem'
                }}>
                  Pasta
                </label>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  <select
                    value={formData.folderId}
                    onChange={(e) => setFormData(prev => ({ ...prev, folderId: e.target.value }))}
                    style={{
                      flex: 1,
                      padding: '0.375rem',
                      background: '#0c0f14',
                      border: '1px solid rgba(245, 210, 108, 0.2)',
                      borderRadius: '0.5rem',
                      color: '#E8EDF2',
                      fontSize: '0.875rem'
                    }}
                  >
                    <option value="">Sem pasta</option>
                    {folders.map((folder: any) => (
                      <option key={folder.id} value={folder.id}>
                        {folder.name}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => setShowCreateFolder(!showCreateFolder)}
                    style={{
                      padding: '0.375rem',
                      backgroundColor: 'rgba(245, 210, 108, 0.1)',
                      color: '#F5D26C',
                      border: '1px solid rgba(245, 210, 108, 0.2)',
                      borderRadius: '0.5rem',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      transition: 'all 0.2s',
                      minWidth: '2.5rem'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = 'rgba(245, 210, 108, 0.2)'
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = 'rgba(245, 210, 108, 0.1)'
                    }}
                  >
                    <Plus style={{ height: '1rem', width: '1rem' }} />
                  </button>
                </div>

                {/* Campo para criar nova pasta */}
                {showCreateFolder && (
                  <div style={{
                    marginTop: '0.75rem',
                    padding: '0.375rem',
                    background: 'rgba(245, 210, 108, 0.05)',
                    border: '1px solid rgba(245, 210, 108, 0.1)',
                    borderRadius: '0.5rem'
                  }}>
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                      <input
                        type="text"
                        value={newFolderName}
                        onChange={(e) => setNewFolderName(e.target.value)}
                        placeholder="Nome da nova pasta..."
                        style={{
                          flex: 1,
                          padding: '0.375rem',
                          background: '#0c0f14',
                          border: '1px solid rgba(245, 210, 108, 0.2)',
                          borderRadius: '0.375rem',
                          color: '#E8EDF2',
                          fontSize: '0.875rem'
                        }}
                        onKeyPress={(e) => {
                          if (e.key === 'Enter') {
                            handleCreateFolder()
                          }
                        }}
                        autoFocus
                      />
                      <button
                        type="button"
                        onClick={handleCreateFolder}
                        disabled={creatingFolder || !newFolderName.trim()}
                        style={{
                          padding: '0.375rem',
                          backgroundColor: '#F5D26C',
                          color: '#0c0f14',
                          border: 'none',
                          borderRadius: '0.375rem',
                          cursor: creatingFolder || !newFolderName.trim() ? 'not-allowed' : 'pointer',
                          opacity: creatingFolder || !newFolderName.trim() ? 0.5 : 1,
                          transition: 'all 0.2s',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          minWidth: '2.5rem'
                        }}
                        onMouseEnter={(e) => {
                          if (!creatingFolder && newFolderName.trim()) {
                            e.currentTarget.style.backgroundColor = '#e0c05c'
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (!creatingFolder && newFolderName.trim()) {
                            e.currentTarget.style.backgroundColor = '#F5D26C'
                          }
                        }}
                      >
                        {creatingFolder ? (
                          <div style={{
                            width: '1rem',
                            height: '1rem',
                            border: '2px solid #0c0f14',
                            borderTop: '2px solid transparent',
                            borderRadius: '50%',
                            animation: 'spin 1s linear infinite'
                          }} />
                        ) : (
                          <Plus style={{ height: '0.875rem', width: '0.875rem' }} />
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setShowCreateFolder(false)
                          setNewFolderName('')
                        }}
                        style={{
                          padding: '0.375rem',
                          backgroundColor: 'rgba(239, 68, 68, 0.1)',
                          color: '#EF4444',
                          border: 'none',
                          borderRadius: '0.375rem',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          transition: 'all 0.2s',
                          minWidth: '2.5rem'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.2)'
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.1)'
                        }}
                      >
                        <X style={{ height: '0.875rem', width: '0.875rem' }} />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

                   {/* Actions */}
                   <div style={{
                     display: 'flex',
                     gap: 'clamp(0.5rem, 2vw, 1rem)',
                     paddingTop: '0.5rem',
                     borderTop: '1px solid rgba(245, 210, 108, 0.1)',
                     marginTop: '0.75rem',
                     position: 'sticky',
                     bottom: 0,
                     background: '#141823',
                     flexWrap: 'wrap'
                   }}>
              <button
                type="submit"
                disabled={loading || !formData.name.trim() || !formData.sourceValue.trim()}
                style={{
                  flex: '1 1 200px',
                  backgroundColor: '#F5D26C',
                  color: '#0c0f14',
                  padding: '0.5rem 0.75rem',
                  borderRadius: '0.5rem',
                  fontWeight: '600',
                  border: 'none',
                  cursor: loading || !formData.name.trim() || !formData.sourceValue.trim() ? 'not-allowed' : 'pointer',
                  opacity: loading || !formData.name.trim() || !formData.sourceValue.trim() ? 0.5 : 1,
                  transition: 'all 0.2s',
                  fontSize: 'clamp(0.875rem, 2.5vw, 1rem)',
                  minWidth: '120px'
                }}
                onMouseEnter={(e) => {
                  if (!loading && formData.name.trim() && formData.sourceValue.trim()) {
                    e.currentTarget.style.backgroundColor = '#e0c05c'
                  }
                }}
                onMouseLeave={(e) => {
                  if (!loading && formData.name.trim() && formData.sourceValue.trim()) {
                    e.currentTarget.style.backgroundColor = '#F5D26C'
                  }
                }}
              >
                {loading ? 'Criando...' : 'Criar Biblioteca'}
              </button>
              <button
                type="button"
                onClick={onClose}
                style={{
                  backgroundColor: 'rgba(245, 210, 108, 0.1)',
                  color: '#F5D26C',
                  padding: '0.5rem 0.75rem',
                  borderRadius: '0.5rem',
                  fontWeight: '500',
                  border: '1px solid rgba(245, 210, 108, 0.2)',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  fontSize: 'clamp(0.875rem, 2.5vw, 1rem)',
                  minWidth: '120px',
                  flex: '1 1 200px'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = 'rgba(245, 210, 108, 0.2)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'rgba(245, 210, 108, 0.1)'
                }}
              >
                Cancelar
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
