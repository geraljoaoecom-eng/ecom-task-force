'use client'

import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { ElegantFilter } from './ElegantFilter'
import { librariesApi, foldersApi, filterOptionsApi } from '@/lib/api'

interface LibraryConfigPopupProps {
  isOpen: boolean
  onClose: () => void
  library: any
  onUpdate: () => void
}

export function LibraryConfigPopup({ isOpen, onClose, library, onUpdate }: LibraryConfigPopupProps) {
  const [mounted, setMounted] = useState(false)
  const [loading, setLoading] = useState(false)
  const [folders, setFolders] = useState([])
  const [refreshKey, setRefreshKey] = useState(0)
  const [formData, setFormData] = useState({
    name: '',
    nota: '',
    sourceValue: '',
    notes: '',
    folderId: '',
    nichos: '',
    estrategias: '',
    produtos: '',
    idiomas: '',
    paises: ''
  })

  useEffect(() => {
    setMounted(true)
    return () => setMounted(false)
  }, [])

  useEffect(() => {
    if (isOpen && library) {
      // Carregar valores atuais da biblioteca
      setFormData({
        name: library.name || '',
        nota: library.nota || '',
        sourceValue: library.sourceValue || '',
        notes: library.notes || '',
        folderId: library.folderId || '',
        nichos: Array.isArray(library.nichos) ? library.nichos.join(',') : (library.nichos || ''),
        estrategias: Array.isArray(library.estrategias) ? library.estrategias.join(',') : (library.estrategias || ''),
        produtos: Array.isArray(library.produtos) ? library.produtos.join(',') : (library.produtos || ''),
        idiomas: Array.isArray(library.idiomas) ? library.idiomas.join(',') : (library.idiomas || ''),
        paises: Array.isArray(library.paises) ? library.paises.join(',') : (library.paises || '')
      })
      loadFolders()
    }
  }, [isOpen, library])

  const loadFolders = async () => {
    try {
      const data = await foldersApi.getAll()
      setFolders(data)
    } catch (error) {
      console.error('Erro ao carregar pastas:', error)
    }
  }

  const handleOptionsChange = (type: string, newOptions: string[]) => {
    console.log(`Opções de ${type} atualizadas:`, newOptions);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      await librariesApi.update(library.id, formData)
      onUpdate()
      onClose()
    } catch (error) {
      console.error('Erro ao atualizar biblioteca:', error)
      alert('Erro ao atualizar biblioteca. Verifique o console para mais detalhes.')
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen || !mounted) return null

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
        padding: '0.75rem',
        maxWidth: '600px',
        width: '85%',
        maxHeight: '90vh',
        overflow: 'auto',
        overflowX: 'hidden',
        boxShadow: '0 25px 80px rgba(0, 0, 0, 0.8)',
        boxSizing: 'border-box',
        transform: 'scale(1)',
        animation: 'modalAppear 0.3s ease-out'
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '0.75rem'
        }}>
          <h3 style={{
            fontSize: '1.25rem',
            fontWeight: '600',
            color: '#F5D26C',
            margin: 0,
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem'
          }}>
            ⚙️ Configurar Biblioteca
          </h3>
          <button
            onClick={onClose}
            style={{
              padding: '0.75rem',
              background: 'rgba(245, 210, 108, 0.1)',
              border: '1px solid rgba(245, 210, 108, 0.3)',
              borderRadius: '0.5rem',
              color: '#F5D26C',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.2s'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(245, 210, 108, 0.2)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(245, 210, 108, 0.1)'
            }}
          >
            <X style={{ height: '1.25rem', width: '1.25rem' }} />
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ 
          display: 'flex', 
          flexDirection: 'column', 
          gap: 'clamp(0.75rem, 2vw, 1.5rem)',
          width: '100%',
          boxSizing: 'border-box',
          overflowX: 'hidden'
        }}>
          
          {/* SEÇÃO 1: INFORMAÇÕES BÁSICAS */}
          <div style={{
            background: 'rgba(245, 210, 108, 0.05)',
            border: '1px solid rgba(245, 210, 108, 0.1)',
            borderRadius: '0.75rem',
            padding: '0.75rem',
            width: '100%',
            boxSizing: 'border-box',
            overflowX: 'hidden'
          }}>
            <h3 style={{
              fontSize: '1rem',
              fontWeight: '600',
              color: '#F5D26C',
              margin: '0 0 0.5rem 0',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}>
              📚 Informações Básicas
            </h3>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              {/* Nome */}
              <div>
                <label style={{
                  display: 'block',
                  fontSize: '0.875rem',
                  fontWeight: '500',
                  color: '#E8EDF2',
                  marginBottom: '0.25rem'
                }}>
                  Nome da Biblioteca *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  style={{
                    width: '100%',
                    padding: '0.5rem',
                    background: '#0c0f14',
                    border: '1px solid rgba(245, 210, 108, 0.2)',
                    borderRadius: '0.5rem',
                    color: '#E8EDF2',
                    fontSize: '0.875rem'
                  }}
                  placeholder="Ex: Nike Dropshipping Brasil"
                  required
                />
              </div>

              {/* URL */}
              <div>
                <label style={{
                  display: 'block',
                  fontSize: '0.875rem',
                  fontWeight: '500',
                  color: '#E8EDF2',
                  marginBottom: '0.25rem'
                }}>
                  URL *
                </label>
                <input
                  type="url"
                  value={formData.sourceValue}
                  onChange={(e) => setFormData(prev => ({ ...prev, sourceValue: e.target.value }))}
                  style={{
                    width: '100%',
                    padding: '0.5rem',
                    background: '#0c0f14',
                    border: '1px solid rgba(245, 210, 108, 0.2)',
                    borderRadius: '0.5rem',
                    color: '#E8EDF2',
                    fontSize: '0.875rem'
                  }}
                  placeholder="https://www.facebook.com/ads/library"
                  required
                />
              </div>
            </div>
          </div>

          {/* SEÇÃO 2: OBSERVAÇÕES */}
          <div style={{
            background: 'rgba(245, 210, 108, 0.05)',
            border: '1px solid rgba(245, 210, 108, 0.1)',
            borderRadius: '0.75rem',
            padding: '0.75rem',
            width: '100%',
            boxSizing: 'border-box',
            overflowX: 'hidden'
          }}>
            <h3 style={{
              fontSize: '1rem',
              fontWeight: '600',
              color: '#F5D26C',
              margin: '0 0 0.5rem 0',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}>
              📝 Observações
            </h3>
            
            <div>
              <label style={{
                display: 'block',
                fontSize: '0.875rem',
                fontWeight: '500',
                color: '#E8EDF2',
                marginBottom: '0.5rem'
              }}>
                Observações Adicionais
              </label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  background: '#0c0f14',
                  border: '1px solid rgba(245, 210, 108, 0.2)',
                  borderRadius: '0.5rem',
                  color: '#E8EDF2',
                  fontSize: '0.875rem',
                  minHeight: '100px',
                  resize: 'vertical'
                }}
                placeholder="Observações sobre esta biblioteca..."
              />
            </div>
          </div>

          {/* SEÇÃO 3: FILTROS AVANÇADOS */}
          <div style={{
            background: 'rgba(245, 210, 108, 0.05)',
            border: '1px solid rgba(245, 210, 108, 0.1)',
            borderRadius: '0.75rem',
            padding: '0.75rem',
            width: '100%',
            boxSizing: 'border-box',
            overflowX: 'hidden'
          }}>
            <h3 style={{
              fontSize: '1rem',
              fontWeight: '600',
              color: '#F5D26C',
              margin: '0 0 0.5rem 0',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}>
              🎯 Filtros Avançados
            </h3>
            
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 'clamp(0.5rem, 2vw, 1rem)' }}>
              <ElegantFilter
                key={`nichos-${refreshKey}`}
                label="Nicho"
                emoji="❤️"
                type="nichos"
                value={formData.nichos}
                onChange={(value) => setFormData(prev => ({ ...prev, nichos: value }))}
                allowAdd={true}
                onOptionsChange={handleOptionsChange}
              />
              
              <ElegantFilter
                key={`estrategias-${refreshKey}`}
                label="Estratégia"
                emoji="📈"
                type="estrategias"
                value={formData.estrategias}
                onChange={(value) => setFormData(prev => ({ ...prev, estrategias: value }))}
                allowAdd={true}
                onOptionsChange={handleOptionsChange}
              />
              
              <ElegantFilter
                key={`produtos-${refreshKey}`}
                label="Produto"
                emoji="📦"
                type="produtos"
                value={formData.produtos}
                onChange={(value) => setFormData(prev => ({ ...prev, produtos: value }))}
                allowAdd={true}
                onOptionsChange={handleOptionsChange}
              />
              
              <ElegantFilter
                key={`idiomas-${refreshKey}`}
                label="Idioma (Filtro)"
                emoji="🌐"
                type="idiomas"
                value={formData.idiomas}
                onChange={(value) => setFormData(prev => ({ ...prev, idiomas: value }))}
                allowAdd={true}
                onOptionsChange={handleOptionsChange}
              />
              
              <ElegantFilter
                key={`paises-${refreshKey}`}
                label="País (Filtro)"
                emoji="🌍"
                type="paises"
                value={formData.paises}
                onChange={(value) => setFormData(prev => ({ ...prev, paises: value }))}
                allowAdd={true}
                onOptionsChange={handleOptionsChange}
              />
            </div>
          </div>

          {/* SEÇÃO 4: ORGANIZAÇÃO */}
          <div style={{
            background: 'rgba(245, 210, 108, 0.05)',
            border: '1px solid rgba(245, 210, 108, 0.1)',
            borderRadius: '0.75rem',
            padding: '0.75rem',
            width: '100%',
            boxSizing: 'border-box',
            overflowX: 'hidden'
          }}>
            <h3 style={{
              fontSize: '1rem',
              fontWeight: '600',
              color: '#F5D26C',
              margin: '0 0 0.5rem 0',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}>
              📁 Organização
            </h3>
            
            <div>
              <label style={{
                display: 'block',
                fontSize: '0.875rem',
                fontWeight: '500',
                color: '#E8EDF2',
                marginBottom: '0.5rem'
              }}>
                Pasta
              </label>
              <select
                value={formData.folderId}
                onChange={(e) => setFormData(prev => ({ ...prev, folderId: e.target.value }))}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  background: '#0c0f14',
                  border: '1px solid rgba(245, 210, 108, 0.2)',
                  borderRadius: '0.5rem',
                  color: '#E8EDF2',
                  fontSize: '0.875rem'
                }}
              >
                <option value="">Sem pasta</option>
                {folders.map((folder: any) => (
                  <option key={folder.id} value={folder.id}>{folder.name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* BOTÕES */}
          <div style={{
            display: 'flex',
            gap: '1rem',
            marginTop: '1rem',
            paddingTop: '0.75rem',
            borderTop: '1px solid rgba(245, 210, 108, 0.2)'
          }}>
            <button
              type="submit"
              disabled={loading}
              style={{
                backgroundColor: loading ? '#94a3b8' : '#F5D26C',
                color: '#0c0f14',
                padding: '0.625rem 1rem',
                borderRadius: '0.5rem',
                fontWeight: '600',
                border: 'none',
                cursor: loading ? 'not-allowed' : 'pointer',
                flex: 1,
                fontSize: '0.875rem',
                transition: 'all 0.2s'
              }}
              onMouseEnter={(e) => {
                if (!loading) {
                  e.currentTarget.style.backgroundColor = '#e0c05c'
                }
              }}
              onMouseLeave={(e) => {
                if (!loading) {
                  e.currentTarget.style.backgroundColor = '#F5D26C'
                }
              }}
            >
              {loading ? '⏳ Salvando...' : '💾 Salvar Alterações'}
            </button>
            <button
              type="button"
              onClick={onClose}
              style={{
                backgroundColor: 'rgba(239, 68, 68, 0.1)',
                color: '#EF4444',
                padding: '0.625rem 1rem',
                borderRadius: '0.5rem',
                fontWeight: '500',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                cursor: 'pointer',
                fontSize: '0.875rem',
                transition: 'all 0.2s'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.2)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.1)'
              }}
            >
              ❌ Cancelar
            </button>
          </div>
        </form>
      </div>

      <style jsx>{`
        @keyframes modalAppear {
          from {
            opacity: 0;
            transform: scale(0.9);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }
      `}</style>
    </div>
  )

  return createPortal(modalContent, document.body)
}
