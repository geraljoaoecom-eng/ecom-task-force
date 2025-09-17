'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { 
  Flame, 
  BookOpen, 
  Folder, 
  Coins,
  FileText,
  ShoppingCart,
  PenTool,
  Copy
} from 'lucide-react'
import { cn } from '@/lib/utils'

const navigation = [
  {
    name: 'TOP 25 Bibliotecas',
    href: '/top-25',
    icon: Flame,
    current: false,
  },
  {
    name: 'Bibliotecas',
    href: '/bibliotecas',
    icon: BookOpen,
    current: false,
  },
  {
    name: 'Pastas',
    href: '/pastas',
    icon: Folder,
    current: false,
  },
]

const goldNavigation = [
  {
    name: 'Páginas Soltas',
    href: '/ouro/paginas-soltas',
    icon: FileText,
  },
  {
    name: 'Páginas de Vendas',
    href: '/ouro/paginas-de-vendas',
    icon: ShoppingCart,
  },
  {
    name: 'Headlines',
    href: '/ouro/headlines',
    icon: PenTool,
  },
  {
    name: 'Swipes',
    href: '/ouro/swipes',
    icon: Copy,
  },
]

export function Sidebar() {
  const pathname = usePathname()

  return (
    <div className="flex h-screen w-64 flex-col bg-card border-r border-gold/20">
      {/* Logo */}
      <div className="flex h-16 items-center justify-center border-b border-gold/20">
        <h1 className="text-xl font-bold text-gold drop-shadow-gold">ECOM TASK FORCE</h1>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 p-4">
        <div className="space-y-1">
          {navigation.map((item) => {
            const isActive = pathname === item.href
            return (
              <Link
                key={item.name}
                href={item.href}
                className={cn(
                  'group flex items-center rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200 h-11 rounded-xl',
                  isActive
                    ? 'bg-gold/10 text-gold border border-gold/30 drop-shadow-gold text-[1rem]'
                    : 'text-muted hover:bg-gold/5 hover:text-gold'
                )}
              >
                <item.icon
                  className={cn(
                    'mr-3 h-5 w-5 flex-shrink-0',
                    isActive ? 'text-gold' : 'text-muted group-hover:text-gold'
                  )}
                />
                {item.name}
              </Link>
            )
          })}
        </div>

        {/* Ouro Section */}
        <div className="pt-6">
          <div className="flex items-center mb-3">
            <Coins className="h-5 w-5 text-gold mr-2" />
            <h3 className="text-sm font-semibold text-gold">OURO</h3>
          </div>
          <div className="space-y-1 pl-7">
            {goldNavigation.map((item) => {
              const isActive = pathname === item.href
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={cn(
                    'group flex items-center rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200 h-11 rounded-xl',
                    isActive
                      ? 'bg-gold/10 text-gold border border-gold/30 drop-shadow-gold text-[1rem]'
                      : 'text-muted hover:bg-gold/5 hover:text-gold'
                  )}
                >
                  <item.icon
                    className={cn(
                      'mr-3 h-4 w-4 flex-shrink-0',
                      isActive ? 'text-gold' : 'text-muted group-hover:text-gold'
                    )}
                  />
                  {item.name}
                </Link>
              )
            })}
          </div>
        </div>
      </nav>

      {/* Status */}
      <div className="border-t border-gold/20 p-4">
        <div className="text-xs text-muted">
          <div className="flex items-center justify-between mb-1">
            <span>Sistema:</span>
            <span className="text-green-400">●</span>
          </div>
          <div className="flex items-center justify-between">
            <span>Auto-Recovery:</span>
            <span className="text-gold">ATIVO</span>
          </div>
        </div>
      </div>
    </div>
  )
}
