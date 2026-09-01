'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { BrandLogo } from '@/components/BrandLogo';
import { APP_NAME } from '@/lib/brand';
import { 
  CheckCircle, 
  BarChart3, 
  Zap, 
  Shield, 
  Clock,
  Users,
  TrendingUp,
  Star,
  ArrowRight
} from 'lucide-react';

export default function LandingPage() {
  const router = useRouter();
  const [isHovered, setIsHovered] = useState<string | null>(null);
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'annual'>('monthly');

  // Função para criar checkout session via servidor
  const createCheckoutSession = async (plan: any) => {
    try {
      const priceId = billingCycle === 'monthly' 
        ? plan.stripeMonthlyPriceId 
        : plan.stripeAnnualPriceId;
      
      console.log('Tentando criar checkout com:', { priceId, billingCycle, plan: plan.name });
      
      // Criar checkout session via API do servidor
      const response = await fetch('/api/stripe/create-checkout-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          priceId,
          planId: plan.name.toLowerCase(),
          billingCycle
        }),
      });

      const data = await response.json();
      
      if (data.url) {
        // Redirecionar para o checkout
        window.location.href = data.url;
      } else {
        console.error('Erro ao criar checkout session:', data);
        alert('Erro ao processar pagamento. Tente novamente.');
      }
    } catch (error) {
      console.error('Erro ao criar checkout session:', error);
      alert('Erro ao processar pagamento. Tente novamente.');
    }
  };

  const plans = [
    {
      name: 'Básico',
      price: '$20',
      yearlyPrice: '$16.60',
      period: '/mês',
      yearlyPeriod: '/mês',
      libraries: '50 bibliotecas',
      features: [
        'Monitoramento básico',
        'Atualizações 6x por dia',
        'Suporte por email',
        'Relatórios básicos'
      ],
      popular: false,
      color: 'from-blue-500 to-blue-600',
      bgColor: 'rgba(59, 130, 246, 0.1)',
      borderColor: 'rgba(59, 130, 246, 0.3)',
      stripeMonthlyPriceId: 'price_1SHD1aAAQoQG6nci6KhrIbEQ',
      stripeAnnualPriceId: 'price_1SHD1bAAQoQG6nciQQBb9osJ'
    },
    {
      name: 'Pro',
      price: '$40',
      yearlyPrice: '$33.20',
      period: '/mês',
      yearlyPeriod: '/mês',
      libraries: '200 bibliotecas',
      features: [
        'Monitoramento avançado',
        'Atualizações em tempo real',
        'Suporte prioritário',
        'Relatórios detalhados',
        'Análise de tendências'
      ],
      popular: true,
      color: 'from-yellow-400 to-yellow-500',
      bgColor: 'rgba(245, 210, 108, 0.1)',
      borderColor: 'rgba(245, 210, 108, 0.3)',
      stripeMonthlyPriceId: 'price_1SHD1cAAQoQG6nciwFIEBpcz',
      stripeAnnualPriceId: 'price_1SHD1cAAQoQG6nciOOB3dzzE'
    },
    {
      name: 'Enterprise',
      price: '$100',
      yearlyPrice: '$83',
      period: '/mês',
      yearlyPeriod: '/mês',
      libraries: 'Bibliotecas ilimitadas',
      features: [
        'Monitoramento completo',
        'API personalizada',
        'Suporte dedicado',
        'Relatórios customizados',
        'Integração avançada',
        'Consultoria incluída'
      ],
      popular: false,
      color: 'from-purple-500 to-purple-600',
      bgColor: 'rgba(139, 92, 246, 0.1)',
      borderColor: 'rgba(139, 92, 246, 0.3)',
      stripeMonthlyPriceId: 'price_1SHD1dAAQoQG6nciTI8nWF4O',
      stripeAnnualPriceId: 'price_1SHD1eAAQoQG6ncib9MIrCeJ'
    }
  ];

  const features = [
    {
      icon: BarChart3,
      title: 'Monitoramento Inteligente',
      description: 'Acompanhe anúncios em tempo real com nossa tecnologia avançada de scraping'
    },
    {
      icon: Zap,
      title: 'Atualizações Automáticas',
      description: 'Receba atualizações 6 vezes por dia automaticamente'
    },
    {
      icon: Shield,
      title: 'Dados Seguros',
      description: 'Seus dados são protegidos com criptografia de nível bancário'
    },
    {
      icon: TrendingUp,
      title: 'Análise Avançada',
      description: 'Relatórios detalhados e insights para otimizar suas campanhas'
    }
  ];

  const testimonials = [
    {
      name: 'Maria Silva',
      role: 'Marketeira Digital',
      content: 'O Ecoom Task Force revolucionou minha forma de monitorar anúncios. Agora consigo identificar oportunidades muito mais rapidamente.',
      rating: 5
    },
    {
      name: 'João Santos',
      role: 'CEO, Agência Digital',
      content: 'A precisão dos dados e a facilidade de uso são impressionantes. Recomendo para qualquer profissional de marketing.',
      rating: 5
    },
    {
      name: 'Ana Costa',
      role: 'Especialista em Ads',
      content: 'Economizei horas de trabalho manual. O sistema é intuitivo e os resultados são sempre precisos.',
      rating: 5
    }
  ];

  return (
    <div style={{
      background: 'linear-gradient(135deg, #0c0f14 0%, #1a1d29 50%, #0c0f14 100%)',
      minHeight: '100vh',
      color: '#E8EDF2'
    }}>
      {/* Header */}
      <header style={{
        padding: '1rem 2rem',
        borderBottom: '1px solid rgba(245, 210, 108, 0.2)',
        background: 'rgba(12, 15, 20, 0.95)',
        backdropFilter: 'blur(20px)',
        position: 'sticky',
        top: 0,
        zIndex: 100
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          maxWidth: '1200px',
          margin: '0 auto'
        }}>
          <BrandLogo maxWidth={200} maxHeight={56} />
          
          <button
            onClick={() => router.push('/')}
            style={{
              background: 'linear-gradient(135deg, #F5D26C 0%, #F59E0B 100%)',
              color: '#0c0f14',
              border: 'none',
              borderRadius: '8px',
              padding: '0.75rem 1.5rem',
              fontSize: '1rem',
              fontWeight: '600',
              cursor: 'pointer',
              transition: 'transform 0.2s ease'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-2px)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
            }}
          >
            Entrar
          </button>
        </div>
      </header>

      {/* Hero Section */}
      <section style={{
        padding: '4rem 2rem',
        textAlign: 'center',
        maxWidth: '1200px',
        margin: '0 auto'
      }}>
        <div style={{ marginBottom: '2rem' }}>
          <h1 style={{
            fontSize: 'clamp(2.5rem, 5vw, 4rem)',
            fontWeight: 'bold',
            color: '#F5D26C',
            marginBottom: '1rem',
            textShadow: '0 0 20px rgba(245, 210, 108, 0.3)'
          }}>
            Monitore Anúncios com Inteligência
          </h1>
          <p style={{
            fontSize: '1.25rem',
            color: '#94a3b8',
            maxWidth: '600px',
            margin: '0 auto 2rem',
            lineHeight: '1.6'
          }}>
            Descubra oportunidades de mercado antes da concorrência com nosso sistema avançado de monitoramento de anúncios
          </p>
          
          <div style={{
            display: 'flex',
            gap: '1rem',
            justifyContent: 'center',
            flexWrap: 'wrap',
            marginBottom: '3rem'
          }}>
            <button
              onClick={() => router.push('/')}
              style={{
                background: 'linear-gradient(135deg, #F5D26C 0%, #F59E0B 100%)',
                color: '#0c0f14',
                border: 'none',
                borderRadius: '12px',
                padding: '1rem 2rem',
                fontSize: '1.1rem',
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
              Começar Agora
              <ArrowRight style={{ width: '20px', height: '20px' }} />
            </button>
            
            <button
              style={{
                background: 'rgba(245, 210, 108, 0.1)',
                color: '#F5D26C',
                border: '1px solid rgba(245, 210, 108, 0.3)',
                borderRadius: '12px',
                padding: '1rem 2rem',
                fontSize: '1.1rem',
                fontWeight: '600',
                cursor: 'pointer',
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
              Ver Demonstração
            </button>
          </div>
        </div>

        {/* Stats */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '2rem',
          marginBottom: '4rem'
        }}>
          {[
            { number: '10K+', label: 'Anúncios Monitorados' },
            { number: '500+', label: 'Usuários Ativos' },
            { number: '99.9%', label: 'Uptime' },
            { number: '24/7', label: 'Suporte' }
          ].map((stat, idx) => (
            <div key={idx} style={{
              background: 'rgba(245, 210, 108, 0.05)',
              border: '1px solid rgba(245, 210, 108, 0.2)',
              borderRadius: '12px',
              padding: '1.5rem',
              textAlign: 'center'
            }}>
              <div style={{
                fontSize: '2rem',
                fontWeight: 'bold',
                color: '#F5D26C',
                marginBottom: '0.5rem'
              }}>
                {stat.number}
              </div>
              <div style={{
                color: '#94a3b8',
                fontSize: '0.9rem'
              }}>
                {stat.label}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Features Section */}
      <section style={{
        padding: '4rem 2rem',
        background: 'rgba(245, 210, 108, 0.02)',
        maxWidth: '1200px',
        margin: '0 auto'
      }}>
        <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
          <h2 style={{
            fontSize: '2.5rem',
            fontWeight: 'bold',
            color: '#E8EDF2',
            marginBottom: '1rem'
          }}>
            Por que escolher o {APP_NAME}?
          </h2>
          <p style={{
            fontSize: '1.1rem',
            color: '#94a3b8',
            maxWidth: '600px',
            margin: '0 auto'
          }}>
            Tecnologia avançada para profissionais que querem estar sempre à frente
          </p>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: '2rem'
        }}>
          {features.map((feature, idx) => (
            <div key={idx} style={{
              background: '#141823',
              border: '1px solid rgba(245, 210, 108, 0.2)',
              borderRadius: '16px',
              padding: '2rem',
              textAlign: 'center',
              transition: 'transform 0.2s ease',
              cursor: 'pointer'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-4px)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
            }}>
              <div style={{
                width: '64px',
                height: '64px',
                borderRadius: '16px',
                background: 'linear-gradient(135deg, #F5D26C, #F59E0B)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 1.5rem'
              }}>
                <feature.icon style={{ width: '32px', height: '32px', color: '#0c0f14' }} />
              </div>
              <h3 style={{
                fontSize: '1.25rem',
                fontWeight: '600',
                color: '#E8EDF2',
                marginBottom: '1rem'
              }}>
                {feature.title}
              </h3>
              <p style={{
                color: '#94a3b8',
                lineHeight: '1.6'
              }}>
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Pricing Section */}
      <section style={{
        padding: '4rem 2rem',
        maxWidth: '1200px',
        margin: '0 auto'
      }}>
        <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
          <h2 style={{
            fontSize: '2.5rem',
            fontWeight: 'bold',
            color: '#E8EDF2',
            marginBottom: '1rem'
          }}>
            Escolha seu Plano
          </h2>
          <p style={{
            fontSize: '1.1rem',
            color: '#94a3b8',
            maxWidth: '600px',
            margin: '0 auto'
          }}>
            Planos flexíveis para profissionais de todos os tamanhos
          </p>
        </div>

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

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
          gap: '2rem',
          marginBottom: '2rem'
        }}>
          {plans.map((plan, idx) => (
            <div key={idx} style={{
              background: plan.popular ? 'rgba(245, 210, 108, 0.05)' : '#141823',
              border: plan.popular 
                ? '2px solid #F5D26C' 
                : '1px solid rgba(245, 210, 108, 0.2)',
              borderRadius: '20px',
              padding: '2rem',
              position: 'relative',
              transition: 'transform 0.2s ease',
              cursor: 'pointer'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-4px)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
            }}>
              {plan.popular && (
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
                    {billingCycle === 'monthly' ? plan.price : plan.yearlyPrice}
                  </span>
                  <span style={{
                    color: '#94a3b8',
                    fontSize: '1rem'
                  }}>
                    {billingCycle === 'monthly' ? plan.period : plan.yearlyPeriod}
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
                  marginTop: '0.5rem'
                }}>
                  {plan.libraries}
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

              <button
                onClick={() => createCheckoutSession(plan)}
                style={{
                  width: '100%',
                  background: plan.popular 
                    ? 'linear-gradient(135deg, #F5D26C 0%, #F59E0B 100%)'
                    : 'rgba(245, 210, 108, 0.1)',
                  color: plan.popular ? '#0c0f14' : '#F5D26C',
                  border: plan.popular 
                    ? 'none' 
                    : '1px solid rgba(245, 210, 108, 0.3)',
                  borderRadius: '12px',
                  padding: '1rem',
                  fontSize: '1rem',
                  fontWeight: '600',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
                onMouseEnter={(e) => {
                  if (!plan.popular) {
                    e.currentTarget.style.background = 'rgba(245, 210, 108, 0.2)';
                    e.currentTarget.style.borderColor = 'rgba(245, 210, 108, 0.5)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!plan.popular) {
                    e.currentTarget.style.background = 'rgba(245, 210, 108, 0.1)';
                    e.currentTarget.style.borderColor = 'rgba(245, 210, 108, 0.3)';
                  }
                }}
              >
                Começar Agora
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* Testimonials */}
      <section style={{
        padding: '4rem 2rem',
        background: 'rgba(245, 210, 108, 0.02)',
        maxWidth: '1200px',
        margin: '0 auto'
      }}>
        <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
          <h2 style={{
            fontSize: '2.5rem',
            fontWeight: 'bold',
            color: '#E8EDF2',
            marginBottom: '1rem'
          }}>
            O que nossos clientes dizem
          </h2>
          <p style={{
            fontSize: '1.1rem',
            color: '#94a3b8',
            maxWidth: '600px',
            margin: '0 auto'
          }}>
            Profissionais de marketing confiam no {APP_NAME}
          </p>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))',
          gap: '2rem'
        }}>
          {testimonials.map((testimonial, idx) => (
            <div key={idx} style={{
              background: '#141823',
              border: '1px solid rgba(245, 210, 108, 0.2)',
              borderRadius: '16px',
              padding: '2rem',
              transition: 'transform 0.2s ease'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-4px)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
            }}>
              <div style={{
                display: 'flex',
                gap: '0.25rem',
                marginBottom: '1rem'
              }}>
                {[...Array(testimonial.rating)].map((_, i) => (
                  <Star key={i} style={{ 
                    width: '20px', 
                    height: '20px', 
                    color: '#F5D26C',
                    fill: '#F5D26C'
                  }} />
                ))}
              </div>
              <p style={{
                color: '#E8EDF2',
                lineHeight: '1.6',
                marginBottom: '1.5rem',
                fontStyle: 'italic'
              }}>
                "{testimonial.content}"
              </p>
              <div>
                <div style={{
                  fontWeight: '600',
                  color: '#F5D26C',
                  marginBottom: '0.25rem'
                }}>
                  {testimonial.name}
                </div>
                <div style={{
                  color: '#94a3b8',
                  fontSize: '0.9rem'
                }}>
                  {testimonial.role}
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* CTA Section */}
      <section style={{
        padding: '4rem 2rem',
        textAlign: 'center',
        maxWidth: '1200px',
        margin: '0 auto'
      }}>
        <div style={{
          background: 'linear-gradient(135deg, rgba(245, 210, 108, 0.1), rgba(245, 158, 11, 0.1))',
          border: '1px solid rgba(245, 210, 108, 0.3)',
          borderRadius: '20px',
          padding: '3rem 2rem'
        }}>
          <h2 style={{
            fontSize: '2.5rem',
            fontWeight: 'bold',
            color: '#E8EDF2',
            marginBottom: '1rem'
          }}>
            Pronto para começar?
          </h2>
          <p style={{
            fontSize: '1.1rem',
            color: '#94a3b8',
            marginBottom: '2rem',
            maxWidth: '600px',
            margin: '0 auto 2rem'
          }}>
            Junte-se a centenas de profissionais que já estão monitorando anúncios com inteligência
          </p>
          
          <button
            onClick={() => router.push('/')}
            style={{
              background: 'linear-gradient(135deg, #F5D26C 0%, #F59E0B 100%)',
              color: '#0c0f14',
              border: 'none',
              borderRadius: '12px',
              padding: '1.25rem 2.5rem',
              fontSize: '1.1rem',
              fontWeight: '600',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              margin: '0 auto',
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
            Criar Conta Gratuita
            <ArrowRight style={{ width: '20px', height: '20px' }} />
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer style={{
        padding: '2rem',
        borderTop: '1px solid rgba(245, 210, 108, 0.2)',
        background: 'rgba(12, 15, 20, 0.95)',
        textAlign: 'center'
      }}>
        <div style={{ marginBottom: '1rem', display: 'flex', justifyContent: 'center' }}>
          <BrandLogo maxWidth={180} maxHeight={52} />
        </div>
        <p style={{
          color: '#94a3b8',
          fontSize: '0.9rem'
        }}>
          © 2026 {APP_NAME}. Todos os direitos reservados.
        </p>
      </footer>
    </div>
  );
}
