'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Users, Plus, Edit2, Trash2, Search, X, ArrowLeft } from 'lucide-react'
import AdminGuard from '../../components/AdminGuard'

interface User {
  id: string
  email: string
  name?: string
  role: 'admin' | 'user'
  created_at: string
  updated_at: string
}

export default function AdminPage() {
  const router = useRouter()
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [selectedUser, setSelectedUser] = useState<User | null>(null)
  const [formData, setFormData] = useState({
    email: '',
    name: '',
    password: '',
    role: 'user' as 'admin' | 'user'
  })

  useEffect(() => {
    loadUsers()
  }, [])

  const loadUsers = async () => {
    try {
      setLoading(true)
      const token = localStorage.getItem('authToken')
      const response = await fetch('/api/users', {
              headers: {
                'Authorization': `Bearer ${token}`
              }
      })
      
      if (response.ok) {
        const data = await response.json()
        setUsers(data)
      }
    } catch (error) {
      console.error('Erro ao carregar usuários:', error)
      alert('Erro ao carregar usuários')
    } finally {
      setLoading(false)
    }
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!formData.email || !formData.password) {
      alert('Email e senha são obrigatórios')
      return
    }

    try {
      const token = localStorage.getItem('authToken')
      const response = await fetch('/api/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(formData)
      })

      if (response.ok) {
        alert('Usuário criado com sucesso!')
        setShowCreateModal(false)
        setFormData({ email: '', name: '', password: '', role: 'user' })
        loadUsers()
      } else {
        const data = await response.json()
        alert(data.error || 'Erro ao criar usuário')
      }
    } catch (error) {
      console.error('Erro ao criar usuário:', error)
      alert('Erro ao criar usuário')
    }
  }

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!selectedUser) return

    try {
      const token = localStorage.getItem('authToken')
      const response = await fetch(`/api/users/${selectedUser.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(formData)
      })

      if (response.ok) {
        alert('Usuário atualizado com sucesso!')
        setShowEditModal(false)
        setSelectedUser(null)
        setFormData({ email: '', name: '', password: '', role: 'user' })
        loadUsers()
      } else {
        const data = await response.json()
        alert(data.error || 'Erro ao atualizar usuário')
      }
    } catch (error) {
      console.error('Erro ao atualizar usuário:', error)
      alert('Erro ao atualizar usuário')
    }
  }

  const handleDelete = async () => {
    if (!selectedUser) return

    try {
      const token = localStorage.getItem('authToken')
      const response = await fetch(`/api/users/${selectedUser.id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      if (response.ok) {
        alert('Usuário deletado com sucesso!')
        setShowDeleteModal(false)
        setSelectedUser(null)
        loadUsers()
      } else {
        const data = await response.json()
        alert(data.error || 'Erro ao deletar usuário')
      }
    } catch (error) {
      console.error('Erro ao deletar usuário:', error)
      alert('Erro ao deletar usuário')
    }
  }

  const openEditModal = (user: User) => {
    setSelectedUser(user)
    setFormData({
      email: user.email,
      name: user.name || '',
      password: '',
      role: user.role || 'user'
    })
    setShowEditModal(true)
  }

  const openDeleteModal = (user: User) => {
    setSelectedUser(user)
    setShowDeleteModal(true)
  }

  const filteredUsers = users.filter(user =>
    user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.name?.toLowerCase().includes(searchTerm.toLowerCase())
  )

  return (
    <AdminGuard>
      <div style={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #0c0f14 0%, #1a1f2e 100%)',
        padding: '2rem'
      }}>
        {/* Header */}
        <div style={{
          maxWidth: '1400px',
          margin: '0 auto',
          marginBottom: '2rem'
        }}>
          <button
            onClick={() => router.push('/dashboard-user')}
            style={{
              background: 'transparent',
              color: '#F5D26C',
              border: '1px solid rgba(245, 210, 108, 0.3)',
              padding: '0.6rem 1rem',
              borderRadius: '0.5rem',
              fontSize: '0.9rem',
              fontWeight: '600',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.5rem',
              transition: 'all 0.2s',
              marginBottom: '1rem',
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.background = 'rgba(245, 210, 108, 0.1)'
              e.currentTarget.style.borderColor = 'rgba(245, 210, 108, 0.5)'
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.background = 'transparent'
              e.currentTarget.style.borderColor = 'rgba(245, 210, 108, 0.3)'
            }}
          >
            <ArrowLeft size={18} />
            Voltar ao Dashboard
          </button>

          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '1.5rem'
          }}>
            <div>
              <h1 style={{
                fontSize: '2rem',
                fontWeight: '700',
                color: '#E8EDF2',
                marginBottom: '0.5rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem'
              }}>
                <Users style={{ color: '#F5D26C' }} />
                Painel de Administração
              </h1>
              <p style={{ color: '#94a3b8' }}>
                Gerencie usuários e permissões do sistema
              </p>
            </div>
            
              <button
              onClick={() => {
                setFormData({ email: '', name: '', password: '', role: 'user' })
                setShowCreateModal(true)
              }}
                style={{
                background: '#F5D26C',
                color: '#0c0f14',
                border: 'none',
                  padding: '0.75rem 1.5rem',
                borderRadius: '0.5rem',
                fontSize: '1rem',
                  fontWeight: '600',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                transition: 'all 0.2s'
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.background = '#e6c25c'
                e.currentTarget.style.transform = 'translateY(-2px)'
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.background = '#F5D26C'
                e.currentTarget.style.transform = 'translateY(0)'
              }}
            >
              <Plus size={20} />
              Novo Usuário
              </button>
            </div>

          {/* Search Bar */}
        <div style={{
            position: 'relative',
            maxWidth: '400px'
          }}>
            <Search 
              size={20} 
              style={{
                position: 'absolute',
                left: '1rem',
                top: '50%',
                transform: 'translateY(-50%)',
                color: '#94a3b8'
              }}
            />
            <input
              type="text"
              placeholder="Buscar usuário..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{
                width: '100%',
                padding: '0.75rem 1rem 0.75rem 3rem',
              background: '#141823',
              border: '1px solid rgba(245, 210, 108, 0.2)',
                borderRadius: '0.5rem',
                color: '#E8EDF2',
                fontSize: '1rem'
              }}
            />
                </div>
        </div>

        {/* Users Table */}
        <div style={{
          maxWidth: '1400px',
          margin: '0 auto',
            background: '#141823',
            border: '1px solid rgba(245, 210, 108, 0.2)',
          borderRadius: '0.75rem',
          overflow: 'hidden',
            boxShadow: '0 6px 24px rgba(0, 0, 0, 0.35)'
          }}>
          {loading ? (
            <div style={{
              padding: '3rem',
              textAlign: 'center',
              color: '#94a3b8'
            }}>
              Carregando...
            </div>
          ) : filteredUsers.length === 0 ? (
                    <div style={{
              padding: '3rem',
              textAlign: 'center',
              color: '#94a3b8'
            }}>
              Nenhum usuário encontrado
                    </div>
          ) : (
            <table style={{
              width: '100%',
              borderCollapse: 'collapse'
            }}>
              <thead>
                <tr style={{
                    background: 'rgba(245, 210, 108, 0.1)',
                  borderBottom: '1px solid rgba(245, 210, 108, 0.2)'
                }}>
                  <th style={{
                    padding: '1rem',
                    textAlign: 'left',
                    color: '#F5D26C',
                    fontWeight: '600',
                    fontSize: '0.875rem',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em'
                  }}>Email</th>
                  <th style={{
                    padding: '1rem',
                    textAlign: 'left',
                    color: '#F5D26C',
                    fontWeight: '600',
                    fontSize: '0.875rem',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em'
                  }}>Nome</th>
                  <th style={{
                    padding: '1rem',
                    textAlign: 'left',
                    color: '#F5D26C',
                    fontWeight: '600',
                    fontSize: '0.875rem',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em'
                  }}>Tipo</th>
                  <th style={{
                    padding: '1rem',
                    textAlign: 'left',
                    color: '#F5D26C',
                    fontWeight: '600',
                    fontSize: '0.875rem',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em'
                  }}>Criado em</th>
                  <th style={{
                    padding: '1rem',
                    textAlign: 'right',
                    color: '#F5D26C',
                    fontWeight: '600',
                    fontSize: '0.875rem',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em'
                  }}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map((user, index) => (
                  <tr
                    key={user.id}
                    style={{
                      borderBottom: index < filteredUsers.length - 1 ? '1px solid rgba(245, 210, 108, 0.1)' : 'none',
                      transition: 'background 0.2s'
                    }}
                    onMouseOver={(e) => {
                      e.currentTarget.style.background = 'rgba(245, 210, 108, 0.05)'
                    }}
                    onMouseOut={(e) => {
                      e.currentTarget.style.background = 'transparent'
                    }}
                  >
                    <td style={{
                      padding: '1rem',
                      color: '#E8EDF2',
                      fontSize: '0.9375rem'
                    }}>{user.email}</td>
                    <td style={{
                      padding: '1rem',
                      color: '#94a3b8',
                      fontSize: '0.9375rem'
                    }}>{user.name || '-'}</td>
                    <td style={{
                      padding: '1rem',
                      fontSize: '0.9375rem'
                    }}>
                      <span style={{
                        background: user.role === 'admin' ? 'rgba(245, 210, 108, 0.1)' : 'rgba(148, 163, 184, 0.1)',
                        color: user.role === 'admin' ? '#F5D26C' : '#94a3b8',
                        padding: '0.25rem 0.75rem',
                        borderRadius: '9999px',
                        fontSize: '0.75rem',
                        fontWeight: '600',
                        border: user.role === 'admin' ? '1px solid rgba(245, 210, 108, 0.3)' : '1px solid rgba(148, 163, 184, 0.2)',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.25rem'
                      }}>
                        {user.role === 'admin' ? '👑 Admin' : '👤 User'}
                      </span>
                    </td>
                    <td style={{
                      padding: '1rem',
                      color: '#94a3b8',
                      fontSize: '0.9375rem'
                    }}>{new Date(user.created_at).toLocaleDateString('pt-BR')}</td>
                    <td style={{
                      padding: '1rem',
                      textAlign: 'right'
                    }}>
                      <div style={{
                        display: 'flex',
                        gap: '0.5rem',
                        justifyContent: 'flex-end'
                      }}>
                        <button
                          onClick={() => openEditModal(user)}
                          style={{
                            background: 'rgba(59, 130, 246, 0.1)',
                            color: '#3b82f6',
                            border: '1px solid rgba(59, 130, 246, 0.3)',
                            padding: '0.5rem',
                            borderRadius: '0.375rem',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            transition: 'all 0.2s'
                          }}
                          onMouseOver={(e) => {
                            e.currentTarget.style.background = 'rgba(59, 130, 246, 0.2)'
                          }}
                          onMouseOut={(e) => {
                            e.currentTarget.style.background = 'rgba(59, 130, 246, 0.1)'
                          }}
                        >
                          <Edit2 size={16} />
                        </button>
                        <button
                          onClick={() => openDeleteModal(user)}
                          style={{
                            background: 'rgba(239, 68, 68, 0.1)',
                            color: '#ef4444',
                            border: '1px solid rgba(239, 68, 68, 0.3)',
                            padding: '0.5rem',
                            borderRadius: '0.375rem',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            transition: 'all 0.2s'
                          }}
                          onMouseOver={(e) => {
                            e.currentTarget.style.background = 'rgba(239, 68, 68, 0.2)'
                          }}
                          onMouseOut={(e) => {
                            e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)'
                          }}
                        >
                          <Trash2 size={16} />
                        </button>
                  </div>
                    </td>
                  </tr>
              ))}
              </tbody>
            </table>
          )}
          </div>

        {/* Stats */}
          <div style={{
          maxWidth: '1400px',
          margin: '2rem auto 0',
          padding: '1rem',
            background: '#141823',
            border: '1px solid rgba(245, 210, 108, 0.2)',
          borderRadius: '0.5rem',
          textAlign: 'center',
          color: '#94a3b8'
        }}>
          <strong style={{ color: '#F5D26C' }}>{filteredUsers.length}</strong> usuário(s) encontrado(s)
          {searchTerm && ` de ${users.length} total`}
        </div>

        {/* Create Modal */}
        {showCreateModal && (
            <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.7)',
              display: 'flex',
              alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '1rem'
          }}>
            <div style={{
              background: '#141823',
              border: '1px solid rgba(245, 210, 108, 0.3)',
              borderRadius: '0.75rem',
              padding: '2rem',
              maxWidth: '500px',
              width: '100%',
              boxShadow: '0 20px 60px rgba(0, 0, 0, 0.5)'
            }}>
                    <div style={{
                      display: 'flex',
                justifyContent: 'space-between',
                      alignItems: 'center',
              marginBottom: '1.5rem'
            }}>
              <h2 style={{
                  fontSize: '1.5rem',
                  fontWeight: '700',
                color: '#E8EDF2'
                }}>Criar Novo Usuário</h2>
                <button
                  onClick={() => setShowCreateModal(false)}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: '#94a3b8',
                    cursor: 'pointer',
                    padding: '0.5rem'
                  }}
                >
                  <X size={24} />
                </button>
            </div>

              <form onSubmit={handleCreate}>
                <div style={{ marginBottom: '1rem' }}>
                  <label style={{
                    display: 'block',
                    color: '#E8EDF2',
                    marginBottom: '0.5rem',
                    fontSize: '0.875rem',
                    fontWeight: '500'
                  }}>Email *</label>
                  <input
                    type="email"
                    required
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    style={{
                      width: '100%',
                  padding: '0.75rem',
                      background: '#0c0f14',
                      border: '1px solid rgba(245, 210, 108, 0.2)',
                      borderRadius: '0.5rem',
                      color: '#E8EDF2',
                      fontSize: '1rem'
                    }}
                  />
                </div>

                <div style={{ marginBottom: '1rem' }}>
                  <label style={{
                    display: 'block',
                    color: '#E8EDF2',
                    marginBottom: '0.5rem',
                      fontSize: '0.875rem',
                    fontWeight: '500'
                  }}>Nome</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      background: '#0c0f14',
                      border: '1px solid rgba(245, 210, 108, 0.2)',
                      borderRadius: '0.5rem',
                      color: '#E8EDF2',
                      fontSize: '1rem'
                    }}
                  />
                    </div>

                <div style={{ marginBottom: '1rem' }}>
                  <label style={{
                    display: 'block',
                        color: '#E8EDF2',
                    marginBottom: '0.5rem',
                    fontSize: '0.875rem',
                    fontWeight: '500'
                  }}>Tipo de Usuário *</label>
                  <select
                    value={formData.role}
                    onChange={(e) => setFormData({ ...formData, role: e.target.value as 'admin' | 'user' })}
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      background: '#0c0f14',
                      border: '1px solid rgba(245, 210, 108, 0.2)',
                      borderRadius: '0.5rem',
                      color: '#E8EDF2',
                      fontSize: '1rem',
                      cursor: 'pointer'
                    }}
                  >
                    <option value="user">👤 Usuário Comum</option>
                    <option value="admin">👑 Administrador</option>
                  </select>
                    </div>

                <div style={{ marginBottom: '1.5rem' }}>
                  <label style={{
                    display: 'block',
                    color: '#E8EDF2',
                    marginBottom: '0.5rem',
                    fontSize: '0.875rem',
                    fontWeight: '500'
                  }}>Senha *</label>
                  <input
                    type="password"
                    required
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      background: '#0c0f14',
                      border: '1px solid rgba(245, 210, 108, 0.2)',
                      borderRadius: '0.5rem',
                      color: '#E8EDF2',
                      fontSize: '1rem'
                    }}
                  />
                  </div>

                  <div style={{
                  display: 'flex',
                  gap: '1rem',
                  justifyContent: 'flex-end'
                }}>
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(false)}
                    style={{
                      padding: '0.75rem 1.5rem',
                      background: 'transparent',
                      border: '1px solid rgba(245, 210, 108, 0.3)',
                      borderRadius: '0.5rem',
                      color: '#E8EDF2',
                      fontSize: '1rem',
                      fontWeight: '600',
                      cursor: 'pointer'
                    }}
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    style={{
                      padding: '0.75rem 1.5rem',
                      background: '#F5D26C',
                      border: 'none',
                      borderRadius: '0.5rem',
                      color: '#0c0f14',
                      fontSize: '1rem',
                      fontWeight: '600',
                      cursor: 'pointer'
                    }}
                  >
                    Criar
                  </button>
                  </div>
              </form>
                </div>
            </div>
        )}

        {/* Edit Modal */}
        {showEditModal && selectedUser && (
          <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '1rem'
          }}>
          <div style={{
            background: '#141823',
              border: '1px solid rgba(245, 210, 108, 0.3)',
              borderRadius: '0.75rem',
              padding: '2rem',
              maxWidth: '500px',
              width: '100%',
              boxShadow: '0 20px 60px rgba(0, 0, 0, 0.5)'
          }}>
            <div style={{
              display: 'flex',
                justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '1.5rem'
            }}>
              <h2 style={{
                  fontSize: '1.5rem',
                  fontWeight: '700',
                color: '#E8EDF2'
                }}>Editar Usuário</h2>
                <button
                  onClick={() => {
                    setShowEditModal(false)
                    setSelectedUser(null)
                  }}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: '#94a3b8',
                    cursor: 'pointer',
                    padding: '0.5rem'
                  }}
                >
                  <X size={24} />
                </button>
            </div>

              <form onSubmit={handleUpdate}>
                <div style={{ marginBottom: '1rem' }}>
                  <label style={{
                    display: 'block',
                    color: '#E8EDF2',
                    marginBottom: '0.5rem',
                    fontSize: '0.875rem',
                    fontWeight: '500'
                  }}>Email</label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      background: '#0c0f14',
                      border: '1px solid rgba(245, 210, 108, 0.2)',
                      borderRadius: '0.5rem',
                      color: '#E8EDF2',
                      fontSize: '1rem'
                    }}
                  />
                </div>

                <div style={{ marginBottom: '1rem' }}>
                  <label style={{
                    display: 'block',
                    color: '#E8EDF2',
                    marginBottom: '0.5rem',
                    fontSize: '0.875rem',
                    fontWeight: '500'
                  }}>Nome</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      background: '#0c0f14',
                      border: '1px solid rgba(245, 210, 108, 0.2)',
                      borderRadius: '0.5rem',
                      color: '#E8EDF2',
                      fontSize: '1rem'
                    }}
                  />
                </div>

                <div style={{ marginBottom: '1rem' }}>
                  <label style={{
                    display: 'block',
                    color: '#E8EDF2',
                    marginBottom: '0.5rem',
                    fontSize: '0.875rem',
                    fontWeight: '500'
                  }}>Tipo de Usuário *</label>
                  <select
                    value={formData.role}
                    onChange={(e) => setFormData({ ...formData, role: e.target.value as 'admin' | 'user' })}
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      background: '#0c0f14',
                      border: '1px solid rgba(245, 210, 108, 0.2)',
                      borderRadius: '0.5rem',
                      color: '#E8EDF2',
                      fontSize: '1rem',
                      cursor: 'pointer'
                    }}
                  >
                    <option value="user">👤 Usuário Comum</option>
                    <option value="admin">👑 Administrador</option>
                  </select>
                </div>

                <div style={{ marginBottom: '1.5rem' }}>
                  <label style={{
                    display: 'block',
                    color: '#E8EDF2',
                    marginBottom: '0.5rem',
                    fontSize: '0.875rem',
                    fontWeight: '500'
                  }}>Nova Senha (deixe em branco para não alterar)</label>
                  <input
                    type="password"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      background: '#0c0f14',
                      border: '1px solid rgba(245, 210, 108, 0.2)',
                      borderRadius: '0.5rem',
                      color: '#E8EDF2',
                      fontSize: '1rem'
                    }}
                  />
                </div>

            <div style={{
              display: 'flex',
                  gap: '1rem',
                  justifyContent: 'flex-end'
                }}>
                  <button
                    type="button"
                    onClick={() => {
                      setShowEditModal(false)
                      setSelectedUser(null)
                    }}
                    style={{
                      padding: '0.75rem 1.5rem',
                      background: 'transparent',
                      border: '1px solid rgba(245, 210, 108, 0.3)',
                      borderRadius: '0.5rem',
                      color: '#E8EDF2',
                      fontSize: '1rem',
                fontWeight: '600',
                      cursor: 'pointer'
                    }}
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    style={{
                      padding: '0.75rem 1.5rem',
                      background: '#3b82f6',
                      border: 'none',
                      borderRadius: '0.5rem',
                      color: '#fff',
                      fontSize: '1rem',
                      fontWeight: '600',
                      cursor: 'pointer'
                    }}
                  >
                    Salvar
                  </button>
            </div>
              </form>
            </div>
          </div>
        )}

        {/* Delete Modal */}
        {showDeleteModal && selectedUser && (
                    <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.7)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
            zIndex: 1000,
            padding: '1rem'
          }}>
            <div style={{
              background: '#141823',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              borderRadius: '0.75rem',
              padding: '2rem',
              maxWidth: '400px',
              width: '100%',
              boxShadow: '0 20px 60px rgba(0, 0, 0, 0.5)'
            }}>
              <h2 style={{
                fontSize: '1.5rem',
                fontWeight: '700',
                color: '#E8EDF2',
                marginBottom: '1rem'
              }}>Confirmar Exclusão</h2>

                        <p style={{
                          color: '#94a3b8',
                marginBottom: '1.5rem',
                lineHeight: '1.6'
              }}>
                Tem certeza que deseja deletar o usuário <strong style={{ color: '#E8EDF2' }}>{selectedUser.email}</strong>?
                <br /><br />
                Esta ação irá deletar também todas as bibliotecas e pastas do usuário e não pode ser desfeita.
              </p>

        <div style={{
          display: 'flex',
          gap: '1rem',
                justifyContent: 'flex-end'
        }}>
          <button
                  onClick={() => {
                    setShowDeleteModal(false)
                    setSelectedUser(null)
                  }}
            style={{
                    padding: '0.75rem 1.5rem',
                    background: 'transparent',
                    border: '1px solid rgba(245, 210, 108, 0.3)',
                    borderRadius: '0.5rem',
                    color: '#E8EDF2',
              fontSize: '1rem',
              fontWeight: '600',
                    cursor: 'pointer'
                  }}
                >
                  Cancelar
          </button>
          <button
                  onClick={handleDelete}
            style={{
                    padding: '0.75rem 1.5rem',
                    background: '#ef4444',
                    border: 'none',
                    borderRadius: '0.5rem',
                    color: '#fff',
              fontSize: '1rem',
              fontWeight: '600',
                    cursor: 'pointer'
                  }}
                >
                  Deletar
          </button>
        </div>
      </div>
          </div>
        )}
      </div>
    </AdminGuard>
  )
}
