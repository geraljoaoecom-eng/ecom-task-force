'use client'

import { useState, useEffect } from 'react'
import { X, Plus, ChevronDown } from 'lucide-react'
import { filterOptionsApi } from '@/lib/api'

interface ElegantFilterProps {
  label: string
  emoji: string
  type: string
  value: string | string[]
  onChange: (value: string) => void
  allowAdd?: boolean
  onOptionsChange?: (type: string, newOptions: string[]) => void
}

export function ElegantFilter({ 
  label, 
  emoji, 
  type, 
  value, 
  onChange, 
  allowAdd = false,
  onOptionsChange 
}: ElegantFilterProps) {
  const [options, setOptions] = useState<string[]>([])
  const [isOpen, setIsOpen] = useState(false)
  const [newOption, setNewOption] = useState('')
  const [showAddInput, setShowAddInput] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadOptions()
  }, [type])

  const loadOptions = async () => {
    try {
      setLoading(true)
      const data = await filterOptionsApi.getByType(type)
      // Normalize data: handle both strings and objects with {value, label}
      const normalizedOptions = (data || []).map((option: any) => {
        if (typeof option === 'string') return option
        if (option && typeof option === 'object' && option.value) return option.value
        if (option && typeof option === 'object' && option.label) return option.label
        return String(option)
      })
      setOptions(normalizedOptions)
    } catch (error) {
      console.error(`Erro ao carregar opções de ${type}:`, error)
      setOptions([])
    } finally {
      setLoading(false)
    }
  }

  const handleAddOption = async () => {
    if (!newOption.trim() || options.includes(newOption.trim())) return

    const trimmedOption = newOption.trim()
    const updatedOptions = [...options, trimmedOption]
    setOptions(updatedOptions)
    setNewOption('')
    setShowAddInput(false)
    
    if (onOptionsChange) {
      onOptionsChange(type, updatedOptions)
    }
  }

  const handleRemoveOption = async (optionToRemove: string) => {
    try {
      // Remover do banco de dados
      await filterOptionsApi.deleteByTypeAndValue(type, optionToRemove)
      
      // Atualizar estado local
      const updatedOptions = options.filter(option => option !== optionToRemove)
      setOptions(updatedOptions)
      
      // Notificar componente pai
      if (onOptionsChange) {
        onOptionsChange(type, updatedOptions)
      }
    } catch (error) {
      console.error(`Erro ao remover opção ${optionToRemove} de ${type}:`, error)
      // Mesmo com erro, atualizar a interface localmente
      const updatedOptions = options.filter(option => option !== optionToRemove)
      setOptions(updatedOptions)
      
      if (onOptionsChange) {
        onOptionsChange(type, updatedOptions)
      }
    }
  }

  const selectedOptions = (() => {
    if (!value) return []
    if (Array.isArray(value)) return value.filter(Boolean)
    if (typeof value === 'string') return value.split(',').filter(Boolean)
    return []
  })()

  return (
    <div style={{ position: 'relative', width: '100%' }}>
      <label style={{
        display: 'block',
        fontSize: '0.875rem',
        fontWeight: '500',
        color: '#E8EDF2',
        marginBottom: '0.5rem'
      }}>
        {label}
      </label>

      {/* Campo de seleção */}
      <div style={{ position: 'relative' }}>
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          style={{
            width: '100%',
            padding: '0.75rem',
            background: '#0c0f14',
            border: '1px solid rgba(245, 210, 108, 0.2)',
            borderRadius: '0.5rem',
            color: '#E8EDF2',
            fontSize: '0.875rem',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            transition: 'all 0.2s'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = 'rgba(245, 210, 108, 0.4)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = 'rgba(245, 210, 108, 0.2)'
          }}
        >
          <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ fontSize: '1rem' }}>{emoji}</span>
            <span>{selectedOptions.length > 0 ? `${selectedOptions.length} selecionado(s)` : 'Selecionar...'}</span>
          </span>
          <ChevronDown style={{ 
            height: '1rem', 
            width: '1rem', 
            transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'transform 0.2s'
          }} />
        </button>

        {/* Dropdown */}
        {isOpen && (
          <div style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            background: '#141823',
            border: '1px solid rgba(245, 210, 108, 0.2)',
            borderRadius: '0.5rem',
            marginTop: '0.25rem',
            zIndex: 1000,
            maxHeight: '300px',
            overflowY: 'auto',
            boxShadow: '0 6px 24px rgba(0, 0, 0, 0.35)'
          }}>
            {loading ? (
              <div style={{
                padding: '1rem',
                textAlign: 'center',
                color: '#94a3b8',
                fontSize: '0.875rem'
              }}>
                Carregando...
              </div>
            ) : (
              <>
                {/* Opções existentes */}
                {options.map((option) => {
                  const isSelected = selectedOptions.includes(option)
                  return (
                    <div
                      key={option}
                      style={{
                        padding: '0.75rem',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        borderBottom: '1px solid rgba(245, 210, 108, 0.1)',
                        transition: 'all 0.2s',
                        backgroundColor: isSelected ? 'rgba(245, 210, 108, 0.1)' : 'transparent'
                      }}
                    >
                      <div
                        onClick={() => {
                          if (isSelected) {
                            const newValue = selectedOptions.filter(opt => opt !== option).join(',')
                            onChange(newValue)
                          } else {
                            const newValue = [...selectedOptions, option].join(',')
                            onChange(newValue)
                          }
                        }}
                        style={{
                          cursor: 'pointer',
                          flex: 1,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between'
                        }}
                        onMouseEnter={(e) => {
                          if (!isSelected) {
                            e.currentTarget.style.backgroundColor = 'rgba(245, 210, 108, 0.05)'
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (!isSelected) {
                            e.currentTarget.style.backgroundColor = 'transparent'
                          }
                        }}
                      >
                        <span style={{
                          color: isSelected ? '#F5D26C' : '#E8EDF2',
                          fontWeight: isSelected ? '500' : '400'
                        }}>
                          {option}
                        </span>
                        {isSelected && (
                          <span style={{ color: '#F5D26C', fontSize: '0.875rem' }}>✓</span>
                        )}
                      </div>
                      
                      {/* Botão de remover opção */}
                      {allowAdd && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleRemoveOption(option)
                          }}
                          style={{
                            marginLeft: '0.5rem',
                            padding: '0.25rem',
                            backgroundColor: 'rgba(239, 68, 68, 0.1)',
                            color: '#EF4444',
                            border: 'none',
                            borderRadius: '0.25rem',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            transition: 'all 0.2s',
                            opacity: 0.7
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.2)'
                            e.currentTarget.style.opacity = '1'
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.1)'
                            e.currentTarget.style.opacity = '0.7'
                          }}
                          title="Remover esta opção"
                        >
                          <X style={{ height: '0.75rem', width: '0.75rem' }} />
                        </button>
                      )}
                    </div>
                  )
                })}

                {/* Botão adicionar nova opção */}
                {allowAdd && (
                  <div style={{
                    padding: '0.75rem',
                    borderTop: '1px solid rgba(245, 210, 108, 0.1)',
                    backgroundColor: 'rgba(245, 210, 108, 0.05)'
                  }}>
                    {showAddInput ? (
                      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                        <input
                          type="text"
                          value={newOption}
                          onChange={(e) => setNewOption(e.target.value)}
                          placeholder="Nova opção..."
                          style={{
                            flex: 1,
                            padding: '0.5rem',
                            background: '#0c0f14',
                            border: '1px solid rgba(245, 210, 108, 0.2)',
                            borderRadius: '0.375rem',
                            color: '#E8EDF2',
                            fontSize: '0.875rem'
                          }}
                          onKeyPress={(e) => {
                            if (e.key === 'Enter') {
                              handleAddOption()
                            }
                          }}
                          autoFocus
                        />
                        <button
                          type="button"
                          onClick={handleAddOption}
                          style={{
                            padding: '0.5rem',
                            backgroundColor: '#F5D26C',
                            color: '#0c0f14',
                            border: 'none',
                            borderRadius: '0.375rem',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            transition: 'all 0.2s'
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor = '#e0c05c'
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = '#F5D26C'
                          }}
                        >
                          <Plus style={{ height: '0.875rem', width: '0.875rem' }} />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setShowAddInput(false)
                            setNewOption('')
                          }}
                          style={{
                            padding: '0.5rem',
                            backgroundColor: 'rgba(239, 68, 68, 0.1)',
                            color: '#EF4444',
                            border: 'none',
                            borderRadius: '0.375rem',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            transition: 'all 0.2s'
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
                    ) : (
                      <button
                        type="button"
                        onClick={() => setShowAddInput(true)}
                        style={{
                          width: '100%',
                          padding: '0.5rem',
                          backgroundColor: 'rgba(245, 210, 108, 0.1)',
                          color: '#F5D26C',
                          border: '1px solid rgba(245, 210, 108, 0.2)',
                          borderRadius: '0.375rem',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '0.5rem',
                          fontSize: '0.875rem',
                          transition: 'all 0.2s'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = 'rgba(245, 210, 108, 0.2)'
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = 'rgba(245, 210, 108, 0.1)'
                        }}
                      >
                        <Plus style={{ height: '0.875rem', width: '0.875rem' }} />
                        Adicionar nova opção
                      </button>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {/* Tags das opções selecionadas */}
      {selectedOptions.length > 0 && (
        <div style={{
          marginTop: '0.75rem',
          display: 'flex',
          flexWrap: 'wrap',
          gap: '0.5rem'
        }}>
          {selectedOptions.map((option) => (
            <div
              key={option}
              style={{
                background: 'rgba(245, 210, 108, 0.1)',
                border: '1px solid rgba(245, 210, 108, 0.3)',
                borderRadius: '0.375rem',
                padding: '0.375rem 0.75rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                fontSize: '0.875rem',
                color: '#F5D26C',
                fontWeight: '500'
              }}
            >
              <span>{option}</span>
              <button
                type="button"
                onClick={() => {
                  const newValue = selectedOptions.filter(opt => opt !== option).join(',')
                  onChange(newValue)
                }}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#EF4444',
                  cursor: 'pointer',
                  padding: '0',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'all 0.2s'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = '#DC2626'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = '#EF4444'
                }}
              >
                <X style={{ height: '0.875rem', width: '0.875rem' }} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
