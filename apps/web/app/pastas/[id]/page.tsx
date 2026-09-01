'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, Folder, BookOpen, ExternalLink, Calendar, Tag, Trash2 } from 'lucide-react'
import { librariesApi, foldersApi } from '@/lib/api'

export default function FolderDetailPage() {
  const params = useParams()
  const router = useRouter()
  const folderId = params.id as string
  
  const [folder, setFolder] = useState<any>(null)
  const [libraries, setLibraries] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (folderId) {
      loadFolderData()
    }
  }, [folderId])

  const loadFolderData = async () => {
    try {
      setLoading(true)
      
      // Buscar dados da pasta
      const folders = await foldersApi.getAll()
      const currentFolder = folders.find((f: any) => f.id === folderId)
      
      if (!currentFolder) {
        router.push('/pastas')
        return
      }
      
      setFolder(currentFolder)
      
      // Buscar bibliotecas da pasta
      const folderLibraries = await librariesApi.getAll({ folderId })
      setLibraries(folderLibraries)
    } catch (error) {
      console.error('Erro ao carregar dados da pasta:', error)
    } finally {
      setLoading(false)
    }
  }

  const getSourceDisplayName = (sourceType: string, sourceValue: string) => {
    if (sourceType === 'facebook') {
      return { label: 'Facebook', url: sourceValue }
    } else if (sourceType === 'instagram') {
      return { label: 'Instagram', url: sourceValue }
    } else if (sourceType === 'youtube') {
      return { label: 'YouTube', url: sourceValue }
    } else if (sourceType === 'tiktok') {
      return { label: 'TikTok', url: sourceValue }
    } else if (sourceType === 'website') {
      return { label: 'Website', url: sourceValue }
    }
    return { label: sourceType, url: sourceValue }
  }

  if (loading) {
    return (
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center', 
        minHeight: '50vh',
        color: '#94a3b8'
      }}>
        Carregando...
      </div>
    )
  }

  if (!folder) {
    return (
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center', 
        minHeight: '50vh',
        color: '#94a3b8'
      }}>
        Pasta não encontrada
      </div>
    )
  }

  return (
    <div style={{ 
      minHeight: '100vh', 
      background: 'linear-gradient(135deg, #0f1419 0%, #1a1f2e 100%)',
      padding: '2rem'
    }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
        {/* Header */}
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: '1rem', 
          marginBottom: '2rem' 
        }}>
          <button
            onClick={() => router.push('/pastas')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.5rem 1rem',
              background: 'rgba(245, 210, 108, 0.1)',
              border: '1px solid rgba(245, 210, 108, 0.3)',
              borderRadius: '0.5rem',
              color: '#F5D26C',
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.background = 'rgba(245, 210, 108, 0.2)'
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.background = 'rgba(245, 210, 108, 0.1)'
            }}
          >
            <ArrowLeft style={{ height: '1rem', width: '1rem' }} />
            Voltar
          </button>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <Folder style={{ height: '2rem', width: '2rem', color: '#F5D26C' }} />
            <div>
              <h1 style={{ 
                fontSize: '1.5rem', 
                fontWeight: '600', 
                color: '#E8EDF2',
                margin: 0
              }}>
                {folder.name}
              </h1>
              <p style={{ 
                fontSize: '0.875rem', 
                color: '#94a3b8',
                margin: 0
              }}>
                {libraries.length} biblioteca{libraries.length !== 1 ? 's' : ''}
              </p>
            </div>
          </div>
        </div>

        {/* Libraries Grid */}
        {libraries.length > 0 ? (
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', 
            gap: '1.5rem' 
          }}>
            {libraries.map((library: any) => {
              const sourceInfo = getSourceDisplayName(library.sourceType, library.sourceValue)
              const isActive = library.status === 'active'
              
              return (
                <div key={library.id} style={{
                  background: '#1A1D24',
                  border: '1px solid rgba(245, 210, 108, 0.1)',
                  borderRadius: '1rem',
                  padding: '1.5rem',
                  boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
                  transition: 'all 0.3s ease',
                  position: 'relative'
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.borderColor = 'rgba(245, 210, 108, 0.3)'
                  e.currentTarget.style.transform = 'translateY(-4px)'
                  e.currentTarget.style.boxShadow = '0 12px 40px rgba(0, 0, 0, 0.5)'
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.borderColor = 'rgba(245, 210, 108, 0.1)'
                  e.currentTarget.style.transform = 'translateY(0)'
                  e.currentTarget.style.boxShadow = '0 8px 32px rgba(0, 0, 0, 0.4)'
                }}
                >
                  {/* Header */}
                  <div style={{ 
                    display: 'flex', 
                    alignItems: 'flex-start', 
                    justifyContent: 'space-between',
                    marginBottom: '1.5rem'
                  }}>
                    <div style={{ flex: 1 }}>
                      <h3 style={{ 
                        fontSize: '1.5rem', 
                        fontWeight: '600', 
                        color: '#E8EDF2',
                        margin: '0 0 0.5rem 0',
                        lineHeight: '1.2'
                      }}>
                        {library.name}
                      </h3>
                    </div>
                    
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.5rem' }}>
                      <span style={{
                        background: isActive ? 'rgba(34, 197, 94, 0.1)' : 'rgba(148, 163, 184, 0.1)',
                        color: isActive ? '#22C55E' : '#94a3b8',
                        padding: '0.25rem 0.75rem',
                        borderRadius: '1rem',
                        fontSize: '0.75rem',
                        fontWeight: '600',
                        border: `1px solid ${isActive ? 'rgba(34, 197, 94, 0.2)' : 'rgba(148, 163, 184, 0.2)'}`
                      }}>
                        {isActive ? 'Ativo' : 'Inativo'}
                      </span>
                      
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button style={{
                          width: '2rem',
                          height: '2rem',
                          borderRadius: '0.5rem',
                          border: '1px solid rgba(245, 210, 108, 0.2)',
                          background: 'rgba(245, 210, 108, 0.05)',
                          color: '#F5D26C',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          transition: 'all 0.2s'
                        }}
                        onMouseOver={(e) => {
                          e.currentTarget.style.borderColor = 'rgba(245, 210, 108, 0.4)'
                          e.currentTarget.style.background = 'rgba(245, 210, 108, 0.1)'
                        }}
                        onMouseOut={(e) => {
                          e.currentTarget.style.borderColor = 'rgba(245, 210, 108, 0.2)'
                          e.currentTarget.style.background = 'rgba(245, 210, 108, 0.05)'
                        }}
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M3 12a9 9 0 0 1 9-9 9 9 0 0 1 9 9 9 9 0 0 1-9 9 9 9 0 0 1-9-9z"/>
                            <path d="M12 3v6l4 2"/>
                          </svg>
                        </button>
                        
                        <button style={{
                          width: '2rem',
                          height: '2rem',
                          borderRadius: '0.5rem',
                          border: '1px solid rgba(239, 68, 68, 0.2)',
                          background: 'rgba(239, 68, 68, 0.05)',
                          color: '#EF4444',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          transition: 'all 0.2s'
                        }}
                        onMouseOver={(e) => {
                          e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.4)'
                          e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)'
                        }}
                        onMouseOut={(e) => {
                          e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.2)'
                          e.currentTarget.style.background = 'rgba(239, 68, 68, 0.05)'
                        }}
                        >
                          <Trash2 style={{ width: '14px', height: '14px' }} />
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Loading State */}
                  <div style={{
                    background: 'rgba(148, 163, 184, 0.1)',
                    border: '1px solid rgba(148, 163, 184, 0.2)',
                    borderRadius: '0.5rem',
                    padding: '0.75rem',
                    marginBottom: '1rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem'
                  }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: '#94a3b8' }}>
                      <path d="M3 12a9 9 0 0 1 9-9 9 9 0 0 1 9 9 9 9 0 0 1-9 9 9 9 0 0 1-9-9z"/>
                      <path d="M12 3v6l4 2"/>
                    </svg>
                    <span style={{ color: '#94a3b8', fontSize: '0.875rem' }}>Carregando...</span>
                  </div>

                  {/* URL Section */}
                  <div style={{
                    background: '#20242D',
                    border: '1px solid rgba(148, 163, 184, 0.1)',
                    borderRadius: '0.75rem',
                    padding: '1rem',
                    marginBottom: '1rem'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <BookOpen style={{ width: '1.25rem', height: '1.25rem', color: '#F5D26C' }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ 
                          color: '#94a3b8', 
                          fontSize: '0.75rem', 
                          margin: '0 0 0.25rem 0',
                          fontWeight: '500'
                        }}>
                          URL:
                        </p>
                        <a 
                          href={sourceInfo.url} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          style={{ 
                            color: '#3B82F6', 
                            textDecoration: 'underline',
                            fontSize: '0.875rem',
                            wordBreak: 'break-all',
                            display: 'block'
                          }}
                        >
                          {sourceInfo.url}
                        </a>
                      </div>
                    </div>
                  </div>

                  {/* Notes Section */}
                  <div style={{
                    background: '#20242D',
                    border: '1px solid rgba(148, 163, 184, 0.1)',
                    borderRadius: '0.75rem',
                    padding: '1rem',
                    marginBottom: '1.5rem'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
                      <svg width="1.25rem" height="1.25rem" viewBox="0 0 24 24" fill="none" stroke="#F97316" strokeWidth="2">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                        <polyline points="14,2 14,8 20,8"/>
                        <line x1="16" y1="13" x2="8" y2="13"/>
                        <line x1="16" y1="17" x2="8" y2="17"/>
                        <polyline points="10,9 9,9 8,9"/>
                      </svg>
                      <h4 style={{ 
                        color: '#E8EDF2', 
                        fontSize: '0.875rem', 
                        fontWeight: '600',
                        margin: 0
                      }}>
                        Observações
                      </h4>
                    </div>
                    <p style={{ 
                      color: '#94a3b8', 
                      fontSize: '0.875rem',
                      margin: 0,
                      fontStyle: 'italic'
                    }}>
                      {library.notes || 'Sem observações adicionadas'}
                    </p>
                  </div>

                  {/* Action Buttons */}
                  <div style={{ 
                    display: 'flex', 
                    gap: '0.75rem', 
                    marginBottom: '1rem',
                    flexWrap: 'wrap'
                  }}>
                    <button style={{
                      width: '2.5rem',
                      height: '2.5rem',
                      borderRadius: '0.75rem',
                      border: '1px solid rgba(59, 130, 246, 0.2)',
                      background: 'rgba(59, 130, 246, 0.05)',
                      color: '#3B82F6',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      transition: 'all 0.2s'
                    }}>
                      <ExternalLink style={{ width: '1.25rem', height: '1.25rem' }} />
                    </button>
                    
                    <button style={{
                      width: '2.5rem',
                      height: '2.5rem',
                      borderRadius: '0.75rem',
                      border: '1px solid rgba(147, 51, 234, 0.2)',
                      background: 'rgba(147, 51, 234, 0.05)',
                      color: '#9333EA',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      transition: 'all 0.2s'
                    }}>
                      <svg width="1.25rem" height="1.25rem" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                      </svg>
                    </button>
                    
                    <button style={{
                      width: '2.5rem',
                      height: '2.5rem',
                      borderRadius: '0.75rem',
                      border: '1px solid rgba(234, 88, 12, 0.2)',
                      background: 'rgba(234, 88, 12, 0.05)',
                      color: '#EA580C',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      transition: 'all 0.2s'
                    }}>
                      <svg width="1.25rem" height="1.25rem" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M3 3v18h18"/>
                        <path d="M18.7 8l-5.1 5.2-2.8-2.7L7 14.3"/>
                      </svg>
                    </button>
                    
                    <button style={{
                      width: '2.5rem',
                      height: '2.5rem',
                      borderRadius: '0.75rem',
                      border: '1px solid rgba(34, 197, 94, 0.2)',
                      background: 'rgba(34, 197, 94, 0.05)',
                      color: '#22C55E',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      transition: 'all 0.2s'
                    }}>
                      <Folder style={{ width: '1.25rem', height: '1.25rem' }} />
                    </button>
                    
                    <button style={{
                      width: '2.5rem',
                      height: '2.5rem',
                      borderRadius: '0.75rem',
                      border: '1px solid rgba(245, 210, 108, 0.2)',
                      background: 'rgba(245, 210, 108, 0.05)',
                      color: '#F5D26C',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      transition: 'all 0.2s'
                    }}>
                      <svg width="1.25rem" height="1.25rem" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="12" cy="12" r="3"/>
                        <path d="M12 1v6m0 6v6m11-7h-6m-6 0H1"/>
                      </svg>
                    </button>
                  </div>

                  {/* View Details Button */}
                  <button style={{
                    width: '100%',
                    background: 'linear-gradient(135deg, #8B5CF6 0%, #7C3AED 100%)',
                    color: '#FFFFFF',
                    border: 'none',
                    borderRadius: '0.75rem',
                    padding: '0.875rem 1.5rem',
                    fontSize: '0.875rem',
                    fontWeight: '600',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.5rem',
                    transition: 'all 0.2s',
                    boxShadow: '0 4px 12px rgba(139, 92, 246, 0.3)'
                  }}
                  onMouseOver={(e) => {
                    e.currentTarget.style.transform = 'translateY(-1px)'
                    e.currentTarget.style.boxShadow = '0 6px 16px rgba(139, 92, 246, 0.4)'
                  }}
                  onMouseOut={(e) => {
                    e.currentTarget.style.transform = 'translateY(0)'
                    e.currentTarget.style.boxShadow = '0 4px 12px rgba(139, 92, 246, 0.3)'
                  }}
                  >
                    Ver Detalhes
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <line x1="12" y1="5" x2="12" y2="19"/>
                      <line x1="5" y1="12" x2="19" y2="12"/>
                    </svg>
                  </button>
                </div>
              )
            })}
          </div>
        ) : (
          <div style={{
            background: '#141823',
            border: '1px solid rgba(245, 210, 108, 0.2)',
            borderRadius: '0.75rem',
            padding: '3rem',
            boxShadow: '0 6px 24px rgba(0, 0, 0, 0.35)',
            textAlign: 'center'
          }}>
            <BookOpen style={{ 
              height: '4rem', 
              width: '4rem', 
              color: '#94a3b8', 
              margin: '0 auto 1rem' 
            }} />
            <h3 style={{ 
              fontSize: '1.25rem', 
              fontWeight: '600', 
              color: '#E8EDF2',
              marginBottom: '0.5rem'
            }}>
              Nenhuma biblioteca encontrada
            </h3>
            <p style={{ 
              color: '#94a3b8',
              marginBottom: '1.5rem'
            }}>
              Esta pasta ainda não possui bibliotecas.
            </p>
            <button
              onClick={() => router.push('/biblioteca')}
              style={{
                background: 'linear-gradient(135deg, #F5D26C 0%, #E6B800 100%)',
                color: '#0f1419',
                border: 'none',
                borderRadius: '0.5rem',
                padding: '0.75rem 1.5rem',
                fontSize: '0.875rem',
                fontWeight: '600',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.transform = 'translateY(-1px)'
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(245, 210, 108, 0.3)'
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.transform = 'translateY(0)'
                e.currentTarget.style.boxShadow = 'none'
              }}
            >
              Adicionar Biblioteca
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
