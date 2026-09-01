# SPY — CHECKPOINT 5/06 (estado known-good)

> **Este é o ponto de referência de "está a funcionar bem".**
> Antes de qualquer alteração ao SPY, lê os **INVARIANTES** abaixo. Se uma alteração os
> violar, vais reintroduzir bugs que já foram caçados. Validado em produção a 2026-06-05
> em **dois mercados** (ZA·Inglês e AO·Português): filtros, paragem, país e velocidade todos certos.

---

## 1. Como funciona (fluxo end-to-end)

```
Form web (1 pesquisa unificada — filtros opcionais, em branco = amplo)
  → POST /api/spy/sessions (server.js)  [guarda country, language, nicho, produto,
                                          discoveryTarget, minActiveAds, maxHours, marketIntel, ctaHunt]
  → createSpySession → spy_sessions.stats
  → startSpySession → runSearchLoop (spy-engine.js)
       ├─ resolve keywords (manual / GPT deep search / CTA Hunt) → spy_keywords
       ├─ resolveTargetCountries(session): país definido → [país];
       │     só idioma → países da língua por interesse DR (Language Sweep); nada → ['ALL']
       ├─ fan-out keyword × país (coluna spy_keywords.country), ordem country-major
       └─ por cada keyword:
            buildAdsLibrarySearchUrl(keyword, kwCountry)
            → scrapeKeywordSearch → orchestrator → cria job móvel (payload inclui
              criteria, minActiveAds, discoveryTarget restante)
            → AGENTE Mac (launchd) faz tudo localmente:
                 scroll keyword (browser directo, dados móveis MEO)
                 → a cada dobra: filtra DR (POST /spy/filter-batch → Gemini/heurística)
                 → relevante → checkLibrary EM PARALELO (browser separado, mesmo país da pesquisa)
                 → ≥ minActiveAds → discovery → POST /spy/mobile/jobs/:id/partial
                 → ATINGE objectivo → pára scroll + descarta fila
            → engine grava discovery (saveIncrementalDiscovery) com país e link correctos
            → objectivo atingido → break → marca sessão "completed"
```

**Agente Mac:** `scripts/spy-mobile-agent.js`, gerido por **launchd** (auto-restart, persistente).
Corre a partir do repo LOCAL, usando `apps/api/*` locais. **O deploy ao VPS NÃO o reinicia** —
reiniciar com `launchctl kickstart -k gui/$(id -u)/site.ecoomtaskforce.spy-agent`. Logs em `/tmp/spy-agent.log`.

---

## 2. INVARIANTES (não regredir — cada um corrige um bug real de 5/06)

1. **`server.js` POST /sessions TEM de ler e passar `minActiveAds` E `maxHours`** ao
   `createSpySession`. Se faltarem, o form é ignorado → usa default 25 ads / 8h.

2. **Browser do agente NÃO pode serializar scroll vs biblioteca.**
   `spy-meta-scraper.js` → `ensureDirectBrowser()` serializa **só o arranque**; `withDirectBrowser`
   corre os `fn` em paralelo (abas separadas). Um mutex no `fn` inteiro faz as bibliotecas
   só correrem DEPOIS do scroll inteiro (lento, 0 discoveries em keywords amplas).

3. **País do link da biblioteca = país da PESQUISA, sempre.**
   `buildPageLibraryUrl(pageId, country)` tem **default 'BR'** — perigoso. No agente,
   `checkLibrary` **constrói sempre** `buildPageLibraryUrl(pid, libCountry)` (ignora `ad.libraryUrl`,
   que vem com BR do scraper) e grava `enriched.libraryUrl` + `enriched.searchCountry`.
   No engine, `saveIncrementalDiscovery` usa `session.country || enriched.searchCountry`.

4. **`discoveryTarget` (objectivo restante) TEM de chegar ao agente** para parar cedo.
   Cadeia: engine (`remainingTarget`) → scrapeKeywordSearch → orchestrator → payload.options.discoveryTarget
   → agente (`stopTarget`). O agente pára o scroll (`livePipeline.shouldStop`) e descarta a fila.
   Sem isto, uma keyword ampla traz dezenas de discoveries antes de o motor verificar o alvo.

5. **Conclusão da sessão não pode ficar presa no wait de enrich.**
   `spy-engine.js` pós-loop: sai do wait quando `!enrichWorkers.has(sessionId)` (sem worker, nada
   drena a fila) e faz `enrichQueues.delete`. Senão fica até 1h em "A pesquisar" apesar de concluído.

6. **`apps/api/package.json` TEM de listar as deps de runtime do server.js (JS):**
   `pg, bcryptjs, jsonwebtoken, nodemailer, sqlite3, stripe, @sendgrid/mail, @supabase/supabase-js`.
   O `package.json` é de um servidor Prisma/TS diferente; sem estas, o `npm install` do deploy
   **poda-as** e a API entra em crash-loop (`Cannot find module 'pg'/'bcryptjs'`).

---

## 3. Funcionalidades (todas a funcionar)

- **Form unificado** (`apps/web/app/spy/page.tsx`): sem tabs de "modo". Filtros opcionais;
  validação relaxada (basta país | idioma | nicho | produto | keywords | CTA). Em branco = amplo.
- **Language Sweep** (`apps/api/spy-language-markets.js`): `LANGUAGE_MARKETS` + `resolveTargetCountries`.
  Idioma sem país → varre países dessa língua por ordem de interesse DR (cap `SPY_SWEEP_MAX_COUNTRIES=8`).
- **CTA Hunt** (`apps/api/spy-cta-keywords.js`): frases de CTA por tipo de funil (quiz/vsl/lead/venda/sorteio)
  em PT/EN/ES; somam-se às keywords (não substituem). Bloco multi-select no form.
- **Spot de Tendências e Novidades** (`apps/api/spy-trends.js` + `SpyTrendsPanel.tsx`):
  LLM avalia discoveries recentes → "o que está a bater" + "o que vai bater". Recompute 30min + debounce.
  Endpoint `GET /api/spy/trends`.

---

## 4. Valores/config conhecidos (5/06)

- `MAX_LIB = 5` (bibliotecas em paralelo no agente) — `spy-mobile-agent.js`
- `onBatch` dispara a CADA scroll com ads novos (sem `flushSize`) — `spy-meta-scraper.js`
- `minActiveAds`: vem do FORM (não hardcoded). Default 25 se não definido.
- `discoveryTarget`: do form ('unlimited' ou número). Stop-at-target activo.
- `spy_keywords` tem coluna `country`; índice único `(session_id, keyword, country)`.

---

## 5. Deploy & operação

**Deploy cirúrgico da API (rápido, sem rebuild web):**
```
rsync -avz -e "ssh -i ~/.ssh/contabo-taskforce/id_ed25519" \
  --exclude node_modules --exclude .env \
  "apps/api/" root@173.249.32.180:/var/www/ecom-taskforce/apps/api/
ssh ... "pm2 restart ecom-api"
```
- **Deploy completo:** `scripts/deploy-contabo.sh` (rsync `--delete` local→VPS + `npm install` + build web ~15min).
  ⚠️ `--delete` apaga ficheiros que só existam no VPS. O repo LOCAL é a fonte de verdade.
- **Reiniciar agente Mac:** `launchctl kickstart -k "gui/$(id -u)/site.ecoomtaskforce.spy-agent"`.
  Nunca lançar o agente à mão em paralelo (duplica o agentId → baralha jobs/heartbeats).
- **Verificar uma corrida ao vivo:** `tail -f /tmp/spy-agent.log` — procurar `📚 ads activos (mín N)`,
  `🎯 Discovery #`, `⏹️ Objectivo atingido`.

**Gotcha operacional:** matar o agente a meio de um job deixa um **job órfão** no VPS que segura
o semáforo do motor (`SPY_META_MAX_PARALLEL=2`) até ~15min de timeout, bloqueando novas pesquisas.
Se isso acontecer, `pm2 restart ecom-api` limpa o estado em memória.

---

## 6. Ficheiros tocados nesta sessão (5/06)

**Novos:** `spy-language-markets.js`, `spy-cta-keywords.js`, `spy-trends.js`, `components/SpyTrendsPanel.tsx`.
**Editados:** `server.js` (minActiveAds/maxHours/ctaHunt + endpoints trends/sweep-preview),
`spy-engine.js` (sweep, fan-out, país do discovery, discoveryTarget, fix conclusão),
`spy-meta-scraper.js` (browser paralelo, shouldStop, payload discoveryTarget),
`spy-meta-orchestrator.js` (forward criteria + discoveryTarget),
`spy-db.js` (coluna country, applySweepCountryOrder, markKeyword por país),
`scripts/spy-mobile-agent.js` (país certo na biblioteca, MAX_LIB=5, stop-at-target),
`apps/api/package.json` (deps em falta), `apps/web/lib/api.ts`, `context/SpyJobContext.tsx`.
