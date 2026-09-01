# ⚡ PASSO A PASSO SIMPLES - 3 MINUTOS

## 🎯 Objetivo
Adicionar a coluna `role` na tabela `users` do Supabase para ativar o sistema de Admin.

---

## 📝 PASSO 1: Abrir Supabase (1 minuto)

1. Abra no navegador: **https://supabase.com/dashboard**
2. Faça login
3. Selecione seu projeto: **ECOM TaskForce** (ou o nome do seu projeto)

---

## 💻 PASSO 2: Executar SQL (1 minuto)

4. No menu lateral esquerdo, clique em **"SQL Editor"**
5. Clique no botão **"+ New query"** (ou **"Nova consulta"**)
6. **COPIE** e **COLE** este SQL:

```sql
ALTER TABLE users ADD COLUMN role VARCHAR(20) DEFAULT 'user';
```

7. Clique no botão **"RUN"** ▶️ (ou **"EXECUTAR"**)
8. Aguarde aparecer: **"Success. No rows returned"** ✅

---

## ✅ PASSO 3: Configurar Admins (1 minuto)

9. Volte aqui no terminal e execute:

```bash
node execute-setup-admin.js
```

10. Você verá:

```
👑 directbpsquad@gmail.com → ADMIN
👑 geral.joaoecoom@gmail.com → ADMIN
👤 outros emails → USER

✅ SISTEMA CONFIGURADO COM SUCESSO!
```

---

## 🎉 PRONTO!

Agora você pode:
- Fazer login com: `directbpsquad@gmail.com` / `Direct123456.`
- Acessar: `http://localhost:3000/dashboard`
- Gerenciar todos os usuários!

---

## 🐛 Se der erro

**Erro**: "column role already exists"
**Solução**: Perfeito! A coluna já existe. Pule para o Passo 3.

**Erro**: "permission denied"
**Solução**: Use a Service Role Key, não a anon key.

**Erro**: "syntax error"
**Solução**: Copie o SQL exatamente como está, sem modificar.

---

## ❓ Por que preciso fazer isso?

O Supabase **não permite** executar `ALTER TABLE` via API REST por segurança.
Apenas o SQL Editor (que você tem acesso como admin do projeto) pode fazer isso.

**É uma limitação de segurança do Supabase, não do nosso código.**

---

## 📸 Visual do SQL Editor

Procure por algo assim no Supabase:

```
┌─────────────────────────────────────┐
│  SQL Editor                         │
├─────────────────────────────────────┤
│  [+ New query]                      │
│                                     │
│  ┌─────────────────────────────┐   │
│  │ ALTER TABLE users ADD ...   │   │
│  │                             │   │
│  └─────────────────────────────┘   │
│                                     │
│  [▶ RUN]  [Cancel]                 │
└─────────────────────────────────────┘
```

---

**Tempo total**: ~3 minutos ⏱️
**Dificuldade**: Muito fácil ⭐

Qualquer dúvida, me avise! 🚀

