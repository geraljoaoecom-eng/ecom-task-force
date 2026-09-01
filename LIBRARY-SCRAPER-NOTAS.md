# Biblioteca de Anúncios — notas para refresh / contagem

Documento de referência para quem mantém o scraper de bibliotecas (`library-scraper-service.js`, `ad-count-parser.js`).

---

## Contagem “perto mas errada” (~130 vs 126) — **não é bug grave**

A Meta mostra **dois números** na mesma página:

| Fonte | Exemplo | Significado |
|--------|---------|-------------|
| **Texto visível** | `~130 resultados` | Número **público**, arredondado. O `~` = aproximado. |
| **JSON embutido** | `search_results_connection.count: 126` | Total **exacto** no momento do scrape. |

Padrão típico:

| UI Meta | JSON exacto | Badge correcto |
|---------|-------------|----------------|
| ~130 | 126 | **130** |
| ~250 | 245 | **250** |
| ~650 | 652 | **650** |

### Regra implementada (`ad-count-parser.js`)

1. Se existir texto `~X resultados` → usar **X** (o que o utilizador vê).
2. Se só existir JSON → aplicar `metaDisplayRound()` (arredondamento estilo Meta):
   - &lt; 1000 → múltiplos de **10**
   - 1000–9999 → múltiplos de **50**
   - etc.
3. Se texto e JSON diferirem ≤ 15 → preferir o **texto**.
4. **Não** confundir a palavra “Anúncios” no menu com contagem — exige dígitos no match.

### Campo `notes` na UI

O texto `~120 anúncios ativos na biblioteca...` nas notas é da **importação antiga**. O refresh **não actualiza** `notes`; só `active_ads` e `ad_history`. Divergência notas vs badge é esperada até alguém editar as notas.

---

## Arquitectura refresh (evitar regressões)

| Caminho | Usar? |
|---------|--------|
| `apps/api/library-scraper-service.js` (Express :4000) | ✅ **Sim** |
| `apps/web/lib/scraper.ts` | ❌ **Obsoleto** — não usar |
| UI Next.js | Deve fazer **proxy** via `apps/web/lib/backend-proxy.ts` → Express |

Rotas Next que devem usar `proxyToBackend`:

- `apps/web/app/api/libraries/[id]/refresh/route.ts`
- `apps/web/app/api/libraries/refresh-all/route.ts`
- `apps/web/app/api/libraries/route.ts` (POST, scrape após criar)

---

## URL e país

- Refresh por `page_id`: `active_status=active` (só activos).
- País: respeitar `country=` da URL guardada; senão `paises` da biblioteca (BR por defeito; ALL se WW).
- `active_status=all` + `country=ALL` **inflaciona** contagens (ex. 6000 vs ~130).

Ficheiros: `spy-url-builder.js`, `library-url-utils.js`.

---

## Bloqueio Meta na VPS

- Muitos scrapes seguidos → página “nenhum anúncio corresponde” mas JSON ainda tem dados.
- **Não** gravar 0 se `likely_blocked` ou JSON &gt; 0 com shell vazia.
- `getPreviousAdCount()` usa pico em `ad_history` quando `active_ads` já foi zerado por engano.
- Evitar “Atualizar todas” em massa quando o IP estiver limitado.

---

## Testes rápidos (VPS)

```bash
cd /var/www/ecom-taskforce/apps/api
node -e "const {metaDisplayRound}=require('./ad-count-parser'); console.log(metaDisplayRound(126), metaDisplayRound(652));"
node -e "require('dotenv').config({path:'../../env-config'}); require('./library-scraper-service').updateSingleLibrary('LIBRARY_ID').then(console.log);"
```

Última actualização: 2026-06-01 (arredondamento Meta + proxy UI→API).
