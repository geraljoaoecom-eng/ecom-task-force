'use client'

import { FileText, Search, Filter, ExternalLink } from 'lucide-react'

export default function PaginasSoltasPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-text flex items-center gap-3">
            <FileText className="h-8 w-8 text-gold" />
            Páginas Soltas
          </h1>
          <p className="text-muted mt-2">
            Coleção de páginas de alta conversão para inspiração
          </p>
        </div>
      </div>

      <div className="card p-12 text-center">
        <FileText className="h-16 w-16 text-gold mx-auto mb-4 opacity-50" />
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
