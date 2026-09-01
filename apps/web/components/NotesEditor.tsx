'use client'

import { useState } from 'react'
import { createPortal } from 'react-dom'
import { X, Save } from 'lucide-react'

interface NotesEditorProps {
  isOpen: boolean
  onClose: () => void
  libraryId: string
  currentNotes: string
  onSave: (notes: string) => void
}

export function NotesEditor({ isOpen, onClose, libraryId, currentNotes, onSave }: NotesEditorProps) {
  const [notes, setNotes] = useState(currentNotes)
  const [loading, setLoading] = useState(false)

  const handleSave = async () => {
    setLoading(true)
    try {
      await onSave(notes)
      onClose()
    } catch (error) {
      console.error('Erro ao salvar notas:', error)
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) return null

  const modalContent = (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0, 0, 0, 0.85)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 99999,
      padding: '1rem'
    }}>
      <div style={{
        background: '#141823',
        border: '2px solid rgba(245, 210, 108, 0.5)',
        borderRadius: '1rem',
        padding: '1.5rem',
        maxWidth: '600px',
        width: '90%',
        maxHeight: '80vh',
        overflow: 'auto',
        boxShadow: '0 25px 80px rgba(0, 0, 0, 0.8)',
        boxSizing: 'border-box'
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '1.5rem'
        }}>
          <h3 style={{
            fontSize: '1.25rem',
            fontWeight: '600',
            color: '#F5D26C',
            margin: 0
          }}>
            📝 Editar Notas
          </h3>
          <button
            onClick={onClose}
            style={{
              padding: '0.5rem',
              background: 'rgba(245, 210, 108, 0.1)',
              border: '1px solid rgba(245, 210, 108, 0.3)',
              borderRadius: '0.5rem',
              color: '#F5D26C',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <X style={{ height: '1rem', width: '1rem' }} />
          </button>
        </div>

        <div style={{ marginBottom: '1.5rem' }}>
          <label style={{
            display: 'block',
            fontSize: '0.875rem',
            fontWeight: '500',
            color: '#E8EDF2',
            marginBottom: '0.5rem'
          }}>
            Notas da Biblioteca
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            style={{
              width: '100%',
              padding: '0.75rem',
              background: '#0c0f14',
              border: '1px solid rgba(245, 210, 108, 0.2)',
              borderRadius: '0.5rem',
              color: '#E8EDF2',
              fontSize: '0.875rem',
              minHeight: '120px',
              resize: 'vertical',
              fontFamily: 'inherit'
            }}
            placeholder="Digite suas notas sobre esta biblioteca..."
          />
        </div>

        <div style={{
          display: 'flex',
          gap: '1rem',
          justifyContent: 'flex-end'
        }}>
          <button
            onClick={onClose}
            style={{
              backgroundColor: 'rgba(239, 68, 68, 0.1)',
              color: '#EF4444',
              padding: '0.75rem 1.5rem',
              borderRadius: '0.5rem',
              fontWeight: '500',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              cursor: 'pointer',
              fontSize: '0.875rem'
            }}
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={loading}
            style={{
              backgroundColor: loading ? '#94a3b8' : '#F5D26C',
              color: '#0c0f14',
              padding: '0.75rem 1.5rem',
              borderRadius: '0.5rem',
              fontWeight: '600',
              border: 'none',
              cursor: loading ? 'not-allowed' : 'pointer',
              fontSize: '0.875rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}
          >
            <Save style={{ height: '1rem', width: '1rem' }} />
            {loading ? 'Salvando...' : 'Salvar'}
          </button>
        </div>
      </div>
    </div>
  )

  return createPortal(modalContent, document.body)
}
