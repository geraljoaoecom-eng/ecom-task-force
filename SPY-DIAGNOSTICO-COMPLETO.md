# ECOM TaskForce SPY — Diagnóstico Completo do Projeto

**Data:** 31 de maio de 2026  
**Site produção:** https://ecoomtaskforce.site  
**VPS:** Contabo `173.249.32.180` — path `/var/www/ecom-taskforce`  
**Stack:** Express `:4000` + Next.js `:3000` + PostgreSQL + PM2 (`ecom-api`, `ecom-web`)

---

## Índice

1. [Stack & Estrutura](#1-stack--estrutura)
2. [Puppeteer](#2-puppeteer)
3. [Scraping da Ads Library](#3-scraping-da-ads-library)
4. [IA / Gemini](#4-ia--gemini)
5. [Enrich de Anunciantes](#5-enrich-de-anunciantes)
6. [Keywords & Loop Recursivo](#6-keywords--loop-recursivo)
7. [Storage & Base de Dados](#7-storage--base-de-dados)
8. [Proxy & Erros Actuais](#8-proxy--erros-actuais)
9. [Multi-Cliente & Auth](#9-multi-cliente--auth)
10. [Refresh Bibliotecas 6×/dia](#10-refresh-bibliotecas-6×dia)
11. [Pipeline SPY (visão geral)](#11-pipeline-spy-visão-geral)
12. [Estado das Sessões SPY (BD)](#12-estado-das-sessões-spy-bd)
13. [Decisões de Produto Já Tomadas](#13-decisões-de-produto-já-tomadas)
14. [Custos Reais (referência)](#14-custos-reais-referência)
15. [Gargalo & Próximos Passos Sugeridos](#15-gargalo--próximos-passos-sugeridos)
16. [Ficheiros-Chave (referência rápida)](#16-ficheiros-chave-referência-rápida)

---

## 1. STACK & ESTRUTURA

### 1.1 Estrutura de pastas (principais)

```
ECOOM TaskForce/
├── package.json                    # monorepo root
├── env-config / env.example
├── scripts/
│   ├── deploy-contabo.sh
│   ├── setup-postgres.sql
│   ├── seed-db.js
│   └── migrations/
│       ├── 001-spy-tables.sql
│       └── 002-spy-niche-intel.sql
├── apps/
│   ├── api/                        # Express :4000 — motor SPY + scraping
│   │   ├── server.js               # rotas, auth, scheduler
│   │   ├── db.js                   # pool PostgreSQL
│   │   ├── spy-engine.js           # orquestrador SPY
│   │   ├── spy-search-scraper.js   # Puppeteer Ads Library (keywords)
│   │   ├── spy-deep-search.js      # Gemini: intel de mercado
│   │   ├── spy-ad-analyzer.js      # relevância + keywords
│   │   ├── spy-openrouter.js       # Gemini + Whisper
│   │   ├── spy-openrouter-shared.js
│   │   ├── spy-db.js               # CRUD sessões/discoveries
│   │   ├── spy-niche-intel.js      # keywords persistentes por nicho
│   │   ├── spy-url-builder.js      # URLs Ads Library
│   │   ├── spy-notify.js           # email conclusão
│   │   ├── spy-cleanup-scheduler.js
│   │   ├── library-scraper-service.js   # refresh bibliotecas
│   │   ├── library-analyzer-service.js  # enrich/import biblioteca
│   │   ├── auto-scraper-scheduler.js    # cron 6×/dia
│   │   ├── ad-count-parser.js
│   │   ├── auth-supabase.js
│   │   └── src/services/scraper/   # TS legado (Apify) — NÃO ligado ao server.js
│   └── web/                        # Next.js 14 :3000
│       ├── app/spy/                # UI SPY (admin)
│       ├── app/bibliotecas/        # UI bibliotecas
│       ├── app/admin/              # painel admin
│       ├── app/dashboard-user/     # dashboard utilizador
│       ├── lib/scraper.ts          # scraper alternativo (Next API routes)
│       ├── lib/api.ts              # cliente API
│       └── components/             # SpyProgress, Sidebar, etc.
└── Original/                       # backup antigo
```

### 1.2 CommonJS ou ESModules?

- **API:** CommonJS (`require` / `module.exports`)
- Nenhum `package.json` tem `"type": "module"`
- **Frontend:** ESModules + TypeScript nos ficheiros `.ts/.tsx` (Next.js 14)

### 1.3 TypeScript?

- **Sim, só no frontend** — `apps/web/tsconfig.json` existe
- **API SPY:** 100% JavaScript (`.js`)
- Existe código TS em `apps/api/src/services/scraper/` (Apify, robust scraper) mas **não está integrado** em `server.js`

### 1.4 Versão Node.js

- Local (Mac): v25.9.0
- Produção (VPS Contabo): Node 20 (contexto deploy; sem `engines` fixo no package.json)
- PM2 gere `ecom-api` e `ecom-web`

### 1.5 Dependências

**Root `package.json`:**
- `@prisma/client`, `@supabase/supabase-js`, `@types/pg`, `axios`, `bcryptjs`, `cors`, `dotenv`, `express`, `jsonwebtoken`, `pg`, `prisma`, `puppeteer`, `recharts`, `sqlite3`, `stripe`, `supabase`
- Dev: `concurrently`

**`apps/api/package.json`:**
- `@prisma/client`, `bcryptjs`, `cors`, `express`, `jsonwebtoken`, `nodemailer`, `prisma`, `puppeteer`, `pg`

**`apps/web/package.json`:**
- `axios`, `bcryptjs`, `clsx`, `https-proxy-agent`, `jsonwebtoken`, `lucide-react`, `next`, `pg`, `puppeteer`, `puppeteer-extra`, `puppeteer-extra-plugin-stealth`, `react`, `react-dom`, `stripe`, `swr`, `tailwind-merge`, `zod`
- Dev: `@types/*`, `eslint`, `tailwindcss`, `typescript`

---

## 2. PUPPETEER

### 2.1 Instalado e funcional?

- **Sim** — `puppeteer ^24.x` na API e web
- Funciona onde o IP não é bloqueado (ex.: Mac local)
- Na **VPS Contabo falha** (0 ads / contagem 0) — bloqueio Meta por IP datacenter, não falha do Puppeteer em si

### 2.2 Launch actual do browser (SPY)

Ficheiro: `apps/api/spy-search-scraper.js`

```javascript
async function launchBrowser() {
  const chromePath = findChrome();
  const opts = {
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--lang=en-US,pt-BR'],
  };
  if (chromePath) opts.executablePath = chromePath;
  return puppeteer.launch(opts);
}
```

- Browser **partilhado** entre requests (`withSharedBrowser` + lock)
- Procura Chrome do sistema: `/usr/bin/google-chrome-stable`, `/usr/bin/google-chrome`, `/Applications/Google Chrome.app/...`
- **Sem proxy**, **sem stealth**, **sem rotação de IP**

### 2.3 `puppeteer` ou `puppeteer-core`?

- **`puppeteer` completo** (bundled Chromium + fallback Chrome sistema)
- Não usa `puppeteer-core`

### 2.4 `puppeteer-extra` + stealth?

- **Instalados** em `apps/web/package.json` (`puppeteer-extra`, `puppeteer-extra-plugin-stealth`)
- **Não usados** em nenhum ficheiro de código activo da app
- A API **não tem** essas dependências
- Todos os scrapers activos usam `puppeteer` plain

### 2.5 Outros launchers Puppeteer (duplicados)

| Ficheiro | Uso |
|----------|-----|
| `spy-search-scraper.js` | SPY keyword + quickCount |
| `library-scraper-service.js` | Refresh contagem bibliotecas |
| `library-analyzer-service.js` | Import/enrich biblioteca |
| `apps/web/lib/scraper.ts` | Next.js API routes (alternativo) |

**Problema:** 4 implementações separadas de launch — nenhuma com proxy centralizado.

---

## 3. SCRAPING DA ADS LIBRARY

### 3.1 Código que abre a Meta Ads Library?

**Sim**, em 3 módulos activos:

| Ficheiro | Uso |
|----------|-----|
| `spy-search-scraper.js` | Pesquisa por keyword (SPY) |
| `library-scraper-service.js` | Contagem refresh bibliotecas |
| `library-analyzer-service.js` | Import/enrich biblioteca completa |

**Construção de URLs** — `apps/api/spy-url-builder.js`:

```javascript
function buildAdsLibrarySearchUrl(keyword, country = 'ALL') {
  const params = new URLSearchParams({
    active_status: 'active',
    ad_type: 'all',
    country: normalizeCountry(country),
    q: keyword,
    search_type: 'keyword_unordered',
    media_type: 'all',
  });
  return `https://www.facebook.com/ads/library/?${params.toString()}`;
}

function buildPageLibraryUrl(pageId) {
  return `https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=ALL&view_all_page_id=${pageId}&search_type=page&media_type=all`;
}
```

Países suportados no mapa: PT, BR, US, NL, ES, DE, FR, IT, GB, ALL (extensível).

### 3.2 Scroll actual

**SPY keyword search** (`scrapeKeywordSearch`):
- 12 iterações
- `window.scrollBy(0, window.innerHeight * 2)` por iteração
- Pausa 1200 ms entre scrolls
- Antes: fecha cookie consent, espera `Library ID|resultados` até 25 s

**Biblioteca enrich** (`extractAdLinkUrlsFromPage`):
- 4 scrolls × 2× innerHeight, pausa 1500 ms

**Refresh bibliotecas** (`library-scraper-service.js`):
- Sem scroll — `goto` + wait 4000 ms + parse texto

### 3.3 Como extrai dados? (seletores)

**Não usa seletores CSS.** Parse de HTML bruto + `innerText` + regex:

| Método | Padrão |
|--------|--------|
| page_id antigo | `view_all_page_id=(\d+)` |
| page_id actual | `"page_id":"123"`, `"pageID"`, `"page_id":123` |
| Imagens | regex URLs `.jpg/.jpeg/.png/.webp` |
| Vídeos | regex `video...fbcdn` |
| Texto ad | split por `Sponsored\|Patrocinado\|Library ID\|ID da biblioteca` |
| Landing URLs | regex `"link_url":"..."` no HTML |

### 3.4 O que extrai de cada ad?

| Campo | Descrição |
|-------|-----------|
| `pageId` | ID do anunciante Facebook |
| `libraryUrl` | URL biblioteca (`view_all_page_id=...`) |
| `adText` | Copy do anúncio (até 800 chars) |
| `imageUrl` | URL imagem criativo |
| `videoUrl` | URL vídeo fbcdn |
| `landingUrl` | Destino do ad (domínio fora facebook.com) |

### 3.5 Limite de scroll / parar em X resultados?

- **Scroll fixo:** 12 ciclos no SPY — não para cedo
- **Sem `maxAds`** por keyword no código
- **Sem paginação** completa — só o que carrega no scroll
- Threshold **≥25 ads activos** aplica-se só no **enrich** (`MIN_ACTIVE_ADS`), não no scrape keyword
- Sessão SPY max **8 horas** (`SESSION_MAX_HOURS`)

---

## 4. IA / GEMINI

### 4.1 Integrado com Gemini/OpenRouter?

**Sim**, via OpenRouter API:

| Módulo | Função |
|--------|--------|
| `spy-deep-search.js` | Intel de mercado antes do scrape |
| `spy-openrouter.js` | Análise relevância por ad (+ Whisper opcional) |
| `spy-ad-analyzer.js` | Wrapper relevância + fallback heurístico |

**Variáveis de ambiente:**
- `OPENROUTER_API_KEY` ou `SPY_AI_API_KEY`
- `OPENROUTER_BASE_URL` (default: `https://openrouter.ai/api/v1`)
- `SPY_ANALYSIS_MODEL`
- `SPY_WHISPER_MODEL`

### 4.2 Modelos

```javascript
const ANALYSIS_MODEL = process.env.SPY_ANALYSIS_MODEL || 'google/gemini-2.0-flash-001';
const WHISPER_MODEL = process.env.SPY_WHISPER_MODEL || 'openai/whisper-large-v3';
```

### 4.3 Prompt Deep Search

Ficheiro: `spy-deep-search.js` — `buildDeepSearchPrompt()`

Pede à IA (como estratega DR):
1. MECANISMOS (ex: truque da gelatina, GLP-1)
2. DORES
3. ÂNGULOS
4. HOOKS
5. KEYWORDS — 15-25 frases para Ads Library (idioma do país)
6. SINAIS DE RELEVÂNCIA
7. RESUMO DE MERCADO

Resposta esperada: JSON com arrays + strings descritivas.

### 4.4 Prompt Análise de Ad

Ficheiro: `spy-openrouter.js` — `buildAnalysisPrompt()`

- Contexto: país, idioma, nicho, produto, keyword semente
- Intel de mercado do Deep Search (mecanismos, dores, hooks hot)
- Analisa: texto + imagem (+ vídeo se `skipVideo=false`)
- Resposta: `{"score":0.0,"relevant":true,"reason":"..."}`

**Fase SPY actual:** `skipVideo: true` — só texto + imagem, **Whisper desactivado** na pesquisa (custo ~$4.50/sessão quando activo).

### 4.5 Resposta da IA (estruturas)

**Deep Search** → objecto parseado:
```json
{
  "mecanismos": [],
  "dores": [],
  "angulos": [],
  "hooks": [],
  "keywords": [],
  "sinaisRelevancia": "",
  "resumoMercado": "",
  "generatedAt": "ISO8601",
  "fallback": false
}
```

**Análise ad** → `{ score: 0-1, relevant: bool, reason: string }`

**Thresholds:**
- IA: `score >= 0.35` e `relevant !== false`
- Heurístico fallback: `score >= 0.28`

### 4.6 Estado OpenRouter (produção)

- Créditos adicionados — HTTP 200 OK
- Dashboard histórico: Whisper ~$4.50 (514 req), Gemini ~$0.69 (3.14K req)
- Whisper **OFF** na fase SPY por decisão de custo

---

## 5. ENRICH DE ANUNCIANTES

### 5.1 Abre biblioteca de anunciante específico?

**Sim:**

| Função | Ficheiro | O que faz |
|--------|----------|-----------|
| `quickCountLibraryAds(url)` | `spy-search-scraper.js` | Só conta ads activos |
| `scrapeAdsLibrary(page, url)` | `library-analyzer-service.js` | Nome, contagem, textos, URLs |
| `analyzeLibraryFromUrl(url)` | `library-analyzer-service.js` | Análise completa + draft biblioteca |

### 5.2 Verifica ≥25 ads activos?

**Sim** — `MIN_ACTIVE_ADS = 25` em `spy-db.js`, usado em `spy-engine.js`:

```javascript
const activeAds = await quickCountLibraryAds(ad.libraryUrl);
if (activeAds < MIN_ACTIVE_ADS) {
  console.log(`↷ SPY skip ${ad.pageId}: ${activeAds} ads (< ${MIN_ACTIVE_ADS})`);
  return;
}
```

### 5.3 Extrai textos, títulos, CTAs das bibliotecas?

**Parcialmente:**

- `extractAdTexts()` — snippets por bloco Sponsored (até 5, 500 chars cada)
- `extractPageName()` — nome da página FB
- `extractAdLinkUrls()` — URLs destino dos ads (JSON embebido)
- `scrapeFacebookAbout()` — página `/about` do anunciante
- `analyzeAdDestinations()` — analisa até 5 landings (QUIZ/VSL/PÁG. VENDAS/Store/Advetorial, detecção cloaker)
- `inferFilters()` — nicho, produto, idioma, país (heurísticas keyword)
- `buildNotes()` — notas automáticas para card biblioteca

**Não extrai:** CTAs ou títulos como campos separados estruturados — tudo via `innerText` + regex.

### 5.4 Fila de enrich

- `enqueueEnrich()` — fila async por sessão
- `runEnrichWorker()` — processa em paralelo com search loop
- Se biblioteca já existe globalmente → discovery rápido sem re-análise completa

---

## 6. KEYWORDS & LOOP RECURSIVO

### 6.1 Gestão de keywords

**PostgreSQL** — tabela `spy_keywords` + fila por sessão.

| Source | Origem |
|--------|--------|
| `deep` | Gemini Deep Search |
| `niche_intel` | Tabela `spy_niche_intel` (persistente entre sessões) |
| `seed` | Heurísticas locais (`generateSeedKeywords`) |
| `learned` | Extraídas de copy de ads encontrados |

Prioridade na fila: `deep` → `niche_intel` → `seed` → resto (`getNextKeyword`).

Tabela persistente `spy_niche_intel`:
- UNIQUE `(nicho, country, keyword)`
- Campos: `score`, `hit_count`, `source`, `last_seen_at`

### 6.2 Loop recursivo de novas keywords?

**Sim, limitado:**

1. Deep Search gera 15-25 keywords iniciais
2. Por cada ad **relevante**, `extractKeywordsFromAdText()` extrai frases DR
3. Frases hot (regex: truque, gelatina, jejum, etc.) → `addKeyword(..., 'learned')`
4. Keywords também guardadas em `spy_niche_intel` para sessões futuras
5. Loop search termina quando fila `pending` vazia por **6 rondas × 5 s** (30 s idle)
6. Enrich worker continua até fila vazia (max wait ~1 h)

**Removido:** aprendizado de keywords a partir do body HTML da página de resultados (degradava para "with", "plano", IDs numéricos).

### 6.3 Evitar keyword duplicada?

**Sim:**
- `UNIQUE(session_id, keyword)` na tabela `spy_keywords`
- `INSERT ... ON CONFLICT DO NOTHING` em `addKeyword()`
- Normalização: `trim().toLowerCase()`
- Niche intel: `UNIQUE(nicho, country, keyword)`

---

## 7. STORAGE & BASE DE DADOS

### 7.1 Base de dados?

**PostgreSQL** self-hosted na VPS Contabo.

- Pool: `apps/api/db.js` (`pg`)
- Schema: `scripts/setup-postgres.sql` + migrations SPY
- Prisma schema existe (`apps/api/prisma/schema.prisma`) mas SPY usa SQL directo
- Legado Supabase ainda referenciado em helpers; produção migrada para PG local
- SQLite legado no root package (migrado)

### 7.2 Tabelas SPY

| Tabela | Conteúdo |
|--------|----------|
| `spy_sessions` | Sessão + stats JSONB + deadline 8h |
| `spy_keywords` | Fila keywords por sessão |
| `spy_ad_candidates` | Todos ads scraped + score relevância |
| `spy_discoveries` | Bibliotecas validadas (card_data JSONB, ad_assets) |
| `spy_learned_terms` | Termos aprendidos por sessão |
| `spy_niche_intel` | Intel persistente nicho/país |

### 7.3 Tabelas plataforma (multi-user)

| Tabela | Conteúdo |
|--------|----------|
| `users` | email, password bcrypt, role, stripe |
| `libraries` | bibliotecas monitorizadas por user |
| `folders` | pastas por user |
| `pages` | URLs associadas a biblioteca |
| `ad_history` | histórico contagem ads |
| `filter_options` | nichos, estratégias, produtos, etc. |

### 7.4 Como guarda resultados SPY?

- **Candidates:** cada ad scraped → `spy_ad_candidates` (relevant/rejected)
- **Discoveries:** bibliotecas ≥25 ads → `spy_discoveries` com TTL 30 dias
- **Stats live:** JSONB em `spy_sessions.stats` (adsScanned, discoveriesCount, keywordsDone, etc.)
- **Copy bank:** derivado de `spy_discoveries.ad_assets`

### 7.5 Deduplicação?

| Nível | Mecanismo |
|-------|-----------|
| Keywords | `UNIQUE(session_id, keyword)` |
| Discoveries | `UNIQUE(session_id, source_value)` + merge ON CONFLICT |
| Biblioteca global | `libraryExistsGlobally(source_value)` |
| Por sessão | `discoveryExistsInSession()` antes de enrich |
| Import | `assertLibrarySourceIsUnique()` |

---

## 8. PROXY & ERROS ACTUAIS

### 8.1 Proxy configurado?

**Não.**

- Sem `SPY_PROXY_URL`, `--proxy-server`, ou `https-proxy-agent` no código de scraping da API
- `https-proxy-agent` no web package.json — **não usado**
- IP de saída = IP datacenter Contabo

### 8.2 Erro principal (VPS)

**SPY scrape 0 ads:**

```
⚠️ SPY scrape 0 ads — body: ${preview}
```

Corpo da página inclui mensagens Meta:
- **"No ads match your search criteria"**
- Ou página sem `page_id` no HTML embebido

**Causa confirmada:** Meta bloqueia IP datacenter — não é bug de parser (parser multi-padrão já corrigido para `"page_id"` JSON).

**Refresh bibliotecas:**

```
⚠️ Contagem de resultados não encontrada na página
```

→ `active_ads` gravado como **0**, sobrescreve valor anterior (bug conhecido).

### 8.3 Outros erros vistos

| Erro | Contexto |
|------|----------|
| OpenRouter `402 Insufficient credits` | Resolvido com créditos |
| `invalid input syntax for type json` | Enrich SPY (JSON malformado) |
| FK errors | Cancelar sessão com worker activo |
| UI discoveries vazia com counter >0 | Corrigido (`q=undefined` no filtro SQL) |
| Download vídeo 403 + Whisper caro | Corrigido com `skipVideo: true` |
| Gemini JSON com markdown | Corrigido com strip de ```json |

### 8.4 Bugs já corrigidos (histórico)

1. **Parser Meta** — `view_all_page_id` → `"page_id"` JSON embebido
2. **UI discoveries vazia** — `URLSearchParams` convertia `undefined` → `"undefined"`
3. **Whisper caro** — desactivado na fase SPY
4. **Keywords degradavam** — removido aprendizado do body; `extractKeywordsFromAdText()` + `spy_niche_intel`

---

## 9. MULTI-CLIENTE & AUTH

### 9.1 Múltiplos clientes/mercados?

**Sim, parcialmente:**

- **Users** com bibliotecas/pastas isoladas por `user_id`
- **SPY** só **admin** (`isAdmin` middleware) — operador único, não self-service por cliente
- **Mercados:** campo `country` por sessão SPY (PT, BR, GB, US, ALL, etc.)
- **Niche intel** persistente por `(nicho, country)`
- Objetivo futuro: pesquisar worldwide sem lista fixa de países

### 9.2 Autenticação / dashboard?

- JWT + bcrypt (`auth-supabase.js`)
- Roles: `admin` | `user`
- Rotas: `/dashboard-user`, `/admin`, `/bibliotecas`, `/pastas`, `/ouro`, `/top-25`
- SPY UI: `/spy`, `/spy/[id]`, `/spy/[id]/copy` — **admin only**
- Stripe: planos/pagamentos integrados
- SMTP Gmail: notificações SPY conclusão

### 9.3 API SPY (admin)

| Método | Rota | Função |
|--------|------|--------|
| GET | `/api/spy/config` | Status integrações |
| GET/POST | `/api/spy/sessions` | Listar/criar sessão |
| GET | `/api/spy/sessions/:id` | Detalhe sessão |
| GET | `/api/spy/sessions/:id/discoveries` | Discoveries |
| GET | `/api/spy/sessions/:id/copy-bank` | Copy bank |
| POST | `/api/spy/sessions/:id/pause\|cancel\|resume` | Controlar sessão |
| POST | `/api/spy/discoveries/import` | Importar para bibliotecas |

---

## 10. REFRESH BIBLIOTECAS 6×/DIA

### 10.1 Implementação

Ficheiro: `apps/api/auto-scraper-scheduler.js`

- Classe `AutoScraperScheduler` iniciada em `server.js` no boot
- `setInterval` cada **60 segundos** verifica horário
- Horários (hora local servidor):

| Hora | Nome |
|------|------|
| 08:00 | Manhã |
| 12:00 | Meio-dia |
| 16:00 | Tarde |
| 20:00 | Noite |
| 00:00 | Meia-noite |
| 04:00 | Madrugada |

### 10.2 Fluxo

1. `executeUpdate()` → `updateAllLibraries()` (`library-scraper-service.js`)
2. Para cada biblioteca: `scrapeFacebookAds(source_value)` via Puppeteer
3. Delay **2 segundos** entre bibliotecas
4. Actualiza `active_ads` + `ad_history` via `updateLibraryScrapeResult()`

### 10.3 Refresh manual

- UI: botão refresh por biblioteca + "refresh all"
- API: `POST /api/libraries/:id/refresh`, `POST /api/libraries/refresh-all`
- Next.js routes alternativas em `apps/web/app/api/`

### 10.4 Problemas conhecidos e notas de contagem

- Bloqueio Meta na VPS → refresh pode devolver 0 → **não sobrescrever** sem `likely_blocked` / histórico.
- UI Next.js deve fazer **proxy** para Express (`backend-proxy.ts`); `lib/scraper.ts` está obsoleto.
- **Contagem “perto mas errada”** (ex. 126 vs ~130, 652 vs ~650): a Meta arredonda no UI (`~X`); o JSON traz o valor exacto. O parser usa `metaDisplayRound()` e prioriza texto visível. **Ver:** [`LIBRARY-SCRAPER-NOTAS.md`](./LIBRARY-SCRAPER-NOTAS.md).

---

## 11. PIPELINE SPY (VISÃO GERAL)

```
ADMIN cria sessão (country, nicho, produto, keywordSeed)
         │
         ▼
┌─────────────────────────────────────────────┐
│ FASE 0 — Deep Search (Gemini/OpenRouter)    │
│ NÃO vai ao Facebook — gera keywords/intel   │
└─────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────┐
│ FASE 1 — Scrape keywords (Puppeteer)        │
│ facebook.com/ads/library?q=keyword          │
│ ← BLOQUEADO na VPS (IP datacenter)          │
└─────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────┐
│ FASE 2 — Análise relevância (Gemini)        │
│ Texto + imagem, skipVideo=true              │
│ Threshold score ≥ 0.35                      │
└─────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────┐
│ FASE 3 — Enrich (Puppeteer + heurísticas)   │
│ Conta ads ≥25, analyzeLibraryFromUrl        │
│ ← BLOQUEADO na VPS                          │
└─────────────────────────────────────────────┘
         │
         ▼
    Discoveries (TTL 30 dias) → Import → Bibliotecas
         │
         ▼
    Email SMTP conclusão + Copy Bank
```

### Quem faz o quê?

| Papel | Quem | Onde |
|-------|------|------|
| Pesquisar keywords (intel) | Gemini Deep Search | OpenRouter — não Facebook |
| Pesquisar no Facebook | Puppeteer | Ads Library URL |
| Analisar relevância | Gemini | OpenRouter — dados já extraídos |
| Extrair dados | Puppeteer parse HTML | Facebook |
| Enrich biblioteca | Puppeteer + heurísticas | Facebook + landings |

**Extrair** = scrape = converter páginas web em JSON (page_id, texto, URLs).  
**Analisar** = IA lê esse JSON e decide relevância.

---

## 12. ESTADO DAS SESSÕES SPY (BD)

| Sessão | País | Deep Search | Ads scanned | Discoveries |
|--------|------|-------------|-------------|-------------|
| PT | PT | OK | ~3699 | ~60 |
| BR | BR | OK | ~3380 | ~40 |
| GB | GB | failed (402) | 0 | 0 |

*(Sessões PT/BR correram antes do bloqueio VPS ou com IP funcional)*

---

## 13. DECISÕES DE PRODUTO JÁ TOMADAS

1. **Whisper OFF na fase SPY** — reservado para fase futura; custo proibitivo (~$4.50/514 req)
2. **Threshold relevância 0.35** — utilizador OK com falsos positivos, não subir
3. **MIN_ACTIVE_ADS = 25** — discovery só com biblioteca ≥25 ads
4. **Descobertas TTL 30 dias** — cleanup scheduler 6h
5. **Apify discutido mas não integrado** — código TS legado existe, não ligado ao SPY
6. **Worker em casa descartado** — tudo deve correr na VPS
7. **Proxy residencial rotativo** — opção preferida vs Apify para SPY+bibliotecas juntos
8. **Sem escolher país proxy manualmente** — rotativo worldwide + country na URL SPY

---

## 14. CUSTOS REAIS (REFERÊNCIA)

| Serviço | Custo |
|---------|-------|
| Apify scrape | ~$0.49 / 1.000 ads **extraídos** (não total Meta) |
| Gemini análise | ~$0.22 / 1.000 análises |
| Whisper | ~$0.009/vídeo — causa dos $4.50 históricos |
| Sessão SPY limitada | ~$0.30–0.50 total (Gemini, sem Whisper) |
| Proxy residencial $9/3GB | ~8–20 sessões SPY/mês (uso moderado) |

**Nota Apify:** Meta mostra "50.000 resultados" mas SPY extrai dezenas por keyword (12 scrolls) — não 50k. Sessão PT ~3700 ads ≈ $1.80 Apify, não $24/keyword.

---

## 15. GARGALO & PRÓXIMOS PASSOS SUGERIDOS

### Gargalo único

**Puppeteer bloqueado na VPS Contabo** — afecta SPY + refresh bibliotecas + enrich.

Gemini/OpenRouter, BD, UI, loop keywords — **funcionais**.

### Próximos passos (não implementados)

1. **`SPY_PROXY_URL`** centralizado — módulo browser partilhado por todos os scrapers
2. **Fix refresh bibliotecas** — não sobrescrever `active_ads` com 0 quando scrape falha
3. **Integração Apify opcional** — alternativa ao proxy
4. **puppeteer-extra stealth** na API (opcional, secundário vs proxy)
5. **Corrigir enrich JSON error**
6. **Unificar 4 launchers Puppeteer** num só módulo

### Opções proxy discutidas

| Opção | Veredicto |
|-------|-----------|
| ISP estático 1 país | Não serve worldwide |
| Residencial rotativo ~$9/3GB | Recomendado — IP muda sozinho |
| Apify | Plano B — ~$1–2/sessão SPY |
| Datacenter/IPv4/IPv6 | Não funciona com Meta |
| Worker em casa | Descartado pelo utilizador |

---

## 16. FICHEIROS-CHAVE (REFERÊNCIA RÁPIDA)

| Ficheiro | Responsabilidade |
|----------|------------------|
| `apps/api/spy-engine.js` | Orquestrador SPY (search loop + enrich worker) |
| `apps/api/spy-search-scraper.js` | Puppeteer keyword search + quickCount |
| `apps/api/spy-deep-search.js` | Deep Search Gemini |
| `apps/api/spy-ad-analyzer.js` | Relevância + extract keywords de ad text |
| `apps/api/spy-openrouter.js` | Gemini analyzeAd + Whisper |
| `apps/api/spy-openrouter-shared.js` | Config modelos OpenRouter |
| `apps/api/spy-db.js` | CRUD sessões, keywords, discoveries |
| `apps/api/spy-niche-intel.js` | Base persistente keywords por nicho |
| `apps/api/spy-url-builder.js` | URLs Ads Library |
| `apps/api/library-scraper-service.js` | Refresh automático bibliotecas |
| `apps/api/library-analyzer-service.js` | Análise completa biblioteca |
| `apps/api/auto-scraper-scheduler.js` | Cron 6×/dia |
| `apps/api/server.js` | Rotas API + boot schedulers |
| `apps/web/app/spy/[id]/page.tsx` | UI discoveries |
| `scripts/migrations/001-spy-tables.sql` | Schema SPY |
| `scripts/migrations/002-spy-niche-intel.sql` | Schema niche intel |
| `apps/api/src/services/scraper/apify-scraper.ts` | Apify legado — NÃO integrado |

---

## APÊNDICE A — Variáveis de ambiente relevantes

```
DATABASE_URL=postgresql://...
JWT_SECRET=...
PORT=4000
NODE_ENV=production
FRONTEND_URL=https://ecoomtaskforce.site
OPENROUTER_API_KEY=...
SPY_ANALYSIS_MODEL=google/gemini-2.0-flash-001
SPY_WHISPER_MODEL=openai/whisper-large-v3
SPY_NOTIFY_EMAIL=...
SMTP_HOST / SMTP_PORT / SMTP_USER / SMTP_PASS
STRIPE_PUBLISHABLE_KEY / STRIPE_SECRET_KEY / STRIPE_WEBHOOK_SECRET
SCRAPER_IMMEDIATE_START=true  # opcional — teste imediato scheduler
# NÃO EXISTE AINDA:
# SPY_PROXY_URL=...
# APIFY_API_TOKEN=...
```

---

## APÊNDICE B — Prompt sugerido para pesquisa de soluções (proxy/scraping)

```
Estou a construir uma ferramenta SaaS (ECOM TaskForce SPY) que monitoriza 
a Facebook Ads Library de forma autónoma. Preciso de comparar soluções 
para contornar bloqueios de scraping da Meta num VPS datacenter (Contabo).

CONTEXTO TÉCNICO:
- Stack: Node.js + Puppeteer (headless Chrome) num VPS Ubuntu
- Fluxo: pesquisa por keywords na Ads Library → extrai page_id, ad text, 
  imagens, URLs de biblioteca → IA (Gemini) analisa relevância → abre 
  bibliotecas de anunciantes para enrich (contar ads, analisar landings)
- Volume: ~20-50 keywords por sessão SPY, ~20-60 discoveries por sessão, 
  refresh de bibliotecas 6x/dia para clientes
- Países: worldwide (parâmetro country na URL da Ads Library, sem lista fixa)
- IA (OpenRouter/Gemini) já funciona; o problema é só o Puppeteer bloqueado 
  (Meta devolve "No ads match" / 0 resultados desde IP datacenter)

RESTRIÇÕES:
- Tudo deve correr na VPS (sem worker em casa)
- Não quero escolher país do proxy manualmente em cada sessão
- Orçamento preferencial: ~$9-30/mês
- Apify Facebook Ads Library scraper cobra ~$0.49/1000 ads extraídos 
  (não confundir com total de resultados mostrados pela Meta)

O QUE PRECISO QUE PESQUISES E COMPARES:
1. Proxy residencial rotativo vs Apify vs proxies ISP vs API oficial Meta
2. Se IP residencial rotativo de país aleatório funciona para pesquisar 
   qualquer country=XX na URL, ou se é obrigatório geo-matching IP↔país
3. Providers concretos com planos ~$9-30/mês, SOCKS5/HTTP, Puppeteer
4. Alternativas a Puppeteer (Apify, Bright Data Scraping Browser, etc.)
5. Estimativa bandwidth por sessão SPY para calcular quantas cabem em 3GB/mês
6. Riscos legais/ToS e boas práticas (rate limits, delays)

FORMATO: tabela comparativa + recomendação + passos implementação.
Não assumes 50.000 ads por keyword — pipeline limita a dezenas via scroll fixo.
```

---

*Documento gerado para partilha com Claude / plano de implementação.*  
*Projeto: ECOM TaskForce v2.0 — workspace `ECOOM TaskForce/`*
