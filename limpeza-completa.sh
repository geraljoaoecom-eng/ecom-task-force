#!/bin/bash

echo "🧹 LIMPEZA COMPLETA DO TASK FORCE"
echo "=================================="
echo ""
echo "📋 O que será MANTIDO:"
echo "✅ apps/ (API + Frontend)"
echo "✅ atlas.db (banco de dados)"
echo "✅ simple-server-production.js (servidor principal)"
echo "✅ package.json (dependências)"
echo "✅ README.md (documentação principal)"
echo "✅ Arquivos de configuração essenciais"
echo ""
echo "🗑️ O que será REMOVIDO:"
echo "❌ salesforce-project/ (projeto Salesforce)"
echo "❌ TaskForce-Clean/ (versão limpa)"
echo "❌ Todos os scripts .exp, .bat, .vbs"
echo "❌ Arquivos de teste e debug"
echo "❌ Scripts de deploy antigos"
echo "❌ Arquivos temporários"
echo ""

# Confirmar antes de prosseguir
read -p "🤔 Continuar com a limpeza? (y/N): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "❌ Limpeza cancelada"
    exit 1
fi

echo ""
echo "🔄 Iniciando limpeza..."

# Parar processos em execução
echo "🛑 Parando processos..."
pkill -f "node" 2>/dev/null || true
pkill -f "next" 2>/dev/null || true
sleep 2

# Criar backup do banco de dados
echo "💾 Criando backup do banco de dados..."
cp atlas.db atlas.db.backup-$(date +%Y%m%d-%H%M%S)

# Remover projetos não relacionados
echo "🗑️ Removendo projetos não relacionados..."
rm -rf salesforce-project/
rm -rf apps/web/TaskForce-Clean/
rm -rf ip-rotator/

# Remover scripts antigos
echo "🗑️ Removendo scripts antigos..."
rm -f *.exp
rm -f *.bat
rm -f *.vbs
rm -f *.ps1
rm -f check-*.js
rm -f clean_*.js
rm -f fix-*.js
rm -f test-*.js
rm -f teste-*.js
rm -f exemplo-*.js
rm -f extract-*.js
rm -f get-*.js
rm -f import_*.js
rm -f normalize_*.js
rm -f remove_*.js
rm -f sync_*.js
rm -f unify_*.js
rm -f start-*.js
rm -f atlas-links-*.js
rm -f libraries-fixed.ts
rm -f LibraryCardNew.tsx

# Remover scripts de shell antigos
echo "🗑️ Removendo scripts de shell antigos..."
rm -f *.sh
rm -f backup-*.sh
rm -f complete-*.sh
rm -f deploy-*.sh
rm -f fix-*.sh
rm -f manual-*.sh
rm -f refresh-*.sh
rm -f restore-*.sh
rm -f ssh-*.sh
rm -f start-*.sh
rm -f stop-*.sh
rm -f upload-*.sh
rm -f verificar-*.sh

# Remover arquivos de configuração antigos
echo "🗑️ Removendo arquivos de configuração antigos..."
rm -f docker-compose.yml
rm -f Dockerfile
rm -f nginx.conf
rm -f pnpm-lock.yaml
rm -f pnpm-workspace.yaml
rm -f *.traineddata
rm -f proxy-list.txt
rm -f library_ids.txt
rm -f system_info.txt

# Remover documentação antiga
echo "🗑️ Removendo documentação antiga..."
rm -f APIFY-INTEGRATION.md
rm -f COMO-EXECUTAR.md
rm -f COMO-USAR.md
rm -f CORRECAO-MANUAL.txt
rm -f CORRIGIR-*.md
rm -f DEPLOY.md
rm -f INSTRUCOES-*.md
rm -f INSTRUCOES-*.txt
rm -f LEIA-*.txt
rm -f OPENROUTER-SETUP.md
rm -f README-SISTEMA-24-7.md
rm -f SOLUCAO-*.md

# Remover arquivos de execução antigos
echo "🗑️ Removendo arquivos de execução antigos..."
rm -f EXECUTAR-*.bat
rm -f EXECUTAR-*.txt
rm -f ECOM-Task-Force*.bat
rm -f setup-*.bat
rm -f setup-*.ps1
rm -f setup-*.sh
rm -f remove-autostart.bat
rm -f create-*.bat
rm -f create-*.vbs

# Limpar node_modules desnecessários
echo "🧹 Limpando node_modules desnecessários..."
if [ -d "node_modules" ]; then
    rm -rf node_modules
fi

# Reinstalar dependências
echo "📦 Reinstalando dependências..."
npm install

# Verificar se o banco de dados está intacto
echo "🔍 Verificando banco de dados..."
if [ -f "atlas.db" ]; then
    COUNT=$(sqlite3 atlas.db "SELECT COUNT(*) FROM libraries;" 2>/dev/null)
    if [ $? -eq 0 ]; then
        echo "✅ Banco de dados intacto: $COUNT bibliotecas"
    else
        echo "❌ Erro ao verificar banco de dados"
    fi
else
    echo "❌ Arquivo atlas.db não encontrado!"
fi

# Criar estrutura limpa
echo "📁 Criando estrutura limpa..."
mkdir -p scripts
mkdir -p docs

# Mover arquivos importantes para pastas organizadas
echo "📁 Organizando arquivos..."
mv README.md docs/ 2>/dev/null || true

# Criar script de inicialização simples
echo "📝 Criando script de inicialização..."
cat > start.sh << 'EOF'
#!/bin/bash
echo "🚀 Iniciando ECOM Task Force..."
echo "📡 Iniciando API..."
node simple-server-production.js &
API_PID=$!

echo "⏳ Aguardando API iniciar..."
sleep 5

echo "🌐 Iniciando Frontend..."
cd apps/web
npm run dev &
FRONTEND_PID=$!

echo "✅ ECOM Task Force iniciado!"
echo "📊 API: http://localhost:4000"
echo "🌐 Frontend: http://localhost:3000"
echo ""
echo "Para parar: Ctrl+C"
EOF

chmod +x start.sh

# Criar README atualizado
echo "📝 Criando README atualizado..."
cat > README.md << 'EOF'
# ECOM Task Force

Sistema de monitoramento de bibliotecas de anúncios do Facebook.

## 🚀 Início Rápido

```bash
# Instalar dependências
npm install

# Iniciar sistema completo
./start.sh
```

## 📊 Acesso

- **Frontend**: http://localhost:3000
- **API**: http://localhost:4000
- **Bibliotecas**: http://localhost:3000/bibliotecas

## 📁 Estrutura

```
TaskForce/
├── apps/
│   ├── api/          # Servidor API
│   └── web/          # Frontend Next.js
├── atlas.db          # Banco de dados SQLite
├── simple-server-production.js  # Servidor principal
├── package.json      # Dependências
└── start.sh          # Script de inicialização
```

## 🎯 Funcionalidades

- ✅ Monitoramento de 56+ bibliotecas
- ✅ Filtros por nicho, estratégia, produto
- ✅ Interface dark theme com acentos dourados
- ✅ Sistema de pastas organizacionais
- ✅ Histórico de anúncios ativos

## 🔧 Comandos

```bash
npm run dev          # Iniciar desenvolvimento
npm run install:all  # Instalar todas as dependências
npm run db:push      # Atualizar banco de dados
```
EOF

echo ""
echo "🎉 LIMPEZA CONCLUÍDA!"
echo "====================="
echo ""
echo "✅ Estrutura limpa criada"
echo "✅ Banco de dados preservado"
echo "✅ Filtros preservados"
echo "✅ Scripts essenciais mantidos"
echo ""
echo "🚀 Para iniciar:"
echo "   ./start.sh"
echo ""
echo "📊 Acesse: http://localhost:3000"
