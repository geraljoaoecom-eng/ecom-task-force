'use client'

import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import {
  ExternalLink,
  Settings,
  Folder,
  StickyNote,
  BarChart3,
  Trash2,
  Edit2,
  Plus,
  X,
  RotateCcw,
  Link,
  FileText,
} from 'lucide-react'
import { LibraryConfigPopup } from './LibraryConfigPopup'
import { NotesEditor } from './NotesEditor'
import { ChartModal } from './ChartModal'
import { FolderConfigModal } from './FolderConfigModal'
import { librariesApi } from '@/lib/api'

export interface Library {
  id: string
  name: string
  nota?: string
  sourceType: string
  sourceValue: string
  country?: string
  language?: string
  notes?: string
  activeAds: number
  lastCheckedAt?: string
  createdAt: string
  updatedAt: string
  folder?: { id: string; name: string }
  pages?: { id: string; url: string }[]
  folderId?: string
  status?: string
  nichos?: string
  estrategias?: string
  produtos?: string
  tipos?: string
  idiomas?: string
  paises?: string
}

interface LibraryCardNewProps {
  library: Library
  onUpdate: () => void
  /** Em modo discovery SPY: elimina o discovery, não a biblioteca */
  onDelete?: () => Promise<void>
  deleting?: boolean
  /** SPY: só link Meta + eliminar (evita refresh/config com ID de discovery) */
  discoveryMode?: boolean
}

const TAG = {
  nichos: { bg: 'rgba(59, 130, 246, 0.1)', color: '#60a5fa', border: 'rgba(59, 130, 246, 0.2)' },
  estrategias: { bg: 'rgba(16, 185, 129, 0.1)', color: '#34d399', border: 'rgba(16, 185, 129, 0.2)' },
  produtos: { bg: 'rgba(168, 85, 247, 0.1)', color: '#a78bfa', border: 'rgba(168, 85, 247, 0.2)' },
  idiomas: { bg: 'rgba(249, 115, 22, 0.1)', color: '#fb923c', border: 'rgba(249, 115, 22, 0.2)' },
  paises: { bg: 'rgba(236, 72, 153, 0.1)', color: '#ec4899', border: 'rgba(236, 72, 153, 0.2)' },
} as const

function TagPill({ label, styleKey }: { label: string; styleKey: keyof typeof TAG }) {
  const s = TAG[styleKey]
  return (
    <span
      style={{
        background: s.bg,
        color: s.color,
        padding: '0.2rem 0.5rem',
        borderRadius: '9999px',
        fontSize: '0.7rem',
        fontWeight: 600,
        border: `1px solid ${s.border}`,
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        maxWidth: '100%',
        display: 'inline-block',
      }}
      title={label}
    >
      {label}
    </span>
  )
}

function LibraryTitle({ name }: { name: string }) {
  const ref = useRef<HTMLSpanElement>(null)
  const [tipPos, setTipPos] = useState<{ x: number; y: number } | null>(null)
  const [truncated, setTruncated] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const check = () => setTruncated(el.scrollWidth > el.clientWidth)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [name])

  return (
    <>
      <span
        ref={ref}
        className="lib-card-title"
        onMouseEnter={() => {
          if (!ref.current || !truncated) return
          const r = ref.current.getBoundingClientRect()
          setTipPos({ x: r.left, y: r.top - 6 })
        }}
        onMouseLeave={() => setTipPos(null)}
      >
        {name}
      </span>
      {tipPos &&
        truncated &&
        typeof document !== 'undefined' &&
        createPortal(
          <div className="lib-card-title-tooltip" style={{ left: tipPos.x, top: tipPos.y }}>
            {name}
          </div>,
          document.body
        )}
    </>
  )
}

function IconBtn({
  onClick,
  title,
  color,
  border,
  bg,
  disabled,
  size = 32,
  children,
}: {
  onClick?: (e: React.MouseEvent) => void
  title: string
  color: string
  border: string
  bg: string
  disabled?: boolean
  size?: number
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      style={{
        padding: '0.25rem',
        background: bg,
        border: `1px solid ${border}`,
        borderRadius: size >= 40 ? '0.5rem' : '0.375rem',
        color,
        cursor: disabled ? 'not-allowed' : 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: `${size}px`,
        height: `${size}px`,
        flexShrink: 0,
        transition: 'all 0.15s',
        opacity: disabled ? 0.6 : 1,
        boxShadow: size >= 40 ? '0 2px 4px rgba(0,0,0,0.15)' : undefined,
      }}
    >
      {children}
    </button>
  )
}

function StatusBadge({ active, scraping }: { active: boolean; scraping: boolean }) {
  if (scraping) {
    return (
      <span
        style={{
          background: 'rgba(148,163,184,0.15)',
          color: '#94a3b8',
          padding: '0.25rem 0.5rem',
          borderRadius: '9999px',
          fontSize: '0.7rem',
          fontWeight: 600,
          border: '1px solid rgba(148,163,184,0.25)',
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.25rem',
        }}
      >
        <RotateCcw style={{ width: '0.65rem', height: '0.65rem', animation: 'spin 1s linear infinite' }} />
        Carregando
      </span>
    )
  }
  return (
    <span
      style={{
        background: active ? 'rgba(34,197,94,0.1)' : 'rgba(148,163,184,0.1)',
        color: active ? '#22C55E' : '#94a3b8',
        padding: '0.25rem 0.5rem',
        borderRadius: '9999px',
        fontSize: '0.7rem',
        fontWeight: 600,
        border: active ? '1px solid rgba(34,197,94,0.2)' : '1px solid rgba(148,163,184,0.2)',
      }}
    >
      {active ? 'Ativo' : 'Inativo'}
    </span>
  )
}

export function LibraryCardNew({ library, onUpdate, onDelete, deleting, discoveryMode }: LibraryCardNewProps) {
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [showConfigModal, setShowConfigModal] = useState(false)
  const [showNotesEditor, setShowNotesEditor] = useState(false)
  const [showChartModal, setShowChartModal] = useState(false)
  const [showFolderModal, setShowFolderModal] = useState(false)

  const isScrapingInitial = () => {
    if (library.activeAds > 0) return false
    if (!library.createdAt) return false
    const diffMinutes = (Date.now() - new Date(library.createdAt).getTime()) / 60000
    return diffMinutes < 3 && diffMinutes >= -0.5
  }

  const shortenUrl = (url: string | undefined, maxLength = 60) => {
    if (!url || typeof url !== 'string') return ''
    return url.length <= maxLength ? url : url.substring(0, maxLength) + '...'
  }

  const handleRefresh = async () => {
    setIsRefreshing(true)
    try {
      await librariesApi.refresh(library.id)
      onUpdate()
    } catch {
      alert('Erro ao atualizar biblioteca. Tente novamente.')
    } finally {
      setIsRefreshing(false)
    }
  }

  const handleDelete = async () => {
    if (deleting) return
    const msg = discoveryMode
      ? 'Eliminar este discovery da pesquisa SPY?'
      : 'Eliminar esta biblioteca permanentemente?'
    try {
      if (onDelete) {
        await onDelete()
      } else {
        if (!window.confirm(msg)) return
        await librariesApi.delete(library.id)
        onUpdate()
      }
    } catch (err: unknown) {
      const apiErr = (err as { message?: string })?.message
      alert(apiErr || (discoveryMode ? 'Erro ao eliminar discovery.' : 'Erro ao eliminar biblioteca.'))
    }
  }

  const handleSaveNotes = async (notes: string) => {
    try {
      await librariesApi.update(library.id, { notes })
      onUpdate()
    } catch (error) {
      console.error('Erro ao salvar notas:', error)
      throw error
    }
  }

  const handleFolderChange = async (folderId: string | null) => {
    await librariesApi.update(library.id, { folderId })
    onUpdate()
  }

  const scraping = isScrapingInitial()
  const isActive = library.activeAds > 0

  return (
    <div
      className="lib-card"
      style={{
        background: '#141823',
        border: '1px solid rgba(245,210,108,0.2)',
        borderRadius: '0.75rem',
        boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
        transition: 'border-color 0.2s, box-shadow 0.2s',
        width: '100%',
        boxSizing: 'border-box',
        overflow: 'hidden',
      }}
      onMouseOver={(e) => {
        e.currentTarget.style.borderColor = 'rgba(245,210,108,0.35)'
        e.currentTarget.style.boxShadow = '0 6px 24px rgba(0,0,0,0.4)'
      }}
      onMouseOut={(e) => {
        e.currentTarget.style.borderColor = 'rgba(245,210,108,0.2)'
        e.currentTarget.style.boxShadow = '0 4px 20px rgba(0,0,0,0.3)'
      }}
    >
      {/* Linha 1 — nome + badges contínuos à esquerda */}
      <div className="lib-card-top">
        <LibraryTitle name={library.name} />
        <span className={`lib-card-ads${scraping ? ' loading' : ''}`}>
          {scraping ? (
            <>
              <RotateCcw style={{ width: '0.6rem', height: '0.6rem', animation: 'spin 1s linear infinite', verticalAlign: 'middle', marginRight: '0.15rem' }} />
              ...
            </>
          ) : (
            `${library.activeAds} anúncios`
          )}
        </span>
        {library.folder && <span className="lib-card-folder">{library.folder.name}</span>}
        <StatusBadge active={isActive} scraping={scraping} />
        {library.nichos ? <TagPill label={library.nichos} styleKey="nichos" /> : null}
        {library.estrategias ? <TagPill label={library.estrategias} styleKey="estrategias" /> : null}
        {library.produtos ? <TagPill label={library.produtos} styleKey="produtos" /> : null}
        {library.idiomas ? <TagPill label={library.idiomas} styleKey="idiomas" /> : null}
        {library.paises ? <TagPill label={library.paises} styleKey="paises" /> : null}
      </div>

      {/* Linha 2 — URL + observações (2 colunas no PC) */}
      <div className="lib-card-details">
        <div className="lib-card-detail-box">
          <FileText style={{ height: '0.8rem', width: '0.8rem', color: '#94a3b8', flexShrink: 0 }} />
          <span className="lib-card-detail-label">URL</span>
          <a
            href={library.sourceValue}
            target="_blank"
            rel="noopener noreferrer"
            className="lib-card-detail-link"
            title={library.sourceValue}
          >
            {shortenUrl(library.sourceValue, 70)}
          </a>
        </div>

        <div className="lib-card-detail-box">
          <span className="lib-card-detail-label">📝</span>
          <span
            className={`lib-card-detail-text ${library.notes ? 'notes' : 'muted'}`}
            title={library.notes || 'Sem observações'}
          >
            {library.notes || 'Sem observações'}
          </span>
        </div>

        {library.pages && library.pages.length > 0 && (
          <div className="lib-card-pages">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', marginBottom: '0.125rem' }}>
              <Link style={{ height: '0.75rem', width: '0.75rem', color: '#F5D26C' }} />
              <span style={{ fontSize: '0.7rem', fontWeight: 600, color: '#E8EDF2' }}>Páginas ({library.pages.length})</span>
            </div>
            {library.pages.map((page, index) => (
              <div key={`page-${page.id}-${index}`} className="lib-card-page-row">
                <a
                  href={page.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="lib-card-detail-link"
                  title={page.url}
                >
                  {shortenUrl(page.url, 90)}
                </a>
                <IconBtn
                  title="Editar URL"
                  color="#22C55E"
                  border="rgba(34,197,94,0.3)"
                  bg="rgba(34,197,94,0.15)"
                  onClick={() => {
                    const newUrl = prompt('Editar URL:', page.url)
                    if (newUrl && newUrl !== page.url) console.log('Atualizar página:', page.id, newUrl)
                  }}
                >
                  <Edit2 style={{ height: '0.65rem', width: '0.65rem' }} />
                </IconBtn>
                <IconBtn title="Excluir página" color="#EF4444" border="rgba(239,68,68,0.3)" bg="rgba(239,68,68,0.15)" onClick={() => console.log('Excluir página:', page.id)}>
                  <X style={{ height: '0.65rem', width: '0.65rem' }} />
                </IconBtn>
                <IconBtn
                  title="Adicionar página"
                  color="#3B82F6"
                  border="rgba(59,130,246,0.3)"
                  bg="rgba(59,130,246,0.15)"
                  onClick={() => {
                    const newUrl = prompt('Adicionar nova página (URL):')
                    if (newUrl?.trim()) console.log('Adicionar página:', newUrl.trim(), library.id)
                  }}
                >
                  <Plus style={{ height: '0.65rem', width: '0.65rem' }} />
                </IconBtn>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Barra de ações */}
      <div className="lib-card-actions">
        <a
          href={library.sourceValue}
          target="_blank"
          rel="noopener noreferrer"
          title="Meta Library"
          className="lib-card-action-link"
          onClick={(e) => e.stopPropagation()}
        >
          <ExternalLink style={{ height: '0.9rem', width: '0.9rem' }} />
        </a>
        {!discoveryMode && (
          <>
            <IconBtn size={36} title="Observações" color="#A855F7" border="rgba(168,85,247,0.3)" bg="rgba(168,85,247,0.15)" onClick={() => setShowNotesEditor(true)}>
              <StickyNote style={{ height: '0.9rem', width: '0.9rem' }} />
            </IconBtn>
            <IconBtn size={36} title="Gráfico" color="#F97316" border="rgba(249,115,22,0.3)" bg="rgba(249,115,22,0.15)" onClick={() => setShowChartModal(true)}>
              <BarChart3 style={{ height: '0.9rem', width: '0.9rem' }} />
            </IconBtn>
            <IconBtn size={36} title="Pasta" color="#22C55E" border="rgba(34,197,94,0.3)" bg="rgba(34,197,94,0.15)" onClick={() => setShowFolderModal(true)}>
              <Folder style={{ height: '0.9rem', width: '0.9rem' }} />
            </IconBtn>
            <IconBtn size={36} title="Configurar" color="#F5D26C" border="rgba(245,210,108,0.3)" bg="rgba(245,210,108,0.15)" onClick={() => setShowConfigModal(true)}>
              <Settings style={{ height: '0.9rem', width: '0.9rem' }} />
            </IconBtn>
            <IconBtn size={36} title="Atualizar" color="#F5D26C" border="rgba(245,210,108,0.3)" bg="rgba(245,210,108,0.15)" disabled={isRefreshing} onClick={(e) => { e.stopPropagation(); handleRefresh() }}>
              <RotateCcw style={{ height: '0.9rem', width: '0.9rem', animation: isRefreshing ? 'spin 1s linear infinite' : 'none' }} />
            </IconBtn>
          </>
        )}
        {(onDelete || !discoveryMode) && (
          <IconBtn size={36} title="Eliminar discovery" color="#EF4444" border="rgba(239,68,68,0.3)" bg="rgba(239,68,68,0.15)" onClick={(e) => { e.stopPropagation(); handleDelete() }} disabled={deleting}>
            {deleting ? <RotateCcw style={{ height: '0.9rem', width: '0.9rem', animation: 'spin 1s linear infinite' }} /> : <Trash2 style={{ height: '0.9rem', width: '0.9rem' }} />}
          </IconBtn>
        )}
      </div>

      <style dangerouslySetInnerHTML={{ __html: '@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }' }} />

      {!discoveryMode && (
        <>
          <LibraryConfigPopup isOpen={showConfigModal} onClose={() => setShowConfigModal(false)} library={library} onUpdate={onUpdate} />
          <NotesEditor isOpen={showNotesEditor} onClose={() => setShowNotesEditor(false)} libraryId={library.id} currentNotes={library.notes || ''} onSave={handleSaveNotes} />
          <ChartModal isOpen={showChartModal} onClose={() => setShowChartModal(false)} libraryId={library.id} libraryName={library.name} currentAds={library.activeAds} />
          <FolderConfigModal isOpen={showFolderModal} onClose={() => setShowFolderModal(false)} libraryId={library.id} currentFolderId={library.folderId} onFolderChange={handleFolderChange} />
        </>
      )}
    </div>
  )
}
