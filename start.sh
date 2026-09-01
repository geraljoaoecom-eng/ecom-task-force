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
