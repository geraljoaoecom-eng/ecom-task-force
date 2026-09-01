'use client'

import { ShoppingCart } from 'lucide-react'

export default function PaginasDeVendasPage() {
  return (
    <div style={{ 
      background: '#0c0f14', 
      color: '#E8EDF2', 
      minHeight: '100vh',
      padding: 'clamp(1rem, 3vw, 2rem)',
      boxSizing: 'border-box',
      overflow: 'hidden'
    }}>
      <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-text flex items-center gap-3">
          <ShoppingCart className="h-8 w-8 text-gold" />
          Páginas de Vendas
        </h1>
        <p className="text-muted mt-2">
          Templates e exemplos de landing pages que vendem
        </p>
      </div>

      <div className="card p-12 text-center">
        <ShoppingCart className="h-16 w-16 text-gold mx-auto mb-4 opacity-50" />
        <h3 className="text-xl font-semibold text-text mb-2">
          Em Desenvolvimento
        </h3>
        <p className="text-muted">
          Esta seção estará disponível em breve com conteúdo exclusivo.
        </p>
      </div>
      </div>
    </div>
  )
}
