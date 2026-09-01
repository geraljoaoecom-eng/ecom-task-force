'use client'

import { useEffect, useState } from 'react'
import { BookOpen, Plus, Search, Filter, RotateCcw } from 'lucide-react'

export default function BibliotecasPage() {
  const [libraries, setLibraries] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadLibraries()
  }, [])

  const loadLibraries = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/proxy/libraries')
      const data = await response.json()
      setLibraries(data)
    } catch (error) {
      console.error('Erro ao carregar bibliotecas:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center', 
        minHeight: '400px',
        background: '#0c0f14',
        color: '#F5D26C'
      }}>
        <div>Carregando bibliotecas...</div>
      </div>
    )
  }

  return (
    <div style={{ 
      background: '#0c0f14', 
      color: '#E8EDF2', 
      minHeight: '100vh',
      padding: '2rem'
    }}>
      {/* Header */}
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'space-between',
        marginBottom: '2rem'
      }}>
        <div>
          <h1 style={{ 
            fontSize: '2rem', 
            fontWeight: 'bold', 
            color: '#E8EDF2',
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            marginBottom: '0.5rem'
          }}>
            <BookOpen style={{ height: '2rem', width: '2rem', color: '#F5D26C' }} />
            Bibliotecas
          </h1>
          <p style={{ color: '#94a3b8' }}>
            Gerencie suas bibliotecas de anúncios
          </p>
        </div>
      </div>

      {/* Summary */}
      <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem' }}>
        <div style={{
          background: '#141823',
          border: '1px solid rgba(245, 210, 108, 0.2)',
          borderRadius: '0.75rem',
          padding: '1rem',
          boxShadow: '0 6px 24px rgba(0, 0, 0, 0.35)',
        }}>
          <div style={{ fontSize: '0.875rem', color: '#94a3b8' }}>Total</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#F5D26C' }}>{libraries.length}</div>
        </div>
        <div style={{
          background: '#141823',
          border: '1px solid rgba(245, 210, 108, 0.2)',
          borderRadius: '0.75rem',
          padding: '1rem',
          boxShadow: '0 6px 24px rgba(0, 0, 0, 0.35)',
        }}>
          <div style={{ fontSize: '0.875rem', color: '#94a3b8' }}>Ativas</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#10B981' }}>
            {libraries.filter((lib: any) => lib.activeAds > 0).length}
          </div>
        </div>
      </div>

      {/* Libraries List */}
      {libraries.length > 0 ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: '1.5rem' }}>
          {libraries.map((library: any) => (
            <div key={library.id} style={{
              background: '#141823',
              border: '1px solid rgba(245, 210, 108, 0.2)',
              borderRadius: '0.75rem',
              padding: '1.5rem',
              boxShadow: '0 6px 24px rgba(0, 0, 0, 0.35)',
            }}>
              <h3 style={{ 
                color: '#E8EDF2', 
                fontSize: '1.125rem', 
                fontWeight: '600', 
                marginBottom: '0.5rem' 
              }}>
                {library.name}
              </h3>
              <p style={{ 
                color: '#F5D26C', 
                fontWeight: 'bold', 
                fontSize: '1.25rem', 
                marginBottom: '0.5rem' 
              }}>
                {library.activeAds} anúncios ativos
              </p>
              <p style={{ 
                color: '#94a3b8', 
                fontSize: '0.875rem' 
              }}>
                {library.country} • {library.language}
              </p>
            </div>
          ))}
        </div>
      ) : (
        <div style={{
          background: '#141823',
          border: '1px solid rgba(245, 210, 108, 0.2)',
          borderRadius: '0.75rem',
          padding: '3rem',
          textAlign: 'center',
          boxShadow: '0 6px 24px rgba(0, 0, 0, 0.35)',
        }}>
          <BookOpen style={{ height: '4rem', width: '4rem', color: '#94a3b8', margin: '0 auto 1rem auto' }} />
          <h3 style={{ fontSize: '1.25rem', fontWeight: '600', color: '#E8EDF2', marginBottom: '0.5rem' }}>
            Nenhuma biblioteca encontrada
          </h3>
          <p style={{ color: '#94a3b8' }}>
            Verifique se o servidor API está rodando na porta 4000
          </p>
        </div>
      )}
    </div>
  )
}
