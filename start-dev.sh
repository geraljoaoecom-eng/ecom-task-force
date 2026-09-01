#!/bin/bash

echo "========================================"
echo " ECOM TaskForce v2.0 - Desenvolvimento"
echo "========================================"
echo ""

# Cores
GREEN='\033[0;32m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${CYAN}Iniciando API (porta 4000)...${NC}"
cd apps/api
npm run dev &
API_PID=$!
cd ../..

sleep 3

echo -e "${CYAN}Iniciando Frontend (porta 3000)...${NC}"
cd apps/web
npm run dev &
FRONTEND_PID=$!
cd ../..

echo ""
echo -e "${GREEN}========================================"
echo " Servidores iniciados!"
echo "========================================${NC}"
echo ""
echo -e "${YELLOW}API:${NC}      http://localhost:4000"
echo -e "${YELLOW}Frontend:${NC} http://localhost:3000"
echo -e "${YELLOW}Health:${NC}   http://localhost:4000/api/health"
echo ""
echo -e "${GREEN}========================================${NC}"
echo ""
echo -e "${CYAN}Para parar: Ctrl+C${NC}"
echo ""

# Aguardar por Ctrl+C
trap "kill $API_PID $FRONTEND_PID" EXIT
wait

