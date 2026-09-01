'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Copy, Loader2, Search } from 'lucide-react'
import AdminGuard from '../../../../components/AdminGuard'
import { spyApi } from '@/lib/api'

export default function SpyCopyBankPage({ params }: { params: { id: string } }) {
  const sessionId = params.id
  const [session, setSession] = useState<any>(null)
  const [items, setItems] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState('')
  const [copied, setCopied] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const [s, bank] = await Promise.all([
        spyApi.getSession(sessionId),
        spyApi.getCopyBank(sessionId, q || undefined),
      ])
      setSession(s)
      setItems(bank.items || [])
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }, [sessionId, q])

  useEffect(() => {
    setLoading(true)
    const t = setTimeout(load, q ? 300 : 0)
    return () => clearTimeout(t)
  }, [load, q])

  const copyText = async (id: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(id)
      setTimeout(() => setCopied(null), 1500)
    } catch {
      // ignore
    }
  }

  const copyAll = async () => {
    const texts = items.map((i) => i.adText).filter(Boolean)
    if (!texts.length) return
    await copyText('all', texts.join('\n\n---\n\n'))
  }

  if (loading && !session) {
    return (
      <AdminGuard>
        <div style={{ color: '#94a3b8', padding: '2rem', textAlign: 'center' }}>
          <Loader2 size={24} style={{ animation: 'spin 1s linear infinite' }} />
        </div>
      </AdminGuard>
    )
  }

  return (
    <AdminGuard>
      <div style={{ maxWidth: '900px', margin: '0 auto' }}>
        <Link href={`/spy/${sessionId}`} style={{ color: '#94a3b8', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '0.375rem', marginBottom: '1rem', fontSize: '0.875rem' }}>
          <ArrowLeft size={16} /> Voltar aos discoveries
        </Link>

        <h1 style={{ color: '#F5D26C', fontSize: '1.5rem', margin: '0 0 0.25rem' }}>Copy Bank</h1>
        <p style={{ color: '#64748b', margin: '0 0 1.25rem', fontSize: '0.875rem' }}>
          {session?.name} · {items.length} criativos com texto
        </p>

        <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: '200px', position: 'relative' }}>
            <Search size={16} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} />
            <input
              placeholder="Filtrar copy..."
              value={q}
              onChange={(e) => setQ(e.target.value)}
              style={{ width: '100%', padding: '0.5rem 0.75rem 0.5rem 2.25rem', background: '#0c0f14', border: '1px solid rgba(245,210,108,0.2)', borderRadius: '0.5rem', color: '#E8EDF2', boxSizing: 'border-box' }}
            />
          </div>
          {items.length > 0 && (
            <button
              type="button"
              onClick={copyAll}
              style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', padding: '0.5rem 1rem', background: '#F5D26C', color: '#0c0f14', border: 'none', borderRadius: '0.5rem', fontWeight: 600, cursor: 'pointer' }}
            >
              <Copy size={16} /> Copiar tudo
            </button>
          )}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {items.map((item) => (
            <div
              key={item.id}
              style={{
                background: '#141823',
                border: '1px solid rgba(245,210,108,0.15)',
                borderRadius: '0.625rem',
                padding: '1rem',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem', marginBottom: '0.5rem', flexWrap: 'wrap' }}>
                <div>
                  <div style={{ color: '#E8EDF2', fontWeight: 600, fontSize: '0.875rem' }}>{item.libraryName}</div>
                  {item.keywordOrigin && (
                    <div style={{ color: '#64748b', fontSize: '0.7rem' }}>via «{item.keywordOrigin}»</div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => copyText(item.id, item.adText || '')}
                  style={{
                    padding: '0.35rem 0.75rem',
                    background: copied === item.id ? 'rgba(74,222,128,0.15)' : 'rgba(245,210,108,0.1)',
                    border: '1px solid rgba(245,210,108,0.25)',
                    borderRadius: '0.375rem',
                    color: copied === item.id ? '#4ade80' : '#F5D26C',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  {copied === item.id ? 'Copiado!' : 'Copiar'}
                </button>
              </div>
              <p style={{ color: '#CBD5E1', fontSize: '0.875rem', margin: 0, whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>
                {item.adText}
              </p>
              {item.landingUrl && (
                <a href={item.landingUrl} target="_blank" rel="noopener noreferrer" style={{ color: '#60a5fa', fontSize: '0.75rem', marginTop: '0.5rem', display: 'inline-block' }}>
                  Landing →
                </a>
              )}
            </div>
          ))}
        </div>

        {!items.length && !loading && (
          <div style={{ color: '#64748b', textAlign: 'center', padding: '3rem' }}>
            Ainda sem copy nesta pesquisa. Aparece quando os ads forem analisados.
          </div>
        )}

        <style dangerouslySetInnerHTML={{ __html: '@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }' }} />
      </div>
    </AdminGuard>
  )
}
