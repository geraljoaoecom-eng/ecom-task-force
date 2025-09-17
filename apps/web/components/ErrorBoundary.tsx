'use client'

import React from 'react'
import { AlertTriangle, RefreshCw } from 'lucide-react'

interface ErrorBoundaryState {
  hasError: boolean
  error?: Error
}

interface ErrorBoundaryProps {
  children: React.ReactNode
  fallback?: React.ReactNode
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo)
  }

  handleReset = () => {
    this.setState({ hasError: false, error: undefined })
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback
      }

      return (
        <div className="min-h-[400px] flex items-center justify-center p-8">
          <div className="text-center max-w-md">
            <div className="mb-6">
              <AlertTriangle className="h-16 w-16 text-yellow-500 mx-auto mb-4" />
              <h2 className="text-xl font-bold text-white mb-2">Oops! Algo deu errado</h2>
              <p className="text-gray-400 text-sm mb-4">
                Ocorreu um erro inesperado. Tente recarregar ou entre em contato com o suporte.
              </p>
              {process.env.NODE_ENV === 'development' && this.state.error && (
                <details className="text-left text-xs bg-gray-800 p-3 rounded border border-gray-600 mb-4">
                  <summary className="cursor-pointer text-yellow-400 mb-2">Detalhes do erro</summary>
                  <pre className="text-red-400 whitespace-pre-wrap break-words">
                    {this.state.error.message}
                    {'\n\n'}
                    {this.state.error.stack}
                  </pre>
                </details>
              )}
            </div>
            
            <div className="space-y-3">
              <button
                onClick={this.handleReset}
                className="etf-btn etf-btn-primary w-full flex items-center justify-center gap-2"
              >
                <RefreshCw className="h-4 w-4" />
                Tentar Novamente
              </button>
              
              <button
                onClick={() => window.location.reload()}
                className="etf-btn etf-btn-ghost w-full"
              >
                Recarregar Página
              </button>
            </div>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

// Hook para usar error boundary de forma declarativa
export function useErrorHandler() {
  return (error: Error, errorInfo?: React.ErrorInfo) => {
    console.error('Error caught by useErrorHandler:', error, errorInfo)
    // Aqui você pode integrar com serviços de monitoramento como Sentry
  }
}
