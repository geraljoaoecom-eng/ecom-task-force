# Prompt: Problemas com Proxy ISP — ECOM TaskForce SPY & Refresh

> Documento de contexto para debugging, decisões de arquitectura ou handoff a outro agente/desenvolvedor.
> **Projeto:** ECOM TaskForce · **Site:** https://ecoomtaskforce.site · **VPS:** Contabo `173.249.32.180`
> **Stack:** Express `:4000` + Next.js `:3000` + PostgreSQL + PM2 (`ecom-api`, `ecom-web`)

---

## Prompt (copiar e usar)

```
Estou a desenvolver o ECOM TaskForce — uma plataforma de monitorização de bibliotecas de anúncios da Meta (Facebook Ad Library).

Temos dois fluxos de scraping com Puppeteer (puppeteer-extra + stealth):

1. REFRESH DE BIBLIOTECAS — actualiza o campo `active_ads` de ~107 bibliotecas guardadas por `page_id`
2. SPY — pesquisa por keywords na Ad Library, extrai page_ids, analisa relevância e enriquece ads

Ambos correm na VPS Contabo (IP datacenter). Configurámos um proxy ISP residencial (~$3/mês) via env `SPY_PROXY_URL` / `SPY_PROXY_URLS`.

PROBLEMAS QUE ESTAMOS A ENFRENTAR COM O ISP:

---

### 1. Dois tipos de bloqueio da Meta (comportamentos diferentes)

A Meta trata de forma distinta:
- URLs por **page_id** (`view_all_page_id=...`) — scrape de contagem de uma página específica
- URLs por **keyword** (`q=...&search_type=keyword_...`) — pesquisa SPY

**Sintoma A — Bloqueio parcial (page_id):**
- UI visível: "No ads match" / "Nenhum anúncio corresponde"
- HTML embebido: `"search_results_connection":{"count":445,"edges":[]}`
- Os ads NÃO renderizam no DOM (`edges: []`) mas o count real está no JSON
- Fix: parser deve ler `search_results_connection.count` do HTML antes de confiar no texto visível

**Sintoma B — Bloqueio total (via proxy ISP em page_id):**
- UI: "No ads match"
- HTML: `"search_results_connection":{"count":0}` — count zero no JSON também
- Nome do anunciante nem aparece no HTML (`hasRenan: false`)
- Exemplo: Renan Botelho Dr — proxy devolvia 0, browser real do utilizador mostrava ~680 resultados

**Sintoma C — Bloqueio datacenter (VPS sem proxy em keyword search):**
- Pesquisa por keyword na VPS Contabo devolve 0 ads / "No ads match"
- Foi o problema original que levou à adopção do proxy ISP

---

### 2. O proxy ISP piora o refresh de bibliotecas (page_id)

Descoberta crítica em testes A/B (Renan Botelho Dr, page_id=378128628724966):

| Método de ligação | Count obtido | Estado |
|-------------------|-------------|--------|
| Proxy ISP         | 0           | Falso zero — bloqueio total |
| IP directo VPS    | 684         | Correcto — alinhado com browser real (~680) |

Isto aconteceu também em massa: refresh completo via proxy zerou dezenas de bibliotecas activas (64 com 0 de 107). Com IP directo da VPS recuperámos 89/107 com ads e 53.011 ads totais.

**Conclusão:** Para refresh por `page_id`, o IP da VPS funciona MELHOR que o proxy ISP. O proxy estava a sabotar os resultados.

**Solução implementada:**
- `library-scraper-service.js` → `launchBrowser({ useProxy: false })`
- `spy-search-scraper.js` → `launchBrowser()` com proxy (default quando `SPY_PROXY_URL` definido)

---

### 3. Degradação do proxy após uso intensivo

Após ~107 scrapes seguidos com proxy ISP:
- O proxy passou a devolver `count: 0` para TUDO, incluindo bibliotecas que antes funcionavam (ex.: Homemade Method: 445 → 0)
- Suspeita: rate limit ou flag temporário do IP do proxy pela Meta
- Sem mecanismo de health check — o sistema gravava zeros silenciosamente na BD

**Protecções implementadas:**
- `applyScrapeResult()`: se scrape devolve 0 mas BD tinha ≥50 ads, mantém valor anterior
- Parser: prioriza JSON embebido sobre texto "No ads match"
- Retry: directo primeiro, proxy só como fallback em scrape individual

**Protecções em falta (ainda não implementadas):**
- Health check do proxy antes de correr SPY
- Alerta na UI quando proxy offline
- Rotação automática entre múltiplos ISPs (`SPY_PROXY_URLS`)
- Cooldown entre batches grandes

---

### 4. Single point of failure no SPY

Arquitectura actual:
- Refresh bibliotecas → IP VPS directo ✅ (independente do ISP)
- SPY keyword search → Proxy ISP ⚠️ (dependente do ISP)

Se o ISP falhar:
- Refresh continua a funcionar
- SPY fica completamente cego — VPS sozinha não consegue keyword search (bloqueio datacenter confirmado)

Fallback VPS no SPY provavelmente NÃO funciona para keywords. Precisamos de redundância no ISP, não de fallback para VPS.

---

### 5. URLs heterogéneas na BD complicam o refresh

Das 107 bibliotecas, nem todas usam `view_all_page_id`:
- ~90% são URLs limpas por page_id → funcionam bem com VPS directo
- Algumas são URLs por keyword (ex.: `q="PP.MENSHEALTHELEVATE.COM"`) → precisam de proxy ISP ou outra abordagem
- Entradas de teste/lixo ("teste fff", "aaaaa") poluem estatísticas
- Duplicados (ex.: 2x "Natalia Beauty" com page_ids diferentes)

---

### 6. Inconsistência de locale e filtros

Browser real do utilizador (PT):
- Mostra "~680 resultados" em português
- Filtros: "Tudo" + "Todos os anúncios" → `active_status=all`, `country=ALL`

Scraper original:
- `active_status=active` (só activos, não "todos")
- Headers sem `Accept-Language: pt-BR`
- User-Agent Chrome 124 genérico

Fixes aplicados:
- `buildPageLibraryUrl()` → `active_status=all`
- `Accept-Language: pt-BR,pt;q=0.9,en-US;q=0.8`
- Parser aceita "resultados" e "results"

---

### 7. Credenciais e env

- Proxy ISP configurado em `env-config` na VPS (NÃO commitar credenciais)
- `OPENROUTER_API_KEY` foi perdido num deploy rsync que sobrescreveu env — verificar se SPY IA funciona
- Deploy script (`scripts/deploy-contabo.sh`) agora exclui `env-config` e `.env` do rsync

Formato proxy:
```
SPY_PROXY_URL="http://USER:PASS@IP:PORT"
SPY_PROXY_URLS="http://user1:pass1@ip1:port1,http://user2:pass2@ip2:port2"
```

---

## Ficheiros relevantes

| Ficheiro | Função |
|----------|--------|
| `apps/api/browser-manager.js` | Launch Puppeteer + proxy opcional (`useProxy: true/false`) |
| `apps/api/library-scraper-service.js` | Refresh bibliotecas — **sem proxy** |
| `apps/api/spy-search-scraper.js` | SPY keyword scrape — **com proxy** |
| `apps/api/ad-count-parser.js` | Parse count (JSON embebido + texto visível) |
| `apps/api/library-url-utils.js` | Normaliza URLs via page_id |
| `apps/api/spy-url-builder.js` | Constrói URLs Ad Library |
| `apps/api/test-proxy.js` | Teste manual do proxy |

---

## Estado actual (pós-fix)

- Refresh 107/107 com VPS directo: 89 com ads, 18 com 0, ~53k ads totais, ~5 min
- 10 bibliotecas que estavam falsamente a 0 foram recuperadas (Renan 684, Guilherme 526, etc.)
- SPY ainda depende 100% do proxy ISP — não testado end-to-end após split directo/proxy

---

## O que preciso de resolver

1. Como garantir que o SPY funciona de forma fiável com proxy ISP (health check, rotação, retry)?
2. Como tratar bibliotecas com URL por keyword no refresh (precisam de proxy)?
3. Vale a pena um segundo ISP (~$6/mês total) vs Apify como fallback?
4. Como detectar bloqueio parcial vs total vs zero real sem falsos positivos?
5. Normalizar todas as URLs da BD para `view_all_page_id` onde possível?

Responde com diagnóstico técnico, opções priorizadas e código concreto se aplicável.
```

---

## Resumo rápido (para referência humana)

| Fluxo | Ligação | Funciona? | Risco |
|-------|---------|-----------|-------|
| Refresh `page_id` | VPS directo | ✅ Sim | Baixo |
| Refresh `page_id` | Proxy ISP | ❌ Pior — falsos zeros | Alto |
| SPY keyword | Proxy ISP | ✅ (quando ISP saudável) | Médio |
| SPY keyword | VPS directo | ❌ Bloqueado | — |
| Refresh keyword URL | VPS directo | ❌ Parcial/zero | Alto |
| Refresh keyword URL | Proxy ISP | ⚠️ Instável | Alto |

**Regra de ouro:** ISP para SPY, VPS para refresh — mas o ISP precisa de redundância e monitoring porque é SPOF do SPY.
