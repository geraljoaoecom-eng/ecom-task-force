'use client';

import { useState } from 'react';
import { Brain, ChevronDown, ChevronUp } from 'lucide-react';

export interface SpyMarketIntelData {
  mecanismos?: string[];
  dores?: string[];
  angulos?: string[];
  hooks?: string[];
  keywords?: string[];
  keywordDetails?: { phrase: string; motivo?: string | null; tipoFunil?: string | null }[];
  raciocinio?: string | null;
  keywordSeedAdapted?: string | null;
  keywordSeedOriginal?: string | null;
  localeNotes?: string | null;
  sinaisRelevancia?: string;
  resumoMercado?: string;
  fallback?: boolean;
  source?: string;
  generatedAt?: string;
}

export function SpyMarketIntel({
  intel,
  status,
}: {
  intel?: SpyMarketIntelData | null;
  status?: string | null;
}) {
  const [open, setOpen] = useState(true);

  if (status === 'running') {
    return (
      <div
        style={{
          background: 'rgba(96,165,250,0.08)',
          border: '1px solid rgba(96,165,250,0.3)',
          borderRadius: '0.75rem',
          padding: '1rem 1.25rem',
          marginBottom: '1.25rem',
          color: '#93c5fd',
          fontSize: '0.875rem',
        }}
      >
        <Brain size={18} style={{ verticalAlign: 'middle', marginRight: '0.5rem' }} />
        Deep Search — a adaptar keywords ao idioma e mercado seleccionados…
      </div>
    );
  }

  if (!intel) return null;

  const Section = ({ title, items }: { title: string; items?: string[] }) =>
    items?.length ? (
      <div style={{ marginBottom: '0.75rem' }}>
        <div style={{ color: '#F5D26C', fontSize: '0.7rem', fontWeight: 700, marginBottom: '0.375rem', letterSpacing: '0.05em' }}>
          {title}
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.375rem' }}>
          {items.map((item) => (
            <span
              key={item}
              style={{
                background: 'rgba(245,210,108,0.1)',
                border: '1px solid rgba(245,210,108,0.2)',
                color: '#E8EDF2',
                padding: '0.25rem 0.5rem',
                borderRadius: '999px',
                fontSize: '0.75rem',
              }}
            >
              {item}
            </span>
          ))}
        </div>
      </div>
    ) : null;

  return (
    <div
      style={{
        background: '#141823',
        border: '1px solid rgba(96,165,250,0.25)',
        borderRadius: '0.75rem',
        marginBottom: '1.25rem',
        overflow: 'hidden',
      }}
    >
      <button
        type="button"
        onClick={() => setOpen(!open)}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          padding: '0.875rem 1.25rem',
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          textAlign: 'left',
        }}
      >
        <Brain size={20} color="#60a5fa" />
        <div style={{ flex: 1 }}>
          <div style={{ color: '#60a5fa', fontWeight: 700, fontSize: '0.9375rem' }}>Deep Search — Intel de Mercado</div>
          {intel.resumoMercado && (
            <div style={{ color: '#94a3b8', fontSize: '0.8125rem', marginTop: '0.25rem' }}>{intel.resumoMercado}</div>
          )}
        </div>
        {intel.fallback && (
          <span style={{ color: '#fcd34d', fontSize: '0.65rem', fontWeight: 600 }}>fallback</span>
        )}
        {open ? <ChevronUp size={18} color="#64748b" /> : <ChevronDown size={18} color="#64748b" />}
      </button>

      {open && (
        <div style={{ padding: '0 1.25rem 1.25rem', borderTop: '1px solid rgba(96,165,250,0.1)' }}>
          {intel.raciocinio && (
            <div
              style={{
                marginTop: '0.75rem',
                marginBottom: '0.75rem',
                padding: '0.75rem',
                background: 'rgba(96,165,250,0.06)',
                borderRadius: '0.5rem',
                color: '#cbd5e1',
                fontSize: '0.8125rem',
                lineHeight: 1.55,
                whiteSpace: 'pre-wrap',
              }}
            >
              {intel.raciocinio}
            </div>
          )}
          <Section title="MECANISMOS EM ALTA" items={intel.mecanismos} />
          <Section title="DORES" items={intel.dores} />
          <Section title="ÂNGULOS" items={intel.angulos} />
          <Section title="HOOKS" items={intel.hooks} />
          {intel.keywordSeedOriginal &&
            intel.keywordSeedAdapted &&
            intel.keywordSeedOriginal.toLowerCase() !== intel.keywordSeedAdapted.toLowerCase() && (
              <div
                style={{
                  marginBottom: '0.75rem',
                  padding: '0.5rem 0.75rem',
                  background: 'rgba(59,130,246,0.1)',
                  border: '1px solid rgba(96,165,250,0.3)',
                  borderRadius: '0.5rem',
                  fontSize: '0.8125rem',
                  color: '#93c5fd',
                }}
              >
                <strong>Semente adaptada ao mercado:</strong>{' '}
                «{intel.keywordSeedOriginal}» → «{intel.keywordSeedAdapted}»
                {intel.localeNotes ? ` — ${intel.localeNotes}` : ''}
              </div>
            )}
          <Section title="KEYWORDS PARA SCRAPE (idioma do mercado)" items={intel.keywords} />
          {intel.sinaisRelevancia && (
            <div style={{ marginTop: '0.5rem', color: '#64748b', fontSize: '0.8125rem' }}>
              <strong style={{ color: '#94a3b8' }}>Sinais de relevância:</strong> {intel.sinaisRelevancia}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
