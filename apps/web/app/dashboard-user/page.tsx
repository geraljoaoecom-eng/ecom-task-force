'use client';

import { useEffect, useState } from 'react';
import AuthGuard from '../../components/AuthGuard';
import { librariesApi } from '@/lib/api';
import { 
  BarChart3, 
  TrendingUp, 
  Clock, 
  Library, 
  Activity,
  Users,
  Calendar,
  Zap,
  CreditCard,
  Crown
} from 'lucide-react';

interface DashboardStats {
  totalLibraries: number;
  activeLibraries: number;
  totalAds: number;
  avgAdsPerLibrary: number;
  topLibrariesByAds: Array<{
    id: string;
    name: string;
    activeAds: number;
    folder?: { name: string } | null;
  }>;
  topLibrariesByVariations: Array<{
    id: string;
    name: string;
    variations: number;
    folder?: { name: string } | null;
  }>;
  librariesWithMostDaysActive: Array<{
    id: string;
    name: string;
    daysActive: number;
    folder?: { name: string } | null;
  }>;
  recentActivity: Array<{
    id: string;
    name: string;
    lastCheckedAt: string;
    activeAds: number;
  }>;
}

interface UserPlan {
  id: string;
  name: string;
  description: string;
  libraries_limit: number;
  price_monthly: number;
  price_annual: number;
  features: string[];
}

export default function UserDashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [currentPlan, setCurrentPlan] = useState<UserPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const loadDashboardData = async () => {
      try {
        setLoading(true);
        setError('');
        
        // Carregar bibliotecas
        const libraries = await librariesApi.getAll();
        
        // Carregar plano atual
        const token = localStorage.getItem('authToken');
        if (token) {
          try {
            const planResponse = await fetch('/api/stripe/current-plan', {
              headers: {
                'Authorization': `Bearer ${token}`
              }
            });
            const planData = await planResponse.json();
            setCurrentPlan(planData.plan);
          } catch (planError) {
            console.log('Usuário sem plano ativo');
          }
        }
        
        // Calcular estatísticas
        const totalLibraries = libraries.length;
        const activeLibraries = libraries.filter((lib: any) => lib.activeAds > 0).length;
        const totalAds = libraries.reduce((sum: number, lib: any) => sum + (lib.activeAds || 0), 0);
        const avgAdsPerLibrary = totalLibraries > 0 ? Math.round(totalAds / totalLibraries) : 0;

        // Top bibliotecas por anúncios ativos
        const topLibrariesByAds = [...libraries]
          .sort((a: any, b: any) => (b.activeAds || 0) - (a.activeAds || 0))
          .slice(0, 5)
          .map((lib: any) => ({
            id: lib.id,
            name: lib.name,
            activeAds: lib.activeAds || 0,
            folder: lib.folder
          }));

        // Top bibliotecas por variações (baseado em campos diferentes)
        const topLibrariesByVariations = [...libraries]
          .map((lib: any) => {
            const variations = [
              lib.nichos,
              lib.estrategias,
              lib.produtos,
              lib.idiomas,
              lib.paises,
              lib.status,
              lib.tipos
            ].filter(Boolean).length;
            return {
              id: lib.id,
              name: lib.name,
              variations,
              folder: lib.folder
            };
          })
          .sort((a, b) => b.variations - a.variations)
          .slice(0, 5);

        // Bibliotecas com mais dias ativos (baseado em lastCheckedAt)
        const librariesWithMostDaysActive = [...libraries]
          .filter((lib: any) => lib.lastCheckedAt)
          .map((lib: any) => {
            const lastChecked = new Date(lib.lastCheckedAt);
            const now = new Date();
            const daysActive = Math.floor((now.getTime() - lastChecked.getTime()) / (1000 * 60 * 60 * 24));
            return {
              id: lib.id,
              name: lib.name,
              daysActive: Math.max(0, daysActive),
              folder: lib.folder
            };
          })
          .sort((a, b) => b.daysActive - a.daysActive)
          .slice(0, 5);

        // Atividade recente
        const recentActivity = [...libraries]
          .filter((lib: any) => lib.lastCheckedAt)
          .sort((a: any, b: any) => new Date(b.lastCheckedAt).getTime() - new Date(a.lastCheckedAt).getTime())
          .slice(0, 5)
          .map((lib: any) => ({
            id: lib.id,
            name: lib.name,
            lastCheckedAt: lib.lastCheckedAt,
            activeAds: lib.activeAds || 0
          }));

        setStats({
          totalLibraries,
          activeLibraries,
          totalAds,
          avgAdsPerLibrary,
          topLibrariesByAds,
          topLibrariesByVariations,
          librariesWithMostDaysActive,
          recentActivity
        });
      } catch (e: any) {
        setError('Não foi possível carregar os dados do dashboard.');
        console.error('Erro ao carregar dashboard:', e);
      } finally {
        setLoading(false);
      }
    };

    loadDashboardData();
  }, []);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getDaysAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - date.getTime());
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return 'Hoje';
    if (diffDays === 1) return 'Ontem';
    return `${diffDays} dias atrás`;
  };

  if (loading) {
    return (
      <AuthGuard>
        <div style={{
          background: '#0c0f14',
          color: '#E8EDF2',
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{
              width: '50px',
              height: '50px',
              border: '3px solid rgba(245, 210, 108, 0.3)',
              borderTop: '3px solid #F5D26C',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite',
              margin: '0 auto 1rem'
            }} />
            <p style={{ color: '#94a3b8' }}>Carregando dashboard...</p>
          </div>
        </div>
      </AuthGuard>
    );
  }

  if (error) {
    return (
      <AuthGuard>
        <div style={{
          background: '#0c0f14',
          color: '#E8EDF2',
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          <div style={{
            background: '#141823',
            border: '1px solid rgba(239, 68, 68, 0.2)',
            borderRadius: '12px',
            padding: '2rem',
            textAlign: 'center',
            maxWidth: '400px'
          }}>
            <p style={{ color: '#ef4444', marginBottom: '1rem' }}>{error}</p>
            <button
              onClick={() => window.location.reload()}
              style={{
                background: 'linear-gradient(135deg, #F5D26C 0%, #F59E0B 100%)',
                color: '#0c0f14',
                border: 'none',
                borderRadius: '8px',
                padding: '0.75rem 1.5rem',
                fontWeight: '600',
                cursor: 'pointer'
              }}
            >
              Tentar Novamente
            </button>
          </div>
        </div>
      </AuthGuard>
    );
  }

  return (
    <AuthGuard>
      <div style={{
        background: '#0c0f14',
        color: '#E8EDF2',
        minHeight: '100vh',
        padding: 'clamp(1rem, 3vw, 2rem)',
        boxSizing: 'border-box'
      }}>
        {/* Header */}
        <div style={{ marginBottom: '2rem' }}>
          <h1 style={{
            fontSize: '2.5rem',
            fontWeight: 'bold',
            color: '#F5D26C',
            marginBottom: '0.5rem',
            textShadow: '0 0 10px rgba(245, 210, 108, 0.35)'
          }}>
            Dashboard
          </h1>
          <p style={{ color: '#94a3b8', fontSize: '1.1rem' }}>
            Visão geral das suas bibliotecas e performance
          </p>
        </div>

        {/* Plano Atual */}
        {currentPlan && (
          <div style={{
            background: 'linear-gradient(135deg, rgba(245, 210, 108, 0.1), rgba(245, 158, 11, 0.1))',
            border: '1px solid rgba(245, 210, 108, 0.3)',
            borderRadius: '16px',
            padding: '1.5rem',
            marginBottom: '2rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '1rem'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <div style={{
                width: '48px',
                height: '48px',
                borderRadius: '12px',
                background: 'linear-gradient(135deg, #F5D26C, #F59E0B)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <Crown style={{ width: '24px', height: '24px', color: '#0c0f14' }} />
              </div>
              <div>
                <h3 style={{
                  fontSize: '1.25rem',
                  fontWeight: '600',
                  color: '#E8EDF2',
                  marginBottom: '0.25rem'
                }}>
                  Plano {currentPlan.name}
                </h3>
                <p style={{
                  color: '#94a3b8',
                  fontSize: '0.9rem'
                }}>
                  {currentPlan.libraries_limit === -1 
                    ? 'Bibliotecas ilimitadas' 
                    : `${currentPlan.libraries_limit} bibliotecas`}
                </p>
              </div>
            </div>
            
            <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
              <button
                onClick={() => window.location.href = '/pricing'}
                style={{
                  background: 'rgba(245, 210, 108, 0.1)',
                  color: '#F5D26C',
                  border: '1px solid rgba(245, 210, 108, 0.3)',
                  borderRadius: '8px',
                  padding: '0.75rem 1.5rem',
                  fontSize: '0.9rem',
                  fontWeight: '600',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  transition: 'all 0.2s ease'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(245, 210, 108, 0.2)';
                  e.currentTarget.style.borderColor = 'rgba(245, 210, 108, 0.5)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'rgba(245, 210, 108, 0.1)';
                  e.currentTarget.style.borderColor = 'rgba(245, 210, 108, 0.3)';
                }}
              >
                <CreditCard style={{ width: '16px', height: '16px' }} />
                Gerenciar Plano
              </button>
            </div>
          </div>
        )}

        {/* Cards de Estatísticas Principais */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
          gap: '1.5rem',
          marginBottom: '2rem'
        }}>
          {[
            {
              title: 'Total de Bibliotecas',
              value: stats?.totalLibraries || 0,
              icon: Library,
              color: '#3B82F6',
              bgColor: 'rgba(59, 130, 246, 0.1)'
            },
            {
              title: 'Bibliotecas Ativas',
              value: stats?.activeLibraries || 0,
              icon: Activity,
              color: '#10B981',
              bgColor: 'rgba(16, 185, 129, 0.1)'
            },
            {
              title: 'Total de Anúncios',
              value: (stats?.totalAds || 0).toLocaleString(),
              icon: BarChart3,
              color: '#F59E0B',
              bgColor: 'rgba(245, 158, 11, 0.1)'
            },
            {
              title: 'Média por Biblioteca',
              value: stats?.avgAdsPerLibrary || 0,
              icon: TrendingUp,
              color: '#8B5CF6',
              bgColor: 'rgba(139, 92, 246, 0.1)'
            }
          ].map((card, idx) => (
            <div key={idx} style={{
              background: '#141823',
              border: '1px solid rgba(245, 210, 108, 0.2)',
              borderRadius: '16px',
              padding: '1.5rem',
              boxShadow: '0 6px 24px rgba(0, 0, 0, 0.35)',
              transition: 'transform 0.2s ease, box-shadow 0.2s ease'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-2px)';
              e.currentTarget.style.boxShadow = '0 8px 32px rgba(0, 0, 0, 0.45)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 6px 24px rgba(0, 0, 0, 0.35)';
            }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '1rem'
              }}>
                <div style={{
                  width: '48px',
                  height: '48px',
                  borderRadius: '12px',
                  background: card.bgColor,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <card.icon style={{ width: '24px', height: '24px', color: card.color }} />
                </div>
              </div>
              <h3 style={{
                fontSize: '2rem',
                fontWeight: 'bold',
                color: '#E8EDF2',
                marginBottom: '0.5rem'
              }}>
                {card.value}
              </h3>
              <p style={{ color: '#94a3b8', fontSize: '0.9rem' }}>
                {card.title}
              </p>
            </div>
          ))}
        </div>

        {/* Grid de Seções */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))',
          gap: '1.5rem'
        }}>
          {/* Top Bibliotecas por Anúncios */}
          <div style={{
            background: '#141823',
            border: '1px solid rgba(245, 210, 108, 0.2)',
            borderRadius: '16px',
            padding: '1.5rem',
            boxShadow: '0 6px 24px rgba(0, 0, 0, 0.35)'
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              marginBottom: '1.5rem'
            }}>
              <BarChart3 style={{ width: '24px', height: '24px', color: '#F5D26C' }} />
              <h2 style={{
                fontSize: '1.25rem',
                fontWeight: '600',
                color: '#E8EDF2'
              }}>
                Top Bibliotecas por Anúncios
              </h2>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {stats?.topLibrariesByAds.map((lib, idx) => (
                <div key={lib.id} style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '0.75rem',
                  background: 'rgba(245, 210, 108, 0.05)',
                  borderRadius: '8px',
                  border: '1px solid rgba(245, 210, 108, 0.1)'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <div style={{
                      width: '32px',
                      height: '32px',
                      borderRadius: '8px',
                      background: 'linear-gradient(135deg, #F5D26C, #F59E0B)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '0.875rem',
                      fontWeight: 'bold',
                      color: '#0c0f14'
                    }}>
                      {idx + 1}
                    </div>
                    <div>
                      <p style={{
                        color: '#E8EDF2',
                        fontWeight: '500',
                        marginBottom: '0.25rem'
                      }}>
                        {lib.name}
                      </p>
                      {lib.folder && (
                        <p style={{
                          color: '#94a3b8',
                          fontSize: '0.75rem'
                        }}>
                          📁 {lib.folder.name}
                        </p>
                      )}
                    </div>
                  </div>
                  <div style={{
                    background: 'rgba(245, 210, 108, 0.1)',
                    color: '#F5D26C',
                    padding: '0.25rem 0.75rem',
                    borderRadius: '6px',
                    fontSize: '0.875rem',
                    fontWeight: '600'
                  }}>
                    {lib.activeAds} anúncios
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Top Bibliotecas por Variações */}
          <div style={{
            background: '#141823',
            border: '1px solid rgba(245, 210, 108, 0.2)',
            borderRadius: '16px',
            padding: '1.5rem',
            boxShadow: '0 6px 24px rgba(0, 0, 0, 0.35)'
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              marginBottom: '1.5rem'
            }}>
              <Zap style={{ width: '24px', height: '24px', color: '#F5D26C' }} />
              <h2 style={{
                fontSize: '1.25rem',
                fontWeight: '600',
                color: '#E8EDF2'
              }}>
                Mais Variações
              </h2>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {stats?.topLibrariesByVariations.map((lib, idx) => (
                <div key={lib.id} style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '0.75rem',
                  background: 'rgba(245, 210, 108, 0.05)',
                  borderRadius: '8px',
                  border: '1px solid rgba(245, 210, 108, 0.1)'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <div style={{
                      width: '32px',
                      height: '32px',
                      borderRadius: '8px',
                      background: 'linear-gradient(135deg, #8B5CF6, #A855F7)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '0.875rem',
                      fontWeight: 'bold',
                      color: '#E8EDF2'
                    }}>
                      {idx + 1}
                    </div>
                    <div>
                      <p style={{
                        color: '#E8EDF2',
                        fontWeight: '500',
                        marginBottom: '0.25rem'
                      }}>
                        {lib.name}
                      </p>
                      {lib.folder && (
                        <p style={{
                          color: '#94a3b8',
                          fontSize: '0.75rem'
                        }}>
                          📁 {lib.folder.name}
                        </p>
                      )}
                    </div>
                  </div>
                  <div style={{
                    background: 'rgba(139, 92, 246, 0.1)',
                    color: '#8B5CF6',
                    padding: '0.25rem 0.75rem',
                    borderRadius: '6px',
                    fontSize: '0.875rem',
                    fontWeight: '600'
                  }}>
                    {lib.variations} campos
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Atividade Recente */}
          <div style={{
            background: '#141823',
            border: '1px solid rgba(245, 210, 108, 0.2)',
            borderRadius: '16px',
            padding: '1.5rem',
            boxShadow: '0 6px 24px rgba(0, 0, 0, 0.35)'
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              marginBottom: '1.5rem'
            }}>
              <Clock style={{ width: '24px', height: '24px', color: '#F5D26C' }} />
              <h2 style={{
                fontSize: '1.25rem',
                fontWeight: '600',
                color: '#E8EDF2'
              }}>
                Atividade Recente
              </h2>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {stats?.recentActivity.map((lib) => (
                <div key={lib.id} style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '0.75rem',
                  background: 'rgba(245, 210, 108, 0.05)',
                  borderRadius: '8px',
                  border: '1px solid rgba(245, 210, 108, 0.1)'
                }}>
                  <div>
                    <p style={{
                      color: '#E8EDF2',
                      fontWeight: '500',
                      marginBottom: '0.25rem'
                    }}>
                      {lib.name}
                    </p>
                    <p style={{
                      color: '#94a3b8',
                      fontSize: '0.75rem'
                    }}>
                      {getDaysAgo(lib.lastCheckedAt)}
                    </p>
                  </div>
                  <div style={{
                    background: 'rgba(16, 185, 129, 0.1)',
                    color: '#10B981',
                    padding: '0.25rem 0.75rem',
                    borderRadius: '6px',
                    fontSize: '0.875rem',
                    fontWeight: '600'
                  }}>
                    {lib.activeAds} anúncios
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Bibliotecas Mais Tempo Ativas */}
          <div style={{
            background: '#141823',
            border: '1px solid rgba(245, 210, 108, 0.2)',
            borderRadius: '16px',
            padding: '1.5rem',
            boxShadow: '0 6px 24px rgba(0, 0, 0, 0.35)'
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              marginBottom: '1.5rem'
            }}>
              <Calendar style={{ width: '24px', height: '24px', color: '#F5D26C' }} />
              <h2 style={{
                fontSize: '1.25rem',
                fontWeight: '600',
                color: '#E8EDF2'
              }}>
                Mais Tempo Ativas
              </h2>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {stats?.librariesWithMostDaysActive.map((lib, idx) => (
                <div key={lib.id} style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '0.75rem',
                  background: 'rgba(245, 210, 108, 0.05)',
                  borderRadius: '8px',
                  border: '1px solid rgba(245, 210, 108, 0.1)'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <div style={{
                      width: '32px',
                      height: '32px',
                      borderRadius: '8px',
                      background: 'linear-gradient(135deg, #10B981, #059669)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '0.875rem',
                      fontWeight: 'bold',
                      color: '#E8EDF2'
                    }}>
                      {idx + 1}
                    </div>
                    <div>
                      <p style={{
                        color: '#E8EDF2',
                        fontWeight: '500',
                        marginBottom: '0.25rem'
                      }}>
                        {lib.name}
                      </p>
                      {lib.folder && (
                        <p style={{
                          color: '#94a3b8',
                          fontSize: '0.75rem'
                        }}>
                          📁 {lib.folder.name}
                        </p>
                      )}
                    </div>
                  </div>
                  <div style={{
                    background: 'rgba(16, 185, 129, 0.1)',
                    color: '#10B981',
                    padding: '0.25rem 0.75rem',
                    borderRadius: '6px',
                    fontSize: '0.875rem',
                    fontWeight: '600'
                  }}>
                    {lib.daysActive} dias
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Botões de Ação */}
        <div style={{
          display: 'flex',
          gap: '1rem',
          marginTop: '2rem',
          flexWrap: 'wrap'
        }}>
          <button
            onClick={() => window.location.href = '/bibliotecas'}
            style={{
              background: 'linear-gradient(135deg, #F5D26C 0%, #F59E0B 100%)',
              color: '#0c0f14',
              border: 'none',
              borderRadius: '12px',
              padding: '1rem 2rem',
              fontSize: '1rem',
              fontWeight: '600',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              boxShadow: '0 4px 12px rgba(245, 210, 108, 0.3)',
              transition: 'transform 0.2s ease'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-2px)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
            }}
          >
            <Library style={{ width: '20px', height: '20px' }} />
            Ver Todas as Bibliotecas
          </button>

          <button
            onClick={() => window.location.href = '/top-25'}
            style={{
              background: 'rgba(59, 130, 246, 0.1)',
              color: '#3B82F6',
              border: '1px solid rgba(59, 130, 246, 0.3)',
              borderRadius: '12px',
              padding: '1rem 2rem',
              fontSize: '1rem',
              fontWeight: '600',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              transition: 'all 0.2s ease'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(59, 130, 246, 0.2)';
              e.currentTarget.style.borderColor = 'rgba(59, 130, 246, 0.5)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(59, 130, 246, 0.1)';
              e.currentTarget.style.borderColor = 'rgba(59, 130, 246, 0.3)';
            }}
          >
            <BarChart3 style={{ width: '20px', height: '20px' }} />
            Top 25 Bibliotecas
          </button>

          <button
            onClick={() => window.location.href = '/pastas'}
            style={{
              background: 'rgba(139, 92, 246, 0.1)',
              color: '#8B5CF6',
              border: '1px solid rgba(139, 92, 246, 0.3)',
              borderRadius: '12px',
              padding: '1rem 2rem',
              fontSize: '1rem',
              fontWeight: '600',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              transition: 'all 0.2s ease'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(139, 92, 246, 0.2)';
              e.currentTarget.style.borderColor = 'rgba(139, 92, 246, 0.5)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(139, 92, 246, 0.1)';
              e.currentTarget.style.borderColor = 'rgba(139, 92, 246, 0.3)';
            }}
          >
            <Users style={{ width: '20px', height: '20px' }} />
            Gerenciar Pastas
          </button>
        </div>
      </div>

      <style dangerouslySetInnerHTML={{
        __html: `
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `
      }} />
    </AuthGuard>
  );
}
