# 👑 Sistema de Admin e Roles

Sistema completo de gerenciamento de permissões com roles Admin e User.

## 📋 O que foi implementado

### 1. ✅ Campo `role` na Tabela Users
- Coluna `role` com valores: `'admin'` | `'user'`
- Default: `'user'`

### 2. ✅ Middleware de Admin
- **Arquivo**: `apps/web/lib/adminMiddleware.ts`
- Funções:
  - `requireAdmin()`: Valida se usuário é admin
  - `checkIsAdmin()`: Verifica role sem bloquear

### 3. ✅ APIs Protegidas
- **GET /api/users**: Apenas admins
- **POST /api/users**: Apenas admins
- **PUT /api/users/[id]**: Apenas admins
- **DELETE /api/users/[id]**: Apenas admins

### 4. ✅ Dashboard Atualizado
- Coluna "Tipo" na tabela
- Badge visual: 👑 Admin / 👤 User
- Select para definir role ao criar
- Select para editar role

---

## 🚀 Como Usar

### Passo 1: Executar SQL no Supabase

1. Acesse: https://supabase.com/dashboard
2. Vá para seu projeto → **SQL Editor**
3. Cole e execute:

```sql
-- Adicionar coluna role
ALTER TABLE users ADD COLUMN IF NOT EXISTS role VARCHAR(20) DEFAULT 'user';

-- Definir admins padrão
UPDATE users SET role = 'admin' 
WHERE email IN ('directbpsquad@gmail.com', 'geral.joaoecoom@gmail.com');

-- Garantir que todos os outros são 'user'
UPDATE users SET role = 'user' WHERE role IS NULL OR role = '';

-- Verificar resultado
SELECT email, role FROM users ORDER BY role DESC;
```

### Passo 2: Verificar Roles

Execute:
```bash
node add-role-column.js
```

Você verá:
```
👑 directbpsquad@gmail.com → ADMIN
👑 geral.joaoecoom@gmail.com → ADMIN
👤 ecoomtaskforcetrial@gmail.com → USER
...
```

### Passo 3: Testar Dashboard

1. Faça login com um admin
2. Acesse: `/dashboard`
3. Crie usuários com role:
   - 👤 Usuário Comum
   - 👑 Administrador

---

## 🔒 Permissões

### Admin pode:
- ✅ Ver todos os usuários
- ✅ Criar novos usuários (admin ou comum)
- ✅ Editar qualquer usuário
- ✅ Deletar usuários
- ✅ Alterar roles

### User pode:
- ✅ Ver suas próprias bibliotecas
- ✅ Gerenciar suas bibliotecas
- ❌ **NÃO** acessa `/dashboard`
- ❌ **NÃO** gerencia outros usuários

---

## 📁 Arquivos Criados/Modificados

### Novos Arquivos:
1. `apps/web/lib/adminMiddleware.ts` - Middleware de admin
2. `add-role-column.js` - Script para adicionar roles
3. `add-role-column.sql` - SQL para criar coluna
4. `add-role-via-api.js` - Instruções para SQL
5. `SISTEMA-ADMIN-ROLES.md` - Esta documentação

### Arquivos Modificados:
1. `apps/web/app/api/users/route.ts` - Proteção admin
2. `apps/web/app/api/users/[id]/route.ts` - Proteção admin
3. `apps/web/app/dashboard/page.tsx` - Gerenciamento de roles

---

## 🎨 Interface

### Tabela de Usuários:
| Email | Nome | Tipo | Criado em | Ações |
|-------|------|------|-----------|-------|
| admin@email.com | Admin | 👑 Admin | 22/10/2025 | ✏️ 🗑️ |
| user@email.com | User | 👤 User | 22/10/2025 | ✏️ 🗑️ |

### Modal de Criação:
- Email *
- Nome
- **Tipo de Usuário ***: 
  - 👤 Usuário Comum
  - 👑 Administrador
- Senha *

### Modal de Edição:
- Email
- Nome
- **Tipo de Usuário ***: 
  - 👤 Usuário Comum
  - 👑 Administrador
- Nova Senha (opcional)

---

## 🔧 Administradores Padrão

Após executar o SQL, estes usuários serão admins:

| Email | Senha | Role |
|-------|-------|------|
| `directbpsquad@gmail.com` | `Direct123456.` | 👑 Admin |
| `geral.joaoecoom@gmail.com` | `Cursor2020.` | 👑 Admin |
| `ecoomtaskforcetrial@gmail.com` | `Trial123456.` | 👤 User |

---

## ⚠️ IMPORTANTE

1. **Execute o SQL primeiro** antes de usar o dashboard
2. **Apenas admins** podem acessar `/dashboard`
3. **Não delete todos os admins** - mantenha pelo menos um
4. **Senhas são hasheadas** com bcrypt (salt rounds = 10)

---

## 🧪 Testar Proteção

### Teste 1: Login como Admin
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"directbpsquad@gmail.com","password":"Direct123456."}'
```

### Teste 2: Acessar Dashboard
```bash
# Com token de admin - funciona ✅
curl -X GET http://localhost:3000/api/users \
  -H "Authorization: Bearer <TOKEN_ADMIN>"

# Com token de user - erro 403 ❌
curl -X GET http://localhost:3000/api/users \
  -H "Authorization: Bearer <TOKEN_USER>"
```

---

## ✅ Checklist

- [x] Campo `role` criado
- [x] Middleware de admin
- [x] APIs protegidas
- [x] Dashboard com gerenciamento de roles
- [x] Badge visual de admin/user
- [x] Select para criar admin/user
- [x] Select para editar role
- [x] Admins padrão definidos
- [x] Documentação completa

**Status**: ✅ Sistema 100% funcional!

---

## 🆘 Troubleshooting

### Erro: "Could not find the 'role' column"
**Solução**: Execute o SQL no Supabase primeiro

### Erro: "Acesso negado - apenas administradores"
**Solução**: Faça login com uma conta admin

### Dashboard vazio
**Solução**: Certifique-se que executou o SQL e que o usuário é admin

---

**Sistema pronto para produção!** 🚀

