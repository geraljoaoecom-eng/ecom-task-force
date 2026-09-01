'use client'

import { useState } from 'react'
import { Keyboard, X } from 'lucide-react'
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts'

interface Shortcut {
  keys: string[]
  description: string
  context?: string
}

const shortcuts: Shortcut[] = [
  { keys: ['Ctrl', 'N'], description: 'Nova biblioteca', context: 'Geral' },
  { keys: ['Ctrl', 'F'], description: 'Focar na busca', context: 'Geral' },
  { keys: ['/'], description: 'Focar na busca', context: 'Geral' },
  { keys: ['Escape'], description: 'Fechar modais/painéis', context: 'Geral' },
  { keys: ['?'], description: 'Mostrar esta ajuda', context: 'Geral' },
  { keys: ['Enter'], description: 'Salvar alteração', context: 'Edição' },
  { keys: ['Escape'], description: 'Cancelar edição', context: 'Edição' },
  { keys: ['Tab'], description: 'Navegar entre campos', context: 'Edição' },
]

export function ShortcutsHelp() {
  const [isOpen, setIsOpen] = useState(false)

  useKeyboardShortcuts([
    {
      key: '?',
      shiftKey: true,
      action: () => setIsOpen(true)
    }
  ])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-lg max-w-2xl w-full max-h-[80vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-700">
          <div className="flex items-center gap-3">
            <Keyboard className="h-6 w-6 text-gold" />
            <h2 className="text-xl font-bold text-white">Atalhos de Teclado</h2>
          </div>
          <button
            onClick={() => setIsOpen(false)}
            className="text-gray-400 hover:text-white transition-colors p-1"
            aria-label="Fechar ajuda"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 max-h-[60vh] overflow-y-auto">
          <div className="space-y-6">
            {['Geral', 'Edição'].map(context => (
              <div key={context}>
                <h3 className="text-lg font-semibold text-gold mb-3">{context}</h3>
                <div className="space-y-2">
                  {shortcuts
                    .filter(shortcut => shortcut.context === context)
                    .map((shortcut, index) => (
                      <div key={index} className="flex items-center justify-between py-2">
                        <span className="text-gray-300">{shortcut.description}</span>
                        <div className="flex gap-1">
                          {shortcut.keys.map((key, keyIndex) => (
                            <kbd 
                              key={keyIndex}
                              className="px-2 py-1 text-xs bg-gray-800 border border-gray-600 rounded text-gray-300 font-mono"
                            >
                              {key}
                            </kbd>
                          ))}
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-6 pt-4 border-t border-gray-700">
            <p className="text-sm text-gray-400">
              💡 <strong>Dica:</strong> Pressione <kbd className="px-1 py-0.5 text-xs bg-gray-800 border border-gray-600 rounded">?</kbd> a qualquer momento para ver esta ajuda.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-gray-800/50 border-t border-gray-700">
          <button
            onClick={() => setIsOpen(false)}
            className="etf-btn etf-btn-primary w-full"
          >
            Entendi
          </button>
        </div>
      </div>
    </div>
  )
}
