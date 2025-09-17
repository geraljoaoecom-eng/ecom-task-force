'use client'

import { Copy } from 'lucide-react'

export default function SwipesPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-text flex items-center gap-3">
          <Copy className="h-8 w-8 text-gold" />
          Swipes
        </h1>
        <p className="text-muted mt-2">
          Arquivo de swipes para copywrites e criativos
        </p>
      </div>

      <div className="card p-12 text-center">
        <Copy className="h-16 w-16 text-gold mx-auto mb-4 opacity-50" />
        <h3 className="text-xl font-semibold text-text mb-2">
          Em Desenvolvimento
        </h3>
        <p className="text-muted">
          Esta seção estará disponível em breve com conteúdo exclusivo.
        </p>
      </div>
    </div>
  )
}
