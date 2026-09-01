'use client';

import { useMemo, useState } from 'react';
import { Brain, Loader2, RefreshCw, Sparkles, Check } from 'lucide-react';
import type { SpyMarketIntelData } from './SpyMarketIntel';

export function SpyKeywordPreviewPanel({
  intel,
  keywords,
  onKeywordsChange,
  onRegenerate,
  onRefine,
  onAccept,
  loading,
  refineLoading,
}: {
  intel: SpyMarketIntelData;
  keywords: string[];
  onKeywordsChange: (keywords: string[]) => void;
  onRegenerate: () => void;
  onRefine: (feedback: string) => void;
  onAccept: () => void;
  loading?: boolean;
  refineLoading?: boolean;
}) {
  const [refineText, setRefineText] = useState('');
  const [showRefine, setShowRefine] = useState(false);

  const detailsByPhrase = useMemo(() => {
    const map = new Map<string, { motivo?: string | null; tipoFunil?: string | null }>();
    for (const d of intel.keywordDetails || []) {
      if (d.phrase) map.set(d.phrase.toLowerCase(), d);
    }
    return map;
  }, [intel.keywordDetails]);

  const textareaValue = keywords.join('\n');

  return (
    <div
      style={{
        background: '#0f1319',
        border: '1px solid rgba(96,165,250,0.35)',
        borderRadius: '0.75rem',
        padding: '1rem 1.25rem',
        marginTop: '1rem',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
        <Brain size={20} color="#60a5fa" />
        <div style={{ flex: 1 }}>
          <div style={{ color: '#60a5fa', fontWeight: 700, fontSize: '0.9375rem' }}>
            Plano GPT — revê antes de pesquisar
          </div>
          {intel.resumoMercado && (
            <div style={{ color: '#94a3b8', fontSize: '0.8125rem', marginTop: '0.25rem' }}>
              {intel.resumoMercado}
            </div>
          )}
        </div>
        {intel.fallback && (
          <span style={{ color: '#fcd34d', fontSize: '0.65rem', fontWeight: 600 }}>fallback</span>
        )}
      </div>

      {intel.raciocinio && (
        <div
          style={{
            color: '#cbd5e1',
            fontSize: '0.8125rem',
            lineHeight: 1.55,
            marginBottom: '1rem',
            whiteSpace: 'pre-wrap',
            padding: '0.75rem',
            background: 'rgba(96,165,250,0.06)',
            borderRadius: '0.5rem',
            border: '1px solid rgba(96,165,250,0.15)',
          }}
        >
          {intel.raciocinio}
        </div>
      )}

      <label style={{ color: '#94a3b8', fontSize: '0.75rem', display: 'block', marginBottom: '0.375rem' }}>
        Keywords para scrape ({keywords.length}) — podes editar (uma por linha)
      </label>
      <textarea
        value={textareaValue}
        onChange={(e) => {
          const list = e.target.value
            .split('\n')
            .map((k) => k.trim())
            .filter(Boolean);
          onKeywordsChange(list);
        }}
        rows={Math.min(12, Math.max(5, keywords.length + 1))}
        style={{
          width: '100%',
          padding: '0.625rem',
          background: '#0c0f14',
          border: '1px solid rgba(245,210,108,0.2)',
          borderRadius: '0.5rem',
          color: '#E8EDF2',
          boxSizing: 'border-box',
          fontSize: '0.8125rem',
          fontFamily: 'inherit',
          lineHeight: 1.45,
          marginBottom: '0.75rem',
        }}
      />

      {keywords.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.375rem', marginBottom: '0.75rem' }}>
          {keywords.slice(0, 8).map((kw) => {
            const meta = detailsByPhrase.get(kw.toLowerCase());
            return (
              <span
                key={kw}
                title={meta?.motivo || undefined}
                style={{
                  background: 'rgba(245,210,108,0.1)',
                  border: '1px solid rgba(245,210,108,0.2)',
                  color: '#E8EDF2',
                  padding: '0.25rem 0.5rem',
                  borderRadius: '999px',
                  fontSize: '0.7rem',
                }}
              >
                {kw}
                {meta?.tipoFunil ? ` · ${meta.tipoFunil}` : ''}
              </span>
            );
          })}
          {keywords.length > 8 && (
            <span style={{ color: '#64748b', fontSize: '0.7rem', alignSelf: 'center' }}>
              +{keywords.length - 8} mais
            </span>
          )}
        </div>
      )}

      {showRefine && (
        <div style={{ marginBottom: '0.75rem' }}>
          <label style={{ color: '#94a3b8', fontSize: '0.75rem' }}>
            Pedido de refinamento (como no ChatGPT)
          </label>
          <textarea
            value={refineText}
            onChange={(e) => setRefineText(e.target.value)}
            placeholder='Ex.: "Mais 10 focadas em VSL" ou "Evita termos genéricos, só quiz e desafio 21 dias"'
            rows={2}
            style={{
              width: '100%',
              marginTop: '0.375rem',
              padding: '0.625rem',
              background: '#0c0f14',
              border: '1px solid rgba(245,210,108,0.2)',
              borderRadius: '0.5rem',
              color: '#E8EDF2',
              boxSizing: 'border-box',
              fontSize: '0.8125rem',
            }}
          />
          <button
            type="button"
            disabled={!refineText.trim() || refineLoading || loading}
            onClick={() => {
              onRefine(refineText.trim());
              setRefineText('');
              setShowRefine(false);
            }}
            style={{
              marginTop: '0.5rem',
              padding: '0.5rem 0.875rem',
              background: refineLoading ? '#555' : 'rgba(96,165,250,0.2)',
              color: '#93c5fd',
              border: '1px solid rgba(96,165,250,0.4)',
              borderRadius: '0.5rem',
              cursor: refineLoading ? 'not-allowed' : 'pointer',
              fontSize: '0.8125rem',
              fontWeight: 600,
            }}
          >
            {refineLoading ? 'A refinar…' : 'Enviar refinamento'}
          </button>
        </div>
      )}

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
        <button
          type="button"
          disabled={loading || refineLoading || keywords.length === 0}
          onClick={onAccept}
          style={{
            flex: '1 1 180px',
            padding: '0.75rem',
            background: loading || keywords.length === 0 ? '#666' : '#10B981',
            color: '#fff',
            border: 'none',
            borderRadius: '0.5rem',
            fontWeight: 600,
            cursor: loading || keywords.length === 0 ? 'not-allowed' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.375rem',
          }}
        >
          <Check size={16} /> Aceitar e pesquisar
        </button>
        <button
          type="button"
          disabled={loading || refineLoading}
          onClick={onRegenerate}
          style={{
            padding: '0.75rem 1rem',
            background: 'transparent',
            color: '#94a3b8',
            border: '1px solid rgba(148,163,184,0.35)',
            borderRadius: '0.5rem',
            cursor: loading ? 'not-allowed' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.375rem',
            fontSize: '0.8125rem',
          }}
        >
          {loading ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <RefreshCw size={14} />}
          Regenerar
        </button>
        <button
          type="button"
          disabled={loading || refineLoading}
          onClick={() => setShowRefine(!showRefine)}
          style={{
            padding: '0.75rem 1rem',
            background: 'transparent',
            color: '#93c5fd',
            border: '1px solid rgba(96,165,250,0.35)',
            borderRadius: '0.5rem',
            cursor: loading ? 'not-allowed' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.375rem',
            fontSize: '0.8125rem',
          }}
        >
          <Sparkles size={14} /> Refinar
        </button>
      </div>
    </div>
  );
}
