# ECOM TaskForce — Análise da stack (codebase)

Documento de referência para arquitectura de scraper Meta Ads Library com filtragem por IA.  
**Base:** análise estrita do que existe no repositório (sem sugestões de implementação).  
**Data:** 2026-06-01

---

## 1. Stack tecnológica actual

Monorepo **ECOM TaskForce** com duas aplicações principais:

| Camada | Tecnologia |
|--------|------------|
| **API backend** | **Node.js** + **Express** (`apps/api/server.js`), JavaScript (CommonJS) |
| **Frontend** | **Next.js 14** + **React 18** + **TypeScript** (`apps/web`) |
| **Estilos** | Tailwind CSS |
| **BD (runtime)** | **PostgreSQL** via driver **`pg`** (`apps/api/db.js`, `apps/web/lib/db.ts`) |
| **ORM / schema** | **Prisma** presente como dependência e ficheiros em `apps/api/prisma/` — o fluxo activo de leitura/escrita usa sobretudo SQL directo com `pg` |
| **Auth** | **JWT** (`jsonwebtoken`) + **bcryptjs** |
| **Pagamentos** | **Stripe** |
| **Email** | **Nodemailer** (API) |
| **Validação (web)** | **Zod** |
| **Raiz** | `package.json` com `concurrently` para correr API + web em dev |

Existem também a pasta `Original/` (cópia legada) e scripts de migração/utilitários em `scripts/`.

---

## 2. Ambiente alvo

**Web app** (SaaS no browser):

- Frontend Next.js (porta **3000** em dev/prod).
- API Express (porta **4000**, `process.env.PORT`).
- Deploy usado: **servidor Linux (VPS)** com **PM2** (`ecom-api` + `ecom-web`), domínio `ecoomtaskforce.site`.

**Não** é extensão de browser nem app desktop nativa.

---

## 3. Cliente HTTP, scraping e automação de browser

**Já existem e são usados:**

| Ferramenta | Onde |
|------------|------|
| **Puppeteer** + **puppeteer-extra** + **stealth** | `library-scraper-service.js`, `browser-manager.js`, `spy-search-scraper.js`, `apps/web/lib/scraper.ts` (obsoleto para refresh — ver `LIBRARY-SCRAPER-NOTAS.md`) |
| **`fetch` nativo** | `spy-apify-scraper.js` (API Apify) |
| **axios** | `apps/web/package.json` (dependência instalada) |
| **Apify** (HTTP, actor `apify/facebook-ads-scraper`) | `spy-apify-scraper.js` — fluxo **SPY** por keyword |
| **https-proxy-agent** | `apps/web` (dependência) |

**Não encontrado nas apps principais:** Playwright, Selenium, Cheerio.

---

## 4. Integração com IA / LLM

**Sim — via OpenRouter** (não há SDK OpenAI/Anthropic directos nas rotas principais):

| Ficheiro | Função |
|----------|--------|
| `spy-openrouter-shared.js` | Config (`OPENROUTER_API_KEY`, modelos) |
| `spy-openrouter.js` | Análise de relevância de anúncios (+ Whisper opcional) |
| `spy-deep-search.js` | Deep search / intel de keywords |

Variáveis típicas: `OPENROUTER_API_KEY`, `SPY_ANALYSIS_MODEL` (ex. `google/gemini-2.0-flash-001`), `SPY_WHISPER_MODEL` (ex. `openai/whisper-large-v3`).

**Não implementado** como cliente directo nas apps: OpenAI SDK, Anthropic SDK.

---

## 5. Base de dados e armazenamento

### PostgreSQL (runtime principal)

- Conexão: `DATABASE_URL`, pool em `apps/api/db.js`.
- Schema: `scripts/setup-postgres.sql`.

Tabelas relevantes (entre outras):

- `users`, `libraries`, `folders`, `pages`
- `ad_history`, `filter_options`, `deletion_history`
- SPY: `spy_sessions`, `spy_discoveries`, etc.

### Legado / auxiliar

| Item | Estado |
|------|--------|
| **sqlite3** | Dependência na raiz; scripts de migração (`migrate-sqlite-to-postgres.js`) — não é o runtime principal actual |
| **@supabase/supabase-js** | Na raiz; scripts antigos de migração; `apps/web/lib/supabase.ts` re-exporta `db.ts` (Postgres), não client Supabase activo no fluxo actual |
| **Prisma** | Schemas em `apps/api/prisma/`; API principal usa `pg`, não `PrismaClient` nos `.js` de runtime |

### Não presente

- **Redis** — ainda não implementado
- **MongoDB** — ainda não implementado

---

## 6. Sistema de filas ou jobs

**Não há** BullMQ, Celery, Redis Queue, Agenda, `node-cron`, etc.

**Agendamento in-process (`setInterval`):**

| Componente | Ficheiro | Comportamento |
|------------|----------|----------------|
| **AutoScraperScheduler** | `auto-scraper-scheduler.js` | A cada **60 s** verifica horários de refresh de bibliotecas (08:00, 12:00, 16:00, 20:00, 00:00, 04:00) |
| **SPY cleanup** | `spy-cleanup-scheduler.js` | A cada **6 h** — purge/avisos de discoveries |
| **SPY engine** | `spy-engine.js` | Sessões SPY no mesmo processo Node |

---

## 7. Ponto de entrada da aplicação

| App | Entrada |
|-----|---------|
| **API** | `apps/api/server.js` (`main` em `apps/api/package.json`) |
| **Web** | Next.js App Router — `apps/web/app/` (ex. `app/page.tsx`, `bibliotecas`, `spy`, `dashboard`) |
| **Dev monorepo** | Raiz: `npm run dev` → `concurrently` API + web |

No arranque da API: `AutoScraperScheduler`, `startSpyCleanupScheduler`, `resumeRunningSessions()` (SPY).

---

## 8. Gestor de pacotes

**npm** — `package-lock.json` na raiz, `apps/api` e `apps/web`.

**pnpm / yarn / pip** — não usados como lockfile principal do projecto.

---

## Ficheiros-chave (scraping + IA)

```
apps/api/
├── server.js                    # Entrada Express
├── db.js                        # PostgreSQL (pg)
├── library-scraper-service.js   # Refresh bibliotecas (Puppeteer)
├── browser-manager.js           # Puppeteer + proxy
├── ad-count-parser.js           # Parser contagens Meta
├── library-url-utils.js         # URLs active/BR/ALL
├── auto-scraper-scheduler.js    # Jobs horários
├── spy-engine.js                # Orquestração SPY
├── spy-search-scraper.js        # Scrape keywords (Puppeteer/Apify)
├── spy-apify-scraper.js         # Apify HTTP
├── spy-openrouter.js            # LLM análise
├── spy-deep-search.js           # LLM keywords
└── spy-openrouter-shared.js     # Config OpenRouter

apps/web/
├── app/                         # Next.js routes
├── lib/backend-proxy.ts         # Proxy refresh → API :4000
└── lib/scraper.ts               # @deprecated
```

---

## Documentação relacionada no repo

- `SPY-DIAGNOSTICO-COMPLETO.md` — diagnóstico SPY, IA, bloqueios Meta
- `LIBRARY-SCRAPER-NOTAS.md` — contagens ~UI vs JSON, proxy UI, refresh
- `ISP-PROXY-PROBLEMAS.md` — proxy ISP / VPS

---

## Resumo em uma frase

**Web app Node/Next com API Express, PostgreSQL, Puppeteer para Meta Ad Library, OpenRouter/Gemini para IA no módulo SPY, Apify opcional para keywords, jobs via `setInterval` no mesmo processo — sem fila externa nem Redis.**

---

*Gerado para partilha com Claude / equipa de arquitectura.*
