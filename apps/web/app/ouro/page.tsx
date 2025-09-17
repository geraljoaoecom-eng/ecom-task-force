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
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center mb-12">
        <div className="inline-flex items-center justify-center w-20 h-20 bg-gold/10 rounded-full mb-6">
          <Crown className="h-10 w-10 text-gold" />
        </div>
        <h1 className="text-4xl font-bold text-text mb-4">
          Seção OURO
        </h1>
        <p className="text-xl text-muted max-w-2xl mx-auto">
          Recursos premium para maximizar suas campanhas de e-commerce. 
          Coleções exclusivas de materiais testados e aprovados.
        </p>
      </div>

      {/* Features Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {goldFeatures.map((feature) => (
          <Link
            key={feature.name}
            href={feature.href}
            className="group"
          >
            <div className="card p-8 h-full transition-all duration-300 group-hover:scale-[1.02]">
              <div className="flex items-start gap-4">
                <div className="p-4 bg-gold/10 rounded-xl group-hover:bg-gold/20 transition-colors">
                  <feature.icon className="h-8 w-8 text-gold" />
                </div>
                
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-3">
                    <h3 className="text-xl font-semibold text-text group-hover:text-gold transition-colors">
                      {feature.name}
                    </h3>
                    <span className="badge">
                      {feature.status}
                    </span>
                  </div>
                  
                  <p className="text-muted leading-relaxed">
                    {feature.description}
                  </p>
                  
                  <div className="mt-6 flex items-center text-gold group-hover:gap-3 gap-2 transition-all">
                    <span className="text-sm font-medium">Explorar</span>
                    <Star className="h-4 w-4 group-hover:rotate-12 transition-transform" />
                  </div>
                </div>
              </div>
            </div>
          </Link>
        ))}
      </div>

      {/* Coming Soon Banner */}
      <div className="card p-8 text-center bg-gradient-to-r from-gold/5 to-gold/10 border-gold/30">
        <Coins className="h-12 w-12 text-gold mx-auto mb-4" />
        <h3 className="text-2xl font-bold text-text mb-3">
          Mais recursos em desenvolvimento
        </h3>
        <p className="text-muted mb-6 max-w-2xl mx-auto">
          Estamos trabalhando em recursos avançados como análise de competição, 
          identificação de tendências e insights automáticos de performance.
        </p>
        <div className="inline-flex items-center gap-2 badge text-base px-6 py-3">
          <Star className="h-4 w-4" />
          Aguarde novidades
        </div>
      </div>
    </div>
  )
}
