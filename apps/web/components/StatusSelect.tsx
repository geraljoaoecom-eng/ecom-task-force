'use client'

import { useState } from 'react'
import { ChevronDown } from 'lucide-react'

interface StatusSelectProps {
  value: string
  onChange: (value: string) => void
  onOpenChange?: (isOpen: boolean) => void
}

const STATUS_OPTIONS = [
  { value: 'ativo', label: 'Ativo' },
  { value: 'inativo', label: 'Inativo' }
]

export function StatusSelect({ value, onChange, onOpenChange }: StatusSelectProps) {
  const [isOpen, setIsOpen] = useState(false)
  
  const handleToggle = () => {
    const newIsOpen = !isOpen
    setIsOpen(newIsOpen)
    onOpenChange?.(newIsOpen)
  }

  const selectedOption = STATUS_OPTIONS.find(opt => opt.value === value)

  return (
    <div className="relative">
      <div 
        className="input text-sm cursor-pointer flex items-center justify-between etf-input"
        onClick={handleToggle}
      >
        <span className={value ? 'text-text' : 'text-muted'}>
          {selectedOption ? `📊 ${selectedOption.label}` : '📊 Status'}
        </span>
        <ChevronDown className={`h-4 w-4 text-muted transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </div>

      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-card border border-gold/20 rounded-lg shadow-etf z-50">
          {/* Opção de limpar seleção */}
          <div
            className="px-3 py-2 hover:bg-gold/10 cursor-pointer border-b border-gold/10"
            onClick={() => {
              onChange('')
              setIsOpen(false)
              onOpenChange?.(false)
            }}
          >
            <span className="text-muted text-sm">📊 Status</span>
          </div>

          {/* Opções fixas */}
          {STATUS_OPTIONS.map((option) => (
            <div
              key={option.value}
              className="px-3 py-2 hover:bg-gold/10 cursor-pointer border-b border-gold/5 last:border-b-0"
              onClick={() => {
                onChange(option.value)
                setIsOpen(false)
                onOpenChange?.(false)
              }}
            >
              <span className="text-text text-sm">{option.label}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
