'use client'

import { useEffect } from 'react'

interface KeyboardShortcut {
  key: string
  ctrlKey?: boolean
  shiftKey?: boolean
  altKey?: boolean
  callback: () => void
  description: string
}

export function useKeyboardShortcuts(shortcuts: KeyboardShortcut[]) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Ignorar se o usuário está digitando em um input/textarea
      if (
        event.target instanceof HTMLInputElement ||
        event.target instanceof HTMLTextAreaElement ||
        event.target instanceof HTMLSelectElement ||
        (event.target as any)?.contentEditable === 'true'
      ) {
        return
      }

      for (const shortcut of shortcuts) {
        const keyMatch = event.key.toLowerCase() === shortcut.key.toLowerCase()
        const ctrlMatch = !!shortcut.ctrlKey === !!event.ctrlKey
        const shiftMatch = !!shortcut.shiftKey === !!event.shiftKey
        const altMatch = !!shortcut.altKey === !!event.altKey

        if (keyMatch && ctrlMatch && shiftMatch && altMatch) {
          event.preventDefault()
          event.stopPropagation()
          shortcut.callback()
          break
        }
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [shortcuts])
}

// Hook para mostrar help de atalhos
export function useShortcutsHelp() {
  const shortcuts = [
    { key: 'n', ctrlKey: true, description: 'Nova biblioteca' },
    { key: 'f', ctrlKey: true, description: 'Focar na busca' },
    { key: 'r', ctrlKey: true, description: 'Atualizar página' },
    { key: '/', description: 'Focar na busca' },
    { key: 'Escape', description: 'Fechar modais/painéis' },
    { key: '?', shiftKey: true, description: 'Mostrar esta ajuda' }
  ]

  return shortcuts
}
