# 📍 ONDE EXECUTAR O SQL NO SUPABASE

## 🎯 Guia Visual Passo a Passo

### PASSO 1: Abrir Supabase Dashboard
```
1. Abra seu navegador (Chrome, Firefox, etc.)
2. Digite: https://supabase.com/dashboard
3. Faça login com sua conta Supabase
```

---

### PASSO 2: Selecionar o Projeto
```
Você verá uma lista de projetos.
Clique no projeto: "ECOM TaskForce" (ou nome do seu projeto)
```

---

### PASSO 3: Encontrar o SQL Editor

**No menu lateral ESQUERDO**, procure por:

```
┌─────────────────────────┐
│ 🏠 Home                 │
│ 📊 Table Editor         │
│ 🔍 Database             │
│ ⚡ SQL Editor   ← AQUI! │  👈👈👈 CLIQUE AQUI!
│ 📝 API Docs             │
│ ⚙️  Settings            │
└─────────────────────────┘
```

**Clique em**: **"SQL Editor"** ou **"⚡ SQL Editor"**

---

### PASSO 4: Criar Nova Query

Após abrir o SQL Editor, você verá:

```
┌──────────────────────────────────────────┐
│  SQL Editor                              │
├──────────────────────────────────────────┤
│  [+ New query]  ← CLIQUE AQUI PRIMEIRO! │
│                                          │
│  Recent queries:                         │
│  - query 1                               │
│  - query 2                               │
└──────────────────────────────────────────┘
```

**Clique em**: **"+ New query"**

---

### PASSO 5: Colar o SQL

Vai abrir um editor de texto. **COLE ESTE SQL**:

```sql
ALTER TABLE users ADD COLUMN role VARCHAR(20) DEFAULT 'user';
```

O editor ficará assim:

```
┌──────────────────────────────────────────┐
│  Untitled query                          │
├──────────────────────────────────────────┤
│  ALTER TABLE users ADD COLUMN role ...   │
│                                          │
│                                          │
├──────────────────────────────────────────┤
│  [▶ RUN]  [Cancel]     ← CLIQUE EM RUN! │
└──────────────────────────────────────────┘
```

---

### PASSO 6: Executar

**Clique no botão verde**: **"▶ RUN"** (ou **"EXECUTAR"**)

**Aguarde aparecer**:
```
✅ Success. No rows returned
```

Ou:
```
✅ Query executed successfully
```

---

### PASSO 7: Configurar Admins

Agora execute **OUTRO SQL** (no mesmo editor ou nova query):

```sql
UPDATE users SET role = 'admin' 
WHERE email IN ('directbpsquad@gmail.com', 'geral.joaoecoom@gmail.com');
```

**Clique**: **"▶ RUN"** novamente

**Resultado esperado**:
```
✅ Success. 2 rows affected
```

---

### PASSO 8: Verificar

Execute este último SQL para confirmar:

```sql
SELECT email, role FROM users ORDER BY role DESC;
```

**Você deve ver**:
```
email                          | role
-------------------------------|-------
directbpsquad@gmail.com        | admin
geral.joaoecoom@gmail.com      | admin
ecoomtaskforcetrial@gmail.com  | user
...outros emails...            | user
```

---

## ✅ FINALIZAR

Volte ao terminal e execute:

```bash
node execute-setup-admin.js
```

Agora deve funcionar! 🎉

---

## 🆘 Não encontrou o SQL Editor?

### Alternativa 1: Database → Query
1. Clique em **"Database"** no menu lateral
2. Embaixo, clique em **"Query"** ou **"SQL"**

### Alternativa 2: Procure por "SQL"
1. Use a busca (Ctrl+K ou Cmd+K)
2. Digite: "SQL"
3. Selecione: "SQL Editor"

---

## 📞 Ainda com dúvida?

Me diga em que tela você está que eu te ajudo a encontrar!

Opções comuns:
- "Estou na tela inicial do Supabase"
- "Estou dentro do projeto mas não acho SQL Editor"
- "Cliquei em SQL Editor mas não sei onde colar"
- "O SQL deu erro: [mensagem do erro]"

---

**Tempo total**: 3-5 minutos ⏱️
**Dificuldade**: Muito fácil ⭐

