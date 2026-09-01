'use client'

import Link from 'next/link'
import { Coins, FileText, ShoppingCart, PenTool, Copy, Crown, Star } from 'lucide-react'

const goldFeatures = [
  {
    name: 'Páginas Soltas',
    href: '/ouro/paginas-soltas',
    icon: FileText,
    description: 'Coleção de páginas de alta conversão para inspiração',
    status: 'Em breve'
  },
  {
    name: 'Páginas de Vendas',
    href: '/ouro/paginas-de-vendas',
    icon: ShoppingCart,
    description: 'Templates e exemplos de landing pages que vendem',
    status: 'Em breve'
  },
  {
    name: 'Headlines',
    href: '/ouro/headlines',
    icon: PenTool,
    description: 'Headlines poderosos testados e aprovados',
    status: 'Em breve'
  },
  {
    name: 'Swipes',
    href: '/ouro/swipes',
    icon: Copy,
    description: 'Arquivos de swipes para copywrites e criativos',
    status: 'Em breve'
  },
]

export default function OuroPage() {
  return (
    <div style={{ 
      background: '#0c0f14', 
      color: '#E8EDF2', 
      minHeight: '100vh',
      padding: '2rem'
    }}>
      {/* Header */}
      <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '5rem',
          height: '5rem',
          background: 'rgba(245, 210, 108, 0.1)',
          borderRadius: '50%',
          marginBottom: '1.5rem'
        }}>
          <Crown style={{ height: '2.5rem', width: '2.5rem', color: '#F5D26C' }} />
        </div>
        <h1 style={{ 
          fontSize: '2.5rem', 
          fontWeight: 'bold', 
          color: '#E8EDF2', 
          marginBottom: '1rem' 
        }}>
          Seção OURO
        </h1>
        <p style={{ 
          fontSize: '1.25rem', 
          color: '#94a3b8', 
          maxWidth: '32rem', 
          margin: '0 auto' 
        }}>
          Recursos premium para maximizar suas campanhas de e-commerce. 
          Coleções exclusivas de materiais testados e aprovados.
        </p>
      </div>

      {/* Features Grid */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', 
        gap: '2rem',
        marginBottom: '2rem'
      }}>
        {goldFeatures.map((feature) => (
          <Link
            key={feature.name}
            href={feature.href}
            style={{ textDecoration: 'none' }}
          >
            <div style={{
              background: '#141823',
              border: '1px solid rgba(245, 210, 108, 0.2)',
              borderRadius: '0.75rem',
              padding: '2rem',
              height: '100%',
              transition: 'all 0.3s',
              cursor: 'pointer',
              boxShadow: '0 6px 24px rgba(0, 0, 0, 0.35)'
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.transform = 'scale(1.02)'
              e.currentTarget.style.borderColor = 'rgba(245, 210, 108, 0.4)'
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.transform = 'scale(1)'
              e.currentTarget.style.borderColor = 'rgba(245, 210, 108, 0.2)'
            }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem' }}>
                <div style={{
                  padding: '1rem',
                  background: 'rgba(245, 210, 108, 0.1)',
                  borderRadius: '0.75rem',
                  transition: 'background-color 0.3s'
                }}>
                  <feature.icon style={{ height: '2rem', width: '2rem', color: '#F5D26C' }} />
                </div>
                
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
                    <h3 style={{ 
                      fontSize: '1.25rem', 
                      fontWeight: '600', 
                      color: '#E8EDF2',
                      transition: 'color 0.3s'
                    }}>
                      {feature.name}
                    </h3>
                    <span style={{
                      background: 'rgba(245, 210, 108, 0.1)',
                      color: '#F5D26C',
                      padding: '0.25rem 0.75rem',
                      borderRadius: '9999px',
                      fontSize: '0.75rem',
                      fontWeight: '500',
                      border: '1px solid rgba(245, 210, 108, 0.2)'
                    }}>
                      {feature.status}
                    </span>
                  </div>
                  
                  <p style={{ 
                    color: '#94a3b8', 
                    lineHeight: '1.6',
                    marginBottom: '1.5rem'
                  }}>
                    {feature.description}
                  </p>
                  
                  <div style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    color: '#F5D26C',
                    gap: '0.5rem',
                    transition: 'gap 0.3s'
                  }}>
                    <span style={{ fontSize: '0.875rem', fontWeight: '500' }}>Explorar</span>
                    <Star style={{ 
                      height: '1rem', 
                      width: '1rem',
                      transition: 'transform 0.3s'
                    }} />
                  </div>
                </div>
              </div>
            </div>
          </Link>
        ))}
      </div>

      {/* Coming Soon Banner */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(245, 210, 108, 0.05), rgba(245, 210, 108, 0.1))',
        border: '1px solid rgba(245, 210, 108, 0.3)',
        borderRadius: '0.75rem',
        padding: '2rem',
        textAlign: 'center',
        boxShadow: '0 6px 24px rgba(0, 0, 0, 0.35)'
      }}>
        <Coins style={{ 
          height: '3rem', 
          width: '3rem', 
          color: '#F5D26C', 
          margin: '0 auto 1rem' 
        }} />
        <h3 style={{ 
          fontSize: '1.5rem', 
          fontWeight: 'bold', 
          color: '#E8EDF2', 
          marginBottom: '0.75rem' 
        }}>
          Mais recursos em desenvolvimento
        </h3>
        <p style={{ 
          color: '#94a3b8', 
          marginBottom: '1.5rem', 
          maxWidth: '32rem', 
          margin: '0 auto 1.5rem' 
        }}>
          Estamos trabalhando em recursos avançados como análise de competição, 
          identificação de tendências e insights automáticos de performance.
        </p>
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.5rem',
          background: 'rgba(245, 210, 108, 0.1)',
          color: '#F5D26C',
          padding: '0.75rem 1.5rem',
          borderRadius: '9999px',
          fontSize: '1rem',
          fontWeight: '500',
          border: '1px solid rgba(245, 210, 108, 0.2)'
        }}>
          <Star style={{ height: '1rem', width: '1rem' }} />
          Aguarde novidades
        </div>
      </div>
    </div>
  )
}