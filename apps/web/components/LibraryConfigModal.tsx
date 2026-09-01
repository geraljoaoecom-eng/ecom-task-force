'use client'

import { useState, useEffect } from 'react'
import { X, Save, RotateCcw } from 'lucide-react'
import { librariesApi, filterOptionsApi } from '@/lib/api'

interface LibraryConfigModalProps {
  isOpen: boolean
  onClose: () => void
  library: any
  onUpdate: () => void
}

export function LibraryConfigModal({ isOpen, onClose, library, onUpdate }: LibraryConfigModalProps) {
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    nota: '',
    sourceValue: '',
    notes: '',
    folderId: '',
    nichos: '',
    estrategias: '',
    produtos: '',
    idiomas: '',
    paises: '',
    status: ''
  })
  const [filterOptions, setFilterOptions] = useState({
    nichos: [],
    estrategias: [],
    produtos: [],
    idiomas: [],
    paises: []
  })

  useEffect(() => {
    if (isOpen && library) {
      setFormData({
        name: library.name || '',
        nota: library.nota || '',
        sourceValue: library.sourceValue || '',
        notes: library.notes || '',
        folderId: library.folderId || '',
        nichos: library.nichos || '',
        estrategias: library.estrategias || '',
        produtos: library.produtos || '',
        idiomas: library.idiomas || '',
        paises: library.paises || '',
        status: library.status || ''
      })
      loadFilterOptions()
    }
  }, [isOpen, library])

  const loadFilterOptions = async () => {
    try {
      const [nichos, estrategias, produtos, idiomas, paises] = await Promise.all([
        filterOptionsApi.getByType('nichos'),
        filterOptionsApi.getByType('estrategias'),
        filterOptionsApi.getByType('produtos'),
        filterOptionsApi.getByType('idiomas'),
        filterOptionsApi.getByType('paises')
      ])
      
      // Normalize data: handle both strings and objects with {value, label}
      const normalizeArray = (arr: any[]) => {
        return (arr || []).map((option: any) => {
          if (typeof option === 'string') return option
          if (option && typeof option === 'object' && option.value) return option.value
          if (option && typeof option === 'object' && option.label) return option.label
          return String(option)
        })
      }
      
      setFilterOptions({
        nichos: normalizeArray(nichos || []),
        estrategias: normalizeArray(estrategias || []),
        produtos: normalizeArray(produtos || []),
        idiomas: normalizeArray(idiomas || []),
        paises: normalizeArray(paises || [])
      })
    } catch (error) {
      console.error('Erro ao carregar opções de filtro:', error)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      await librariesApi.update(library.id, formData)
      onUpdate()
      onClose()
    } catch (error) {
      console.error('Erro ao atualizar biblioteca:', error)
      alert('Erro ao atualizar biblioteca. Verifique o console para mais detalhes.')
    } finally {
      setLoading(false)
    }
  }

  const handleReset = () => {
    if (library) {
      setFormData({
        name: library.name || '',
        nota: library.nota || '',
        sourceValue: library.sourceValue || '',
        notes: library.notes || '',
        folderId: library.folderId || '',
        nichos: library.nichos || '',
        estrategias: library.estrategias || '',
        produtos: library.produtos || '',
        idiomas: library.idiomas || '',
        paises: library.paises || '',
        status: library.status || ''
      })
    }
  }

  if (!isOpen) return null

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.7)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 10000,
      padding: '1rem'
    }}>
      <div style={{
        background: '#141823',
        border: '1px solid rgba(245, 210, 108, 0.3)',
        borderRadius: '0.75rem',
        maxWidth: '90vw',
        width: '100%',
        maxHeight: '90vh',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 10px 40px rgba(0, 0, 0, 0.5)',
        boxSizing: 'border-box'
      }}>
        <div style={{
          flex: 1,
          overflowY: 'auto',
          padding: 'clamp(1rem, 3vw, 1.5rem)',
          boxSizing: 'border-box'
        }}>
          {/* Header */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '1.5rem',
            paddingBottom: '1rem',
            borderBottom: '1px solid rgba(245, 210, 108, 0.2)'
          }}>
            <div>
              <h2 style={{
                fontSize: '1.5rem',
                fontWeight: 'bold',
                color: '#F5D26C',
                margin: 0,
                marginBottom: '0.25rem'
              }}>
                Configurações da Biblioteca
              </h2>
              <p style={{
                fontSize: '0.875rem',
                color: '#94a3b8',
                margin: 0
              }}>
                Edite as configurações de: <strong style={{ color: '#E8EDF2' }}>{library?.name}</strong>
              </p>
            </div>
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
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'clamp(1rem, 3vw, 1.5rem)' }}>
            
            {/* SEÇÃO 1: INFORMAÇÕES BÁSICAS */}
            <div style={{
              background: 'rgba(245, 210, 108, 0.05)',
              border: '1px solid rgba(245, 210, 108, 0.1)',
              borderRadius: '0.75rem',
              padding: '1.5rem'
            }}>
              <h3 style={{
                fontSize: '1.125rem',
                fontWeight: '600',
                color: '#F5D26C',
                margin: '0 0 1.5rem 0',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem'
              }}>
                📚 Informações Básicas
              </h3>
              
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1rem' }}>
                {/* Nome */}
                <div>
                  <label style={{
                    display: 'block',
                    fontSize: '0.875rem',
                    fontWeight: '500',
                    color: '#E8EDF2',
                    marginBottom: '0.5rem'
                  }}>
                    Nome da Biblioteca
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      background: '#0c0f14',
                      border: '1px solid rgba(245, 210, 108, 0.2)',
                      borderRadius: '0.5rem',
                      color: '#E8EDF2',
                      fontSize: '0.875rem'
                    }}
                  />
                </div>

                {/* URL */}
                <div style={{ gridColumn: '1 / -1' }}>
                  <label style={{
                    display: 'block',
                    fontSize: '0.875rem',
                    fontWeight: '500',
                    color: '#E8EDF2',
                    marginBottom: '0.5rem'
                  }}>
                    URL da Biblioteca
                  </label>
                  <input
                    type="url"
                    value={formData.sourceValue}
                    onChange={(e) => setFormData(prev => ({ ...prev, sourceValue: e.target.value }))}
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      background: '#0c0f14',
                      border: '1px solid rgba(245, 210, 108, 0.2)',
                      borderRadius: '0.5rem',
                      color: '#E8EDF2',
                      fontSize: '0.875rem'
                    }}
                  />
                </div>
              </div>
            </div>

            {/* SEÇÃO 2: CONFIGURAÇÕES AVANÇADAS */}
            <div style={{
              background: 'rgba(245, 210, 108, 0.05)',
              border: '1px solid rgba(245, 210, 108, 0.1)',
              borderRadius: '0.75rem',
              padding: '1.5rem'
            }}>
              <h3 style={{
                fontSize: '1.125rem',
                fontWeight: '600',
                color: '#F5D26C',
                margin: '0 0 1.5rem 0',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem'
              }}>
                ⚙️ Configurações Avançadas
              </h3>
              
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                {/* Status */}
                <div>
                  <label style={{
                    display: 'block',
                    fontSize: '0.875rem',
                    fontWeight: '500',
                    color: '#E8EDF2',
                    marginBottom: '0.5rem'
                  }}>
                    Status
                  </label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData(prev => ({ ...prev, status: e.target.value }))}
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      background: '#0c0f14',
                      border: '1px solid rgba(245, 210, 108, 0.2)',
                      borderRadius: '0.5rem',
                      color: '#E8EDF2',
                      fontSize: '0.875rem'
                    }}
                  >
                    <option value="">Selecionar Status</option>
                    <option value="ativo">Ativo</option>
                    <option value="inativo">Inativo</option>
                    <option value="pausado">Pausado</option>
                  </select>
                </div>

                {/* Nicho */}
                <div>
                  <label style={{
                    display: 'block',
                    fontSize: '0.875rem',
                    fontWeight: '500',
                    color: '#E8EDF2',
                    marginBottom: '0.5rem'
                  }}>
                    Nicho
                  </label>
                  <select
                    value={formData.nichos}
                    onChange={(e) => setFormData(prev => ({ ...prev, nichos: e.target.value }))}
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      background: '#0c0f14',
                      border: '1px solid rgba(245, 210, 108, 0.2)',
                      borderRadius: '0.5rem',
                      color: '#E8EDF2',
                      fontSize: '0.875rem'
                    }}
                  >
                    <option value="">Selecionar Nicho</option>
                    {filterOptions.nichos.map((nicho: string) => (
                      <option key={nicho} value={nicho}>{nicho}</option>
                    ))}
                  </select>
                </div>

                {/* Estratégia */}
                <div>
                  <label style={{
                    display: 'block',
                    fontSize: '0.875rem',
                    fontWeight: '500',
                    color: '#E8EDF2',
                    marginBottom: '0.5rem'
                  }}>
                    Estratégia
                  </label>
                  <select
                    value={formData.estrategias}
                    onChange={(e) => setFormData(prev => ({ ...prev, estrategias: e.target.value }))}
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      background: '#0c0f14',
                      border: '1px solid rgba(245, 210, 108, 0.2)',
                      borderRadius: '0.5rem',
                      color: '#E8EDF2',
                      fontSize: '0.875rem'
                    }}
                  >
                    <option value="">Selecionar Estratégia</option>
                    {filterOptions.estrategias.map((estrategia: string) => (
                      <option key={estrategia} value={estrategia}>{estrategia}</option>
                    ))}
                  </select>
                </div>

                {/* Produto */}
                <div>
                  <label style={{
                    display: 'block',
                    fontSize: '0.875rem',
                    fontWeight: '500',
                    color: '#E8EDF2',
                    marginBottom: '0.5rem'
                  }}>
                    Produto
                  </label>
                  <select
                    value={formData.produtos}
                    onChange={(e) => setFormData(prev => ({ ...prev, produtos: e.target.value }))}
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      background: '#0c0f14',
                      border: '1px solid rgba(245, 210, 108, 0.2)',
                      borderRadius: '0.5rem',
                      color: '#E8EDF2',
                      fontSize: '0.875rem'
                    }}
                  >
                    <option value="">Selecionar Produto</option>
                    {filterOptions.produtos.map((produto: string) => (
                      <option key={produto} value={produto}>{produto}</option>
                    ))}
                  </select>
                </div>

                {/* Idioma */}
                <div>
                  <label style={{
                    display: 'block',
                    fontSize: '0.875rem',
                    fontWeight: '500',
                    color: '#E8EDF2',
                    marginBottom: '0.5rem'
                  }}>
                    Idioma
                  </label>
                  <select
                    value={formData.idiomas}
                    onChange={(e) => setFormData(prev => ({ ...prev, idiomas: e.target.value }))}
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      background: '#0c0f14',
                      border: '1px solid rgba(245, 210, 108, 0.2)',
                      borderRadius: '0.5rem',
                      color: '#E8EDF2',
                      fontSize: '0.875rem'
                    }}
                  >
                    <option value="">Selecionar Idioma</option>
                    {filterOptions.idiomas.map((idioma: string) => (
                      <option key={idioma} value={idioma}>{idioma}</option>
                    ))}
                  </select>
                </div>

                {/* País */}
                <div>
                  <label style={{
                    display: 'block',
                    fontSize: '0.875rem',
                    fontWeight: '500',
                    color: '#E8EDF2',
                    marginBottom: '0.5rem'
                  }}>
                    País
                  </label>
                  <select
                    value={formData.paises}
                    onChange={(e) => setFormData(prev => ({ ...prev, paises: e.target.value }))}
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      background: '#0c0f14',
                      border: '1px solid rgba(245, 210, 108, 0.2)',
                      borderRadius: '0.5rem',
                      color: '#E8EDF2',
                      fontSize: '0.875rem'
                    }}
                  >
                    <option value="">Selecionar País</option>
                    {filterOptions.paises.map((pais: string) => (
                      <option key={pais} value={pais}>{pais}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* SEÇÃO 3: OBSERVAÇÕES */}
            <div style={{
              background: 'rgba(245, 210, 108, 0.05)',
              border: '1px solid rgba(245, 210, 108, 0.1)',
              borderRadius: '0.75rem',
              padding: '1.5rem'
            }}>
              <h3 style={{
                fontSize: '1.125rem',
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
                  padding: '0.75rem',
                  background: '#0c0f14',
                  border: '1px solid rgba(245, 210, 108, 0.2)',
                  borderRadius: '0.5rem',
                  color: '#E8EDF2',
                  fontSize: '0.875rem',
                  resize: 'vertical',
                  minHeight: '100px'
                }}
                rows={4}
                placeholder="Adicione observações sobre esta biblioteca..."
              />
            </div>

            {/* Actions */}
            <div style={{
              display: 'flex',
              gap: 'clamp(0.5rem, 2vw, 1rem)',
              paddingTop: 'clamp(1rem, 3vw, 1.5rem)',
              borderTop: '1px solid rgba(245, 210, 108, 0.1)',
              marginTop: 'clamp(1rem, 3vw, 1.5rem)',
              position: 'sticky',
              bottom: 0,
              background: '#141823',
              flexWrap: 'wrap'
            }}>
              <button
                type="submit"
                disabled={loading}
                style={{
                  flex: '1 1 200px',
                  backgroundColor: '#F5D26C',
                  color: '#0c0f14',
                  padding: 'clamp(0.5rem, 2vw, 0.75rem) clamp(1rem, 3vw, 1.5rem)',
                  borderRadius: '0.5rem',
                  fontWeight: '600',
                  border: 'none',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  opacity: loading ? 0.5 : 1,
                  transition: 'all 0.2s',
                  fontSize: 'clamp(0.875rem, 2.5vw, 1rem)',
                  minWidth: '120px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.5rem'
                }}
                onMouseEnter={(e) => {
                  if (!loading) {
                    e.currentTarget.style.backgroundColor = '#e0c05c'
                  }
                }}
                onMouseLeave={(e) => {
                  if (!loading) {
                    e.currentTarget.style.backgroundColor = '#F5D26C'
                  }
                }}
              >
                <Save style={{ height: 'clamp(1rem, 3vw, 1.25rem)', width: 'clamp(1rem, 3vw, 1.25rem)' }} />
                {loading ? 'Salvando...' : 'Salvar Alterações'}
              </button>
              
              <button
                type="button"
                onClick={handleReset}
                style={{
                  backgroundColor: 'rgba(245, 210, 108, 0.1)',
                  color: '#F5D26C',
                  padding: 'clamp(0.5rem, 2vw, 0.75rem) clamp(1rem, 3vw, 1.5rem)',
                  borderRadius: '0.5rem',
                  fontWeight: '500',
                  border: '1px solid rgba(245, 210, 108, 0.2)',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  fontSize: 'clamp(0.875rem, 2.5vw, 1rem)',
                  minWidth: '120px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.5rem',
                  flex: '1 1 200px'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = 'rgba(245, 210, 108, 0.2)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'rgba(245, 210, 108, 0.1)'
                }}
              >
                <RotateCcw style={{ height: 'clamp(1rem, 3vw, 1.25rem)', width: 'clamp(1rem, 3vw, 1.25rem)' }} />
                Restaurar
              </button>
              
              <button
                type="button"
                onClick={onClose}
                style={{
                  backgroundColor: 'rgba(239, 68, 68, 0.1)',
                  color: '#EF4444',
                  padding: 'clamp(0.5rem, 2vw, 0.75rem) clamp(1rem, 3vw, 1.5rem)',
                  borderRadius: '0.5rem',
                  fontWeight: '500',
                  border: '1px solid rgba(239, 68, 68, 0.2)',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  fontSize: 'clamp(0.875rem, 2.5vw, 1rem)',
                  minWidth: '120px',
                  flex: '1 1 200px'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.2)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.1)'
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
