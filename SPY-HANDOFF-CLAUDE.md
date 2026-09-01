# SPY — Handoff Completo (para Claude resolver com 1 prompt)

> **Estado:** 2026-06-01 23:17 (Europe/Lisbon). Atualizado após 2 fixes aplicados nesta sessão.
> **Objetivo:** dar contexto COMPLETO + TODOS os erros do módulo SPY para o Claude gerar um patch único que estabilize o pipeline de ponta a ponta.

---

## 0. TL;DR — onde estamos

O SPY descobre anunciantes "escalados" (≥20 ads ativos) na Facebook Ads Library, por nicho/país, usando o telemóvel do utilizador (dados móveis MEO) como ponte para contornar o bloqueio de IP-datacenter da Meta.

**JÁ CORRIGIDO nesta sessão (em produção):**
1. ✅ **Auto-delegação no agente do Mac** — jobs `keyword_search`/`library_page` já não fazem loop "Ponte móvel offline" (flag `directScrape`).
2. ✅ **Scroll de bibliotecas lento** — de ~58 scrolls (~60s) para ~14 scrolls (~15-23s) por biblioteca.
3. ✅ **Auto-reconnect da ponte** após deploy/restart da VPS.
4. ✅ **Endpoint liveness** + rehydrate de agentes em memória.

**AINDA PARTIDO (o que o Claude tem de resolver):**
- 🔴 **Worker crash / sessão estagna**: `TypeError: Cannot read properties of null (reading 'status')` no loop do motor → a sessão fica `running` para sempre sem progredir (confirmado: RELIGIOSO travou em `keywordsDone:9, discoveries:0`, sem logs há minutos).
- 🔴 **Enrich falha**: `insert or update on table "spy_discoveries" violates foreign key constraint "spy_discoveries_session_id_fkey"` → discoveries não são gravados.
- 🔴 **`countryFromSourceUrl is not a function`** (74×) no enrich.
- 🟠 Vários erros não-tratados que derrubam pedidos (ver secção 5).

---

## 1. Arquitetura

- **API:** Node.js/Express CommonJS, `apps/api/server.js` (porta 3001), PM2 `ecom-api`.
- **Web:** Next.js 14, `apps/web`, PM2 `ecom-web`.
- **DB:** PostgreSQL (tabelas `spy_*`).
- **IA:** OpenRouter / Gemini 2.5 Flash (filtro DR, deep search, scroll guiado).
- **VPS:** Contabo `173.249.32.180`; deploy `scripts/deploy-contabo.sh`; site https://ecoomtaskforce.site.
- **Ponte móvel:** Mac do utilizador + iPhone (hotspot USB, MEO). Processo local `scripts/spy-mobile-bridge-local.js` (`127.0.0.1:9780`).

### Porquê a ponte móvel
A Meta bloqueia IPs de datacenter (a VPS Contabo dá 0 ads). O scroll da Ads Library corre no **Mac via dados móveis** (IP residencial/móvel limpo). A VPS cria "jobs", o Mac reclama-os, executa o scrape e devolve o resultado.

```
VPS (motor SPY) ─cria job─► fila em memória (apps/api/spy-mobile-bridge.js)
      ▲                              │ GET /spy/mobile/jobs/claim
      │ POST /complete (ads)         ▼
      └──────────────── Mac executa scrape (dados móveis) ──┘
```

---

## 2. Pipeline (3 fases) — o que DEVE acontecer

| Fase | Ficheiro | O quê |
|------|----------|-------|
| 0. Deep Search | `spy-meta-scraper.js` + IA | Gera keywords do nicho adaptadas ao país/idioma (direct response) |
| 1. Scroll keyword | `scrapeKeywordSearchPhase` (`spy-meta-scraper.js`) | Scroll GraphQL da Ads Library **via ponte móvel** → metadados de ads |
| 2. Filtro IA (DR vs institucional) | `spy-meta-filter.js` | Gemini decide se cada ad é direct-response relevante |
| 3. Pull de bibliotecas | `spy-library-pull.js` | Para anunciantes relevantes: abre biblioteca 1×/`page_id`, **gate `SPY_MIN_ACTIVE_ADS=20`**, dedupe (`LibraryVisitRegistry`) |

**Regras de negócio:**
- Scroll de keyword vai **até esgotar**.
- Dropdown da UI = **objetivo de discoveries** (não limite de scroll).
- Nunca visitar 2× a mesma biblioteca (`page_id`).
- Scraper **100% próprio** (GraphQL Meta) — **sem Apify** (VPS não tem `APIFY_API_TOKEN`).
- Gate de 20 ads ativos é **intencional** (só anunciantes escalados). Confirmado que funciona: "Saber Cristão" tinha ~98 ads → qualifica; a maioria dos pequenos tem 0-6 → rejeitados.

---

## 3. FIXES APLICADOS nesta sessão (já em produção — NÃO refazer)

### 3.1 Auto-delegação (`directScrape`)
**Problema:** o agente do Mac, ao executar `keyword_search`, chamava `scrapeKeywordSearchPhase` que reavalia `isMobileBridgeRequired()` (=`true` no Mac, pois `SPY_REQUIRE_MOBILE_BRIDGE` não está definido lá) e `isBridgeReady()` (=`false`, o Mac não tem agentes em si próprio) → lançava "Ponte móvel offline" em loop para todas as keywords.

**Fix:**
- `apps/api/spy-meta-scraper.js`: flag `options.directScrape === true` em `scrapeKeywordSearchPhase` e `scrapeLibraryPagePhase` → salta verificação de ponte e vai direto a `withDirectBrowser` + `scrapeMetadataOnPage`.
- `scripts/spy-mobile-agent-core.js`: jobs `keyword_search` e `library_page` passam `directScrape: true`. Ramo morto `keyword_live` removido.
- VPS intacta (continua a delegar via `tryDelegateMobile`).

**Validado:** keyword "adelgazar" CO → 60 ads; biblioteca de anunciante ativo → 24 ads em 23s.

### 3.2 Scroll de bibliotecas (parar cedo)
**Problema:** `SPY_META_SCROLL_TO_END_STAGNANT=40` fazia ~58 scrolls "no vazio" mesmo para anunciantes com 2 ads (~60s/biblioteca). Com ~100 bibliotecas/keyword → horas.

**Fix em `apps/api/spy-meta-scraper.js` (dentro de `scrapeMetadataOnPage`):**
```js
const isLibraryScrape = options.label === 'library';
const libraryStagnant = parseInt(process.env.SPY_LIBRARY_SCROLL_STAGNANT || '8', 10) || 8;
const maxStagnant = isLibraryScrape
  ? Math.min(libraryStagnant, cfg.scrollToEndStagnant)
  : scrollToEnd ? cfg.scrollToEndStagnant : cfg.maxStagnant;
const maxScrollRounds = isLibraryScrape
  ? Math.max(maxStagnant * 3, 24)
  : scrollToEnd ? cfg.maxScrollRounds : maxStagnant * 4;
```
**Validado:** biblioteca passou de 58→14-20 scrolls (~15-23s). Keyword continua exaustivo.

### 3.3 Auto-reconnect + liveness (sessões anteriores)
- `scripts/spy-mobile-bridge-local.js`: auto-sync VPS a cada 30s, auto-resume do agente.
- `scripts/spy-mobile-agent-core.js`: `syncAgentWithVps`, `fetchVpsLiveness`.
- `apps/api/server.js`: `GET /api/spy/mobile/agent/liveness`.
- `apps/api/spy-mobile-bridge.js`: export `listLiveAgents`, rehydrate de agentes via heartbeat.
- `apps/api/spy-mobile-connect.js`: cache ip-api 90s.

---

## 4. 🔴 BUGS POR RESOLVER (prioridade para o Claude)

### 4.1 Worker crash → sessão estagna para sempre (CRÍTICO)
```
❌ SPY worker crash <sessionId>: TypeError: Cannot read properties of null (reading 'status')
```
- Ocorre no loop principal do motor (`apps/api/spy-engine.js`, ~linha 571+). O loop faz `session = await getSpySessionByIdOnly(sessionId); if (shouldStopSearch(session)) ...`. Quando `getSpySessionByIdOnly` devolve `null` (ou a sessão é apagada/indisponível momentaneamente), `shouldStopSearch(null)` ou `session.status` rebenta → o worker morre.
- **Efeito:** a sessão fica `running` na BD mas nada a processa. `resumeRunningSessions()` (server.js:1330) retoma no arranque, mas volta a crashar.
- **Evidência:** sessão RELIGIOSO `fe396b27` travou em `keywordsDone:9, adsScanned:1, discoveriesCount:0`, sem logs há minutos.
- **Fix sugerido:** guardas null-safe em todo o loop (`if (!session) break;`), try/catch por iteração que não mate o worker, e marcar a sessão `failed`/`completed` em vez de deixar `running` órfã. Considerar timeout/deadline por sessão.

### 4.2 Enrich → foreign key violation (discoveries não gravam)
```
❌ SPY enrich (<id>): insert or update on table "spy_discoveries"
   violates foreign key constraint "spy_discoveries_session_id_fkey"
```
- Tenta inserir discovery com `session_id` que não existe em `spy_sessions` (sessão apagada/cancelada antes do enrich assíncrono terminar, ou id errado).
- **Fix sugerido:** verificar existência da sessão antes do insert; ou apanhar o erro FK e descartar; garantir que o enrich usa o `sessionId` correto.

### 4.3 `countryFromSourceUrl is not a function` (74×)
```
❌ SPY enrich (ad ...): countryFromSourceUrl is not a function
```
- Função chamada no enrich mas não importada/exportada. Procurar em `spy-engine.js` / `spy-meta-extractor.js` / `spy-enrich*`. Corrigir o require/export ou implementar.

### 4.4 Outros erros não-tratados (derrubam pedidos)
| Erro | Nº | Provável causa |
|------|----|----------------|
| `page.waitForTimeout is not a function` | 138 | Puppeteer novo removeu `waitForTimeout`; usar `new Promise(r=>setTimeout(r,ms))`. Em scrapers legacy (`facebook-crawler.js`, `library-*`) |
| `RESIDENTIAL_PROXY_URL necessário...` | 130 | **Maioria são STALE** (antes do fix 3.1). Confirmar que pararam após o deploy |
| `Ponte móvel offline...` (keyword) | 37 | **STALE** (antes do fix 3.1) |
| `taskforceDir is not defined` | 3 | `ReferenceError` — variável não definida nalgum handler |
| `Invalid regular expression flags` (SyntaxError) | 20 | Regex construída dinamicamente com flags inválidas |
| `PayloadTooLargeError: request entity too large` | 5 | Resultado do job móvel demasiado grande no POST `/complete`; aumentar limite do body-parser OU `slimScrapePayload` mais agressivo |
| `Missing credentials for "PLAIN"` | 5 | SMTP não configurado → email de conclusão falha (não-bloqueante) |
| `ERR_TUNNEL_CONNECTION_FAILED` | 12 | Proxy residencial instável (`SPY_PROXY_URL`) |
| `null value in column "name" of relation "libraries"` | 2 | Insert de biblioteca sem `name` |
| `SPY mobile delegate (keyword_search): Erro interno do servidor` | 5 | 500 na VPS durante delegação |

---

## 5. Estrutural / tuning (não é bug)
- **Ritmo lento:** 1 só telemóvel verifica 1 biblioteca de cada vez (~15-23s). Uma keyword com 20+ anunciantes relevantes demora ~10-15 min. Inerente à ponte única.
- **Gate de 20 ads** é escolha de negócio. Em mercados pequenos (AR, CO) poucos anunciantes qualificam → poucos discoveries. Ajustável via `SPY_MIN_ACTIVE_ADS`.

---

## 6. Ficheiros-chave

### Backend `apps/api/`
| Ficheiro | Papel |
|----------|-------|
| `server.js` | Rotas; SPY mobile endpoints ~678-850; `resumeRunningSessions()` no boot (~1330) |
| `spy-engine.js` | **Motor.** Loop de keywords (~571), enrich, ROI. **← worker crash (4.1)** e markKeyword |
| `spy-search-scraper.js` | Dispatcher de scraper (`scrapeKeywordSearch` ~206) |
| `spy-meta-orchestrator.js` | Orquestra 3 fases (`collectKeywordAds` ~150, `scrapeKeywordSearchViaMeta` ~174) |
| `spy-meta-scraper.js` | Scrape GraphQL. `scrapeKeywordSearchPhase`, `scrapeLibraryPagePhase`, `scrapeMetadataOnPage`, `withDirectBrowser`. **← fixes 3.1/3.2** |
| `spy-meta-filter.js` | Fase 2 — filtro IA DR |
| `spy-library-pull.js` | Fase 3 — pull bibliotecas + gate ads ativos |
| `spy-library-ai-scraper.js` | `runAiGuidedScrollLoop`, `isLibraryAiEnabled` (scroll guiado por IA) |
| `spy-library-visit-registry.js` | Cache visitas por `page_id` |
| `spy-meta-extractor.js` | Enrich a partir de metadados (**← countryFromSourceUrl?**) |
| `spy-mobile-bridge.js` | Lado VPS: agentes, fila jobs, heartbeat, `isBridgeReady`, `listLiveAgents`, `submitMobileJob` |
| `spy-mobile-delegator.js` | `tryDelegateMobile(type, payload, timeout)` |
| `spy-mobile-connect.js` | Deteção IP móvel (ip-api, cache 90s) |
| `spy-mobile-agent-store.js` | Persistência de agentes registados |
| `spy-db.js` | Acesso DB; `markKeyword` (~192) |
| `spy-notify.js` | Email conclusão (SMTP **off**) |
| `spy-url-builder.js` | `buildAdsLibrarySearchUrl`, `buildPageLibraryUrl` |

### Mac `scripts/`
| Ficheiro | Papel |
|----------|-------|
| `spy-mobile-bridge-local.js` | Servidor local 9780; auto-sync VPS; endpoints `/status`,`/activate`,`/reconnect` |
| `spy-mobile-agent-core.js` | Loop do agente: heartbeat, claim, executa jobs (`keyword_search`/`library_page` com `directScrape:true`), complete |
| `deploy-contabo.sh` | Deploy (rsync + build + pm2; exclui `data/`) |

### Frontend `apps/web/app/spy/`
`page.tsx`, `[id]/page.tsx`, `SpyMobileBridge.tsx`.

---

## 7. Schema DB (relevante)

**`spy_sessions`**: `id, user_id, name, status(queued→running→completed/failed/cancelled), country, language, keyword_seed, nicho, produto, pause_search, stats(jsonb), error_message, started_at, ended_at, deadline_at, created_at, updated_at`
- `stats` jsonb: `keywordsDone, keywordsQueued, adsScanned, adsRelevant, discoveriesCount, librariesChecked, marketIntel, live{phase,message}`.

**`spy_keywords`**: `id, session_id, keyword, status(pending→running→done/failed), source(seed/learned/deep), ads_found, priority, ads_relevant, discoveries_count, created_at`.

Outras: `spy_ad_candidates`, `spy_discoveries` (**FK session_id → ver 4.2**), `spy_learned_terms`, `spy_meta_staging`, `spy_niche_intel` (ROI keywords por nicho/país).

---

## 8. Variáveis de ambiente (VPS `env-config`)

```bash
SPY_SCRAPER=meta
SPY_REQUIRE_MOBILE_BRIDGE=true        # NÃO definido no Mac (default true → causou o bug 3.1)
SPY_MOBILE_AGENT_SECRET=***
SPY_MOBILE_HEARTBEAT_TTL_MS=180000
SPY_MOBILE_JOB_TIMEOUT_MS=600000
SPY_PUBLIC_API_URL=https://ecoomtaskforce.site/api
SPY_ANALYSIS_MODEL=google/gemini-2.5-flash
SPY_AI_API_KEY=***                    # OpenRouter
SPY_PROXY_URL=***                     # proxy residencial (instável)
SPY_MIN_ACTIVE_ADS=20                 # gate ads ativos (Fase 3)
SPY_MAX_KEYWORDS=50
SPY_MAX_LEARNED_KEYWORDS=15
SPY_META_MAX_ADS_DEFAULT=10000
SPY_META_BATCH_SIZE=50
SPY_META_PHASE1_COLLECT_CAP=600
SPY_META_MAX_SCROLL_ROUNDS=200
SPY_META_SCROLL_TO_END_STAGNANT=40    # keyword exaustivo
SPY_LIBRARY_SCROLL_STAGNANT=8         # NOVO (fix 3.2) — bibliotecas param cedo
SPY_META_MAX_STAGNANT=8
SPY_LIBRARY_MAX_DETAIL_FETCHES=100
SPY_LIBRARY_AI_MAX_ROUNDS=120
SPY_FAST_DISCOVERY=true
SPY_ENRICH_CONCURRENCY=3
SPY_NOTIFY_EMAIL=geral.joaoecoom@gmail.com
# SEM APIFY_API_TOKEN; SEM SMTP configurado
```

---

## 9. Comandos úteis

```bash
# Deploy (reinicia API → retoma sessões running)
bash scripts/deploy-contabo.sh

# Ponte local no Mac
node scripts/spy-mobile-bridge-local.js
curl -s http://127.0.0.1:9780/status | jq

# Logs VPS
ssh -i ~/.ssh/contabo-taskforce/id_ed25519 root@173.249.32.180 "pm2 logs ecom-api --lines 100 --nostream"
ssh ... "tail -50 /root/.pm2/logs/ecom-api-error.log"

# DB
source /var/www/ecom-taskforce/env-config
psql "$DATABASE_URL" -c "SELECT id,status,nicho,country,stats->'keywordsDone',stats->'discoveriesCount' FROM spy_sessions ORDER BY created_at DESC LIMIT 5;"
psql "$DATABASE_URL" -c "SELECT status,count(*) FROM spy_keywords WHERE session_id='<ID>' GROUP BY status;"
```

---

## 10. PROMPT sugerido para o Claude

> Corrige o módulo SPY (Node.js CommonJS) com um patch único, sem alterar o comportamento já correto (fixes da secção 3 estão OK). Prioridades:
>
> 1. **(CRÍTICO) Worker crash em `apps/api/spy-engine.js`** — `TypeError: Cannot read properties of null (reading 'status')` no loop de keywords (~linha 571+). Tornar todo o loop null-safe: se `getSpySessionByIdOnly` devolver null, sair limpo; `shouldStopSearch` deve aceitar null; envolver cada iteração em try/catch que NÃO mate o worker; ao terminar/falhar, marcar a sessão `completed`/`failed` (nunca deixar `running` órfã). Adicionar deadline por sessão.
> 2. **Enrich FK violation** — antes de inserir em `spy_discoveries`, validar que a sessão existe; apanhar o erro de foreign key e descartar sem crashar.
> 3. **`countryFromSourceUrl is not a function`** — corrigir import/export ou implementar a função usada no enrich (`spy-meta-extractor.js`/`spy-engine.js`).
> 4. **`page.waitForTimeout is not a function`** — substituir por `await new Promise(r => setTimeout(r, ms))` nos scrapers legacy.
> 5. **`PayloadTooLargeError`** no POST `/spy/mobile/jobs/:id/complete` — aumentar limite do body-parser (ex.: `express.json({ limit: '25mb' })`) e/ou tornar `slimScrapePayload` mais agressivo.
> 6. **`taskforceDir is not defined`** e **`Invalid regular expression flags`** — localizar e corrigir.
> 7. (Opcional) Marcar sessões `running` órfãs (sem progresso há > X min) como `failed` no boot, em vez de retomar em loop de crash.
>
> Restrições: CommonJS (`require`/`module.exports`), comentários em português, não tocar em `spy-mobile-bridge.js`/`spy-mobile-delegator.js`/agente do Mac (já corrigidos). Validar: lançar sessão e confirmar `keywordsDone` a subir, discoveries gravados, zero crashes no error log.

---

## 11. Histórico de sessões (evidência)

| Sessão | País | Status | kd | ads | disc | Nota |
|--------|------|--------|----|-----|------|------|
| `fe396b27` | AR RELIGIOSO | running (estagnada) | 9 | 1 | 0 | worker crash (4.1); "Saber Cristão ~98 ads" qualificava |
| `77abd953` | CO EMAGRECIMENTO | completed | 0 | 0 | 0 | bug auto-delegação (corrigido em 3.1) |
| `b6043f8b` | PT EMAGRECIMENTO | failed | 19 | 28 | 5 | proxy residencial caiu |
| `f8771130` | BR EMAGRECIMENTO | completed | 228 | 3380 | 40 | ✅ pipeline funcionou (mercado grande) |

A sessão BR (40 discoveries) prova que o pipeline está conceptualmente correto; o que falta é estabilidade (secção 4).
