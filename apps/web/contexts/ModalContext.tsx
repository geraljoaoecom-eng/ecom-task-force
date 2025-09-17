'use client'

import { createContext, useContext, useState, ReactNode } from 'react'

interface ModalContextType {
  isOpen: boolean
  libraryId: string | null
  openModal: (libraryId: string) => void
  closeModal: () => void
}

const ModalContext = createContext<ModalContextType | undefined>(undefined)

export function ModalProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false)
  const [libraryId, setLibraryId] = useState<string | null>(null)

  const openModal = (id: string) => {
    setLibraryId(id)
    setIsOpen(true)
    document.body.style.overflow = 'hidden'
  }

  const closeModal = () => {
    setIsOpen(false)
    setLibraryId(null)
    document.body.style.overflow = 'unset'
  }

  return (
    <ModalContext.Provider value={{ isOpen, libraryId, openModal, closeModal }}>
      {children}
    </ModalContext.Provider>
  )
}

export function useModal() {
  const context = useContext(ModalContext)
  if (context === undefined) {
    throw new Error('useModal must be used within a ModalProvider')
  }
  return context
}

