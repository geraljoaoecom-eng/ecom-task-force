import './globals.css'
import type { Metadata } from 'next'
import { ConditionalLayout } from '@/components/ConditionalLayout'
import ErrorReporter from '@/components/ErrorReporter'
import { APP_NAME } from '@/lib/brand'

export const metadata: Metadata = {
  title: APP_NAME,
  description: 'Monitorização de bibliotecas Meta Ads, SPY e copy bank para direct response.',
  icons: { icon: '/logo.png', apple: '/logo.png' },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <body suppressHydrationWarning style={{
        fontSize: '15px',
        letterSpacing: '0.01em',
        margin: 0,
        padding: 0,
        backgroundColor: '#0c0f14',
        color: '#E8EDF2',
        fontFamily: 'system-ui, -apple-system, sans-serif'
      }}>
        <ErrorReporter />
        <ConditionalLayout>
          {children}
        </ConditionalLayout>
      </body>
    </html>
  )
}
