'use client';

import { useState } from 'react';
import { ChevronDown, ChevronUp, Copy, Image as ImageIcon, Video } from 'lucide-react';

export interface SpyAdAsset {
  adText?: string;
  imageUrl?: string | null;
  videoUrl?: string | null;
  landingUrl?: string | null;
  videoTranscript?: string | null;
}

export function SpyAdAssets({ assets }: { assets: SpyAdAsset[] }) {
  const [open, setOpen] = useState(false);
  const list = (assets || []).filter(
    (a) => a.adText || a.imageUrl || a.videoUrl || a.landingUrl || a.videoTranscript
  );

  if (!list.length) return null;

  const copyText = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // ignore
    }
  };

  return (
    <div
      style={{
        marginTop: '0.5rem',
        marginBottom: '0.75rem',
        marginLeft: '1.625rem',
        background: 'rgba(12,15,20,0.6)',
        border: '1px solid rgba(245,210,108,0.12)',
        borderRadius: '0.5rem',
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
          padding: '0.5rem 0.75rem',
          background: 'transparent',
          border: 'none',
          color: '#94a3b8',
          cursor: 'pointer',
          fontSize: '0.8125rem',
          fontWeight: 600,
        }}
      >
        <Copy size={14} color="#F5D26C" />
        Copy / criativos ({list.length})
        <span style={{ marginLeft: 'auto' }}>
          {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </span>
      </button>

      {open && (
        <div style={{ padding: '0 0.75rem 0.75rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {list.map((asset, i) => (
            <div
              key={i}
              style={{
                padding: '0.625rem',
                background: '#0c0f14',
                borderRadius: '0.375rem',
                border: '1px solid rgba(245,210,108,0.08)',
              }}
            >
              {asset.adText && (
                <div style={{ marginBottom: '0.5rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                    <span style={{ color: '#64748b', fontSize: '0.7rem', fontWeight: 600 }}>TEXTO</span>
                    <button
                      type="button"
                      onClick={() => copyText(asset.adText!)}
                      style={{
                        background: 'rgba(245,210,108,0.1)',
                        border: '1px solid rgba(245,210,108,0.2)',
                        borderRadius: '0.25rem',
                        color: '#F5D26C',
                        fontSize: '0.65rem',
                        padding: '0.15rem 0.4rem',
                        cursor: 'pointer',
                      }}
                    >
                      Copiar
                    </button>
                  </div>
                  <p style={{ color: '#E8EDF2', fontSize: '0.8125rem', margin: 0, whiteSpace: 'pre-wrap', lineHeight: 1.45 }}>
                    {asset.adText}
                  </p>
                </div>
              )}

              <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'flex-start' }}>
                {asset.imageUrl && (
                  <a href={asset.imageUrl} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none' }}>
                    <div style={{ color: '#64748b', fontSize: '0.65rem', marginBottom: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                      <ImageIcon size={12} /> Imagem
                    </div>
                    <img
                      src={asset.imageUrl}
                      alt=""
                      style={{ maxWidth: '140px', maxHeight: '140px', borderRadius: '0.375rem', objectFit: 'cover', border: '1px solid rgba(245,210,108,0.15)' }}
                    />
                  </a>
                )}
                {asset.videoUrl && (
                  <div>
                    <div style={{ color: '#64748b', fontSize: '0.65rem', marginBottom: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                      <Video size={12} /> Vídeo
                    </div>
                    <video
                      src={asset.videoUrl}
                      controls
                      style={{ maxWidth: '220px', maxHeight: '140px', borderRadius: '0.375rem', background: '#000' }}
                    />
                  </div>
                )}
              </div>

              {asset.videoTranscript && (
                <div style={{ marginTop: '0.5rem' }}>
                  <div style={{ color: '#64748b', fontSize: '0.7rem', fontWeight: 600, marginBottom: '0.25rem' }}>TRANSCRIÇÃO VÍDEO</div>
                  <p style={{ color: '#94a3b8', fontSize: '0.8125rem', margin: 0, whiteSpace: 'pre-wrap', lineHeight: 1.45, fontStyle: 'italic' }}>
                    {asset.videoTranscript}
                  </p>
                </div>
              )}

              {asset.landingUrl && (
                <a
                  href={asset.landingUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ display: 'inline-block', marginTop: '0.5rem', color: '#60a5fa', fontSize: '0.75rem' }}
                >
                  Landing page →
                </a>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
