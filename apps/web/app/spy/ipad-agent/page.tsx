'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import Script from 'next/script'
import {
  Loader2,
  Smartphone,
  Signal,
  WifiOff,
  CheckCircle2,
  XCircle,
  ChevronLeft,
  Star,
} from 'lucide-react'
import AdminGuard from '../../../components/AdminGuard'
import { spyApi } from '@/lib/api'
import { getSpyDeviceContext, isBrowserAgentChoice, SPY_MODE_INFO, type SpyDeviceChoice } from '@/lib/spy-device-mode'

const STORAGE_KEY = 'ecom_spy_ipad_agent'
const SCRIPT_VER = '1.5.2'

type Phase = 'idle' | 'activating' | 'ready' | 'error'

type StoredCreds = {
  agentId: string
  agentKey: string
  apiUrl: string
  deviceName: string
  platform?: SpyDeviceChoice
}

function buildSpyMetaBookmarklet(creds: StoredCreds | null, bundleSource?: string): string {
  const inline =
    creds?.agentId && creds?.agentKey
      ? JSON.stringify({
          agentId: creds.agentId,
          agentKey: creds.agentKey,
          apiUrl: creds.apiUrl || 'https://ecoomtaskforce.site/api',
          deviceName: creds.deviceName || 'iPhone',
          platform: creds.platform || 'iphone',
        })
      : 'null'
  if (!bundleSource) {
    return `javascript:void(alert('No /spy: Activar → Copiar código do favorito (v${SCRIPT_VER})'))`
  }
  return (
    `javascript:(function(){if(window.__ecomSpyBootstrap)return;` +
    `window.__ecomSpyInlineCreds=${inline};` +
    `try{(0,eval)(${JSON.stringify(bundleSource)})}` +
    `catch(e){alert('SPY: '+(e&&e.message||e))}})();`
  )
}

declare global {
  interface Window {
    EcomSpyIpad?: {
      claimJob: (c: StoredCreds) => Promise<{ job: unknown }>
      getCurrentJob: (c: StoredCreds) => Promise<{ job: unknown }>
    }
    EcomSpyAgentRunner?: {
      start: (c: StoredCreds, hooks: Record<string, () => void>) => void
      stop: () => void
    }
  }
}

function loadStoredCreds(): StoredCreds | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

async function sendHeartbeat(creds: StoredCreds, platform: 'ipad' | 'iphone') {
      const net = await spyApi.checkNetwork({ fresh: true }).catch(() => null)
  const res = await fetch(`${creds.apiUrl.replace(/\/$/, '')}/spy/mobile/heartbeat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Spy-Agent-Key': creds.agentKey,
    },
    body: JSON.stringify({
      agentId: creds.agentId,
      platform,
      connectionCheck: net
        ? {
            ok: !!net.mobile,
            ip: net.ip,
            isp: net.isp,
            org: net.org,
            mobile: net.mobile,
            reason: net.mobile ? `Dados móveis OK — ${net.isp || net.org}` : 'Sem dados móveis',
          }
        : undefined,
    }),
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error(data.error || 'Heartbeat falhou')
  }
}

export default function SpyIpadAgentPage() {
  const deviceCtx = getSpyDeviceContext()
  const browserPlatform: 'ipad' | 'iphone' = deviceCtx.platform === 'iphone' ? 'iphone' : 'ipad'
  const deviceLabel = deviceCtx.formLabel === 'Mobile' ? 'iPhone' : 'iPad'
  const modeInfo = SPY_MODE_INFO[browserPlatform]

  const [phase, setPhase] = useState<Phase>('idle')
  const [message, setMessage] = useState('')
  const [networkMobile, setNetworkMobile] = useState<boolean | null>(null)
  const [creds, setCreds] = useState<StoredCreds | null>(null)
  const [scriptsReady, setScriptsReady] = useState(false)
  const [awaitingMetaTap, setAwaitingMetaTap] = useState(false)
  const credsRef = useRef<StoredCreds | null>(null)

  const [networkInfo, setNetworkInfo] = useState('')

  const checkNetwork = useCallback(async (fresh = false) => {
    try {
      const net = await spyApi.checkNetwork({ fresh })
      setNetworkMobile(net.mobile)
      setNetworkInfo(net.reason || net.isp || net.org || '')
      return net
    } catch {
      setNetworkMobile(null)
      setNetworkInfo('')
      return null
    }
  }, [])

  const activate = useCallback(async () => {
    setPhase('activating')
    setMessage('A testar dados móveis…')
    try {
      const net = await checkNetwork(true)
      if (!net?.mobile) {
        setPhase('error')
        setMessage(
          net?.reason
            ? `${net.reason}. Liga os dados móveis do ${deviceLabel} (desliga Wi-Fi) e tenta de novo.`
            : browserPlatform === 'iphone'
              ? 'Liga os dados móveis do iPhone (desliga Wi-Fi fixa) e tenta de novo.'
              : 'Liga os dados móveis do iPad (desliga Wi-Fi fixa) e tenta de novo.'
        )
        return
      }
      setMessage(`A registar agente ${deviceLabel}…`)
      const pairing = await spyApi.createMobilePairing()
      const deviceName =
        browserPlatform === 'iphone'
          ? `iPhone (${navigator.platform || 'iOS'})`
          : `${/iPad/i.test(navigator.userAgent) ? 'iPad' : 'Safari'} (${navigator.platform || 'iOS'})`

      const res = await fetch(`${pairing.apiUrl}/spy/mobile/register-pairing`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pairingToken: pairing.pairingToken,
          deviceName,
          platform: browserPlatform,
          connectionCheck: {
            ok: true,
            ip: net.ip,
            isp: net.isp,
            org: net.org,
            mobile: true,
            reason: `Dados móveis OK — ${net.isp || net.org}`,
          },
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Registo falhou')

      const stored: StoredCreds = {
        agentId: data.agentId,
        agentKey: data.agentKey,
        apiUrl: pairing.apiUrl,
        deviceName,
        platform: browserPlatform,
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(stored))
      setCreds(stored)
      credsRef.current = stored

      setMessage('A sincronizar com a VPS…')
      await sendHeartbeat(stored, browserPlatform)

      setPhase('ready')
      setMessage(
        'Agente activo. Guarda o favorito «SPY Meta» abaixo (1×). Depois podes pesquisar no SPY.'
      )
    } catch (err) {
      setPhase('error')
      setMessage(err instanceof Error ? err.message : 'Erro ao activar')
    }
  }, [browserPlatform, checkNetwork, deviceLabel])

  useEffect(() => {
    checkNetwork()
    const stored = loadStoredCreds()
    setCreds(stored)
    credsRef.current = stored
    if (stored?.agentId) setPhase('ready')
  }, [checkNetwork])

  useEffect(() => {
    if (!creds?.agentId) return undefined
    const platform = creds.platform === 'iphone' ? 'iphone' : browserPlatform
    const tick = () => {
      sendHeartbeat(creds, platform).catch(() => {})
    }
    tick()
    const id = setInterval(tick, 20000)
    return () => clearInterval(id)
  }, [browserPlatform, creds])

  useEffect(() => {
    if (!scriptsReady || !creds?.agentId || phase !== 'ready') return undefined
    if (!window.EcomSpyAgentRunner) return undefined

    window.EcomSpyAgentRunner.start(creds, {
      onJobOpened: () => {
        setAwaitingMetaTap(true)
        setMessage(
          'Meta abriu — TOCA «SPY Meta» nos favoritos Safari NESTE MOMENTO (tab Facebook). Sem isto o scroll não arranca.'
        )
      },
      onJobDone: () => {
        setAwaitingMetaTap(false)
        setMessage('Keyword concluída. Mantém este separador aberto para a próxima.')
      },
      onError: (msg: string) => {
        if (msg) setMessage(msg)
      },
    })

    return () => {
      window.EcomSpyAgentRunner?.stop()
    }
  }, [scriptsReady, creds, phase])

  const netOk = networkMobile === true
  const agentReady = phase === 'ready' || !!creds?.agentId
  const [bookmarkBundle, setBookmarkBundle] = useState<string | null>(null)

  useEffect(() => {
    fetch(`/spy/ipad-agent/meta-bundle.js?v=${SCRIPT_VER}`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.text() : Promise.reject()))
      .then(setBookmarkBundle)
      .catch(() => setBookmarkBundle(null))
  }, [])

  const bookmarklet = buildSpyMetaBookmarklet(
    creds || (typeof window !== 'undefined' ? loadStoredCreds() : null),
    bookmarkBundle || undefined
  )

  return (
    <AdminGuard>
      <Script
        src={`/spy/ipad-agent/agent-api.js?v=${SCRIPT_VER}`}
        strategy="afterInteractive"
        onLoad={() => {
          /* agent-runner loads after api */
        }}
      />
      <Script
        src={`/spy/ipad-agent/agent-runner.js?v=${SCRIPT_VER}`}
        strategy="afterInteractive"
        onLoad={() => setScriptsReady(true)}
      />

      <div style={{ maxWidth: 720, margin: '0 auto', padding: '1.5rem 1rem 3rem', color: '#E8EDF2' }}>
        {awaitingMetaTap && (
          <div
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 9999,
              background: 'rgba(12, 15, 20, 0.92)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '1.5rem',
              textAlign: 'center',
            }}
          >
            <p style={{ color: '#F5D26C', fontSize: '1.35rem', fontWeight: 800, margin: '0 0 0.75rem', lineHeight: 1.3 }}>
              TOCA «SPY Meta» AGORA
            </p>
            <p style={{ color: '#E8EDF2', fontSize: '0.95rem', margin: '0 0 1.25rem', lineHeight: 1.5, maxWidth: 360 }}>
              Vai à tab Facebook Ads Library → barra de favoritos → toca o favorito amarelo.
              Sem isto a pesquisa fica a 0 discoveries.
            </p>
            <a
              href={bookmarklet}
              style={{
                display: 'block',
                width: '100%',
                maxWidth: 320,
                padding: '0.9rem 1rem',
                background: 'linear-gradient(135deg, #F5D26C 0%, #d4a843 100%)',
                borderRadius: '0.5rem',
                color: '#0c0f14',
                fontWeight: 700,
                fontSize: '1rem',
                textDecoration: 'none',
                marginBottom: '0.75rem',
              }}
            >
              ⭐ SPY Meta (se ainda não guardaste)
            </a>
            <button
              type="button"
              onClick={() => setAwaitingMetaTap(false)}
              style={{
                background: 'transparent',
                border: '1px solid rgba(148,163,184,0.35)',
                color: '#94a3b8',
                borderRadius: '0.4rem',
                padding: '0.5rem 1rem',
                fontSize: '0.8rem',
                cursor: 'pointer',
              }}
            >
              Já toquei — fechar aviso
            </button>
          </div>
        )}

        <Link
          href="/spy"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.35rem',
            color: '#94a3b8',
            fontSize: '0.8125rem',
            marginBottom: '1rem',
            textDecoration: 'none',
          }}
        >
          <ChevronLeft size={16} /> Voltar ao SPY
        </Link>

        <h1 style={{ fontSize: '1.35rem', fontWeight: 700, margin: '0 0 0.35rem', color: '#F5D26C' }}>
          SPY — Agente {deviceLabel}
        </h1>
        <p style={{ margin: '0 0 1.25rem', color: '#94a3b8', fontSize: '0.875rem', lineHeight: 1.55 }}>
          {modeInfo.note} Pesquisa na Meta com dados móveis — só Safari.
        </p>

        {!isBrowserAgentChoice(deviceCtx.platform) && (
          <p
            style={{
              margin: '0 0 1rem',
              padding: '0.65rem 0.75rem',
              background: 'rgba(245,210,108,0.08)',
              border: '1px solid rgba(245,210,108,0.25)',
              borderRadius: '0.5rem',
              color: '#fcd34d',
              fontSize: '0.8125rem',
              lineHeight: 1.5,
            }}
          >
            Este dispositivo foi detectado como {deviceCtx.formLabel} · {deviceCtx.osLabel}. Abre esta página no iPad ou iPhone com Safari.
          </p>
        )}

        <div
          style={{
            background: netOk ? 'rgba(16,185,129,0.08)' : 'rgba(239,68,68,0.08)',
            border: `1px solid ${netOk ? 'rgba(16,185,129,0.35)' : 'rgba(239,68,68,0.35)'}`,
            borderRadius: '0.625rem',
            padding: '0.75rem 0.9rem',
            marginBottom: '0.75rem',
            fontSize: '0.8125rem',
          }}
        >
          {netOk ? (
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#34d399' }}>
              <Signal size={14} /> {networkInfo || 'Dados móveis OK — pronto para activar'}
            </span>
          ) : (
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#f87171' }}>
              <WifiOff size={14} /> {networkInfo || `Usa dados móveis (desliga Wi-Fi fixa no ${deviceLabel})`}
            </span>
          )}
        </div>

        <div
          style={{
            background: agentReady ? 'rgba(16,185,129,0.06)' : 'rgba(148,163,184,0.06)',
            border: `1px solid ${agentReady ? 'rgba(16,185,129,0.25)' : 'rgba(148,163,184,0.2)'}`,
            borderRadius: '0.625rem',
            padding: '0.85rem 0.9rem',
            marginBottom: '1rem',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 600, fontSize: '0.8125rem' }}>
              {agentReady ? <CheckCircle2 size={15} color="#34d399" /> : <XCircle size={15} color="#f87171" />}
              {agentReady ? `Agente ${deviceLabel} ligado` : `Agente ${deviceLabel} offline`}
            </span>
            <button
              type="button"
              onClick={activate}
              disabled={phase === 'activating'}
              style={{
                padding: '0.4rem 0.85rem',
                background: 'rgba(245,210,108,0.15)',
                border: '1px solid rgba(245,210,108,0.35)',
                borderRadius: '0.4rem',
                color: '#F5D26C',
                fontWeight: 600,
                fontSize: '0.75rem',
                cursor: phase === 'activating' ? 'wait' : 'pointer',
              }}
            >
              {phase === 'activating' ? (
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                  <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} /> A ligar…
                </span>
              ) : (
                `Activar ${deviceLabel}`
              )}
            </button>
          </div>
          {message && (
            <p style={{ margin: '0.55rem 0 0', fontSize: '0.775rem', color: '#fcd34d', lineHeight: 1.5 }}>{message}</p>
          )}
          {agentReady && (
            <p style={{ margin: '0.45rem 0 0', fontSize: '0.72rem', color: '#64748b' }}>
              Mantém este separador aberto — envia sinal à VPS a cada 8s.
            </p>
          )}
        </div>

        <div
          style={{
            background: 'rgba(245,210,108,0.06)',
            border: '1px solid rgba(245,210,108,0.22)',
            borderRadius: '0.625rem',
            padding: '0.9rem',
            marginBottom: '1rem',
          }}
        >
          <h2 style={{ margin: '0 0 0.6rem', fontSize: '0.9rem', fontWeight: 600, color: '#F5D26C' }}>
            <Star size={15} style={{ verticalAlign: 'middle', marginRight: 6 }} />
            Passo 2 — Guardar favorito (1×, 10 segundos)
          </h2>
          <ol style={{ margin: '0 0 0.75rem', paddingLeft: '1.1rem', fontSize: '0.8125rem', color: '#cbd5e1', lineHeight: 1.65 }}>
            <li>
              <strong>Pressiona e segura</strong> o botão amarelo abaixo.
            </li>
            <li>
              Escolhe <strong>«Adicionar marcador»</strong> (ou «Add Bookmark»).
            </li>
            <li>
              Quando uma pesquisa abrir a Meta, toca <strong>«SPY Meta»</strong> na barra de favoritos.
            </li>
          </ol>
          <a
            href={bookmarklet}
            style={{
              display: 'block',
              textAlign: 'center',
              padding: '0.85rem 1rem',
              background: 'linear-gradient(135deg, #F5D26C 0%, #d4a843 100%)',
              borderRadius: '0.5rem',
              color: '#0c0f14',
              fontWeight: 700,
              fontSize: '0.95rem',
              textDecoration: 'none',
              WebkitTouchCallout: 'none',
            }}
          >
            ⭐ SPY Meta — pressiona e segura aqui
          </a>
          <p style={{ margin: '0.6rem 0 0', fontSize: '0.72rem', color: '#64748b', lineHeight: 1.5 }}>
            Não precisas de instalar Userscripts nem mudar pastas. Só este favorito no Safari.
          </p>
        </div>

        <div
          style={{
            background: 'rgba(148,163,184,0.05)',
            border: '1px solid rgba(148,163,184,0.18)',
            borderRadius: '0.625rem',
            padding: '0.9rem',
            marginBottom: '1rem',
          }}
        >
          <h2 style={{ margin: '0 0 0.5rem', fontSize: '0.875rem', fontWeight: 600 }}>
            <Smartphone size={15} style={{ verticalAlign: 'middle', marginRight: 6 }} />
            Como pesquisar
          </h2>
          <ol style={{ margin: 0, paddingLeft: '1.1rem', fontSize: '0.8125rem', color: '#cbd5e1', lineHeight: 1.65 }}>
            <li>Activar {deviceLabel} acima + guardar favorito (1×).</li>
            <li>No SPY, selecciona modo «{deviceLabel}» antes de pesquisar.</li>
            <li>Desliga o agente Mac se estiver activo (evita conflitos).</li>
            <li>Vai ao SPY → cria pesquisa. Abre-se a Meta noutro separador.</li>
            <li>Toca <strong>SPY Meta</strong> nos favoritos — começa o scroll.</li>
          </ol>
        </div>

        <p style={{ margin: 0, fontSize: '0.75rem', color: '#64748b', lineHeight: 1.55 }}>
          Não consigo ligar-me ao teu {deviceLabel} remotamente — estes passos têm de ser feitos no teu Safari.
          Se preferires, usa o Mac com iPhone USB (modo «Mac» no SPY) e deixa o {deviceLabel} de lado.
        </p>
      </div>
    </AdminGuard>
  )
}
