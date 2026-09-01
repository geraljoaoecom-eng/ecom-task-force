'use client'

import { useState, useEffect } from 'react'
import { Plus, X, Edit3 } from 'lucide-react'
import { filterOptionsApi } from '@/lib/api'
import { getFilterTextColor } from '@/lib/filterColors'

interface ManageableSelectProps {
  label: string
  emoji: string
  type: string
  value: string
  onChange: (value: string) => void
  onOptionsChange?: () => void
  onOpenChange?: (isOpen: boolean) => void
}

export function ManageableSelect({ 
  label, 
  emoji, 
  type, 
  value, 
  onChange, 
  onOptionsChange,
  onOpenChange 
}: ManageableSelectProps) {
  const [options, setOptions] = useState<string[]>([])
  const [isAdding, setIsAdding] = useState(false)
  const [newOption, setNewOption] = useState('')
  const [isOpen, setIsOpen] = useState(false)

  useEffect(() => {
    loadOptions()
  }, [type])

  const loadOptions = async () => {
    try {
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

  return (
    <div className="relative">
      <div 
        className="input text-sm cursor-pointer flex items-center justify-between etf-input"
        onClick={() => {
          const newIsOpen = !isOpen
          setIsOpen(newIsOpen)
          onOpenChange?.(newIsOpen)
        }}
      >
        <span className={value ? 'text-text' : `text-muted ${getFilterTextColor(type)}`}>
          {value || `${emoji} ${label}`}
        </span>
        <Edit3 className="h-4 w-4 text-muted" />
      </div>

      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-card border border-gold/20 rounded-lg shadow-etf z-50 max-h-60 overflow-y-auto">
          {/* Opção de limpar seleção */}
          <div
            className="px-3 py-2 hover:bg-gold/10 cursor-pointer border-b border-gold/10"
            onClick={() => {
              onChange('')
              setIsOpen(false)
              onOpenChange?.(false)
            }}
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
                onClick={() => {
                  onChange(option)
                  setIsOpen(false)
                  onOpenChange?.(false)
                }}
              >
                {option}
              </span>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  handleRemoveOption(option)
                }}
                className="ml-2 p-1 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}

          {/* Adicionar nova opção */}
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
              <button
                onClick={() => setIsAdding(true)}
                className="w-full flex items-center justify-center gap-2 px-3 py-2 text-gold hover:bg-gold/10 rounded text-sm"
              >
                <Plus className="h-4 w-4" />
                Adicionar {label}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
