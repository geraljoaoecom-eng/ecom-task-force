'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { ChevronDown, ChevronUp, List, Loader2, Pause, Play, ScanSearch, X, XCircle } from 'lucide-react';
import { useSpyJob } from '@/context/SpyJobContext';
import { spyApi } from '@/lib/api';
import { buildSpyFilterChips } from '@/lib/spy-session-filters';

const PHASE_SHORT: Record<string, string> = {
  deep_search: 'DeepSearch',
  keywords: 'Keywords',
  keyword: 'Keyword',
  meta_collect: 'Scroll',
  meta_filter: 'Filtro DR',
  meta_library: 'Biblioteca',
  enrich: 'Validação',
  complete: 'Concluído',
  done: 'Concluído',
};

type LogEntry = { time: string; phase: string; message: string };

export function SpyProgress() {
  const {
    panelSessions,
    panelVisible,
    expanded,
    setExpanded,
    dismissPanel,
    pauseSession,
    cancelSession,
    resumeSession,
  } = useSpyJob();

  const [logOpen, setLogOpen] = useState(false);
  const [log, setLog] = useState<LogEntry[]>([]);
  const logEndRef = useRef<HTMLDivElement>(null);

  const primary = panelSessions[0];
  const stats = primary?.stats || {};
  const live = (stats.live || null) as SpyLiveState | null;

  // Acumula entradas no log quando a mensagem live muda
  useEffect(() => {
    if (!live?.message) return;
    const entry: LogEntry = {
      time: new Date().toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      phase: PHASE_SHORT[live.phase || ''] || live.phase || 'SPY',
      message: live.message,
    };
    setLog((prev) => {
      // Evita duplicar a mesma mensagem consecutiva
      if (prev.length && prev[prev.length - 1].message === entry.message) return prev;
      return [...prev.slice(-99), entry]; // máx 100 entradas
    });
  }, [live?.message, live?.phase]);

  // Auto-scroll do log para o fim quando abre ou quando chega nova entrada
  useEffect(() => {
    if (logOpen) {
      setTimeout(() => logEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
    }
  }, [logOpen, log.length]);

  // Todos os hooks têm de vir antes de qualquer return condicional (Rules of Hooks)
  const deepStatus = stats.deepSearchStatus;
  const discoveries = primary?.discoveriesCount ?? stats.discoveriesCount ?? 0;
  const keywordsDone = stats.keywordsDone ?? 0;
  const keywordsQueued = stats.keywordsQueued ?? 0;
  const adsScanned = stats.adsScanned ?? 0;
  const adsRelevant = stats.adsRelevant ?? 0;
  const librariesChecked = stats.librariesChecked ?? 0;
  const running = (primary?.status === 'running' || primary?.status === 'queued') ?? false;
  const paused = primary?.status === 'paused';
  const completed = (primary?.status === 'completed' || primary?.status === 'timeout') ?? false;
  const failed = primary?.status === 'failed';
  const errorMessage = primary?.errorMessage as string | undefined;
  const keywordActive = running && ['keyword', 'meta_collect', 'meta_filter', 'meta_library'].includes(live?.phase || '');
  const keywordsDisplay = keywordActive ? keywordsDone + 1 : keywordsDone;
  const pct = keywordsQueued ? Math.min(100, Math.round((keywordsDisplay / keywordsQueued) * 100)) : completed ? 100 : 0;
  const filterChips = primary
    ? buildSpyFilterChips({
        country: primary.country,
        language: primary.language,
        nicho: primary.nicho,
        produto: primary.produto,
        keywordSeed: primary.keywordSeed,
        stats: primary.stats,
        marketIntel: primary.marketIntel,
      })
    : [];

  // Timer de tempo decorrido
  const [elapsed, setElapsed] = useState('');
  useEffect(() => {
    if (!primary?.startedAt) { setElapsed(''); return; }
    const update = () => {
      const secs = Math.floor((Date.now() - new Date(primary.startedAt!).getTime()) / 1000);
      if (secs < 60) setElapsed(`${secs}s`);
      else if (secs < 3600) setElapsed(`${Math.floor(secs / 60)}m ${secs % 60}s`);
      else setElapsed(`${Math.floor(secs / 3600)}h ${Math.floor((secs % 3600) / 60)}m`);
    };
    update();
    const t = setInterval(update, 1000);
    return () => clearInterval(t);
  }, [primary?.startedAt]);


  if (!panelVisible || !panelSessions.length) return null;

  return (
    <div
      style={{
        position: 'fixed',
        bottom: '1.25rem',
        left: '1.25rem',
        width: expanded ? 'min(400px, calc(100vw - 2rem))' : 'auto',
        maxWidth: '400px',
        background: '#141823',
        border: '1px solid rgba(96,165,250,0.35)',
        borderRadius: '0.75rem',
        boxShadow: '0 8px 32px rgba(0,0,0,0.45)',
        zIndex: 9998,
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.625rem',
          padding: '0.875rem 1rem',
          cursor: 'pointer',
          userSelect: 'none',
        }}
        onClick={() => setExpanded(!expanded)}
      >
        {running ? (
          <Loader2 size={18} color="#60a5fa" style={{ animation: 'spySpin 1s linear infinite', flexShrink: 0 }} />
        ) : (
          <ScanSearch size={18} color="#60a5fa" style={{ flexShrink: 0 }} />
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ color: '#60a5fa', fontWeight: 600, fontSize: '0.875rem' }}>
            {deepStatus === 'running'
              ? 'Deep Search…'
              : running
                ? 'SPY a pesquisar…'
                : paused
                  ? 'SPY pausada'
                  : failed
                    ? '⚠️ SPY — erro'
                    : completed
                      ? 'SPY concluída ✓'
                      : 'SPY'}
          </div>
          <div style={{ color: '#94a3b8', fontSize: '0.75rem', marginTop: '0.125rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {primary.name}
          </div>
          {filterChips.length > 0 && (
            <div style={{ color: '#64748b', fontSize: '0.6875rem', marginTop: '0.2rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {filterChips.join(' · ')}
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setExpanded(!expanded);
          }}
          style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '0.25rem' }}
        >
          {expanded ? <ChevronDown size={18} /> : <ChevronUp size={18} />}
        </button>
        {!running && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              dismissPanel();
            }}
            style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '0.25rem' }}
          >
            <X size={18} />
          </button>
        )}
      </div>

      {expanded && (
        <div style={{ padding: '0 1rem 1rem' }}>
          {failed && errorMessage && (
            <div style={{
              marginBottom: '0.625rem', padding: '0.5rem 0.625rem', fontSize: '0.7rem', lineHeight: 1.4,
              background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.4)', borderRadius: '0.375rem', color: '#fca5a5',
            }}>
              <strong>Erro:</strong> {errorMessage}
            </div>
          )}
          {filterChips.length > 0 && (
            <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap', marginBottom: '0.625rem' }}>
              {filterChips.map((chip) => (
                <span key={chip} style={filterChipStyle}>{chip}</span>
              ))}
            </div>
          )}
          <div style={{ marginBottom: '0.75rem' }}>
            <div style={{ height: '5px', background: '#0c0f14', borderRadius: '999px', overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${pct}%`, background: '#60a5fa', transition: 'width 0.3s' }} />
            </div>
            <div style={{ color: '#64748b', fontSize: '0.75rem', marginTop: '0.375rem' }}>
              Keywords: {keywordsDisplay}/{keywordsQueued} · Ads: {adsScanned} · Discoveries: {discoveries}
              {elapsed && <span style={{ marginLeft: '0.4rem', color: '#475569' }}>· ⏱ {elapsed}</span>}
            </div>
            {(running || paused) && live?.message && (
              <div style={{ marginTop: '0.625rem' }}>
                <SpyLiveFeed live={live} compact />
              </div>
            )}
            <div style={{ color: '#64748b', fontSize: '0.75rem', marginTop: '0.25rem' }}>
              {completed
                ? `${discoveries} discoveries prontos para importar.`
                : 'Podes navegar ou fazer refresh — a pesquisa continua no servidor.'}
            </div>
          </div>

          {/* Estatísticas detalhadas */}
          {(adsRelevant > 0 || librariesChecked > 0) && (
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.625rem' }}>
              {adsRelevant > 0 && (
                <span style={chipStyle}>{adsRelevant} DR relevantes</span>
              )}
              {librariesChecked > 0 && (
                <span style={chipStyle}>{librariesChecked} bibliotecas verificadas</span>
              )}
              {discoveries > 0 && (
                <span style={{ ...chipStyle, borderColor: 'rgba(245,210,108,0.4)', color: '#F5D26C' }}>
                  {discoveries} discoveries
                </span>
              )}
            </div>
          )}

          <div style={{ display: 'flex', gap: '0.375rem', flexWrap: 'wrap' }}>
            {running && (
              <button type="button" onClick={() => pauseSession(primary.id)} style={btnStyle('#fcd34d')}>
                <Pause size={14} /> Pausar
              </button>
            )}
            {paused && (
              <button type="button" onClick={() => resumeSession(primary.id)} style={btnStyle('#4ade80')}>
                <Play size={14} /> Retomar
              </button>
            )}
            {(running || paused) && (
              <button type="button" onClick={() => cancelSession(primary.id)} style={btnStyle('#f87171')}>
                <XCircle size={14} /> Cancelar
              </button>
            )}
            <Link href={`/spy/${primary.id}`} style={{ ...btnStyle('#60a5fa'), textDecoration: 'none' }}>
              Ver discoveries
            </Link>
            {log.length > 0 && (
              <button type="button" onClick={() => setLogOpen(!logOpen)} style={btnStyle('#94a3b8')}>
                <List size={14} /> Log {logOpen ? '▲' : '▼'}
              </button>
            )}
          </div>

          {/* Log em tempo real */}
          {logOpen && log.length > 0 && (
            <div style={{
              marginTop: '0.625rem',
              maxHeight: '180px',
              overflowY: 'auto',
              background: '#0c0f14',
              border: '1px solid rgba(100,116,139,0.25)',
              borderRadius: '0.375rem',
              padding: '0.5rem 0.625rem',
              fontFamily: 'monospace',
              fontSize: '0.6875rem',
              lineHeight: 1.6,
            }}>
              {log.map((e, i) => (
                <div key={i} style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.125rem' }}>
                  <span style={{ color: '#475569', flexShrink: 0 }}>{e.time}</span>
                  <span style={{ color: '#60a5fa', flexShrink: 0, minWidth: '70px' }}>{e.phase}</span>
                  <span style={{ color: '#cbd5e1', wordBreak: 'break-word' }}>{e.message}</span>
                </div>
              ))}
              <div ref={logEndRef} />
            </div>
          )}

          {panelSessions.length > 1 && (
            <div style={{ marginTop: '0.75rem', color: '#64748b', fontSize: '0.75rem' }}>
              +{panelSessions.length - 1} pesquisa(s) em paralelo
            </div>
          )}
        </div>
      )}
      <style dangerouslySetInnerHTML={{ __html: '@keyframes spySpin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }' }} />
    </div>
  );
}

function btnStyle(color: string): React.CSSProperties {
  return {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.25rem',
    padding: '0.35rem 0.625rem',
    background: `${color}18`,
    border: `1px solid ${color}44`,
    borderRadius: '0.375rem',
    color,
    fontSize: '0.75rem',
    fontWeight: 600,
    cursor: 'pointer',
  };
}

const filterChipStyle: React.CSSProperties = {
  fontSize: '0.6875rem',
  padding: '0.2rem 0.5rem',
  borderRadius: '0.3rem',
  background: 'rgba(96,165,250,0.08)',
  border: '1px solid rgba(96,165,250,0.25)',
  color: '#93c5fd',
  fontWeight: 500,
};

const chipStyle: React.CSSProperties = {
  fontSize: '0.6875rem',
  padding: '0.15rem 0.45rem',
  borderRadius: '0.25rem',
  background: 'rgba(15,23,42,0.6)',
  border: '1px solid rgba(100,116,139,0.35)',
  color: '#94a3b8',
};
