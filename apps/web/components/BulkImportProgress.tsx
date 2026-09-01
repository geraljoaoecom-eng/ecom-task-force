'use client';

import { ChevronDown, ChevronUp, Loader2, X, Layers } from 'lucide-react';
import { useBulkImport } from '@/context/BulkImportContext';
import { LIBRARY_DUPLICATE_MESSAGE } from '@/lib/library-messages';

export function BulkImportProgress() {
  const { running, visible, progress, results, expanded, setExpanded, dismiss } = useBulkImport();

  if (!visible) return null;

  const successCount = results.filter((r) => r.status === 'success').length;
  const skippedCount = results.filter((r) => r.status === 'skipped').length;
  const errorCount = results.filter((r) => r.status === 'error').length;
  const pct = progress.total ? Math.round((progress.current / progress.total) * 100) : 0;

  return (
    <div
      style={{
        position: 'fixed',
        bottom: '1.25rem',
        right: '1.25rem',
        width: expanded ? 'min(380px, calc(100vw - 2rem))' : 'auto',
        maxWidth: '380px',
        background: '#141823',
        border: '1px solid rgba(245,210,108,0.3)',
        borderRadius: '0.75rem',
        boxShadow: '0 8px 32px rgba(0,0,0,0.45)',
        zIndex: 9999,
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
          <Loader2 size={18} color="#F5D26C" style={{ animation: 'bulkSpin 1s linear infinite', flexShrink: 0 }} />
        ) : (
          <Layers size={18} color="#F5D26C" style={{ flexShrink: 0 }} />
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ color: '#F5D26C', fontWeight: 600, fontSize: '0.875rem' }}>
            {running
              ? `A importar ${progress.current} / ${progress.total}...`
              : 'Importação concluída'}
          </div>
          {!expanded && (
            <div style={{ color: '#94a3b8', fontSize: '0.75rem', marginTop: '0.125rem' }}>
              {running ? `${pct}%` : `${successCount} ok · ${skippedCount + errorCount} ignorados/erros`}
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
              dismiss();
            }}
            style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '0.25rem' }}
          >
            <X size={18} />
          </button>
        )}
      </div>

      {expanded && (
        <div style={{ padding: '0 1rem 1rem' }}>
          {running && (
            <div style={{ marginBottom: '0.75rem' }}>
              <div style={{ height: '5px', background: '#0c0f14', borderRadius: '999px', overflow: 'hidden' }}>
                <div
                  style={{
                    height: '100%',
                    width: `${pct}%`,
                    background: '#F5D26C',
                    transition: 'width 0.3s',
                  }}
                />
              </div>
              <div style={{ color: '#64748b', fontSize: '0.75rem', marginTop: '0.375rem' }}>
                Podes navegar ou fazer refresh — a importação continua de onde parou.
              </div>
            </div>
          )}

          {!running && (
            <div style={{ color: '#94a3b8', fontSize: '0.8rem', marginBottom: '0.75rem' }}>
              {successCount} importada{successCount !== 1 ? 's' : ''}
              {skippedCount > 0 && ` · ${skippedCount} já existia${skippedCount !== 1 ? 'm' : ''}`}
              {errorCount > 0 && ` · ${errorCount} erro${errorCount !== 1 ? 's' : ''}`}
            </div>
          )}

          {results.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem', maxHeight: '200px', overflowY: 'auto' }}>
              {results.map((result, idx) => (
                <div
                  key={`${result.url}-${idx}`}
                  style={{
                    padding: '0.5rem 0.625rem',
                    borderRadius: '0.375rem',
                    fontSize: '0.75rem',
                    background:
                      result.status === 'success'
                        ? 'rgba(16,185,129,0.08)'
                        : result.status === 'skipped'
                          ? 'rgba(245,158,11,0.08)'
                          : 'rgba(239,68,68,0.08)',
                    border: `1px solid ${
                      result.status === 'success'
                        ? 'rgba(16,185,129,0.25)'
                        : result.status === 'skipped'
                          ? 'rgba(245,158,11,0.25)'
                          : 'rgba(239,68,68,0.25)'
                    }`,
                    color:
                      result.status === 'success'
                        ? '#6ee7b7'
                        : result.status === 'skipped'
                          ? '#fcd34d'
                          : '#fca5a5',
                  }}
                >
                  {result.status === 'success' && `✓ ${result.name}`}
                  {result.status === 'skipped' && `↷ ${LIBRARY_DUPLICATE_MESSAGE}`}
                  {result.status === 'error' && `✗ ${result.message}`}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <style dangerouslySetInnerHTML={{ __html: '@keyframes bulkSpin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }' }} />
    </div>
  );
}
