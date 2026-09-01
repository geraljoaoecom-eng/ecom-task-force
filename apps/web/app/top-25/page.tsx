"use client";

import { useEffect, useMemo, useState } from 'react';
import AuthGuard from '../../components/AuthGuard';
import { librariesApi } from '@/lib/api';
import { RotateCcw } from 'lucide-react';
import { LibraryCardNew } from '../../components/LibraryCardNew';

interface UILibrary {
  id: string;
  name: string;
  activeAds: number;
  country?: string | null;
  language?: string | null;
  sourceType?: string;
  sourceValue?: string;
  folder?: { name: string } | null;
  status?: string;
  nichos?: string;
  estrategias?: string;
  produtos?: string;
  idiomas?: string;
  paises?: string;
  notes?: string;
  tags?: string;
  lastCheckedAt?: string;
  createdAt?: string;
  updatedAt?: string;
}

export default function Top25Page() {
  const [libraries, setLibraries] = useState<UILibrary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isRefreshingAll, setIsRefreshingAll] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        setError('');
        const data = await librariesApi.getAll();
        const normalized = (data || []).map((l: any) => ({
          id: l.id,
          name: l.name,
          activeAds: Number(l.activeAds || 0),
          country: l.country || null,
          language: l.language || null,
          sourceType: l.sourceType,
          sourceValue: l.sourceValue,
          folder: l.folder,
          status: l.status,
          nichos: l.nichos,
          estrategias: l.estrategias,
          produtos: l.produtos,
          idiomas: l.idiomas,
          paises: l.paises,
          notes: l.notes,
          tags: l.tags,
          lastCheckedAt: l.lastCheckedAt,
          createdAt: l.createdAt,
          updatedAt: l.updatedAt,
        }));
        setLibraries(normalized);
      } catch (e: any) {
        setError('Não foi possível carregar as bibliotecas.');
        setLibraries([]);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const orderedTop = useMemo(() => {
    const ordered = [...libraries].sort((a, b) => b.activeAds - a.activeAds);
    return ordered.slice(0, 25);
  }, [libraries]);

  const totalLibraries = libraries.length;
  const totalAds = libraries.reduce((sum, l) => sum + (l.activeAds || 0), 0);
  const avgPerLibrary = totalLibraries > 0 ? Math.round(totalAds / totalLibraries) : 0;

  const handleRefreshAll = async () => {
    setIsRefreshingAll(true);
    try {
      console.log('🔄 Atualizando todas as bibliotecas...');
      const result = await librariesApi.refreshAll();
      console.log('✅ Todas as bibliotecas atualizadas:', result);
      alert(`✅ ${result.message || 'Todas as bibliotecas foram atualizadas com sucesso!'}`);
      
      // Recarregar dados
      const data = await librariesApi.getAll();
      const normalized = (data || []).map((l: any) => ({
        id: l.id,
        name: l.name,
        activeAds: Number(l.activeAds || 0),
        country: l.country || null,
        language: l.language || null,
        sourceType: l.sourceType,
        sourceValue: l.sourceValue,
        folder: l.folder,
        status: l.status,
        nichos: l.nichos,
        estrategias: l.estrategias,
        produtos: l.produtos,
        idiomas: l.idiomas,
        paises: l.paises,
        notes: l.notes,
        tags: l.tags,
        lastCheckedAt: l.lastCheckedAt,
        createdAt: l.createdAt,
        updatedAt: l.updatedAt,
      }));
      setLibraries(normalized);
    } catch (error) {
      console.error('❌ Erro ao atualizar todas as bibliotecas:', error);
      alert('❌ Erro ao atualizar bibliotecas. Tente novamente.');
    } finally {
      setIsRefreshingAll(false);
    }
  };

  const handleLibraryUpdate = async () => {
    // Recarregar dados após atualização individual
    const data = await librariesApi.getAll();
    const normalized = (data || []).map((l: any) => ({
      id: l.id,
      name: l.name,
      activeAds: Number(l.activeAds || 0),
      country: l.country || null,
      language: l.language || null,
      sourceType: l.sourceType,
      sourceValue: l.sourceValue,
      folder: l.folder,
      status: l.status,
      nichos: l.nichos,
      estrategias: l.estrategias,
      produtos: l.produtos,
      idiomas: l.idiomas,
      paises: l.paises,
      notes: l.notes,
      tags: l.tags,
      lastCheckedAt: l.lastCheckedAt,
      createdAt: l.createdAt,
      updatedAt: l.updatedAt,
    }));
    setLibraries(normalized);
  };

  return (
    <AuthGuard>
      <div style={{
        background: '#0c0f14',
        color: '#E8EDF2',
        minHeight: '100vh',
        padding: 'clamp(1rem, 3vw, 2rem)',
        boxSizing: 'border-box',
        overflow: 'hidden'
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '2rem',
          flexWrap: 'wrap',
          gap: '1rem'
        }}>
          <div>
            <h1 style={{
              fontSize: '2rem',
              fontWeight: 'bold',
              color: '#F5D26C',
              marginBottom: '0.5rem',
              textShadow: '0 0 10px rgba(245, 210, 108, 0.35)'
            }}>
              TOP 25 Bibliotecas
            </h1>
            <p style={{ color: '#94a3b8' }}>
              As bibliotecas com mais anúncios ativos no momento
            </p>
          </div>
          
          <button
            onClick={handleRefreshAll}
            disabled={isRefreshingAll}
            style={{
              backgroundColor: 'rgba(34, 197, 94, 0.1)',
              color: '#22C55E',
              padding: '0.75rem 1.5rem',
              borderRadius: '0.5rem',
              fontWeight: '600',
              border: '1px solid rgba(34, 197, 94, 0.2)',
              cursor: isRefreshingAll ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              opacity: isRefreshingAll ? 0.7 : 1,
              transition: 'all 0.2s'
            }}
            onMouseEnter={(e) => {
              if (!isRefreshingAll) {
                e.currentTarget.style.backgroundColor = 'rgba(34, 197, 94, 0.2)';
                e.currentTarget.style.borderColor = 'rgba(34, 197, 94, 0.4)';
              }
            }}
            onMouseLeave={(e) => {
              if (!isRefreshingAll) {
                e.currentTarget.style.backgroundColor = 'rgba(34, 197, 94, 0.1)';
                e.currentTarget.style.borderColor = 'rgba(34, 197, 94, 0.2)';
              }
            }}
          >
            <RotateCcw style={{ 
              height: '1rem', 
              width: '1rem',
              animation: isRefreshingAll ? 'spin 1s linear infinite' : 'none'
            }} />
            {isRefreshingAll ? 'Atualizando...' : 'Atualizar Todas'}
          </button>
        </div>

        {/* Cards de métricas */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 350px))',
          gap: '1.5rem',
          marginBottom: '2rem'
        }}>
          {[{
            label: 'Total de Bibliotecas', value: totalLibraries
          }, {
            label: 'Total de Anúncios', value: totalAds.toLocaleString()
          }, {
            label: 'Média por Biblioteca', value: avgPerLibrary
          }].map((card, idx) => (
            <div key={idx} style={{
              background: '#141823',
              border: '1px solid rgba(245, 210, 108, 0.2)',
              borderRadius: '0.75rem',
              padding: '1.5rem',
              boxShadow: '0 6px 24px rgba(0, 0, 0, 0.35)'
            }}>
              <p style={{ color: '#94a3b8', fontSize: '0.875rem', marginBottom: '0.5rem' }}>
                {card.label}
              </p>
              <p style={{ color: '#E8EDF2', fontSize: '1.5rem', fontWeight: 'bold' }}>
                {String(card.value)}
              </p>
            </div>
          ))}
        </div>

        {loading && (
          <div style={{ color: '#94a3b8' }}>Carregando...</div>
        )}

        {!loading && error && (
          <div style={{ color: '#ef4444', marginBottom: '1rem' }}>{error}</div>
        )}

        {/* Lista Top 25 ou estado vazio */}
        {!loading && orderedTop.length === 0 ? (
          <div style={{
            background: '#141823',
            border: '1px solid rgba(148, 163, 184, 0.2)',
            color: '#94a3b8',
            padding: '2rem',
            borderRadius: '0.75rem',
            textAlign: 'center'
          }}>
            Nenhuma biblioteca encontrada. Adicione bibliotecas para ver o TOP 25.
          </div>
        ) : (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '24px',
            paddingLeft: '1rem',
          }}>
            {orderedTop.map((library, index) => (
              <div key={library.id} style={{ position: 'relative' }}>
                <div style={{
                  position: 'absolute',
                  top: '50%',
                  left: '-14px',
                  transform: 'translateY(-50%)',
                  zIndex: 10,
                  width: '28px',
                  height: '28px',
                  background: 'linear-gradient(135deg, #facc15, #F5D26C)',
                  border: '2px solid #ffffff',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '0.7rem',
                  fontWeight: 'bold',
                  color: '#0c0f14',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
                }}>
                  {index + 1}
                </div>
                <LibraryCardNew 
                  library={library} 
                  onUpdate={handleLibraryUpdate}
                />
              </div>
            ))}
          </div>
        )}
      </div>
    </AuthGuard>
  );
}