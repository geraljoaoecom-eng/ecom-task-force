# ECOM TASK FORCE

Sistema avançado de monitoramento de bibliotecas de anúncios do Facebook com scraping inteligente e rotação de IPs.

## 🚀 Recursos

- **Monorepo** com API + Frontend + Sistema de Proxies
- **API Node.js + Express + TypeScript** com Prisma + SQLite
- **Frontend Next.js 14** com App Router, Tailwind e shadcn/ui
- **Scraper sem API** usando puppeteer-extra + stealth plugin
- **Sistema de rotação de IPs** para evitar bloqueios do Facebook
- **Agendador automático** com node-cron (hora em hora)
- **Interface dark/dourada** com efeitos de glow
- **Deploy na Digital Ocean** com Docker + Nginx
- **Load balancing** e rate limiting

## 📁 Estrutura

```
ecom-task-force/
├── apps/
│   ├── api/              # Backend Node.js + Express + Scraper
│   └── web/              # Frontend Next.js 14
├── ip-rotator/           # Sistema de rotação de IPs
├── docker-compose.yml    # Deploy com Docker
├── Dockerfile           # Container principal
├── nginx.conf           # Configuração do Nginx
├── deploy.sh            # Script de deploy para Digital Ocean
├── proxy-list.txt       # Lista de proxies
└── README.md
```

## 🛠️ Instalação

1. **Instalar dependências:**
   ```bash
   pnpm install:all
   ```

2. **Configurar banco de dados:**
   ```bash
   pnpm db:push
   ```

3. **Configurar variáveis de ambiente:**
   ```bash
   # Em apps/api, copie .env.example para .env
   cp apps/api/.env.example apps/api/.env
   ```

4. **Executar em desenvolvimento:**
   ```bash
   pnpm dev
   ```

## 🌐 Acesso

- **API:** http://0.0.0.0:4000
- **Web:** http://0.0.0.0:3000

Para acessar de outros dispositivos na rede, substitua `0.0.0.0` pelo IP da máquina Windows.

## 📱 Funcionalidades

- **TOP 25 Bibliotecas** - Rankings por anúncios ativos
- **Bibliotecas** - CRUD completo com filtros avançados
- **Pastas** - Organização por categorias
- **Ouro** - Seção premium com recursos especiais
- **Scraping Inteligente** - Extração automática de dados
- **Atualização Automática** - Monitoramento contínuo
