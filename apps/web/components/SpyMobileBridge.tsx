'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Loader2, Smartphone, Signal, WifiOff, RefreshCw, Zap, CheckCircle2, XCircle, Copy, Check } from 'lucide-react'
import { spyApi, api } from '@/lib/api'
import { getSpyDeviceChoice, setSpyDeviceChoice, SPY_DEVICE_CHOICES, SPY_MODE_INFO, spyStartBlockedMessage, agentMatchesChoice, isBrowserAgentChoice, isDesktopBridgeChoice, choiceMatchesCurrentDevice, type SpyDeviceChoice } from '@/lib/spy-device-mode'

type StoredIpadCreds = {
  agentId: string
  agentKey: string
  apiUrl: string
  deviceName: string
  platform?: SpyDeviceChoice
}

const LOCAL_PORT = 9780
const LOCAL_BASE = `http://127.0.0.1:${LOCAL_PORT}`
const IPAD_STORAGE_KEY = 'ecom_spy_ipad_agent'
const SCRIPT_VER = '1.5.2'

/** Bookmarklet INLINE (Meta CSP bloqueia fetch). bundleSource = texto de meta-bundle.js */
function buildSpyMetaBookmarklet(creds?: StoredIpadCreds | null, bundleSource?: string): string {
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
    return (
      `javascript:void(alert('No /spy: Activar → Copiar código do favorito (v${SCRIPT_VER})'))`
    )
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
      claimJob: (c: StoredIpadCreds) => Promise<{ job: unknown }>
      getCurrentJob: (c: StoredIpadCreds) => Promise<{ job: unknown }>
    }
    EcomSpyAgentRunner?: {
      start: (c: StoredIpadCreds, hooks: Record<string, unknown>) => void
      stop: () => void
      openMeta?: (url: string) => unknown
      clearRunningJob?: () => void
    }
  }
}

function loadIpadStoredCreds(): StoredIpadCreds | null {
  try {
    const raw = localStorage.getItem(IPAD_STORAGE_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

function loadScriptOnce(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[data-ecom-spy="${src}"]`) as HTMLScriptElement | null
    if (existing) {
      if (existing.dataset.loaded === '1') {
        resolve()
        return
      }
      existing.addEventListener('load', () => resolve())
      existing.addEventListener('error', () => reject(new Error('script fail')))
      return
    }
    const s = document.createElement('script')
    s.src = src
    s.async = true
    s.dataset.ecomSpy = src
    s.onload = () => {
      s.dataset.loaded = '1'
      resolve()
    }
    s.onerror = () => reject(new Error(`Falha a carregar ${src}`))
    document.head.appendChild(s)
  })
}

async function ensureSpyAgentScripts() {
  await loadScriptOnce(`/spy/ipad-agent/agent-api.js?v=${SCRIPT_VER}`)
  await loadScriptOnce(`/spy/ipad-agent/agent-runner.js?v=${SCRIPT_VER}`)
}

async function sendIpadHeartbeat(creds: StoredIpadCreds) {
  const platform = creds.platform === 'iphone' ? 'iphone' : 'ipad'
  const net = await spyApi.checkNetwork().catch(() => null)
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
  return res.ok
}

async function localBridgeHealth() {
  try {
    const res = await fetch(`${LOCAL_BASE}/health`, { cache: 'no-store', mode: 'cors', signal: AbortSignal.timeout(2000) })
    return res.ok
  } catch {
    return false
  }
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

type Status = 'checking' | 'mobile' | 'wifi' | 'error'
type AgentStatus = 'checking' | 'connected' | 'offline'

type Props = {
  bridge?: {
    required: boolean
    agents?: { id: string; deviceName: string; platform?: string; mobileValidated?: boolean }[]
  } | null
  localBridgeOk?: boolean
  onRefresh: () => void
  onNetworkStatus?: (mobile: boolean) => void
  onAgentMobile?: (ready: boolean) => void
}

export default function SpyMobileBridge({ bridge, onRefresh, onNetworkStatus, onAgentMobile }: Props) {
  const [status, setStatus] = useState<Status>('checking')
  const [agentStatus, setAgentStatus] = useState<AgentStatus>('checking')
  const [agentMobileOk, setAgentMobileOk] = useState(false)
  const [info, setInfo] = useState('')
  const [checking, setChecking] = useState(false)
  const [activating, setActivating] = useState(false)
  const [agentHint, setAgentHint] = useState('')
  const [terminalCmd, setTerminalCmd] = useState('')
  const [copied, setCopied] = useState(false)
  const [metaJobUrl, setMetaJobUrl] = useState<string | null>(null)
  const [runnerOn, setRunnerOn] = useState(false)
  const [bookmarkCopied, setBookmarkCopied] = useState(false)
  const [showBookmarkHelp, setShowBookmarkHelp] = useState(false)
  const [bookmarkBundle, setBookmarkBundle] = useState<string | null>(null)
  const [deviceChoice, setDeviceChoice] = useState<SpyDeviceChoice>(() =>
    typeof window !== 'undefined' ? getSpyDeviceChoice() : 'mac'
  )
  const runnerStartedRef = useRef(false)

  useEffect(() => {
    fetch(`/spy/ipad-agent/meta-bundle.js?v=${SCRIPT_VER}`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.text() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then(setBookmarkBundle)
      .catch(() => setBookmarkBundle(null))
  }, [])

  const startInlineRunner = useCallback(async (creds: StoredIpadCreds) => {
    await ensureSpyAgentScripts()
    if (!window.EcomSpyAgentRunner) throw new Error('Runner SPY não carregou')
    window.EcomSpyAgentRunner.stop()
    window.EcomSpyAgentRunner.start(creds, {
      autoOpen: false,
      onJobReady: (_job: unknown, url: string) => {
        setMetaJobUrl(url)
        setAgentHint('Pesquisa pronta — toca «Abrir Meta» e depois o favorito «SPY Meta».')
      },
      onJobDone: () => {
        setMetaJobUrl(null)
        window.EcomSpyAgentRunner?.clearRunningJob?.()
      },
      onError: (msg: string) => {
        if (msg) setAgentHint(msg)
      },
    })
    runnerStartedRef.current = true
    setRunnerOn(true)
  }, [])

  const check = useCallback(async () => {
    setChecking(true)
    try {
      const data = await spyApi.checkNetwork({ fresh: true })
      const browserMobile = !!data.mobile
      setStatus(browserMobile ? 'mobile' : 'wifi')
      setInfo(data.reason || data.isp || data.org || data.asn || '')
      onNetworkStatus?.(browserMobile || agentMobileOk)
    } catch {
      setStatus('error')
    } finally {
      setChecking(false)
    }
  }, [agentMobileOk, onNetworkStatus])

  const checkAgent = useCallback(async (): Promise<boolean> => {
    const choice = getSpyDeviceChoice()

    let localRunning = false
    try {
      const res = await fetch(`${LOCAL_BASE}/status`, {
        cache: 'no-store',
        mode: 'cors',
        signal: AbortSignal.timeout(2000),
      })
      if (res.ok) {
        const st = await res.json()
        localRunning = !!(st.agentRunning && st.localOnline)
      }
    } catch {
      localRunning = false
    }

    let platformAgents: {
      deviceName?: string
      platform?: string
      mobileValidated?: boolean
      claimFresh?: boolean
    }[] = []
    try {
      const data = await api('/spy/mobile/agent-ready') as {
        agents?: { platform?: string; deviceName?: string; mobileValidated?: boolean; claimFresh?: boolean }[]
      }
      platformAgents = Array.isArray(data?.agents)
        ? data.agents.filter((a) => agentMatchesChoice(a, choice))
        : []
    } catch {
      platformAgents = []
    }

    const desktopAgentLive = platformAgents.some(
      (a) =>
        (agentMatchesChoice(a, 'mac') || agentMatchesChoice(a, 'windows')) &&
        a.mobileValidated
    )
    // iPhone/iPad: só «ligado» se o runner está a fazer claim (poll activo)
    const browserAgentLive = platformAgents.some(
      (a) => agentMatchesChoice(a, choice) && a.claimFresh === true
    )

    let connected = false
    if (isDesktopBridgeChoice(choice)) {
      connected =
        localRunning ||
        platformAgents.some((a) => agentMatchesChoice(a, choice) && a.mobileValidated) ||
        (choice === 'mac' && desktopAgentLive)
    } else if (isBrowserAgentChoice(choice)) {
      if (browserAgentLive && !runnerStartedRef.current) {
        const stored = loadIpadStoredCreds()
        if (stored && (stored.platform === choice || !stored.platform)) {
          try {
            await startInlineRunner({ ...stored, platform: choice })
          } catch {
            // UI continua; Activar tenta de novo
          }
        }
      }
      if (!runnerStartedRef.current) {
        const stored = loadIpadStoredCreds()
        if (stored && choiceMatchesCurrentDevice(choice) && (stored.platform === choice || !stored.platform)) {
          try {
            await startInlineRunner({ ...stored, platform: choice })
            await sendIpadHeartbeat({ ...stored, platform: choice })
          } catch {
            // ignore
          }
        }
      }
      connected = browserAgentLive || (runnerStartedRef.current && choiceMatchesCurrentDevice(choice))
    }

    setAgentStatus(connected ? 'connected' : 'offline')
    setAgentMobileOk(!!connected)
    onAgentMobile?.(!!connected)
    if (connected) setTerminalCmd('')
    return connected
  }, [onAgentMobile, startInlineRunner])

  const pickDevice = useCallback((choice: SpyDeviceChoice) => {
    setSpyDeviceChoice(choice)
    setDeviceChoice(choice)
    setAgentHint('')
    window.EcomSpyAgentRunner?.stop()
    runnerStartedRef.current = false
    setRunnerOn(false)
    setMetaJobUrl(null)
    checkAgent()
    onRefresh()
  }, [checkAgent, onRefresh])

  const loadTerminalHelp = useCallback(async () => {
    try {
      const choice = getSpyDeviceChoice()
      const data = await spyApi.getMobileTerminal(
        isDesktopBridgeChoice(choice) ? choice : 'mac'
      )
      setTerminalCmd(data.resumeCommand)
    } catch {
      // ignore
    }
  }, [])

  const waitForAgent = useCallback(async (attempts = 15) => {
    for (let i = 0; i < attempts; i += 1) {
      await new Promise((r) => setTimeout(r, 2000))
      if (await checkAgent()) return true
    }
    return false
  }, [checkAgent])

  const tryLocalReconnect = useCallback(async () => {
    try {
      const statusRes = await fetch(`${LOCAL_BASE}/status`, { cache: 'no-store', mode: 'cors' })
      if (!statusRes.ok) return false
      const st = await statusRes.json()
      if (!st.credentials) return false
      const recon = await fetch(`${LOCAL_BASE}/reconnect`, { method: 'POST', mode: 'cors' })
      return recon.ok
    } catch {
      return false
    }
  }, [])

  const tryLocalActivate = useCallback(async (pairingToken: string, apiUrl: string) => {
    try {
      const res = await fetch(`${LOCAL_BASE}/activate`, {
        method: 'POST',
        mode: 'cors',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pairingToken, apiUrl }),
      })
      if (!res.ok) return false
      const data = await res.json()
      return data.phase === 'ready' || data.phase === 'working'
    } catch {
      return false
    }
  }, [])

  const copyTerminalCmd = useCallback(async () => {
    if (!terminalCmd) return
    try {
      await navigator.clipboard.writeText(terminalCmd)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setAgentHint('Não foi possível copiar — selecciona o comando manualmente.')
    }
  }, [terminalCmd])

  const activateBrowserAgent = useCallback(async (choice: SpyDeviceChoice) => {
    setAgentHint(`A activar ${choice === 'iphone' ? 'iPhone' : 'iPad'}…`)
    const net = await spyApi.checkNetwork({ fresh: true })
    if (!net.mobile) {
      setAgentHint('Usa dados móveis (desliga Wi-Fi) e toca Activar de novo.')
      return false
    }
    const pairing = await spyApi.createMobilePairing()
    const deviceName =
      choice === 'iphone'
        ? `iPhone (${navigator.platform || 'iOS'})`
        : `${/iPad/i.test(navigator.userAgent) ? 'iPad' : 'Safari'} (${navigator.platform || 'iOS'})`
    const res = await fetch(`${pairing.apiUrl}/spy/mobile/register-pairing`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        pairingToken: pairing.pairingToken,
        deviceName,
        platform: choice,
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

    const stored: StoredIpadCreds = {
      agentId: data.agentId,
      agentKey: data.agentKey,
      apiUrl: pairing.apiUrl,
      deviceName,
      platform: choice,
    }
    localStorage.setItem(IPAD_STORAGE_KEY, JSON.stringify(stored))

    await fetch(`${pairing.apiUrl}/spy/mobile/heartbeat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Spy-Agent-Key': data.agentKey,
      },
      body: JSON.stringify({
        agentId: data.agentId,
        platform: choice,
        connectionCheck: {
          ok: true,
          ip: net.ip,
          isp: net.isp,
          mobile: true,
          reason: `Dados móveis OK — ${net.isp || net.org}`,
        },
      }),
    })

    await startInlineRunner(stored)
    setAgentHint('Pronto. Cria o favorito «SPY Meta» (1×) se ainda não tiveres, e lança a pesquisa.')
    for (let i = 0; i < 8; i += 1) {
      await new Promise((r) => setTimeout(r, 1500))
      if (await checkAgent()) {
        setAgentHint('Pronto — lança a pesquisa; quando aparecer «Abrir Meta», toca e depois o favorito.')
        onRefresh()
        return true
      }
    }
    setAgentHint('Agente a arrancar… espera 5s e toca Verificar.')
    onRefresh()
    return true
  }, [checkAgent, onRefresh, startInlineRunner])

  const activate = useCallback(async () => {
    setActivating(true)
    setAgentHint('')
    try {
      const choice = getSpyDeviceChoice()

      if (isBrowserAgentChoice(choice)) {
        if (!choiceMatchesCurrentDevice(choice)) {
          setAgentHint(
            `Modo ${choice === 'iphone' ? 'iPhone' : 'iPad'} — abre o Safari nesse aparelho (dados móveis), escolhe o mesmo modo e toca Activar.`
          )
          return
        }
        await activateBrowserAgent(choice)
        return
      }

      const hasLocalBridge = await localBridgeHealth()

      if (isDesktopBridgeChoice(choice) && !hasLocalBridge && !choiceMatchesCurrentDevice(choice)) {
        setAgentHint(
          choice === 'windows'
            ? 'Modo Windows — abre o SPY no PC Windows (ligado ao hotspot) e clica Activar.'
            : 'Modo Mac seleccionado — abre o SPY no Mac e clica Activar (ponte local).'
        )
        return
      }

      if (await tryLocalReconnect()) {
        setAgentHint('A religar agente local…')
        if (await waitForAgent(10)) {
          setAgentHint('')
          onRefresh()
          return
        }
      }

      if (await fetch(`${LOCAL_BASE}/health`, { cache: 'no-store', mode: 'cors' }).then((r) => r.ok).catch(() => false)) {
        setAgentHint('Ponte local detectada — a activar…')
        const pairing = await spyApi.createMobilePairing()
        if (await tryLocalActivate(pairing.pairingToken, pairing.apiUrl)) {
          if (await waitForAgent()) {
            setAgentHint('')
            onRefresh()
            return
          }
        }
      }

      setAgentHint('A preparar activador…')
      const pairing = await spyApi.createMobilePairing()

      if (choice === 'windows') {
        try {
          const blob = await spyApi.downloadMobileInstaller(pairing.pairingToken, 'windows')
          downloadBlob(blob, 'Ecoom-SPY-Activar-Windows.ps1')
          setTerminalCmd(pairing.activateCommandWindows || pairing.activateCommand)
          setAgentHint(
            '⬇️ Descarregado «Ecoom-SPY-Activar-Windows.ps1». No PowerShell: clique direito → Executar com PowerShell. PC tem de estar no hotspot.'
          )
        } catch {
          setTerminalCmd(pairing.activateCommandWindows || pairing.activateCommand)
          setAgentHint('Cola o comando PowerShell abaixo (PC no hotspot do telemóvel).')
        }
      } else {
        try {
          const blob = await spyApi.downloadMobileInstaller(pairing.pairingToken)
          downloadBlob(blob, 'Ecoom-SPY-Activar.command')
          setTerminalCmd('')
          setAgentHint(
            '⬇️ Ficheiro descarregado — faz duplo clique em «Ecoom-SPY-Activar.command». Depois basta «Activar» aqui.'
          )
        } catch {
          setTerminalCmd(pairing.activateCommand)
          setAgentHint('Não foi possível descarregar o activador — usa o comando abaixo.')
        }
      }

      if (await waitForAgent(25)) {
        setAgentHint('')
        onRefresh()
      }
    } catch (err) {
      setAgentHint(err instanceof Error ? err.message : 'Não foi possível activar o agente')
      await loadTerminalHelp()
    } finally {
      setActivating(false)
    }
  }, [activateBrowserAgent, loadTerminalHelp, onRefresh, tryLocalActivate, tryLocalReconnect, waitForAgent])

  const installAutostart = useCallback(async () => {
    setActivating(true)
    setAgentHint('')
    try {
      const blob = await spyApi.downloadAutostartInstaller()
      downloadBlob(blob, 'Ecoom-SPY-Arranque-Automatico.command')
      setAgentHint('⬇️ Duplo clique em «Ecoom-SPY-Arranque-Automatico.command» (só 1×). Depois basta «Activar».')
    } catch (err) {
      setAgentHint(err instanceof Error ? err.message : 'Erro ao gerar instalador')
    } finally {
      setActivating(false)
    }
  }, [])

  const openMetaNow = useCallback(() => {
    if (!metaJobUrl) return
    window.EcomSpyAgentRunner?.openMeta?.(metaJobUrl)
    setAgentHint('Na tab Facebook: toca o favorito «SPY Meta» (uma vez). Depois volta aqui.')
  }, [metaJobUrl])

  useEffect(() => {
    check()
    checkAgent()
    const t1 = setInterval(() => { check() }, 30000)
    const t2 = setInterval(() => { checkAgent() }, 20000)
    return () => {
      clearInterval(t1)
      clearInterval(t2)
      window.EcomSpyAgentRunner?.stop()
      runnerStartedRef.current = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (agentStatus === 'offline' && isDesktopBridgeChoice(deviceChoice)) loadTerminalHelp()
  }, [agentStatus, deviceChoice, loadTerminalHelp])

  useEffect(() => {
    if (agentMobileOk) onNetworkStatus?.(true)
  }, [agentMobileOk, onNetworkStatus])

  const copyBookmarklet = useCallback(async () => {
    const stored = loadIpadStoredCreds()
    if (!stored?.agentId) {
      setAgentHint('Activa primeiro (botão Activar) e depois copia o favorito.')
      return
    }
    try {
      setAgentHint('A preparar favorito (código completo)…')
      const bundle = await fetch(`/spy/ipad-agent/meta-bundle.js?v=${SCRIPT_VER}`, {
        cache: 'no-store',
      }).then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.text()
      })
      setBookmarkBundle(bundle)
      const code = buildSpyMetaBookmarklet(stored, bundle)
      await navigator.clipboard.writeText(code)
      setBookmarkCopied(true)
      setAgentHint(
        `Favorito v${SCRIPT_VER} copiado (~17KB). Cola no «SPY Meta» — se aparecer «Load failed» ainda tens o antigo.`
      )
      setTimeout(() => setBookmarkCopied(false), 2500)
    } catch (err) {
      setAgentHint(err instanceof Error ? err.message : 'Falha ao copiar favorito')
      setShowBookmarkHelp(true)
    }
  }, [])

  const required = bridge?.required !== false
  if (!required) return null

  const networkOk = status === 'mobile' || (isDesktopBridgeChoice(deviceChoice) && agentMobileOk)
  const netColor = networkOk ? '#34d399' : status === 'checking' ? '#94a3b8' : '#f87171'
  const netBg = networkOk ? 'rgba(16,185,129,0.07)' : status === 'checking' ? 'rgba(148,163,184,0.05)' : 'rgba(239,68,68,0.08)'
  const netBorder = networkOk ? 'rgba(16,185,129,0.3)' : status === 'checking' ? 'rgba(148,163,184,0.2)' : 'rgba(239,68,68,0.35)'

  const modeInfo = SPY_MODE_INFO[deviceChoice]
  const modeTitle =
    deviceChoice === 'mac'
      ? 'Modo Mac'
      : deviceChoice === 'windows'
        ? 'Modo Windows'
        : deviceChoice === 'ipad'
          ? 'Modo iPad'
          : 'Modo iPhone'

  const netLabel =
    agentMobileOk && status !== 'mobile'
      ? `Agente móvel OK${info ? ` · ${info}` : ''} — ${modeTitle}`
      : status === 'mobile'
        ? `Dados móveis${info ? ` · ${info}` : ''} — toca Activar abaixo`
        : status === 'wifi'
          ? `${isBrowserAgentChoice(deviceChoice) ? 'Wi-Fi no telemóvel/tablet' : 'Wi-Fi / fibra'}${info ? ` · ${info}` : ''} — ${
              deviceChoice === 'mac'
                ? 'iPhone USB ao Mac'
                : deviceChoice === 'windows'
                  ? 'liga o PC ao hotspot do telemóvel'
                  : 'usa dados móveis'
            }`
          : status === 'error'
            ? 'Não foi possível verificar a ligação'
            : 'A verificar…'

  const agentLabel =
    agentStatus === 'connected'
      ? deviceChoice === 'mac'
        ? 'Agente Mac ligado — podes pesquisar'
        : deviceChoice === 'windows'
          ? 'Agente Windows ligado — podes pesquisar'
          : deviceChoice === 'iphone'
            ? 'Agente iPhone ligado — mantém este ecrã aberto'
            : 'Agente iPad ligado — mantém este ecrã aberto'
      : agentStatus === 'checking'
        ? 'A verificar agente…'
        : deviceChoice === 'mac'
          ? 'Toca Activar (Mac)'
          : deviceChoice === 'windows'
            ? 'Toca Activar (Windows + hotspot)'
            : 'Toca Activar (dados móveis)'

  const agentColor = agentStatus === 'connected' ? '#34d399' : agentStatus === 'checking' ? '#94a3b8' : '#f87171'
  const agentBorder = agentStatus === 'connected' ? 'rgba(16,185,129,0.3)' : agentStatus === 'checking' ? 'rgba(148,163,184,0.2)' : 'rgba(239,68,68,0.35)'

  const isBlocked = !agentMobileOk
  const showTerminal = agentStatus === 'offline' && terminalCmd && isDesktopBridgeChoice(deviceChoice)
  const bookmarkletCode = buildSpyMetaBookmarklet(
    typeof window !== 'undefined' ? loadIpadStoredCreds() : null,
    bookmarkBundle || undefined
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1rem' }}>
      {metaJobUrl && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            background: 'rgba(6,8,12,0.92)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1.5rem',
            gap: '1rem',
          }}
        >
          <p style={{ margin: 0, color: '#F5D26C', fontSize: '1.25rem', fontWeight: 700, textAlign: 'center' }}>
            Meta pronta
          </p>
          <p style={{ margin: 0, color: '#cbd5e1', fontSize: '0.9rem', textAlign: 'center', lineHeight: 1.5, maxWidth: 320 }}>
            1) Toca «Abrir Meta» · 2) Na tab Facebook toca o favorito «SPY Meta» · 3) Volta a este ecrã
          </p>
          <button
            type="button"
            onClick={openMetaNow}
            style={{
              width: '100%',
              maxWidth: 320,
              padding: '1rem',
              borderRadius: '0.75rem',
              border: 'none',
              background: '#F5D26C',
              color: '#0c0f14',
              fontWeight: 700,
              fontSize: '1rem',
              cursor: 'pointer',
            }}
          >
            Abrir Meta
          </button>
          <button
            type="button"
            onClick={() => setMetaJobUrl(null)}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#94a3b8',
              fontSize: '0.8rem',
              cursor: 'pointer',
            }}
          >
            Já abri — fechar
          </button>
        </div>
      )}

      <div style={{ background: 'rgba(148,163,184,0.05)', border: '1px solid rgba(148,163,184,0.18)', borderRadius: '0.625rem', padding: '0.55rem 0.65rem' }}>
        <p style={{ margin: '0 0 0.45rem', fontSize: '0.72rem', color: '#94a3b8', fontWeight: 600 }}>
          Dispositivo para esta pesquisa
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.35rem' }}>
          {SPY_DEVICE_CHOICES.map((opt) => {
            const active = deviceChoice === opt.id
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => pickDevice(opt.id)}
                style={{
                  padding: '0.45rem 0.35rem',
                  borderRadius: '0.45rem',
                  border: active ? '1px solid rgba(245,210,108,0.45)' : '1px solid rgba(148,163,184,0.2)',
                  background: active ? 'rgba(245,210,108,0.12)' : 'transparent',
                  color: active ? '#F5D26C' : '#cbd5e1',
                  fontSize: '0.72rem',
                  fontWeight: active ? 700 : 500,
                  cursor: 'pointer',
                  lineHeight: 1.35,
                }}
              >
                {opt.label}
              </button>
            )
          })}
        </div>
        <p style={{ margin: '0.4rem 0 0', fontSize: '0.68rem', color: '#64748b', lineHeight: 1.45 }}>
          {SPY_DEVICE_CHOICES.find((o) => o.id === deviceChoice)?.short}
          {!choiceMatchesCurrentDevice(deviceChoice) && (
            <span style={{ color: '#fcd34d' }}> — abre o SPY no dispositivo seleccionado.</span>
          )}
        </p>
      </div>

      <div style={{ background: netBg, border: `1px solid ${netBorder}`, borderRadius: '0.625rem', padding: '0.55rem 0.9rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 600, fontSize: '0.8125rem', color: netColor }}>
            {networkOk ? <Signal size={14} /> :
             status === 'checking' ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> :
             <WifiOff size={14} />}
            <Smartphone size={14} />
            {netLabel}
          </div>
          <button type="button" onClick={check} disabled={checking} style={{
            display: 'flex', alignItems: 'center', gap: '0.3rem', padding: '0.35rem 0.6rem',
            background: 'transparent', border: `1px solid ${netBorder}`, borderRadius: '0.4rem',
            color: '#E8EDF2', fontSize: '0.75rem', cursor: checking ? 'wait' : 'pointer',
          }}>
            {checking ? <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} /> : <RefreshCw size={12} />}
            Testar
          </button>
        </div>
        {isBlocked && status !== 'checking' && !agentMobileOk && (
          <p style={{ margin: '0.4rem 0 0', fontSize: '0.775rem', color: '#fca5a5', lineHeight: 1.5 }}>
            {spyStartBlockedMessage(deviceChoice).split('\n\n')[0]}
          </p>
        )}
        <p style={{ margin: '0.35rem 0 0', fontSize: '0.7rem', color: '#64748b' }}>
          <strong style={{ color: '#94a3b8' }}>{modeInfo.title}</strong> — {modeInfo.note}
          {runnerOn && isDesktopBridgeChoice(deviceChoice) ? ' · ponte activa' : ''}
        </p>
      </div>

      <div style={{ background: 'rgba(148,163,184,0.04)', border: `1px solid ${agentBorder}`, borderRadius: '0.625rem', padding: '0.55rem 0.9rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 600, fontSize: '0.8125rem', color: agentColor }}>
            {agentStatus === 'connected' ? <CheckCircle2 size={14} /> :
             agentStatus === 'checking' ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> :
             <XCircle size={14} />}
            {agentLabel}
          </div>
          {isDesktopBridgeChoice(deviceChoice) && (
          <button
            type="button"
            onClick={agentStatus === 'connected' ? () => { checkAgent() } : activate}
            disabled={activating || agentStatus === 'checking'}
            style={{
              display: 'flex', alignItems: 'center', gap: '0.3rem', padding: '0.45rem 0.9rem',
              background: agentStatus === 'offline' ? 'rgba(245,210,108,0.18)' : 'transparent',
              border: `1px solid ${agentStatus === 'offline' ? 'rgba(245,210,108,0.45)' : agentBorder}`,
              borderRadius: '0.4rem',
              color: agentStatus === 'offline' ? '#F5D26C' : '#E8EDF2',
              fontSize: '0.8rem', fontWeight: agentStatus === 'offline' ? 700 : 400,
              cursor: activating ? 'wait' : 'pointer',
            }}
          >
            {activating
              ? <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} />
              : agentStatus === 'offline' ? <Zap size={12} /> : <RefreshCw size={12} />
            }
            {activating ? 'A ligar…' : agentStatus === 'offline' ? 'Activar' : 'Verificar'}
          </button>
          )}
          {isBrowserAgentChoice(deviceChoice) && (
          <button
            type="button"
            onClick={agentStatus === 'connected' ? () => { checkAgent() } : activate}
            disabled={activating || agentStatus === 'checking'}
            style={{
              display: 'flex', alignItems: 'center', gap: '0.3rem', padding: '0.45rem 0.9rem',
              background: agentStatus === 'offline' ? 'rgba(245,210,108,0.18)' : 'transparent',
              border: `1px solid ${agentStatus === 'offline' ? 'rgba(245,210,108,0.45)' : agentBorder}`,
              borderRadius: '0.4rem',
              color: agentStatus === 'offline' ? '#F5D26C' : '#E8EDF2',
              fontSize: '0.8rem', fontWeight: agentStatus === 'offline' ? 700 : 400,
              cursor: activating ? 'wait' : 'pointer',
            }}
          >
            {activating
              ? <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} />
              : agentStatus === 'offline' ? <Zap size={12} /> : <RefreshCw size={12} />
            }
            {activating ? 'A ligar…' : agentStatus === 'offline' ? 'Activar' : 'Verificar'}
          </button>
          )}
        </div>
        {agentHint && (
          <p style={{ margin: '0.4rem 0 0', fontSize: '0.775rem', color: '#fcd34d', lineHeight: 1.5 }}>
            {agentHint}
          </p>
        )}
        {showTerminal && (
          <div style={{ marginTop: '0.55rem' }}>
            <p style={{ margin: '0 0 0.35rem', fontSize: '0.75rem', color: '#94a3b8' }}>
              {deviceChoice === 'windows' ? 'PowerShell (Windows):' : 'Alternativa manual (Terminal):'}
            </p>
            <div style={{
              display: 'flex', gap: '0.4rem', alignItems: 'flex-start',
              background: '#0c0f14', border: '1px solid rgba(148,163,184,0.2)',
              borderRadius: '0.4rem', padding: '0.45rem 0.55rem',
            }}>
              <code style={{
                flex: 1, margin: 0, fontSize: '0.68rem', lineHeight: 1.45,
                color: '#E8EDF2', whiteSpace: 'pre-wrap', wordBreak: 'break-all',
                fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
              }}>
                {terminalCmd}
              </code>
              <button
                type="button"
                onClick={copyTerminalCmd}
                title="Copiar comando"
                style={{
                  flexShrink: 0, display: 'flex', alignItems: 'center', gap: '0.25rem',
                  padding: '0.3rem 0.45rem', background: 'rgba(245,210,108,0.12)',
                  border: '1px solid rgba(245,210,108,0.25)', borderRadius: '0.35rem',
                  color: '#F5D26C', fontSize: '0.68rem', cursor: 'pointer',
                }}
              >
                {copied ? <Check size={11} /> : <Copy size={11} />}
                {copied ? 'Copiado' : 'Copiar'}
              </button>
            </div>
          </div>
        )}
        {agentStatus === 'offline' && deviceChoice === 'mac' && (
          <p style={{ margin: '0.45rem 0 0', fontSize: '0.72rem', color: '#64748b', lineHeight: 1.45 }}>
            <button
              type="button"
              onClick={installAutostart}
              disabled={activating}
              style={{
                background: 'none', border: 'none', padding: 0, color: '#94a3b8',
                textDecoration: 'underline', cursor: activating ? 'wait' : 'pointer', fontSize: 'inherit',
              }}
            >
              Arranque automático no Mac (1×)
            </button>
          </p>
        )}
        {agentStatus === 'offline' && deviceChoice === 'windows' && (
          <p style={{ margin: '0.45rem 0 0', fontSize: '0.72rem', color: '#64748b', lineHeight: 1.45 }}>
            Requisitos: Node.js + projecto em <code style={{ color: '#94a3b8' }}>C:\EcoomTaskForce</code> ·
            PC no hotspot do telemóvel · PowerShell aberto enquanto pesquisas.
          </p>
        )}
        {isBrowserAgentChoice(deviceChoice) && (
          <div style={{ marginTop: '0.55rem', padding: '0.55rem 0.65rem', background: 'rgba(245,210,108,0.06)', border: '1px solid rgba(245,210,108,0.22)', borderRadius: '0.45rem' }}>
            <p style={{ margin: '0 0 0.35rem', fontSize: '0.75rem', color: '#F5D26C', fontWeight: 700 }}>
              Favorito «SPY Meta» (só 1×)
            </p>
            <p style={{ margin: '0 0 0.45rem', fontSize: '0.72rem', color: '#cbd5e1', lineHeight: 1.45 }}>
              1) Activar · 2) Copiar código (versão nova, ~20KB) · 3) Colar no favorito «SPY Meta» ·
              4) Lançar → Abrir Meta → na Facebook toca o favorito. Mantém o /spy aberto.
            </p>
            <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'stretch' }}>
              <button
                type="button"
                onClick={copyBookmarklet}
                style={{
                  flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.3rem',
                  padding: '0.45rem', background: 'rgba(245,210,108,0.15)',
                  border: '1px solid rgba(245,210,108,0.4)', borderRadius: '0.4rem',
                  color: '#F5D26C', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer',
                }}
              >
                {bookmarkCopied ? <Check size={12} /> : <Copy size={12} />}
                {bookmarkCopied ? 'Copiado' : 'Copiar código do favorito'}
              </button>
              <button
                type="button"
                onClick={() => setShowBookmarkHelp((v) => !v)}
                style={{
                  padding: '0.45rem 0.55rem', background: 'transparent',
                  border: '1px solid rgba(148,163,184,0.25)', borderRadius: '0.4rem',
                  color: '#94a3b8', fontSize: '0.72rem', cursor: 'pointer',
                }}
              >
                {showBookmarkHelp ? 'Ocultar' : 'Ver URL'}
              </button>
            </div>
            {showBookmarkHelp && (
              <code style={{
                display: 'block', marginTop: '0.45rem', padding: '0.4rem',
                fontSize: '0.6rem', lineHeight: 1.4, color: '#94a3b8', wordBreak: 'break-all',
                background: '#0c0f14', borderRadius: '0.35rem',
              }}>
                {bookmarkletCode}
              </code>
            )}
            <p style={{ margin: '0.4rem 0 0', fontSize: '0.68rem', color: '#64748b', lineHeight: 1.4 }}>
              Depois: Activar → Lançar → «Abrir Meta» → na tab Facebook toca «SPY Meta».
            </p>
          </div>
        )}
        {agentStatus === 'connected' && isBrowserAgentChoice(deviceChoice) && (
          <p style={{ margin: '0.45rem 0 0', fontSize: '0.72rem', color: '#64748b', lineHeight: 1.45 }}>
            Mantém este ecrã aberto. Quando aparecer «Abrir Meta», toca e depois o favorito na tab Facebook.
          </p>
        )}
      </div>
    </div>
  )
}
