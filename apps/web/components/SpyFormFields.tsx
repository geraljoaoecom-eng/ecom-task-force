'use client'

import { useEffect, useId, useRef, useState } from 'react'

export type CountryOption = { code: string; label: string }
export type LangOption = { value: string; label: string }

const inputStyleBase: React.CSSProperties = {
  width: '100%',
  padding: '0.625rem',
  background: '#0c0f14',
  border: '1px solid rgba(245,210,108,0.2)',
  borderRadius: '0.5rem',
  color: '#E8EDF2',
  boxSizing: 'border-box',
  fontSize: '0.875rem',
}

export function SpyCountryField({
  label,
  value,
  onChange,
  countries,
  inputStyle = inputStyleBase,
}: {
  label: string
  value: string
  onChange: (code: string) => void
  countries: CountryOption[]
  inputStyle?: React.CSSProperties
}) {
  const listId = useId()
  const [text, setText] = useState('')

  useEffect(() => {
    if (!value) {
      setText('')
      return
    }
    const hit = countries.find((c) => c.code === value)
    setText(hit?.label || value)
  }, [value, countries])

  return (
    <div>
      <label style={{ color: '#94a3b8', fontSize: '0.75rem' }}>{label}</label>
      <input
        list={listId}
        style={inputStyle}
        value={text}
        onChange={(e) => {
          const t = e.target.value
          setText(t)
          if (!t) {
            onChange('')
            return
          }
          const hit = countries.find((c) => c.label.toLowerCase() === t.toLowerCase())
          if (hit) onChange(hit.code)
        }}
        onBlur={() => {
          if (!text.trim()) {
            onChange('')
            return
          }
          const hit = countries.find((c) => c.label.toLowerCase() === text.trim().toLowerCase())
          if (hit) {
            onChange(hit.code)
            setText(hit.label)
          }
        }}
        placeholder="Ex.: Brasil, Portugal, Todos os países…"
      />
      <datalist id={listId}>
        {countries.map((c) => (
          <option key={c.code} value={c.label} />
        ))}
      </datalist>
    </div>
  )
}

export function SpyCountryMultiField({
  label,
  values,
  onChange,
  countries,
  inputStyle = inputStyleBase,
}: {
  label: string
  values: string[]
  onChange: (codes: string[]) => void
  countries: CountryOption[]
  inputStyle?: React.CSSProperties
}) {
  const [search, setSearch] = useState('')
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)

  // Fecha dropdown ao clicar fora
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const addCountry = (code: string) => {
    if (code === 'ALL') { onChange(['ALL']); setSearch(''); setOpen(false); return }
    const prev = values.filter((c) => c !== 'ALL')
    if (!prev.includes(code)) onChange([...prev, code])
    setSearch('')
  }

  const removeCountry = (code: string) => onChange(values.filter((c) => c !== code))

  const labelFor = (code: string) =>
    code === 'ALL' ? 'Todos os países' : (countries.find((c) => c.code === code)?.label || code)

  const available = countries.filter(
    (c) => !values.includes(c.code) &&
      (!search || c.label.toLowerCase().includes(search.toLowerCase()))
  )

  return (
    <div ref={wrapRef} style={{ position: 'relative' }}>
      <label style={{ color: '#94a3b8', fontSize: '0.75rem' }}>{label}</label>
      {/* Chips de países seleccionados */}
      {values.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem', marginBottom: '0.375rem' }}>
          {values.map((code) => (
            <span key={code} style={{
              display: 'inline-flex', alignItems: 'center', gap: '0.3rem',
              background: 'rgba(245,210,108,0.12)', border: '1px solid rgba(245,210,108,0.35)',
              borderRadius: '0.375rem', padding: '0.15rem 0.5rem', fontSize: '0.75rem', color: '#F5D26C',
            }}>
              {labelFor(code)}
              <button type="button" onClick={() => removeCountry(code)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: 0, lineHeight: 1, fontSize: '0.85rem' }}>
                ×
              </button>
            </span>
          ))}
        </div>
      )}
      {/* Input de pesquisa */}
      <input
        style={inputStyle}
        value={search}
        onFocus={() => setOpen(true)}
        onChange={(e) => { setSearch(e.target.value); setOpen(true) }}
        placeholder={values.length === 0 ? 'Pesquisa ou clica — vazio = Todos os países' : 'Adicionar país…'}
        autoComplete="off"
      />
      {/* Dropdown customizado */}
      {open && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 999,
          background: '#0c0f14', border: '1px solid rgba(245,210,108,0.3)',
          borderRadius: '0.5rem', maxHeight: '220px', overflowY: 'auto',
          boxShadow: '0 8px 24px rgba(0,0,0,0.5)', marginTop: '2px',
        }}>
          {available.length === 0 ? (
            <div style={{ padding: '0.5rem 0.75rem', color: '#64748b', fontSize: '0.8125rem' }}>
              Sem resultados
            </div>
          ) : (
            available.map((c) => (
              <div
                key={c.code}
                onMouseDown={(e) => { e.preventDefault(); addCountry(c.code) }}
                style={{
                  padding: '0.5rem 0.75rem', cursor: 'pointer', fontSize: '0.8125rem',
                  color: c.code === 'ALL' ? '#F5D26C' : '#E8EDF2',
                  fontWeight: c.code === 'ALL' ? 600 : 400,
                  borderBottom: c.code === 'ALL' ? '1px solid rgba(245,210,108,0.15)' : 'none',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(245,210,108,0.08)')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
              >
                {c.label}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}

export function SpyLanguageField({
  label,
  value,
  onChange,
  languages,
  inputStyle = inputStyleBase,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  languages: LangOption[]
  inputStyle?: React.CSSProperties
}) {
  const listId = useId()

  return (
    <div>
      <label style={{ color: '#94a3b8', fontSize: '0.75rem' }}>{label}</label>
      <input
        list={listId}
        style={inputStyle}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Ex.: Português, Inglês…"
      />
      <datalist id={listId}>
        {languages.map((l) => (
          <option key={l.value} value={l.label} />
        ))}
      </datalist>
    </div>
  )
}

export function SpyCreatableField({
  label,
  value,
  onChange,
  suggestions,
  placeholder,
  inputStyle = inputStyleBase,
  uppercase,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  suggestions: string[]
  placeholder?: string
  inputStyle?: React.CSSProperties
  uppercase?: boolean
}) {
  const listId = useId()

  return (
    <div>
      <label style={{ color: '#94a3b8', fontSize: '0.75rem' }}>{label}</label>
      <input
        list={listId}
        style={inputStyle}
        value={value}
        onChange={(e) => onChange(uppercase ? e.target.value.toUpperCase() : e.target.value)}
        placeholder={placeholder || 'Escreve ou escolhe da lista'}
      />
      <datalist id={listId}>
        {[...new Set(suggestions.filter(Boolean))].map((s) => (
          <option key={s} value={s} />
        ))}
      </datalist>
    </div>
  )
}

export function countryLabelFromOptions(code: string, countries: CountryOption[]) {
  if (!code) return ''
  if (code === 'ALL') return 'Todos os países'
  // Suporta multi-país separado por vírgula
  if (code.includes(',')) {
    return code.split(',').map((c) => countryLabelFromOptions(c.trim(), countries)).join(', ')
  }
  return countries.find((c) => c.code === code)?.label || code
}
