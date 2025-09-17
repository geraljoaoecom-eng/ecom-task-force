# 🚀 ECOM Task Force - Guia de Deploy

## 📋 Pré-requisitos

- **Digital Ocean Droplet** (Ubuntu 20.04+)
- **Docker** e **Docker Compose** instalados
- **Domínio** configurado (opcional)
- **10 Proxies** funcionais (já configurados)

## 🛠️ Deploy Rápido

### 1. Preparar Servidor

```bash
# Conectar ao servidor
ssh root@seu-ip

# Atualizar sistema
apt update && apt upgrade -y

# Instalar Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh

# Instalar Docker Compose
curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
chmod +x /usr/local/bin/docker-compose
```

### 2. Clonar e Configurar

```bash
# Clonar repositório
git clone https://github.com/seu-usuario/ecom-task-force.git
cd ecom-task-force

# Configurar domínio (opcional)
export DOMAIN=seu-dominio.com
export EMAIL=admin@seu-dominio.com

# Executar deploy automático
chmod +x deploy.sh
./deploy.sh
```

### 3. Deploy Manual (Alternativo)

```bash
# Construir containers
docker-compose build

# Iniciar serviços
docker-compose up -d

# Verificar status
docker-compose ps
```

## 🔧 Configuração Avançada

### Variáveis de Ambiente

Edite `.env` em cada app:

```bash
# apps/api/.env
NODE_ENV=production
DATABASE_URL=file:./prisma/atlas.db
PORT=4000

# apps/web/.env
NODE_ENV=production
NEXT_PUBLIC_API_URL=http://seu-dominio.com/api
```

### Configurar Proxies

Edite `proxy-list.txt` com seus proxies:

```
http://username:password@ip:porta
http://username:password@ip:porta
...
```

### Testar Proxies

```bash
# Testar todos os proxies
node test-proxies.js

# Testar individual
curl -x http://username:password@ip:porta https://httpbin.org/ip
```

## 📊 Monitoramento

### Verificar Status

```bash
# Status dos containers
docker-compose ps

# Logs em tempo real
docker-compose logs -f

# Logs específicos
docker-compose logs -f ecom-task-force
docker-compose logs -f ip-rotator
```

### Health Checks

```bash
# API
curl http://localhost:4000/health

# Web
curl http://localhost:3000

# IP Rotator
curl http://localhost:8080/health
```

## 🔒 Segurança

### Firewall

```bash
# Configurar UFW
ufw allow 22
ufw allow 80
ufw allow 443
ufw enable
```

### SSL (Opcional)

```bash
# Usar Certbot
certbot --nginx -d seu-dominio.com
```

## 🚨 Troubleshooting

### Problemas Comuns

1. **Containers não iniciam**
   ```bash
   docker-compose logs
   docker system prune -f
   ```

2. **Proxies não funcionam**
   ```bash
   node test-proxies.js
   # Verificar formato no proxy-list.txt
   ```

3. **Porta já em uso**
   ```bash
   sudo lsof -i :3000
   sudo kill -9 PID
   ```

4. **Banco de dados**
   ```bash
   docker-compose exec ecom-task-force npx prisma db push
   ```

### Logs Importantes

```bash
# Logs do scraper
docker-compose logs ecom-task-force | grep "Scraping"

# Logs de proxy
docker-compose logs ip-rotator | grep "proxy"

# Logs de erro
docker-compose logs | grep "ERROR"
```

## 📈 Otimizações

### Performance

- **Aumentar memória** do container se necessário
- **Configurar swap** no servidor
- **Monitorar CPU/RAM** com `htop`

### Escalabilidade

- **Load balancer** com múltiplas instâncias
- **Database** externo (PostgreSQL)
- **Redis** para cache

## 🔄 Atualizações

### Deploy de Nova Versão

```bash
# Parar serviços
docker-compose down

# Atualizar código
git pull origin main

# Reconstruir e iniciar
docker-compose build --no-cache
docker-compose up -d
```

### Backup

```bash
# Backup do banco
docker-compose exec ecom-task-force cp prisma/atlas.db /backup/

# Backup completo
tar -czf backup-$(date +%Y%m%d).tar.gz .
```

## 📞 Suporte

- **Logs**: `docker-compose logs -f`
- **Status**: `docker-compose ps`
- **Teste**: `node test-proxies.js`
- **Health**: `curl http://localhost:4000/health`

---

**🎉 Sistema pronto para produção com rotação de IPs!**
