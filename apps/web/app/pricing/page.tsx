'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import AuthGuard from '../../components/AuthGuard';
import { 
  CheckCircle, 
  Star, 
  ArrowRight,
  CreditCard,
  Shield,
  Zap,
  Users,
  BarChart3
} from 'lucide-react';

interface Plan {
  id: string;
  name: string;
  description: string;
  libraries_limit: number;
  price_monthly: number;
  price_annual: number;
  stripe_product_id: string;
  stripe_monthly_price_id: string;
  stripe_annual_price_id: string;
  features: string[];
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

export default function PricingPage() {
  const router = useRouter();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [currentPlan, setCurrentPlan] = useState<UserPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'annual'>('monthly');

  useEffect(() => {
    loadData();
    
    // Verificar parâmetro da URL
    const urlParams = new URLSearchParams(window.location.search);
    const cycle = urlParams.get('cycle');
    if (cycle === 'annual' || cycle === 'monthly') {
      setBillingCycle(cycle);
    }
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      
      // Buscar planos disponíveis
      const plansResponse = await fetch('/api/stripe/plans');
      const plansData = await plansResponse.json();
      setPlans(plansData.plans || []);

      // Buscar plano atual do usuário
      const token = localStorage.getItem('authToken');
      if (token) {
        const planResponse = await fetch('/api/stripe/current-plan', {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        const planData = await planResponse.json();
        setCurrentPlan(planData.plan);
      }
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubscribe = async (plan: Plan) => {
    try {
      setProcessing(plan.id);
      
      const token = localStorage.getItem('authToken');
      if (!token) {
        router.push('/');
        return;
      }

      const priceId = billingCycle === 'monthly' 
        ? plan.stripe_monthly_price_id 
        : plan.stripe_annual_price_id;

      const response = await fetch('/api/stripe/create-checkout-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          priceId,
          planId: plan.id,
          billingCycle
        })
      });

      const data = await response.json();
      
      if (data.url) {
        window.location.href = data.url;
      } else {
        throw new Error('Erro ao criar sessão de pagamento');
      }
    } catch (error) {
      console.error('Erro ao processar assinatura:', error);
      alert('Erro ao processar assinatura. Tente novamente.');
    } finally {
      setProcessing(null);
    }
  };

  const handleManageSubscription = async () => {
    try {
      setProcessing('manage');
      
      const token = localStorage.getItem('authToken');
      if (!token) {
        router.push('/');
        return;
      }

      const response = await fetch('/api/stripe/create-portal-session', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      const data = await response.json();
      
      if (data.url) {
        window.location.href = data.url;
      } else {
        throw new Error('Erro ao criar sessão de gerenciamento');
      }
    } catch (error) {
      console.error('Erro ao gerenciar assinatura:', error);
      alert('Erro ao gerenciar assinatura. Tente novamente.');
    } finally {
      setProcessing(null);
    }
  };

  const formatPrice = (priceInCents: number) => {
    return (priceInCents / 100).toFixed(2);
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
            <p style={{ color: '#94a3b8' }}>Carregando planos...</p>
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
        <div style={{ marginBottom: '3rem' }}>
          <h1 style={{
            fontSize: '2.5rem',
            fontWeight: 'bold',
            color: '#F5D26C',
            marginBottom: '0.5rem',
            textAlign: 'center',
            textShadow: '0 0 10px rgba(245, 210, 108, 0.35)'
          }}>
            Escolha seu Plano
          </h1>
          <p style={{
            color: '#94a3b8',
            fontSize: '1.1rem',
            textAlign: 'center',
            maxWidth: '600px',
            margin: '0 auto 2rem'
          }}>
            Planos flexíveis para profissionais de todos os tamanhos
          </p>

          {/* Toggle de ciclo de cobrança */}
          <div style={{
            display: 'flex',
            justifyContent: 'center',
            marginBottom: '2rem'
          }}>
            <div style={{
              background: 'rgba(245, 210, 108, 0.1)',
              border: '1px solid rgba(245, 210, 108, 0.3)',
              borderRadius: '12px',
              padding: '0.25rem',
              display: 'flex',
              gap: '0.5rem'
            }}>
              <button
                onClick={() => setBillingCycle('monthly')}
                style={{
                  background: billingCycle === 'monthly' 
                    ? 'linear-gradient(135deg, #F5D26C 0%, #F59E0B 100%)'
                    : 'transparent',
                  color: billingCycle === 'monthly' ? '#0c0f14' : '#F5D26C',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '0.75rem 1.5rem',
                  fontSize: '0.9rem',
                  fontWeight: '600',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
              >
                Mensal
              </button>
              <button
                onClick={() => setBillingCycle('annual')}
                style={{
                  background: billingCycle === 'annual' 
                    ? 'linear-gradient(135deg, #F5D26C 0%, #F59E0B 100%)'
                    : 'transparent',
                  color: billingCycle === 'annual' ? '#0c0f14' : '#F5D26C',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '0.75rem 1.5rem',
                  fontSize: '0.9rem',
                  fontWeight: '600',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
              >
                Anual
                <span style={{
                  background: 'rgba(16, 185, 129, 0.2)',
                  color: '#10B981',
                  fontSize: '0.75rem',
                  padding: '0.125rem 0.5rem',
                  borderRadius: '4px',
                  marginLeft: '0.5rem'
                }}>
                  -17%
                </span>
              </button>
            </div>
          </div>
        </div>

        {/* Plano atual */}
        {currentPlan && (
          <div style={{
            background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.1), rgba(5, 150, 105, 0.1))',
            border: '1px solid rgba(16, 185, 129, 0.3)',
            borderRadius: '16px',
            padding: '1.5rem',
            marginBottom: '2rem',
            textAlign: 'center'
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.75rem',
              marginBottom: '1rem'
            }}>
              <CheckCircle style={{ width: '24px', height: '24px', color: '#10B981' }} />
              <h3 style={{
                fontSize: '1.25rem',
                fontWeight: '600',
                color: '#10B981'
              }}>
                Plano Atual: {currentPlan.name}
              </h3>
            </div>
            <p style={{ color: '#94a3b8', marginBottom: '1rem' }}>
              {currentPlan.libraries_limit === -1 
                ? 'Bibliotecas ilimitadas' 
                : `${currentPlan.libraries_limit} bibliotecas`}
            </p>
            <button
              onClick={handleManageSubscription}
              disabled={processing === 'manage'}
              style={{
                background: 'rgba(16, 185, 129, 0.1)',
                color: '#10B981',
                border: '1px solid rgba(16, 185, 129, 0.3)',
                borderRadius: '8px',
                padding: '0.75rem 1.5rem',
                fontSize: '0.9rem',
                fontWeight: '600',
                cursor: processing === 'manage' ? 'not-allowed' : 'pointer',
                opacity: processing === 'manage' ? 0.7 : 1,
                transition: 'all 0.2s ease'
              }}
            >
              {processing === 'manage' ? 'Carregando...' : 'Gerenciar Assinatura'}
            </button>
          </div>
        )}

        {/* Billing Cycle Selector */}
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          marginBottom: '3rem'
        }}>
          <div style={{
            background: 'rgba(12, 15, 20, 0.8)',
            border: '1px solid rgba(148, 163, 184, 0.2)',
            borderRadius: '16px',
            padding: '0.5rem',
            display: 'flex',
            gap: '0.5rem'
          }}>
            <button
              onClick={() => setBillingCycle('monthly')}
              style={{
                padding: '0.75rem 1.5rem',
                borderRadius: '12px',
                border: 'none',
                background: billingCycle === 'monthly' 
                  ? 'linear-gradient(135deg, #F5D26C, #F59E0B)' 
                  : 'transparent',
                color: billingCycle === 'monthly' ? '#0c0f14' : '#94a3b8',
                fontSize: '0.9rem',
                fontWeight: '600',
                cursor: 'pointer',
                transition: 'all 0.3s ease'
              }}
            >
              Mensal
            </button>
            <button
              onClick={() => setBillingCycle('annual')}
              style={{
                padding: '0.75rem 1.5rem',
                borderRadius: '12px',
                border: 'none',
                background: billingCycle === 'annual' 
                  ? 'linear-gradient(135deg, #F5D26C, #F59E0B)' 
                  : 'transparent',
                color: billingCycle === 'annual' ? '#0c0f14' : '#94a3b8',
                fontSize: '0.9rem',
                fontWeight: '600',
                cursor: 'pointer',
                transition: 'all 0.3s ease',
                position: 'relative'
              }}
            >
              Anual
              <span style={{
                position: 'absolute',
                top: '-8px',
                right: '-8px',
                background: '#10B981',
                color: '#E8EDF2',
                fontSize: '0.7rem',
                fontWeight: 'bold',
                padding: '0.25rem 0.5rem',
                borderRadius: '8px',
                transform: 'rotate(12deg)'
              }}>
                -17%
              </span>
            </button>
          </div>
        </div>

        {/* Grid de planos */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
          gap: '2rem',
          marginBottom: '3rem'
        }}>
          {plans.map((plan, idx) => {
            const isPopular = plan.name === 'Pro';
            const isCurrentPlan = currentPlan?.id === plan.id;
            const price = billingCycle === 'monthly' 
              ? plan.price_monthly 
              : plan.price_annual;

            return (
              <div key={plan.id} style={{
                background: isCurrentPlan 
                  ? 'rgba(16, 185, 129, 0.05)' 
                  : isPopular 
                    ? 'rgba(245, 210, 108, 0.05)' 
                    : '#141823',
                border: isCurrentPlan
                  ? '2px solid #10B981'
                  : isPopular 
                    ? '2px solid #F5D26C' 
                    : '1px solid rgba(245, 210, 108, 0.2)',
                borderRadius: '20px',
                padding: '2rem',
                position: 'relative',
                transition: 'transform 0.2s ease',
                cursor: 'pointer'
              }}
              onMouseEnter={(e) => {
                if (!isCurrentPlan) {
                  e.currentTarget.style.transform = 'translateY(-4px)';
                }
              }}
              onMouseLeave={(e) => {
                if (!isCurrentPlan) {
                  e.currentTarget.style.transform = 'translateY(0)';
                }
              }}>
                {isPopular && !isCurrentPlan && (
                  <div style={{
                    position: 'absolute',
                    top: '-12px',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    background: 'linear-gradient(135deg, #F5D26C, #F59E0B)',
                    color: '#0c0f14',
                    padding: '0.5rem 1.5rem',
                    borderRadius: '20px',
                    fontSize: '0.875rem',
                    fontWeight: '600'
                  }}>
                    Mais Popular
                  </div>
                )}

                {isCurrentPlan && (
                  <div style={{
                    position: 'absolute',
                    top: '-12px',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    background: 'linear-gradient(135deg, #10B981, #059669)',
                    color: '#E8EDF2',
                    padding: '0.5rem 1.5rem',
                    borderRadius: '20px',
                    fontSize: '0.875rem',
                    fontWeight: '600'
                  }}>
                    Plano Atual
                  </div>
                )}

                <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
                  <h3 style={{
                    fontSize: '1.5rem',
                    fontWeight: 'bold',
                    color: '#E8EDF2',
                    marginBottom: '0.5rem'
                  }}>
                    {plan.name}
                  </h3>
                  <div style={{ marginBottom: '0.5rem' }}>
                    <span style={{
                      fontSize: '3rem',
                      fontWeight: 'bold',
                      color: '#F5D26C'
                    }}>
                      ${formatPrice(price)}
                    </span>
                    <span style={{
                      color: '#94a3b8',
                      fontSize: '1rem'
                    }}>
                      /{billingCycle === 'monthly' ? 'mês' : 'ano'}
                    </span>
                  </div>
                  {billingCycle === 'annual' && (
                    <div style={{
                      fontSize: '0.875rem',
                      color: '#10B981',
                      fontWeight: '500',
                      marginBottom: '0.5rem'
                    }}>
                      Economize 17% com o plano anual
                    </div>
                  )}
                  <p style={{
                    color: '#94a3b8',
                    fontSize: '0.9rem',
                    marginBottom: '0.5rem'
                  }}>
                    {plan.description}
                  </p>
                  <p style={{
                    color: '#F5D26C',
                    fontSize: '0.9rem',
                    fontWeight: '600'
                  }}>
                    {plan.libraries_limit === -1 
                      ? 'Bibliotecas ilimitadas' 
                      : `${plan.libraries_limit} bibliotecas`}
                  </p>
                </div>

                <div style={{ marginBottom: '2rem' }}>
                  {plan.features.map((feature, featureIdx) => (
                    <div key={featureIdx} style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.75rem',
                      marginBottom: '0.75rem'
                    }}>
                      <CheckCircle style={{ 
                        width: '20px', 
                        height: '20px', 
                        color: '#10B981',
                        flexShrink: 0
                      }} />
                      <span style={{ color: '#E8EDF2' }}>{feature}</span>
                    </div>
                  ))}
                </div>

                {isCurrentPlan ? (
                  <button
                    disabled
                    style={{
                      width: '100%',
                      background: 'rgba(16, 185, 129, 0.2)',
                      color: '#10B981',
                      border: '1px solid rgba(16, 185, 129, 0.3)',
                      borderRadius: '12px',
                      padding: '1rem',
                      fontSize: '1rem',
                      fontWeight: '600',
                      cursor: 'not-allowed',
                      opacity: 0.7
                    }}
                  >
                    Plano Atual
                  </button>
                ) : (
                  <button
                    onClick={() => handleSubscribe(plan)}
                    disabled={processing === plan.id}
                    style={{
                      width: '100%',
                      background: isPopular 
                        ? 'linear-gradient(135deg, #F5D26C 0%, #F59E0B 100%)'
                        : 'rgba(245, 210, 108, 0.1)',
                      color: isPopular ? '#0c0f14' : '#F5D26C',
                      border: isPopular 
                        ? 'none' 
                        : '1px solid rgba(245, 210, 108, 0.3)',
                      borderRadius: '12px',
                      padding: '1rem',
                      fontSize: '1rem',
                      fontWeight: '600',
                      cursor: processing === plan.id ? 'not-allowed' : 'pointer',
                      opacity: processing === plan.id ? 0.7 : 1,
                      transition: 'all 0.2s ease',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '0.5rem'
                    }}
                  >
                    {processing === plan.id ? (
                      <>
                        <div style={{
                          width: '16px',
                          height: '16px',
                          border: '2px solid currentColor',
                          borderTop: '2px solid transparent',
                          borderRadius: '50%',
                          animation: 'spin 1s linear infinite'
                        }} />
                        Processando...
                      </>
                    ) : (
                      <>
                        <CreditCard style={{ width: '20px', height: '20px' }} />
                        Assinar Agora
                      </>
                    )}
                  </button>
                )}
              </div>
            );
          })}
        </div>

        {/* Seção de benefícios */}
        <div style={{
          background: 'rgba(245, 210, 108, 0.02)',
          border: '1px solid rgba(245, 210, 108, 0.2)',
          borderRadius: '20px',
          padding: '3rem 2rem',
          textAlign: 'center'
        }}>
          <h2 style={{
            fontSize: '2rem',
            fontWeight: 'bold',
            color: '#E8EDF2',
            marginBottom: '1rem'
          }}>
            Por que escolher o Ecoom Task Force?
          </h2>
          
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
            gap: '2rem',
            marginTop: '2rem'
          }}>
            {[
              {
                icon: Shield,
                title: 'Pagamento Seguro',
                description: 'Processamento seguro com Stripe'
              },
              {
                icon: Zap,
                title: 'Ativação Instantânea',
                description: 'Acesso imediato após o pagamento'
              },
              {
                icon: Users,
                title: 'Suporte Dedicado',
                description: 'Equipe de suporte sempre disponível'
              },
              {
                icon: BarChart3,
                title: 'Relatórios Avançados',
                description: 'Análises detalhadas e insights'
              }
            ].map((benefit, idx) => (
              <div key={idx} style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '1rem'
              }}>
                <div style={{
                  width: '64px',
                  height: '64px',
                  borderRadius: '16px',
                  background: 'linear-gradient(135deg, #F5D26C, #F59E0B)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <benefit.icon style={{ width: '32px', height: '32px', color: '#0c0f14' }} />
                </div>
                <h3 style={{
                  fontSize: '1.25rem',
                  fontWeight: '600',
                  color: '#E8EDF2'
                }}>
                  {benefit.title}
                </h3>
                <p style={{
                  color: '#94a3b8',
                  textAlign: 'center',
                  lineHeight: '1.6'
                }}>
                  {benefit.description}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Botões de ação */}
        <div style={{
          display: 'flex',
          gap: '1rem',
          justifyContent: 'center',
          marginTop: '2rem',
          flexWrap: 'wrap'
        }}>
          <button
            onClick={() => router.push('/dashboard')}
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
            <ArrowRight style={{ width: '20px', height: '20px' }} />
            Voltar ao Dashboard
          </button>
        </div>
      </div>

      <style jsx>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </AuthGuard>
  );
}
