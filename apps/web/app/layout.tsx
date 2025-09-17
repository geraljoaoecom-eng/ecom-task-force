import './globals.css'
import type { Metadata } from 'next'
import { Sidebar } from '@/components/Sidebar'
import { ShortcutsHelp } from '@/components/ShortcutsHelp'
import { ModalProvider } from '@/contexts/ModalContext'

export const metadata: Metadata = {
  title: 'ECOM TASK FORCE',
  description: 'Sistema de monitoramento de bibliotecas de anúncios do Facebook',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="pt-BR">
      <body className="text-[15px] md:text-[16px] tracking-[0.01em]">
        <ModalProvider>
          <div className="flex min-h-screen bg-background">
            <Sidebar />
            <main className="flex-1 p-6 max-w-[1500px] mx-auto px-5 md:px-8 xl:px-10">
              {children}
            </main>
          </div>
          <ShortcutsHelp />
        </ModalProvider>
      </body>
    </html>
  )
}
