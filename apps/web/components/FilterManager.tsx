'use client'

import { useState, useEffect } from 'react'
import { Plus, X, Settings, Save, Trash2, RotateCcw } from 'lucide-react'
import { filterOptionsApi } from '@/lib/api'

interface FilterManagerProps {
  isOpen: boolean
  onClose: () => void
  onFiltersChange: (filters: FilterType[]) => void
  currentFilters: FilterType[]
}

interface FilterType {
  id: string
  name: string
  type: string
  emoji: string
  enabled: boolean
}

const DEFAULT_FILTERS: FilterType[] = [
  { id: 'status', name: 'Status', type: 'status', emoji: '📊', enabled: true },
  { id: 'nichos', name: 'Nicho', type: 'nichos', emoji: '❤️', enabled: true },
  { id: 'estrategias', name: 'Estratégia', type: 'estrategias', emoji: '📈', enabled: true },
  { id: 'produtos', name: 'Produto', type: 'produtos', emoji: '📦', enabled: true },
  { id: 'idiomas', name: 'Idioma', type: 'idiomas', emoji: '🌐', enabled: true },
  { id: 'paises', name: 'País', type: 'paises', emoji: '🌍', enabled: true }
]

export function FilterManager({ isOpen, onClose, onFiltersChange, currentFilters }: FilterManagerProps) {
  const [filters, setFilters] = useState<FilterType[]>(currentFilters)
  const [newFilterName, setNewFilterName] = useState('')
  const [newFilterType, setNewFilterType] = useState('')
  const [newFilterEmoji, setNewFilterEmoji] = useState('')
  const [showAddForm, setShowAddForm] = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (isOpen) {
      setFilters(currentFilters)
    }
  }, [isOpen, currentFilters])

  const handleToggleFilter = (filterId: string) => {
    setFilters(prev => prev.map(filter => 
      filter.id === filterId ? { ...filter, enabled: !filter.enabled } : filter
    ))
  }

  const handleRemoveFilter = (filterId: string) => {
    setFilters(prev => prev.filter(filter => filter.id !== filterId))
  }

  const handleAddFilter = async () => {
    if (!newFilterName.trim() || !newFilterType.trim()) return

    const newFilter: FilterType = {
      id: newFilterType.toLowerCase(),
      name: newFilterName.trim(),
      type: newFilterType.toLowerCase(),
      emoji: newFilterEmoji || '🏷️',
      enabled: true
    }

    setFilters(prev => [...prev, newFilter])
    setNewFilterName('')
    setNewFilterType('')
    setNewFilterEmoji('')
    setShowAddForm(false)
  }

  const handleSave = () => {
    onFiltersChange(filters)
    onClose()
  }

  const handleReset = () => {
    setFilters(DEFAULT_FILTERS)
  }

  if (!isOpen) return null

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.8)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000
    }}>
      <div style={{
        backgroundColor: '#1a1a1a',
        borderRadius: '1rem',
        padding: '2rem',
        width: '90%',
        maxWidth: '600px',
        maxHeight: '80vh',
        overflowY: 'auto',
        border: '1px solid #333'
      }}>
        {/* Header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '1.5rem'
        }}>
          <h2 style={{
            fontSize: '1.5rem',
            fontWeight: '600',
            color: '#fff',
            margin: 0,
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem'
          }}>
            <Settings size={24} />
            Gerenciar Filtros
          </h2>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: '#666',
              cursor: 'pointer',
              padding: '0.5rem',
              borderRadius: '0.5rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Filtros existentes */}
        <div style={{ marginBottom: '1.5rem' }}>
          <h3 style={{
            fontSize: '1.1rem',
            fontWeight: '600',
            color: '#fff',
            marginBottom: '1rem'
          }}>
            Filtros Disponíveis
          </h3>
          
          <div style={{
            display: 'grid',
            gap: '0.75rem'
          }}>
            {filters.map(filter => (
              <div
                key={filter.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '0.75rem',
                  backgroundColor: filter.enabled ? 'rgba(34, 197, 94, 0.1)' : 'rgba(55, 65, 81, 0.5)',
                  border: `1px solid ${filter.enabled ? 'rgba(34, 197, 94, 0.3)' : 'rgba(55, 65, 81, 0.3)'}`,
                  borderRadius: '0.5rem'
                }}
              >
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem'
                }}>
                  <span style={{ fontSize: '1.2rem' }}>{filter.emoji}</span>
                  <span style={{
                    color: filter.enabled ? '#fff' : '#666',
                    fontWeight: '500'
                  }}>
                    {filter.name}
                  </span>
                  <span style={{
                    color: '#666',
                    fontSize: '0.875rem'
                  }}>
                    ({filter.type})
                  </span>
                </div>
                
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem'
                }}>
                  <button
                    onClick={() => handleToggleFilter(filter.id)}
                    style={{
                      background: filter.enabled ? '#22c55e' : '#374151',
                      color: '#fff',
                      border: 'none',
                      borderRadius: '0.375rem',
                      padding: '0.375rem 0.75rem',
                      fontSize: '0.875rem',
                      fontWeight: '500',
                      cursor: 'pointer',
                      transition: 'all 0.2s'
                    }}
                  >
                    {filter.enabled ? 'Ativo' : 'Inativo'}
                  </button>
                  
                  {!DEFAULT_FILTERS.some(df => df.id === filter.id) && (
                    <button
                      onClick={() => handleRemoveFilter(filter.id)}
                      style={{
                        background: '#ef4444',
                        color: '#fff',
                        border: 'none',
                        borderRadius: '0.375rem',
                        padding: '0.375rem',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Adicionar novo filtro */}
        <div style={{ marginBottom: '1.5rem' }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '1rem'
          }}>
            <h3 style={{
              fontSize: '1.1rem',
              fontWeight: '600',
              color: '#fff',
              margin: 0
            }}>
              Adicionar Novo Filtro
            </h3>
            <button
              onClick={() => setShowAddForm(!showAddForm)}
              style={{
                background: '#3b82f6',
                color: '#fff',
                border: 'none',
                borderRadius: '0.375rem',
                padding: '0.5rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem'
              }}
            >
              <Plus size={16} />
              Novo Filtro
            </button>
          </div>

          {showAddForm && (
            <div style={{
              padding: '1rem',
              backgroundColor: 'rgba(55, 65, 81, 0.3)',
              borderRadius: '0.5rem',
              border: '1px solid rgba(55, 65, 81, 0.5)'
            }}>
              <div style={{
                display: 'grid',
                gap: '0.75rem',
                marginBottom: '1rem'
              }}>
                <div>
                  <label style={{
                    display: 'block',
                    fontSize: '0.875rem',
                    fontWeight: '500',
                    color: '#fff',
                    marginBottom: '0.25rem'
                  }}>
                    Nome do Filtro
                  </label>
                  <input
                    type="text"
                    value={newFilterName}
                    onChange={(e) => setNewFilterName(e.target.value)}
                    placeholder="Ex: Categoria, Tipo, etc."
                    style={{
                      width: '100%',
                      padding: '0.5rem',
                      backgroundColor: '#374151',
                      border: '1px solid #4b5563',
                      borderRadius: '0.375rem',
                      color: '#fff',
                      fontSize: '0.875rem'
                    }}
                  />
                </div>
                
                <div>
                  <label style={{
                    display: 'block',
                    fontSize: '0.875rem',
                    fontWeight: '500',
                    color: '#fff',
                    marginBottom: '0.25rem'
                  }}>
                    Tipo (ID)
                  </label>
                  <input
                    type="text"
                    value={newFilterType}
                    onChange={(e) => setNewFilterType(e.target.value.toLowerCase())}
                    placeholder="Ex: categoria, tipo, etc."
                    style={{
                      width: '100%',
                      padding: '0.5rem',
                      backgroundColor: '#374151',
                      border: '1px solid #4b5563',
                      borderRadius: '0.375rem',
                      color: '#fff',
                      fontSize: '0.875rem'
                    }}
                  />
                </div>
                
                <div>
                  <label style={{
                    display: 'block',
                    fontSize: '0.875rem',
                    fontWeight: '500',
                    color: '#fff',
                    marginBottom: '0.25rem'
                  }}>
                    Emoji
                  </label>
                  <input
                    type="text"
                    value={newFilterEmoji}
                    onChange={(e) => setNewFilterEmoji(e.target.value)}
                    placeholder="Ex: 🏷️, 📋, etc."
                    style={{
                      width: '100%',
                      padding: '0.5rem',
                      backgroundColor: '#374151',
                      border: '1px solid #4b5563',
                      borderRadius: '0.375rem',
                      color: '#fff',
                      fontSize: '0.875rem'
                    }}
                  />
                </div>
              </div>
              
              <div style={{
                display: 'flex',
                gap: '0.5rem',
                justifyContent: 'flex-end'
              }}>
                <button
                  onClick={() => setShowAddForm(false)}
                  style={{
                    background: '#6b7280',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '0.375rem',
                    padding: '0.5rem 1rem',
                    cursor: 'pointer'
                  }}
                >
                  Cancelar
                </button>
                <button
                  onClick={handleAddFilter}
                  disabled={!newFilterName.trim() || !newFilterType.trim()}
                  style={{
                    background: '#22c55e',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '0.375rem',
                    padding: '0.5rem 1rem',
                    cursor: 'pointer',
                    opacity: (!newFilterName.trim() || !newFilterType.trim()) ? 0.5 : 1
                  }}
                >
                  Adicionar
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Botões de ação */}
        <div style={{
          display: 'flex',
          gap: '0.75rem',
          justifyContent: 'flex-end'
        }}>
          <button
            onClick={handleReset}
            style={{
              background: '#6b7280',
              color: '#fff',
              border: 'none',
              borderRadius: '0.375rem',
              padding: '0.75rem 1.5rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}
          >
            <RotateCcw size={16} />
            Resetar
          </button>
          
          <button
            onClick={handleSave}
            style={{
              background: '#3b82f6',
              color: '#fff',
              border: 'none',
              borderRadius: '0.375rem',
              padding: '0.75rem 1.5rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}
          >
            <Save size={16} />
            Salvar
          </button>
        </div>
      </div>
    </div>
  )
}
