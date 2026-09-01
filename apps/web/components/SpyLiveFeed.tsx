'use client';

import { Activity, Brain, Library, Search } from 'lucide-react';

export type SpyLiveState = {
  phase?: string;
  keyword?: string;
  message?: string;
  pagesFound?: number;
  relevant?: number;
  pagesGold?: number;
  pagesRejected?: number;
  libraryVisits?: number;
  libraryVisitsTotal?: number;
  goldCached?: number;
  discoveries?: number;
  keywordsQueued?: number;
  aiAction?: string;
  adsCollected?: number;
  updatedAt?: string;
};

const PHASE_LABEL: Record<string, string> = {
  deep_search: 'Deep Search',
  keywords: 'Fila de keywords',
  keyword: 'Keyword',
  meta_collect: 'Recolha Meta',
  meta_filter: 'Filtro / memória',
  meta_library: 'Biblioteca',
  enrich: 'Validação',
  done: 'Concluído',
};

function phaseIcon(phase?: string) {
  if (phase === 'deep_search') return <Brain size={16} color="#a78bfa" />;
  if (phase === 'meta_library') return <Library size={16} color="#fbbf24" />;
  if (phase?.startsWith('meta')) return <Search size={16} color="#60a5fa" />;
  return <Activity size={16} color="#4ade80" />;
}

export function SpyLiveFeed({
  live,
  compact = false,
}: {
  live?: SpyLiveState | null;
  compact?: boolean;
}) {
  if (!live?.message && !live?.phase) return null;

  const label = PHASE_LABEL[live.phase || ''] || live.phase || 'SPY';
  const updated = live.updatedAt
    ? new Date(live.updatedAt).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    : null;

  const chips: string[] = [];
  if (live.pagesGold != null && live.pagesGold > 0) chips.push(`${live.pagesGold} bibliotecas`);
  if (live.pagesFound != null) chips.push(`${live.pagesFound} páginas`);
  if (live.relevant != null) chips.push(`${live.relevant} relevantes`);
  if (live.libraryVisits != null && live.libraryVisitsTotal != null) {
    chips.push(`biblioteca ${live.libraryVisits}/${live.libraryVisitsTotal}`);
  } else if (live.libraryVisits != null) chips.push(`${live.libraryVisits} biblioteca(s)`);
  if (live.goldCached != null && live.goldCached > 0) chips.push(`${live.goldCached} ouro cache`);
  if (live.discoveries != null && live.discoveries > 0) chips.push(`${live.discoveries} discoveries`);
  if (live.aiAction) chips.push(`AI: ${live.aiAction}`);

  return (
    <div
      style={{
        marginBottom: compact ? '0.75rem' : '1rem',
        padding: compact ? '0.625rem 0.75rem' : '0.875rem 1rem',
        background: 'rgba(59,130,246,0.08)',
        border: '1px solid rgba(96,165,250,0.3)',
        borderRadius: '0.5rem',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem' }}>
        <div style={{ marginTop: '0.125rem', flexShrink: 0 }}>{phaseIcon(live.phase)}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
            <span style={{ color: '#93c5fd', fontWeight: 700, fontSize: compact ? '0.75rem' : '0.8125rem' }}>
              {label}
              {live.keyword ? ` · ${live.keyword}` : ''}
            </span>
            {updated && (
              <span style={{ color: '#475569', fontSize: '0.6875rem' }}>{updated}</span>
            )}
          </div>
          <div
            style={{
              color: '#e2e8f0',
              fontSize: compact ? '0.8125rem' : '0.875rem',
              marginTop: '0.25rem',
              lineHeight: 1.45,
            }}
          >
            {live.message}
          </div>
          {chips.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', marginTop: '0.5rem' }}>
              {chips.map((c) => (
                <span
                  key={c}
                  style={{
                    fontSize: '0.6875rem',
                    padding: '0.15rem 0.45rem',
                    borderRadius: '0.25rem',
                    background: 'rgba(15,23,42,0.6)',
                    border: '1px solid rgba(100,116,139,0.35)',
                    color: '#94a3b8',
                  }}
                >
                  {c}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
