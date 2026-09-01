'use client';

import { useRef, useState } from 'react';
import { X, Sparkles, Loader2, Upload, Link2, Layers } from 'lucide-react';
import { adminLibraryApi } from '@/lib/api';
import { parseAdsLibraryUrls, parseAdsLibraryUrlsFromFile } from '@/lib/parse-ads-urls';
import { getApiErrorMessage, isLibraryDuplicateError, LIBRARY_DUPLICATE_MESSAGE } from '@/lib/library-messages';
import { useBulkImport } from '@/context/BulkImportContext';

interface ImportLibraryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

interface DraftLibrary {
  name: string;
  sourceType: string;
  sourceValue: string;
  pages: string[];
  nichos: string;
  estrategias: string;
  produtos: string;
  idiomas: string;
  paises: string;
  notes: string;
  nota: string;
  activeAdsEstimate?: number;
  analysis?: {
    isCloaker?: boolean;
    websiteFound?: string | null;
    confidence?: Record<string, unknown>;
  };
}

type Tab = 'single' | 'bulk';

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '0.625rem',
  background: '#0c0f14',
  border: '1px solid rgba(245,210,108,0.2)',
  borderRadius: '0.5rem',
  color: '#E8EDF2',
  boxSizing: 'border-box',
};

const tabStyle = (active: boolean): React.CSSProperties => ({
  flex: 1,
  padding: '0.625rem',
  borderRadius: '0.5rem',
  border: active ? '1px solid rgba(245,210,108,0.4)' : '1px solid transparent',
  background: active ? 'rgba(245,210,108,0.12)' : 'transparent',
  color: active ? '#F5D26C' : '#94a3b8',
  cursor: 'pointer',
  fontWeight: 600,
  fontSize: '0.875rem',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '0.375rem',
});

export function ImportLibraryModal({ isOpen, onClose, onSuccess }: ImportLibraryModalProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { running: bulkRunning, startBulkImport } = useBulkImport();
  const [tab, setTab] = useState<Tab>('single');

  const [url, setUrl] = useState('');
  const [bulkText, setBulkText] = useState('');
  const [bulkUrls, setBulkUrls] = useState<string[]>([]);
  const [fileName, setFileName] = useState('');

  const [analyzing, setAnalyzing] = useState(false);
  const [creating, setCreating] = useState(false);

  const [draft, setDraft] = useState<DraftLibrary | null>(null);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const resetForm = () => {
    setUrl('');
    setBulkText('');
    setBulkUrls([]);
    setFileName('');
    setDraft(null);
    setError('');
    setTab('single');
  };

  const handleClose = () => {
    onClose();
    resetForm();
  };

  const syncBulkUrls = (text: string) => {
    setBulkText(text);
    setBulkUrls(parseAdsLibraryUrls(text));
  };

  const handleFileUpload = async (file: File | null) => {
    if (!file) return;
    setFileName(file.name);
    try {
      const urls = await parseAdsLibraryUrlsFromFile(file);
      setBulkUrls(urls);
      setBulkText(urls.join('\n'));
    } catch {
      setError('Não foi possível ler o ficheiro.');
    }
  };

  const handleAnalyze = async () => {
    if (!url.trim()) return;
    setAnalyzing(true);
    setError('');
    setDraft(null);
    try {
      const result = await adminLibraryApi.analyze(url.trim());
      setDraft({
        ...result.draft,
        pages: result.draft.pages?.length ? result.draft.pages : [''],
      });
    } catch (err: any) {
      setError(isLibraryDuplicateError(err) ? LIBRARY_DUPLICATE_MESSAGE : getApiErrorMessage(err, 'Erro ao analisar biblioteca'));
    } finally {
      setAnalyzing(false);
    }
  };

  const handleCreate = async () => {
    if (!draft?.name?.trim() || !draft?.sourceValue?.trim()) return;
    setCreating(true);
    setError('');
    try {
      await adminLibraryApi.import({
        ...draft,
        pages: draft.pages.filter((p) => p.trim()),
      });
      onSuccess();
      handleClose();
    } catch (err: any) {
      setError(isLibraryDuplicateError(err) ? LIBRARY_DUPLICATE_MESSAGE : getApiErrorMessage(err, 'Erro ao criar biblioteca'));
    } finally {
      setCreating(false);
    }
  };

  const handleBulkImport = () => {
    const urls = bulkUrls.length ? bulkUrls : parseAdsLibraryUrls(bulkText);
    if (!urls.length) {
      setError('Nenhum link válido da Ads Library encontrado.');
      return;
    }
    if (bulkRunning) {
      setError('Já há uma importação em massa a correr em segundo plano.');
      return;
    }

    void startBulkImport(urls);
    handleClose();
  };

  const updateDraft = (field: keyof DraftLibrary, value: string) => {
    if (!draft) return;
    setDraft({ ...draft, [field]: value });
  };

  const updatePage = (index: number, value: string) => {
    if (!draft) return;
    const pages = [...draft.pages];
    pages[index] = value;
    setDraft({ ...draft, pages });
  };

  const detectedCount = bulkUrls.length || parseAdsLibraryUrls(bulkText).length;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0,0,0,0.6)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10000,
        padding: '1rem',
      }}
    >
      <div
        style={{
          background: '#141823',
          border: '1px solid rgba(245,210,108,0.2)',
          borderRadius: '0.75rem',
          width: 'min(720px, 100%)',
          maxHeight: '95vh',
          overflow: 'auto',
          padding: '1.25rem',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h2 style={{ color: '#F5D26C', margin: 0, fontSize: '1.125rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Sparkles size={20} /> Importar Bibliotecas (Admin)
          </h2>
          <button onClick={handleClose} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}>
            <X size={20} />
          </button>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
          <button type="button" style={tabStyle(tab === 'single')} onClick={() => !bulkRunning && setTab('single')}>
            <Link2 size={16} /> 1 link
          </button>
          <button type="button" style={tabStyle(tab === 'bulk')} onClick={() => !bulkRunning && setTab('bulk')}>
            <Layers size={16} /> Em massa
          </button>
        </div>

        {error && (
          <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#fca5a5', padding: '0.75rem', borderRadius: '0.5rem', marginBottom: '1rem', fontSize: '0.875rem' }}>
            {error}
          </div>
        )}

        {tab === 'single' && (
          <>
            <p style={{ color: '#94a3b8', fontSize: '0.875rem', marginTop: 0 }}>
              Cola o link da Facebook Ads Library. O sistema analisa os anúncios (Saiba Mais), preenche filtros e cria o card.
            </p>

            <label style={{ display: 'block', color: '#E8EDF2', fontSize: '0.875rem', marginBottom: '0.25rem' }}>Link da Ads Library *</label>
            <input type="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://www.facebook.com/ads/library/?..." style={{ ...inputStyle, marginBottom: '0.75rem' }} />

            <button
              onClick={handleAnalyze}
              disabled={analyzing || !url.trim()}
              style={{
                width: '100%', padding: '0.75rem', marginBottom: '1rem',
                background: analyzing ? '#666' : '#F5D26C', color: '#0c0f14', border: 'none',
                borderRadius: '0.5rem', fontWeight: 600, cursor: analyzing ? 'not-allowed' : 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
              }}
            >
              {analyzing ? <><Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> A analisar...</> : 'Analisar link'}
            </button>

            {draft && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {draft.analysis?.isCloaker && (
                  <div style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)', color: '#fcd34d', padding: '0.75rem', borderRadius: '0.5rem', fontSize: '0.875rem' }}>
                    Cloaker detectado — página de vendas: CLOAKER.com
                  </div>
                )}
                {draft.activeAdsEstimate ? (
                  <div style={{ color: '#94a3b8', fontSize: '0.875rem' }}>~{draft.activeAdsEstimate} anúncios ativos</div>
                ) : null}
                {[['name', 'Nome'], ['sourceValue', 'URL Ads Library']].map(([field, label]) => (
                  <div key={field}>
                    <label style={{ display: 'block', color: '#E8EDF2', fontSize: '0.875rem', marginBottom: '0.25rem' }}>{label}</label>
                    <input value={(draft as any)[field]} onChange={(e) => updateDraft(field as keyof DraftLibrary, e.target.value)} style={inputStyle} />
                  </div>
                ))}
                <div>
                  <label style={{ display: 'block', color: '#E8EDF2', fontSize: '0.875rem', marginBottom: '0.25rem' }}>Página de vendas</label>
                  <input value={draft.pages[0] || ''} onChange={(e) => updatePage(0, e.target.value)} style={inputStyle} />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  {[['nichos', 'Nicho'], ['estrategias', 'Estratégia'], ['produtos', 'Produto'], ['idiomas', 'Idioma'], ['paises', 'País']].map(([field, label]) => (
                    <div key={field}>
                      <label style={{ display: 'block', color: '#E8EDF2', fontSize: '0.8rem', marginBottom: '0.25rem' }}>{label}</label>
                      <input value={(draft as any)[field] || ''} onChange={(e) => updateDraft(field as keyof DraftLibrary, e.target.value)} placeholder="Vazio se incerto" style={inputStyle} />
                    </div>
                  ))}
                </div>
                <button onClick={handleCreate} disabled={creating} style={{ width: '100%', padding: '0.75rem', background: creating ? '#666' : '#10B981', color: '#fff', border: 'none', borderRadius: '0.5rem', fontWeight: 600, cursor: creating ? 'not-allowed' : 'pointer' }}>
                  {creating ? 'A criar...' : 'Criar biblioteca'}
                </button>
              </div>
            )}
          </>
        )}

        {tab === 'bulk' && (
          <>
            <p style={{ color: '#94a3b8', fontSize: '0.875rem', marginTop: 0 }}>
              Cola vários links (um por linha) ou carrega um ficheiro <strong style={{ color: '#E8EDF2' }}>.txt</strong> ou <strong style={{ color: '#E8EDF2' }}>.csv</strong>. Cada link demora ~1–2 min — podes fechar o modal, navegar ou fazer refresh.
            </p>

            {bulkRunning && (
              <div style={{ background: 'rgba(245,210,108,0.08)', border: '1px solid rgba(245,210,108,0.25)', color: '#fcd34d', padding: '0.75rem', borderRadius: '0.5rem', marginBottom: '1rem', fontSize: '0.875rem' }}>
                Importação em curso em segundo plano — vê o progresso no canto inferior direito.
              </div>
            )}

            <label style={{ display: 'block', color: '#E8EDF2', fontSize: '0.875rem', marginBottom: '0.25rem' }}>Links (um por linha)</label>
            <textarea
              value={bulkText}
              onChange={(e) => syncBulkUrls(e.target.value)}
              rows={6}
              placeholder={'https://www.facebook.com/ads/library/?...\nhttps://www.facebook.com/ads/library/?...'}
              disabled={bulkRunning}
              style={{ ...inputStyle, marginBottom: '0.75rem', resize: 'vertical', fontFamily: 'inherit' }}
            />

            <div
              onClick={() => !bulkRunning && fileInputRef.current?.click()}
              style={{
                border: '1px dashed rgba(245,210,108,0.35)',
                borderRadius: '0.5rem',
                padding: '1rem',
                textAlign: 'center',
                cursor: bulkRunning ? 'not-allowed' : 'pointer',
                marginBottom: '0.75rem',
                background: 'rgba(245,210,108,0.03)',
              }}
            >
              <Upload size={20} color="#F5D26C" style={{ margin: '0 auto 0.5rem' }} />
              <div style={{ color: '#E8EDF2', fontSize: '0.875rem' }}>
                {fileName ? `Ficheiro: ${fileName}` : 'Carregar ficheiro .txt ou .csv'}
              </div>
              <div style={{ color: '#64748b', fontSize: '0.75rem', marginTop: '0.25rem' }}>Clica ou arrasta para aqui</div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".txt,.csv,text/plain,text/csv"
                style={{ display: 'none' }}
                onChange={(e) => handleFileUpload(e.target.files?.[0] || null)}
              />
            </div>

            <div style={{ color: '#94a3b8', fontSize: '0.875rem', marginBottom: '0.75rem' }}>
              {detectedCount} link{detectedCount !== 1 ? 's' : ''} válido{detectedCount !== 1 ? 's' : ''} detectado{detectedCount !== 1 ? 's' : ''}
            </div>

            <button
              onClick={handleBulkImport}
              disabled={bulkRunning || detectedCount === 0}
              style={{
                width: '100%', padding: '0.75rem',
                background: bulkRunning || detectedCount === 0 ? '#666' : '#F5D26C',
                color: '#0c0f14', border: 'none', borderRadius: '0.5rem', fontWeight: 600,
                cursor: bulkRunning || detectedCount === 0 ? 'not-allowed' : 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
              }}
            >
              {bulkRunning ? 'Importação em curso...' : `Importar ${detectedCount || ''} biblioteca${detectedCount !== 1 ? 's' : ''} em segundo plano`}
            </button>
          </>
        )}

        <style dangerouslySetInnerHTML={{ __html: '@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }' }} />
      </div>
    </div>
  );
}
