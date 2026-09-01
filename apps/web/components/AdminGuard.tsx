'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

interface AdminGuardProps {
  children: React.ReactNode;
}

export default function AdminGuard({ children }: AdminGuardProps) {
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const checkAdmin = async () => {
      const token = localStorage.getItem('authToken');
      
      if (!token) {
        router.push('/');
        return;
      }

      try {
        // Verificar se o token ainda é válido e se é admin
        const response = await fetch('/api/auth/verify', {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });

        if (response.ok) {
          const data = await response.json();
          if (data.user && data.user.role === 'admin') {
            setIsAdmin(true);
          } else {
            // Usuário não é admin, redirecionar para dashboard de usuário
            router.push('/dashboard-user');
          }
        } else {
          localStorage.removeItem('authToken');
          localStorage.removeItem('user');
          router.push('/');
        }
      } catch (error) {
        localStorage.removeItem('authToken');
        localStorage.removeItem('user');
        router.push('/');
      } finally {
        setLoading(false);
      }
    };

    checkAdmin();
  }, [router]);

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #0c0f14 0%, #1a1f2e 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        <div style={{ textAlign: 'center', color: '#E8EDF2' }}>
          <div style={{
            width: '4rem',
            height: '4rem',
            border: '4px solid rgba(245, 210, 108, 0.2)',
            borderTop: '4px solid #F5D26C',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            margin: '0 auto 1rem'
          }}></div>
          <p style={{ color: '#94a3b8' }}>Verificando permissões de administrador...</p>
          <style dangerouslySetInnerHTML={{
            __html: `
              @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
              }
            `
          }} />
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return null; // Será redirecionado
  }

  return <>{children}</>;
}
