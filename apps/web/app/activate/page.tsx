'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle, Lock, Mail } from 'lucide-react';

export default function ActivateAccountPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [token, setToken] = useState('');

  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const tokenParam = searchParams.get('token');
    const emailParam = searchParams.get('email');
    const successParam = searchParams.get('success');
    
    if (successParam === 'true') {
      setSuccess(true);
      return;
    }
    
    if (tokenParam) {
      setToken(tokenParam);
    }
    if (emailParam) {
      setEmail(emailParam);
    }
  }, []);

  const handleActivate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    if (password !== confirmPassword) {
      setError('As senhas não coincidem');
      setLoading(false);
      return;
    }

    if (password.length < 6) {
      setError('A senha deve ter pelo menos 6 caracteres');
      setLoading(false);
      return;
    }

    try {
      const response = await fetch('http://localhost:4000/api/auth/activate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          email, 
          password, 
          token 
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setSuccess(true);
        setTimeout(() => {
          router.push('/dashboard-user');
        }, 2000);
      } else {
        setError(data.error || 'Erro ao ativar conta');
      }
    } catch (err) {
      setError('Erro de conexão');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div style={{
        background: 'linear-gradient(135deg, #0c0f14 0%, #1a1d29 50%, #0c0f14 100%)',
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '2rem'
      }}>
        <div style={{
          background: 'rgba(12, 15, 20, 0.95)',
          backdropFilter: 'blur(20px)',
          border: '1px solid rgba(16, 185, 129, 0.3)',
          borderRadius: '24px',
          padding: '3rem',
          width: '100%',
          maxWidth: '450px',
          textAlign: 'center',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)'
        }}>
          <div style={{
            width: '80px',
            height: '80px',
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #10B981, #059669)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 2rem'
          }}>
            <CheckCircle style={{ width: '40px', height: '40px', color: '#E8EDF2' }} />
          </div>
          
          <h1 style={{
            fontSize: '1.5rem',
            fontWeight: 'bold',
            color: '#10B981',
            marginBottom: '1rem'
          }}>
            Pagamento Confirmado!
          </h1>
          
          <p style={{
            color: '#94a3b8',
            fontSize: '1rem',
            marginBottom: '2rem'
          }}>
            Seu pagamento foi processado com sucesso. Você receberá um email com instruções para ativar sua conta.
          </p>
          
          <div style={{
            background: 'rgba(16, 185, 129, 0.1)',
            border: '1px solid rgba(16, 185, 129, 0.3)',
            borderRadius: '12px',
            padding: '1rem',
            color: '#10B981',
            fontSize: '0.9rem'
          }}>
            Aguarde o email de ativação...
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      background: 'linear-gradient(135deg, #0c0f14 0%, #1a1d29 50%, #0c0f14 100%)',
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '2rem'
    }}>
      <div style={{
        background: 'rgba(12, 15, 20, 0.95)',
        backdropFilter: 'blur(20px)',
        border: '1px solid rgba(245, 210, 108, 0.2)',
        borderRadius: '24px',
        padding: '3rem',
        width: '100%',
        maxWidth: '450px',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)'
      }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
          <div style={{
            width: '80px',
            height: '80px',
            borderRadius: '20px',
            background: 'linear-gradient(135deg, #F5D26C, #F59E0B)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 1.5rem'
          }}>
            <Lock style={{ width: '40px', height: '40px', color: '#0c0f14' }} />
          </div>
          
          <h1 style={{
            fontSize: '1.5rem',
            fontWeight: 'bold',
            color: '#F5D26C',
            marginBottom: '0.5rem'
          }}>
            Ativar Sua Conta
          </h1>
          
          <p style={{
            color: '#94a3b8',
            fontSize: '1rem'
          }}>
            Crie sua senha para acessar o sistema
          </p>
        </div>

        {/* Error Message */}
        {error && (
          <div style={{
            padding: '1rem',
            borderRadius: '12px',
            marginBottom: '1.5rem',
            fontSize: '0.9rem',
            fontWeight: '500',
            backgroundColor: 'rgba(239, 68, 68, 0.1)',
            color: '#ef4444',
            border: '1px solid rgba(239, 68, 68, 0.2)',
            textAlign: 'center'
          }}>
            {error}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleActivate} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
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
            <div style={{ position: 'relative' }}>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                style={{
                  width: '100%',
                  padding: '1rem 1rem 1rem 3rem',
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
                disabled={!!searchParams.get('email')}
              />
              <Mail style={{
                position: 'absolute',
                left: '1rem',
                top: '50%',
                transform: 'translateY(-50%)',
                width: '20px',
                height: '20px',
                color: '#94a3b8'
              }} />
            </div>
          </div>

          <div>
            <label style={{
              display: 'block',
              fontSize: '0.9rem',
              fontWeight: '600',
              color: '#E8EDF2',
              marginBottom: '0.5rem'
            }}>
              Nova Senha
            </label>
            <input
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
              placeholder="Mínimo 6 caracteres"
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
              Confirmar Senha
            </label>
            <input
              type="password"
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
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
              placeholder="Digite a senha novamente"
            />
          </div>

          <button
            type="submit"
            disabled={loading || !token}
            style={{
              width: '100%',
              padding: '1rem',
              borderRadius: '12px',
              border: 'none',
              background: loading || !token
                ? 'rgba(148, 163, 184, 0.3)' 
                : 'linear-gradient(135deg, #F5D26C 0%, #F59E0B 100%)',
              color: loading || !token ? '#94a3b8' : '#0c0f14',
              fontSize: '1rem',
              fontWeight: '600',
              cursor: loading || !token ? 'not-allowed' : 'pointer',
              transition: 'all 0.3s ease',
              boxShadow: loading || !token
                ? 'none' 
                : '0 10px 25px rgba(245, 210, 108, 0.3)',
              transform: loading || !token ? 'none' : 'translateY(0)'
            }}
          >
            {loading ? 'Ativando...' : 'Ativar Conta'}
          </button>

          {!token && (
            <div style={{
              background: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid rgba(239, 68, 68, 0.2)',
              borderRadius: '12px',
              padding: '1rem',
              textAlign: 'center',
              color: '#ef4444',
              fontSize: '0.9rem'
            }}>
              Link de ativação inválido ou expirado
            </div>
          )}
        </form>
      </div>
    </div>
  );
}
