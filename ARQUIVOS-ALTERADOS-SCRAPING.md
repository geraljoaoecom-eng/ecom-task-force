# Arquivos Alterados - Scraping Automático

## 📋 Resumo das Alterações

### 1. **apps/web/app/api/libraries/route.ts**
- Scraping automático ao criar biblioteca
- Logs detalhados para debug

### 2. **apps/web/lib/supabase.ts**
- Adicionado mapeamento `createdAt` e `updatedAt`

### 3. **apps/web/components/LibraryCardNew.tsx**
- Loading visual "Carregando..." com ícone animado
- Timeout reduzido para 3 minutos
- Logs para debug

### 4. **apps/web/app/bibliotecas/page.tsx**
- Polling automático (15s) com quick check (5s)
- Logs detalhados para debug

---

## 🧪 Como Testar

### 1. **Verificar se o scraping está funcionando:**

Adicione uma biblioteca de teste e verifique o **TERMINAL DO SERVIDOR** (não o browser):

```
✅ Biblioteca criada com sucesso: { id: '...', source_value: '...' }
🕷️ Iniciando scraping automático para biblioteca: ... URL: ...
✅ Scraping automático concluído: X anúncios para biblioteca ...
```

Se NÃO aparecer `✅ Scraping automático concluído`, o problema está no backend.

### 2. **Verificar logs do browser:**

Abra F12 → Console e adicione uma biblioteca. Você deve ver:

```
🔧 Biblioteca criada com sucesso!
🔄 Biblioteca "Nome" em scraping (0.0 min, activeAds: 0)
✅ Polling ativado - bibliotecas em scraping detectadas
⚡ Quick check - atualizando após 5s
🔄 Biblioteca "Nome" em scraping (0.1 min, activeAds: [número ou 0])
```

Se `activeAds` continuar em 0 após 30 segundos, o scraping falhou.

---

## 🔍 Diagnóstico de Problemas

### Problema: activeAds continua em 0

**Possíveis causas:**

1. **URL inválida** - Use uma URL real do Facebook Ads Library
2. **Scraper não rodando** - Verifique terminal do servidor
3. **Erro no scraper** - Verifique logs: `⚠️ Scraping automático falhou`
4. **Timeout** - Scraper pode levar mais de 3 minutos

**Solução:**

No terminal do servidor, verifique se aparece:
- `✅ Scraping automático concluído: X anúncios`

Se não aparecer, o problema é no backend (scraper não está rodando).

---

## 📁 Lista de Arquivos para Deploy

```
apps/web/app/api/libraries/route.ts
apps/web/lib/supabase.ts
apps/web/components/LibraryCardNew.tsx
apps/web/app/bibliotecas/page.tsx
```

---

## 🚀 Deploy via Git

```bash
git add apps/web/app/api/libraries/route.ts
git add apps/web/lib/supabase.ts
git add apps/web/components/LibraryCardNew.tsx
git add apps/web/app/bibliotecas/page.tsx
git commit -m "feat: scraping automático com loading visual"
git push origin main

# Na VPS
cd /caminho/do/projeto
git pull origin main
npm run build  # se necessário
pm2 restart all
```

---

## ⚠️ Importante

O loading mostra por **até 3 minutos**. Se após 3 minutos continuar em 0:
- O scraping falhou
- A URL é inválida
- O servidor não está executando o scraping

**Verifique sempre os logs do SERVIDOR primeiro!**

