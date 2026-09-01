# 🚀 INSTRUÇÕES: Setup do Sistema Admin

## ⚠️ IMPORTANTE - Siga estes passos:

### 📋 Passo 1: Executar SQL no Supabase

1. **Abra o Supabase Dashboard**
   - URL: https://supabase.com/dashboard
   - Faça login na sua conta

2. **Acesse o SQL Editor**
   - No menu lateral, clique em **"SQL Editor"**
   - Clique em **"New query"**

3. **Cole o SQL**
   - Abra o arquivo: `setup-admin-system.sql`
   - **COPIE TODO O CONTEÚDO**
   - **COLE** no SQL Editor

4. **Execute**
   - Clique em **"RUN"** (ou pressione Ctrl/Cmd + Enter)
   - Aguarde a confirmação de sucesso ✅

5. **Verifique o Resultado**
   - Você deve ver uma tabela com:
     - Email
     - Nome
     - Role (admin ou user)
     - Data de criação
   - Os emails `directbpsquad@gmail.com` e `geral.joaoecoom@gmail.com` devem mostrar role = **admin**

---

### ✅ Passo 2: Verificar se Funcionou

Execute este comando no terminal:

```bash
node test-users-api.js
```

**Resultado esperado:**
```
📊 Total de usuários: X

1. 👑 directbpsquad@gmail.com
   Nome: Direct BP Squad
   Role: admin

2. 👑 geral.joaoecoom@gmail.com  
   Nome: João ECOOM
   Role: admin

3. 👤 ecoomtaskforcetrial@gmail.com
   Nome: ECOOM TaskForce Trial
   Role: user

...

📊 ESTATÍSTICAS
👑 Administradores: 2
👤 Usuários comuns: X
```

---

### 🎯 Passo 3: Testar o Dashboard

1. **Faça login** com um admin:
   - Email: `directbpsquad@gmail.com`
   - Senha: `Direct123456.`

2. **Acesse o Dashboard**:
   - URL: `http://localhost:3000/dashboard`

3. **Teste as funcionalidades**:
   - ✅ Ver lista de usuários
   - ✅ Criar novo usuário (admin ou user)
   - ✅ Editar usuário
   - ✅ Deletar usuário

---

## 🐛 Troubleshooting

### Erro: "column users.role does not exist"
**Causa**: SQL não foi executado no Supabase  
**Solução**: Volte ao Passo 1 e execute o SQL

### Erro: "Acesso negado - apenas administradores"
**Causa**: Usuário não tem role = 'admin'  
**Solução**: Execute novamente a parte do SQL que define admins:
```sql
UPDATE users SET role = 'admin' 
WHERE email IN ('directbpsquad@gmail.com', 'geral.joaoecoom@gmail.com');
```

### Dashboard não carrega usuários
**Causa**: Token expirado ou usuário não é admin  
**Solução**: 
1. Faça logout
2. Faça login novamente com um email admin
3. Tente acessar `/dashboard` novamente

---

## 📝 Resumo do que o SQL faz:

1. ✅ Cria coluna `role` na tabela `users`
2. ✅ Define valor padrão `'user'` para novos usuários
3. ✅ Atualiza usuários existentes sem role para `'user'`
4. ✅ Define `directbpsquad@gmail.com` e `geral.joaoecoom@gmail.com` como **admin**
5. ✅ Mostra resultado final para verificação

---

## 🎉 Após Executar com Sucesso

Você terá:
- ✅ Sistema de roles funcionando
- ✅ 2 administradores configurados
- ✅ Dashboard protegido (apenas admins)
- ✅ API protegida (apenas admins)
- ✅ Interface para gerenciar usuários

**Pronto para usar!** 🚀

