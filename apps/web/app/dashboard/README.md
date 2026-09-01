# Dashboard de Gerenciamento de Usuários

Dashboard completo para administrar usuários do sistema.

## 📁 Estrutura de Arquivos Criados

```
apps/web/
├── app/
│   ├── dashboard/
│   │   ├── page.tsx              # Página principal do dashboard
│   │   └── README.md             # Esta documentação
│   └── api/
│       └── users/
│           ├── route.ts          # GET (listar) e POST (criar)
│           └── [id]/
│               └── route.ts      # PUT (editar) e DELETE (deletar)
```

## ✨ Funcionalidades

### 🔍 Listar Usuários
- Visualiza todos os usuários cadastrados
- Tabela com email, nome e data de criação
- Busca por email ou nome
- Contador de usuários

### ➕ Criar Usuário
- Modal com formulário
- Campos: email, nome e senha
- Validação de email único
- Hash automático de senha (bcrypt)

### ✏️ Editar Usuário
- Modal pré-preenchido com dados atuais
- Editar email, nome e/ou senha
- Senha opcional (deixe em branco para não alterar)

### 🗑️ Deletar Usuário
- Modal de confirmação
- Deleta também:
  - Todas as bibliotecas do usuário
  - Todas as pastas do usuário
- Ação irreversível

## 🔐 Segurança

- **Autenticação obrigatória**: Todas as rotas requerem token JWT
- **Senhas hasheadas**: Bcrypt com salt rounds = 10
- **Validação de duplicatas**: Email único no sistema

## 🚀 Como Acessar

1. Faça login no sistema
2. Acesse: `/dashboard`
3. Use as funcionalidades de CRUD

## 📊 API Endpoints

### GET /api/users
Lista todos os usuários
- **Auth**: Requerida
- **Response**: Array de usuários

### POST /api/users
Cria novo usuário
- **Auth**: Requerida
- **Body**: `{ email, password, name? }`
- **Response**: `{ success: true, user }`

### PUT /api/users/[id]
Atualiza usuário
- **Auth**: Requerida
- **Body**: `{ email?, name?, password? }`
- **Response**: `{ success: true }`

### DELETE /api/users/[id]
Deleta usuário e seus dados
- **Auth**: Requerida
- **Response**: `{ success: true }`

## 🎨 Design

- Dark theme consistente com o resto do sistema
- Cores: 
  - Primária: `#F5D26C` (amarelo dourado)
  - Background: `#141823` / `#0c0f14`
  - Texto: `#E8EDF2`
- Responsivo e moderno
- Animações suaves
- Feedback visual claro

## 🔧 Tecnologias

- **Next.js 14** - Framework
- **TypeScript** - Type safety
- **Supabase** - Database
- **Bcrypt** - Hash de senhas
- **Lucide React** - Ícones
- **AuthGuard** - Proteção de rotas

## 📝 Notas

- Apenas usuários autenticados podem acessar
- Recomenda-se adicionar verificação de admin no futuro
- Todos os TODOs foram completados ✅

