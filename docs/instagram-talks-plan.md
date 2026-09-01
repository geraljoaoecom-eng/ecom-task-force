# Instagram Talks — Plano

Feature sob a aba **Study**: prospeção de influencers/experts + envio de DMs +
funil de conversa automático (tipo ManyChat, mas com descoberta e seleção incluídas).

## Decisões fechadas
- **Envio de DM:** automação NÃO-oficial com a sessão da própria conta IG (cold DM real).
  Viola os ToS do Instagram → todo o sistema é desenhado à volta de **segurança da conta**.
- **Descoberta:** scraper próprio (Puppeteer + stealth via `browser-manager.js`),
  protegido com **IP móvel** reaproveitando o `network-check` do SPY.
- **Funil:** sequência de steps configurável (send / wait / ask / branch por keyword ou
  intenção via Gemini / tag / handoff / end). Guardado em **JSONB** para evoluir
  depois para um flow builder visual sem migração de schema.
- **Escala:** 1 conta IG agora, arquitetura preparada para multi-conta.
- **Login:** user/pass no painel → login via browser → cookies cifrados (AES-256-GCM) em DB.
  Primeiro login em IP móvel; UI trata 2FA/challenge; cookies reutilizados sempre.
- **AI:** Gemini 2.5-flash via Vertex (classificar nicho + intenção de respostas).

## Segurança da conta (princípios)
- **Gate de IP móvel** — nenhuma ação acontece em WiFi (reusa `/api/spy/network-check`).
- **Delays humanos randomizados** entre ações (nunca fixos).
- **Caps diários por conta** + **warmup** progressivo.
- **Kill-switch** — checkpoint/challenge/rate-limit → conta em pausa + notificação (SMTP).
- Tudo reversível, com logs e screenshots de debug em falha.

## Arquitetura

### Frontend (`apps/web/app/study/instagram-talks`)
Sub-tabs: `descoberta` · `prospects` · `campanhas` · `funis` · `inbox` · `definicoes`.

### Backend (`apps/api`, Express CommonJS, padrão `spy-*.js`)
| Ficheiro | Responsabilidade |
|---|---|
| `ig-crypto.js` | Cifra/decifra cookies de sessão (AES-256-GCM, chave `IG_SESSION_KEY`) |
| `ig-db.js` | Schema (`ensureIgTables`) + CRUD de contas/prospects/campanhas/funis/conversas |
| `ig-session.js` | Login + 2FA + persistência de sessão + ler inbox + enviar DM (web private API) |
| `ig-discovery.js` | (Fase 1) scraper keyword/hashtag → perfis |
| `ig-enrich.js` | (Fase 1) followers, bio, nicho (Gemini), score |
| `ig-sender.js` | (Fase 2) fila de envio + rate-limit + delays + warmup + caps |
| `ig-inbox-poller.js` | (Fase 3) poll periódico da inbox por respostas |
| `ig-funnel-engine.js` | (Fase 3) runtime do funil sobre as respostas |

### Base de dados (PostgreSQL)
`ig_accounts`, `ig_prospects`, `ig_campaigns`, `ig_campaign_targets`,
`ig_funnels` (steps JSONB), `ig_conversations`, `ig_messages`, `ig_send_queue`.

## Fases
0. **Fundação** *(esta entrega)* — schema + login/sessão + 2FA + gate IP móvel + provar
   ler inbox e enviar 1 DM de teste.
1. Descoberta + enriquecimento + lista selecionável.
2. Envio: fila + rate-limit + delays + warmup + caps + kill-switch.
3. Funil + poller + engine que atua nas respostas.
4. Inbox UI, analytics, multi-conta.

## Notas de implementação
- Ler inbox / enviar DM via **web private API** do IG (endpoints `/api/v1/direct_v2/...`)
  dentro do contexto autenticado da página — mais estável que scraping de DOM.
- Selectors de login e endpoints privados **precisam de calibração ao vivo** na VPS
  (IG muda DOM/headers com frequência). Há screenshots de debug em falha.
- `IG_SESSION_KEY` (32 bytes) deve ir para `secrets/CREDENCIAIS-PRODUCAO.env`.
