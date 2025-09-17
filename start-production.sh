#!/bin/bash

# ECOM Task Force - Script de Inicialização para Produção
# Este script inicia todos os serviços necessários

set -e

echo "🚀 ECOM Task Force - Iniciando Sistema de Produção"
echo "================================================="

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Verificar se Docker está rodando
if ! docker info > /dev/null 2>&1; then
    echo -e "${RED}❌ Docker não está rodando. Inicie o Docker primeiro.${NC}"
    exit 1
fi

# Verificar se docker-compose está disponível
if ! command -v docker-compose &> /dev/null; then
    echo -e "${RED}❌ docker-compose não encontrado. Instale primeiro.${NC}"
    exit 1
fi

# Criar diretórios necessários
echo -e "${YELLOW}📁 Criando diretórios necessários...${NC}"
mkdir -p data logs ssl

# Verificar se proxy-list.txt existe
if [ ! -f "proxy-list.txt" ]; then
    echo -e "${RED}❌ Arquivo proxy-list.txt não encontrado!${NC}"
    echo -e "${YELLOW}   Configure seus proxies antes de continuar.${NC}"
    exit 1
fi

# Testar proxies (opcional)
if [ "$1" = "--test-proxies" ]; then
    echo -e "${YELLOW}🧪 Testando proxies...${NC}"
    node test-proxies.js
    echo ""
fi

# Parar containers existentes
echo -e "${YELLOW}🛑 Parando containers existentes...${NC}"
docker-compose down 2>/dev/null || true

# Construir e iniciar containers
echo -e "${YELLOW}🔨 Construindo containers...${NC}"
docker-compose build --no-cache

echo -e "${YELLOW}🚀 Iniciando serviços...${NC}"
docker-compose up -d

# Aguardar serviços iniciarem
echo -e "${YELLOW}⏳ Aguardando serviços iniciarem...${NC}"
sleep 30

# Verificar status dos serviços
echo -e "${YELLOW}🔍 Verificando status dos serviços...${NC}"

# Verificar API
if curl -s http://localhost:4000/health > /dev/null; then
    echo -e "${GREEN}✅ API rodando em http://localhost:4000${NC}"
else
    echo -e "${RED}❌ API não está respondendo${NC}"
fi

# Verificar Web
if curl -s http://localhost:3000 > /dev/null; then
    echo -e "${GREEN}✅ Web rodando em http://localhost:3000${NC}"
else
    echo -e "${RED}❌ Web não está respondendo${NC}"
fi

# Verificar IP Rotator
if curl -s http://localhost:8080/health > /dev/null; then
    echo -e "${GREEN}✅ IP Rotator rodando em http://localhost:8080${NC}"
else
    echo -e "${RED}❌ IP Rotator não está respondendo${NC}"
fi

# Mostrar logs
echo -e "${YELLOW}📋 Logs dos serviços:${NC}"
echo -e "${BLUE}   docker-compose logs -f${NC}"

# Mostrar status
echo -e "${YELLOW}📊 Status dos containers:${NC}"
docker-compose ps

echo ""
echo -e "${GREEN}🎉 Sistema ECOM Task Force iniciado com sucesso!${NC}"
echo -e "${GREEN}🌐 Acesse: http://localhost:3000${NC}"
echo -e "${GREEN}📡 API: http://localhost:4000${NC}"
echo -e "${GREEN}🔄 IP Rotator: http://localhost:8080${NC}"
echo ""
echo -e "${YELLOW}📝 Comandos úteis:${NC}"
echo -e "${BLUE}   Parar sistema: docker-compose down${NC}"
echo -e "${BLUE}   Ver logs: docker-compose logs -f${NC}"
echo -e "${BLUE}   Status: docker-compose ps${NC}"
echo -e "${BLUE}   Testar proxies: node test-proxies.js${NC}"
