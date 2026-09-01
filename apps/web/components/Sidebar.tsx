'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useState, useEffect } from 'react'
import { BrandLogo } from '@/components/BrandLogo'
import { 
  Flame, 
  BookOpen, 
  Folder, 
  Coins,
  FileText,
  ShoppingCart,
  PenTool,
  Copy,
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  LogOut,
  LayoutDashboard,
  Menu,
  ScanSearch,
  ClipboardList,
  GraduationCap,
  Instagram,
} from 'lucide-react'

const navigation = [
  {
    name: 'Dashboard',
    href: '/dashboard',
    icon: LayoutDashboard,
    current: false,
    adminOnly: false,
  },
  {
    name: 'SPY',
    href: '/spy',
    icon: ScanSearch,
    current: false,
    adminOnly: true,
  },
  {
    name: 'Bibliotecas',
    href: '/bibliotecas',
    icon: BookOpen,
    current: false,
    adminOnly: false,
  },
  {
    name: 'TOP 25 Bibliotecas',
    href: '/top-25',
    icon: Flame,
    current: false,
    adminOnly: false,
  },
  {
    name: 'Pastas',
    href: '/pastas',
    icon: Folder,
    current: false,
    adminOnly: false,
  },
  {
    name: 'Copy',
    href: '/copy',
    icon: ClipboardList,
    current: false,
    adminOnly: true,
  },
  {
    name: 'Study',
    href: '/study',
    icon: GraduationCap,
    current: false,
    adminOnly: true,
  },
  {
    name: 'Instagram Talks',
    href: '/study/instagram-talks',
    icon: Instagram,
    current: false,
    adminOnly: true,
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
  const router = useRouter()
  const [isOuroExpanded, setIsOuroExpanded] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)
  const [isOpen, setIsOpen] = useState(false)

  const SIDEBAR_WIDTH = '16rem'
  // Verificar se usuário é admin
  useEffect(() => {
    const user = localStorage.getItem('user')
    if (user) {
      try {
        const userData = JSON.parse(user)
        setIsAdmin(userData.role === 'admin')
      } catch {
        setIsAdmin(false)
      }
    }
  }, [])
  
  const handleLogout = () => {
    localStorage.removeItem('authToken')
    localStorage.removeItem('user')
    router.push('/')
  }

  // Verificar se alguma página do OURO está ativa
  const isOuroActive = pathname.startsWith('/ouro/')
  
  // Ajustar navegação baseado no role
  const adjustedNavigation = navigation
    .map((item) => {
      if (item.href === '/dashboard') {
        return {
          ...item,
          name: isAdmin ? 'Admin' : 'Dashboard',
          href: isAdmin ? '/admin' : '/dashboard-user',
        }
      }
      return item
    })
    .filter((item) => !item.adminOnly || isAdmin)

  return (
    <>
      {/* Botão para abrir — visível quando fechado */}
      {!isOpen && (
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          title="Abrir menu"
          style={{
            position: 'fixed',
            left: 0,
            top: '50%',
            transform: 'translateY(-50%)',
            zIndex: 1001,
            width: '36px',
            height: '72px',
            background: '#141823',
            border: '1px solid rgba(245,210,108,0.35)',
            borderLeft: 'none',
            borderRadius: '0 0.5rem 0.5rem 0',
            color: '#F5D26C',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '4px 0 16px rgba(0,0,0,0.35)',
            transition: 'background 0.2s, border-color 0.2s',
          }}
          onMouseOver={(e) => {
            e.currentTarget.style.background = 'rgba(245,210,108,0.12)'
            e.currentTarget.style.borderColor = 'rgba(245,210,108,0.5)'
          }}
          onMouseOut={(e) => {
            e.currentTarget.style.background = '#141823'
            e.currentTarget.style.borderColor = 'rgba(245,210,108,0.35)'
          }}
        >
          <Menu style={{ width: '1.125rem', height: '1.125rem' }} />
        </button>
      )}

      {/* Overlay — clica fora para fechar */}
      {isOpen && (
        <div
          onClick={() => setIsOpen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.45)',
            zIndex: 999,
          }}
          aria-hidden
        />
      )}

      {/* Sidebar */}
      <div
        style={{
          position: 'fixed',
          left: 0,
          top: 0,
          height: '100vh',
          width: isOpen ? SIDEBAR_WIDTH : 0,
          zIndex: 1000,
          overflow: 'hidden',
          transition: 'width 0.28s ease',
          boxShadow: isOpen ? '4px 0 24px rgba(0,0,0,0.45)' : 'none',
        }}
      >
        <div style={{
          display: 'flex',
          height: '100vh',
          width: SIDEBAR_WIDTH,
          flexDirection: 'column',
          backgroundColor: '#141823',
          borderRight: '1px solid rgba(245, 210, 108, 0.2)',
          boxSizing: 'border-box',
          overflowY: 'auto',
        }}>
      {/* Ecoom Task Force — logo */}
      <div style={{
        display: 'flex',
        minHeight: 'clamp(4.5rem, 10vw, 6rem)',
        alignItems: 'center',
        justifyContent: 'center',
        borderBottom: '1px solid rgba(245, 210, 108, 0.2)',
        background: 'linear-gradient(to right, rgba(245, 210, 108, 0.05), transparent)',
        padding: '0.75rem 2.25rem 0.75rem 0.75rem',
        boxSizing: 'border-box',
        position: 'relative',
      }}>
        <button
          type="button"
          onClick={() => setIsOpen(false)}
          title="Fechar menu"
          style={{
            position: 'absolute',
            right: '0.625rem',
            top: '50%',
            transform: 'translateY(-50%)',
            background: 'rgba(245,210,108,0.1)',
            border: '1px solid rgba(245,210,108,0.25)',
            borderRadius: '0.375rem',
            color: '#F5D26C',
            cursor: 'pointer',
            padding: '0.35rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <ChevronLeft style={{ width: '1rem', height: '1rem' }} />
        </button>
        <BrandLogo maxWidth={168} maxHeight={56} />
      </div>

      {/* Status */}
      <div style={{
        borderBottom: '1px solid rgba(245, 210, 108, 0.2)',
        padding: '1rem',
        backgroundColor: 'rgba(245, 210, 108, 0.05)'
      }}>
        <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
            <span>Sistema:</span>
            <span style={{ color: '#4ade80' }}>●</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span>Auto-Recovery:</span>
            <span style={{ color: '#F5D26C' }}>ATIVO</span>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav style={{ flex: 1, padding: '1rem' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          {adjustedNavigation.map((item) => {
            const isActive = pathname === item.href
            return (
              <Link
                key={item.name}
                href={item.href}
                onClick={() => setIsOpen(false)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  borderRadius: '0.75rem',
                  padding: '0.75rem',
                  fontSize: '0.875rem',
                  fontWeight: '500',
                  transition: 'all 0.2s',
                  height: '2.75rem',
                  textDecoration: 'none',
                  backgroundColor: isActive ? 'rgba(245, 210, 108, 0.1)' : 'transparent',
                  color: isActive ? '#F5D26C' : '#94a3b8',
                  border: isActive ? '1px solid rgba(245, 210, 108, 0.3)' : '1px solid transparent',
                  textShadow: isActive ? '0 0 10px rgba(245, 210, 108, 0.35)' : 'none'
                }}
                onMouseOver={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.backgroundColor = 'rgba(245, 210, 108, 0.05)'
                    e.currentTarget.style.color = '#F5D26C'
                  }
                }}
                onMouseOut={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.backgroundColor = 'transparent'
                    e.currentTarget.style.color = '#94a3b8'
                  }
                }}
              >
                <item.icon
                  style={{
                    marginRight: '0.75rem',
                    height: '1.25rem',
                    width: '1.25rem',
                    flexShrink: 0,
                    color: isActive ? '#F5D26C' : '#94a3b8'
                  }}
                />
                {item.name}
              </Link>
            )
          })}
        </div>

        {/* Ouro Section - apenas admin */}
        {isAdmin && (
        <div style={{ paddingTop: '1.5rem' }}>
          {/* Botão OURO */}
          <button
            onClick={() => setIsOuroExpanded(!isOuroExpanded)}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              width: '100%',
              padding: '0.75rem',
              borderRadius: '0.75rem',
              fontSize: '0.875rem',
              fontWeight: '600',
              color: isOuroActive ? '#F5D26C' : '#94a3b8',
              backgroundColor: isOuroActive ? 'rgba(245, 210, 108, 0.1)' : 'transparent',
              border: isOuroActive ? '1px solid rgba(245, 210, 108, 0.3)' : '1px solid transparent',
              textShadow: isOuroActive ? '0 0 10px rgba(245, 210, 108, 0.35)' : 'none',
              cursor: 'pointer',
              transition: 'all 0.2s',
              marginBottom: isOuroExpanded ? '0.75rem' : '0'
            }}
            onMouseOver={(e) => {
              if (!isOuroActive) {
                e.currentTarget.style.backgroundColor = 'rgba(245, 210, 108, 0.05)'
                e.currentTarget.style.color = '#F5D26C'
              }
            }}
            onMouseOut={(e) => {
              if (!isOuroActive) {
                e.currentTarget.style.backgroundColor = 'transparent'
                e.currentTarget.style.color = '#94a3b8'
              }
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <Coins style={{ height: '1.25rem', width: '1.25rem', marginRight: '0.5rem' }} />
              OURO
            </div>
            {isOuroExpanded ? (
              <ChevronDown style={{ height: '1rem', width: '1rem' }} />
            ) : (
              <ChevronRight style={{ height: '1rem', width: '1rem' }} />
            )}
          </button>

          {/* Submenu OURO - Expansível */}
          {isOuroExpanded && (
            <div style={{ 
              display: 'flex', 
              flexDirection: 'column', 
              gap: '0.25rem', 
              paddingLeft: '1.75rem',
              animation: 'slideDown 0.3s ease-out'
            }}>
              {goldNavigation.map((item) => {
                const isActive = pathname === item.href
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    onClick={() => setIsOpen(false)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      borderRadius: '0.75rem',
                      padding: '0.75rem',
                      fontSize: '0.875rem',
                      fontWeight: '500',
                      transition: 'all 0.2s',
                      height: '2.75rem',
                      textDecoration: 'none',
                      backgroundColor: isActive ? 'rgba(245, 210, 108, 0.1)' : 'transparent',
                      color: isActive ? '#F5D26C' : '#94a3b8',
                      border: isActive ? '1px solid rgba(245, 210, 108, 0.3)' : '1px solid transparent',
                      textShadow: isActive ? '0 0 10px rgba(245, 210, 108, 0.35)' : 'none'
                    }}
                    onMouseOver={(e) => {
                      if (!isActive) {
                        e.currentTarget.style.backgroundColor = 'rgba(245, 210, 108, 0.05)'
                        e.currentTarget.style.color = '#F5D26C'
                      }
                    }}
                    onMouseOut={(e) => {
                      if (!isActive) {
                        e.currentTarget.style.backgroundColor = 'transparent'
                        e.currentTarget.style.color = '#94a3b8'
                      }
                    }}
                  >
                    <item.icon
                      style={{
                        marginRight: '0.75rem',
                        height: '1rem',
                        width: '1rem',
                        flexShrink: 0,
                        color: isActive ? '#F5D26C' : '#94a3b8'
                      }}
                    />
                    {item.name}
                  </Link>
                )
              })}
            </div>
          )}
        </div>
        )}
      </nav>
      
      {/* Botão de Logout */}
      <div style={{
        padding: '1rem',
        borderTop: '1px solid rgba(148, 163, 184, 0.1)',
        marginTop: 'auto'
      }}>
        <button
          onClick={handleLogout}
          style={{
            display: 'flex',
            alignItems: 'center',
            width: '100%',
            padding: '0.75rem',
            borderRadius: '0.75rem',
            fontSize: '0.875rem',
            fontWeight: '500',
            backgroundColor: 'transparent',
            color: '#ef4444',
            border: '1px solid rgba(239, 68, 68, 0.2)',
            cursor: 'pointer',
            transition: 'all 0.2s'
          }}
          onMouseOver={(e) => {
            e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.1)'
            e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.4)'
          }}
          onMouseOut={(e) => {
            e.currentTarget.style.backgroundColor = 'transparent'
            e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.2)'
          }}
        >
          <LogOut style={{ 
            height: '1rem', 
            width: '1rem', 
            marginRight: '0.75rem' 
          }} />
          Sair
        </button>
      </div>
        </div>
      </div>
    </>
  )
}
