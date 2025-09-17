'use client'

import { useState, useEffect } from 'react'
import { ChevronDown, Plus, X } from 'lucide-react'
import { filterOptionsApi } from '@/lib/api'
import { getFilterTextColor } from '@/lib/filterColors'

interface SimpleSelectProps {
  label: string
  emoji: string
  type: string
  value: string
  onChange: (value: string) => void
  onOpenChange?: (isOpen: boolean) => void
  allowAdd?: boolean
  onOptionsChange?: () => void
}

export function SimpleSelect({ 
  label, 
  emoji, 
  type, 
  value, 
  onChange, 
  onOpenChange,
  allowAdd = false,
  onOptionsChange
}: SimpleSelectProps) {
  const [options, setOptions] = useState<string[]>([])
  const [isOpen, setIsOpen] = useState(false)
  const [isAdding, setIsAdding] = useState(false)
  const [newOption, setNewOption] = useState('')
  const [showSuccess, setShowSuccess] = useState(false)

  useEffect(() => {
    loadOptions()
  }, [type])

  const loadOptions = async () => {
    try {
      const data = await filterOptionsApi.getByType(type)
      setOptions(data)
    } catch (error) {
      console.error('Erro ao carregar opções:', error)
    }
  }

  const handleAddOption = async () => {
    if (!newOption.trim()) return

    try {
      await filterOptionsApi.create(type, newOption.trim())
      setNewOption('')
      setIsAdding(false)
      await loadOptions()
      onOptionsChange?.()
      // NÃO seleciona automaticamente a nova opção - apenas adiciona à lista
      setShowSuccess(true)
      setTimeout(() => setShowSuccess(false), 2000)
    } catch (error) {
      console.error('Erro ao adicionar opção:', error)
      alert('Erro ao adicionar opção')
    }
  }

  const handleRemoveOption = async (optionToRemove: string) => {
    try {
      await filterOptionsApi.delete(type, optionToRemove)
      await loadOptions()
      
      // Se a opção removida estava selecionada, limpar a seleção
      if (value === optionToRemove) {
        onChange('')
      }
      
      onOptionsChange?.()
    } catch (error) {
      console.error('Erro ao remover opção:', error)
      alert('Erro ao remover opção')
    }
  }

  const handleToggle = () => {
    const newIsOpen = !isOpen
    setIsOpen(newIsOpen)
    onOpenChange?.(newIsOpen)
  }

  const handleSelect = (optionValue: string) => {
    onChange(optionValue)
    setIsOpen(false)
    onOpenChange?.(false)
  }

  const handleClear = () => {
    onChange('')
    setIsOpen(false)
    onOpenChange?.(false)
  }

  return (
    <div className="relative">
      <div 
        className="input text-sm cursor-pointer flex items-center justify-between etf-input"
        onClick={handleToggle}
      >
        <span className={value ? 'text-text' : `text-muted ${getFilterTextColor(type)}`}>
          {value || `${emoji} ${label}`}
        </span>
        <ChevronDown className={`h-4 w-4 text-muted transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </div>

      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-card border border-gold/20 rounded-lg shadow-etf z-50 max-h-80 overflow-y-auto">
          {/* Opção de limpar seleção */}
          <div
            className="px-3 py-2 hover:bg-gold/10 cursor-pointer border-b border-gold/10"
            onClick={handleClear}
          >
            <span className="text-muted text-sm">{emoji} {label}</span>
          </div>

          {/* Opções existentes */}
          {options.map((option) => (
            <div
              key={option}
              className="flex items-center justify-between px-3 py-2 hover:bg-gold/10 cursor-pointer border-b border-gold/5 last:border-b-0"
            >
              <span
                className="flex-1 text-text text-sm"
                onClick={() => handleSelect(option)}
              >
                {option}
              </span>
              {allowAdd && (
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    handleRemoveOption(option)
                  }}
                  className="ml-2 p-1 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>
          ))}

          {/* Mensagem se não há opções */}
          {options.length === 0 && !allowAdd && (
            <div className="px-3 py-2 text-center text-muted text-sm">
              Nenhuma opção disponível
            </div>
          )}

          {/* Adicionar nova opção */}
          {allowAdd && (
            <div className="border-t border-gold/20 p-2">
              {isAdding ? (
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newOption}
                    onChange={(e) => setNewOption(e.target.value)}
                    placeholder="Nova opção..."
                    className="flex-1 px-2 py-1 text-sm bg-bg border border-gold/20 rounded focus:outline-none focus:border-gold/50"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleAddOption()
                      if (e.key === 'Escape') {
                        setIsAdding(false)
                        setNewOption('')
                      }
                    }}
                    autoFocus
                  />
                  <button
                    onClick={handleAddOption}
                    className="px-2 py-1 bg-gold/20 text-gold rounded hover:bg-gold/30 text-sm"
                  >
                    OK
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  <button
                    onClick={() => setIsAdding(true)}
                    className="w-full flex items-center justify-center gap-2 px-3 py-2 text-gold hover:bg-gold/10 rounded text-sm border border-gold/20"
                  >
                    <Plus className="h-4 w-4" />
                    + Adicionar nova opção
                  </button>
                  {showSuccess && (
                    <div className="text-center text-green-400 text-xs">
                      ✅ Opção adicionada com sucesso!
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
