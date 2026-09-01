'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { BrandLogo } from '@/components/BrandLogo';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const token = localStorage.getItem('authToken');
    if (!token) return;

    fetch('/api/auth/verify', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((response) => {
        if (!response.ok) throw new Error('invalid');
        return response.json();
      })
      .then((data) => {
        router.push('/dashboard-user');
      })
      .catch(() => {
        localStorage.removeItem('authToken');
        localStorage.removeItem('user');
      });
  }, [router]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      let data: { error?: string; token?: string; user?: { role?: string } } = {};
      try {
        data = await response.json();
      } catch {
        if (response.status === 502 || response.status === 503 || response.status === 504) {
          setError('Servidor temporariamente indisponível. Tenta outra vez em 1 minuto.');
          return;
        }
        setError('Resposta inválida do servidor. Tenta outra vez.');
        return;
      }

      if (response.ok) {
        localStorage.setItem('authToken', data.token!);
        localStorage.setItem('user', JSON.stringify(data.user));
        router.push('/dashboard-user');
      } else if (response.status === 502 || response.status === 503 || response.status === 504) {
        setError('Servidor temporariamente indisponível. Tenta outra vez em 1 minuto.');
      } else {
        setError(data.error || 'Erro ao fazer login');
      }
    } catch {
      setError('Sem ligação ao servidor. Verifica a internet e tenta outra vez.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      background: 'linear-gradient(135deg, #0c0f14 0%, #1a1d29 50%, #0c0f14 100%)',
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '2rem',
      position: 'relative',
      overflow: 'hidden'
    }}>
      {/* Background Effects */}
      <div style={{
        position: 'absolute',
        top: '-50%',
        left: '-50%',
        width: '200%',
        height: '200%',
        background: 'radial-gradient(circle, rgba(245, 210, 108, 0.1) 0%, transparent 70%)',
        animation: 'float 6s ease-in-out infinite'
      }} />
      
      <div style={{
        position: 'absolute',
        top: '20%',
        right: '-20%',
        width: '300px',
        height: '300px',
        background: 'radial-gradient(circle, rgba(59, 130, 246, 0.1) 0%, transparent 70%)',
        animation: 'float 8s ease-in-out infinite reverse'
      }} />

      {/* Main Login Card */}
      <div style={{
        background: 'rgba(12, 15, 20, 0.95)',
        backdropFilter: 'blur(20px)',
        border: '1px solid rgba(245, 210, 108, 0.2)',
        borderRadius: '24px',
        padding: '3rem',
        width: '100%',
        maxWidth: '450px',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(245, 210, 108, 0.1)',
        position: 'relative',
        zIndex: 10
      }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
          <div style={{ margin: '0 auto 1.5rem', maxWidth: '280px' }}>
            <BrandLogo maxWidth={280} maxHeight={100} />
          </div>
          
          <p style={{
            color: '#94a3b8',
            fontSize: '1.1rem',
            fontWeight: '500'
          }}>
            Faça login em sua conta
          </p>
        </div>
        {/* Error/Success Message */}
        {error && (
          <div style={{
            padding: '1rem',
            borderRadius: '12px',
            marginBottom: '1.5rem',
            fontSize: '0.9rem',
            fontWeight: '500',
            backgroundColor: error.includes('sucesso') 
              ? 'rgba(34, 197, 94, 0.1)' 
              : 'rgba(239, 68, 68, 0.1)',
            color: error.includes('sucesso') 
              ? '#22c55e' 
              : '#ef4444',
            border: `1px solid ${error.includes('sucesso') 
              ? 'rgba(34, 197, 94, 0.2)' 
              : 'rgba(239, 68, 68, 0.2)'}`,
            textAlign: 'center'
          }}>
            {error}
          </div>
        )}

        {/* Forms */}
        <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div>
              <label style={{
                display: 'block',
                fontSize: '0.9rem',
                fontWeight: '600',
                color: '#E8EDF2',
                marginBottom: '0.5rem'
              }}>
                Email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                style={{
                  width: '100%',
                  padding: '1rem',
                  borderRadius: '12px',
                  border: '1px solid rgba(148, 163, 184, 0.2)',
                  backgroundColor: 'rgba(12, 15, 20, 0.8)',
                  color: '#E8EDF2',
                  fontSize: '1rem',
                  outline: 'none',
                  transition: 'all 0.3s ease',
                  boxSizing: 'border-box'
                }}
                placeholder="seu@email.com"
              />
            </div>

            <div>
              <label style={{
                display: 'block',
                fontSize: '0.9rem',
                fontWeight: '600',
                color: '#E8EDF2',
                marginBottom: '0.5rem'
              }}>
                Senha
              </label>
              <input
                id="password"
                name="password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={{
                  width: '100%',
                  padding: '1rem',
                  borderRadius: '12px',
                  border: '1px solid rgba(148, 163, 184, 0.2)',
                  backgroundColor: 'rgba(12, 15, 20, 0.8)',
                  color: '#E8EDF2',
                  fontSize: '1rem',
                  outline: 'none',
                  transition: 'all 0.3s ease',
                  boxSizing: 'border-box'
                }}
                placeholder="Sua senha"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%',
                padding: '1rem',
                borderRadius: '12px',
                border: 'none',
                background: loading 
                  ? 'rgba(148, 163, 184, 0.3)' 
                  : 'linear-gradient(135deg, #F5D26C 0%, #F59E0B 100%)',
                color: loading ? '#94a3b8' : '#0c0f14',
                fontSize: '1rem',
                fontWeight: '600',
                cursor: loading ? 'not-allowed' : 'pointer',
                transition: 'all 0.3s ease',
                boxShadow: loading 
                  ? 'none' 
                  : '0 10px 25px rgba(245, 210, 108, 0.3)',
                transform: loading ? 'none' : 'translateY(0)'
              }}
            >
              {loading ? 'Entrando...' : 'Entrar'}
            </button>

            <div style={{ textAlign: 'center' }}>
              <p style={{
                color: '#94a3b8',
                fontSize: '0.9rem',
                marginTop: '1rem'
              }}>
                Acesso apenas para clientes. 
                <br />
                <a 
                  href="/landing" 
                  style={{
                    color: '#F5D26C',
                    textDecoration: 'underline',
                    fontWeight: '500'
                  }}
                >
                  Compre seu plano aqui
                </a>
              </p>
            </div>
          </form>

      </div>
    </div>
  );
}
