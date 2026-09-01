/** Plataforma do agente SPY (auto-detectada). */
export type SpyDeviceChoice = 'mac' | 'windows' | 'linux' | 'ipad' | 'iphone'

export type SpyDeviceForm = 'desktop' | 'tablet' | 'mobile'
export type SpyDeviceOs = 'macos' | 'windows' | 'ios' | 'linux' | 'other'

export interface SpyDeviceContext {
  platform: SpyDeviceChoice
  form: SpyDeviceForm
  os: SpyDeviceOs
  formLabel: string
  osLabel: string
}

function detectHardwarePlatform(): SpyDeviceChoice | 'other' {
  if (typeof navigator === 'undefined') return 'mac'
  const ua = navigator.userAgent
  if (/iPad/i.test(ua) || (navigator.maxTouchPoints > 1 && /Macintosh/i.test(ua))) return 'ipad'
  if (/iPhone|iPod/i.test(ua)) return 'iphone'
  if (/Windows/i.test(ua)) return 'windows'
  if (/Macintosh|Mac OS X/i.test(ua)) return 'mac'
  if (/Linux/i.test(ua) && !/Android/i.test(ua)) return 'linux'
  return 'other'
}

function platformToContext(platform: SpyDeviceChoice): SpyDeviceContext {
  switch (platform) {
    case 'iphone':
      return { platform, form: 'mobile', os: 'ios', formLabel: 'Mobile', osLabel: 'iOS' }
    case 'ipad':
      return { platform, form: 'tablet', os: 'ios', formLabel: 'Tablet', osLabel: 'iOS' }
    case 'windows':
      return { platform, form: 'desktop', os: 'windows', formLabel: 'Desktop', osLabel: 'Windows' }
    case 'linux':
      return { platform, form: 'desktop', os: 'linux', formLabel: 'Desktop', osLabel: 'Linux' }
    default:
      return { platform: 'mac', form: 'desktop', os: 'macos', formLabel: 'Desktop', osLabel: 'macOS' }
  }
}

/** Detecta automaticamente dispositivo + OS (sem escolha manual). */
export function getSpyDeviceContext(): SpyDeviceContext {
  const hw = detectHardwarePlatform()
  if (hw === 'other') return platformToContext('mac')
  return platformToContext(hw)
}

/** Plataforma do agente para API/jobs. */
export function getSpyDeviceChoice(): SpyDeviceChoice {
  return getSpyDeviceContext().platform
}

/** @deprecated escolha manual removida — mantido por compatibilidade */
export function setSpyDeviceChoice(_choice: SpyDeviceChoice) {
  // noop — detecção automática
}

export type SpyDeviceMode = SpyDeviceChoice

export function getSpyDeviceMode(): SpyDeviceChoice {
  return getSpyDeviceChoice()
}

export function isDesktopBridgeChoice(choice: SpyDeviceChoice = getSpyDeviceChoice()): boolean {
  return choice === 'mac' || choice === 'windows' || choice === 'linux'
}

export function isBrowserAgentChoice(choice: SpyDeviceChoice = getSpyDeviceChoice()): boolean {
  return choice === 'ipad' || choice === 'iphone'
}

export function detectCurrentHardware(): SpyDeviceChoice | 'other' {
  return detectHardwarePlatform()
}

export function choiceMatchesCurrentDevice(_choice?: SpyDeviceChoice): boolean {
  return true
}

export function isSpyTabletDevice(): boolean {
  const { form } = getSpyDeviceContext()
  return form === 'tablet' || form === 'mobile'
}

export function agentMatchesChoice(
  agent: { platform?: string; deviceName?: string },
  choice: SpyDeviceChoice = getSpyDeviceChoice()
): boolean {
  const platform = String(agent.platform || '').toLowerCase()
  const name = String(agent.deviceName || '')
  if (platform === choice) return true
  if (choice === 'ipad' && (/iPad/i.test(name) || platform === 'ipad')) return true
  if (choice === 'iphone' && (/iPhone/i.test(name) || platform === 'iphone')) return true
  if (choice === 'mac' && (/Mac/i.test(name) || platform === 'mac')) return true
  if (choice === 'windows' && (/Win/i.test(name) || platform === 'windows' || platform === 'win32')) return true
  if (choice === 'linux' && (platform === 'linux' || /Linux/i.test(name))) return true
  return false
}

export const SPY_MODE_INFO = {
  mac: {
    title: 'Desktop · macOS',
    activate: 'Liga dados móveis (hotspot/USB) → Activar ponte local',
    note: 'O scroll na Meta corre neste Mac com IP 4G/5G. Wi‑Fi fixa bloqueia a pesquisa.',
  },
  windows: {
    title: 'Desktop · Windows',
    activate: 'Hotspot/USB tether → PowerShell → Activar',
    note: 'O PC tem de sair pelos dados móveis. Sem Wi‑Fi fixa.',
  },
  linux: {
    title: 'Desktop · Linux',
    activate: 'Hotspot/USB tether → terminal → Activar ponte local',
    note: 'O scroll corre neste PC com IP 4G/5G.',
  },
  ipad: {
    title: 'Tablet · iOS',
    activate: 'Dados móveis → Activar → favorito «SPY Meta»',
    note: 'Safari no iPad com 4G/5G. Mantém este ecrã aberto.',
  },
  iphone: {
    title: 'Mobile · iOS',
    activate: 'Dados móveis → Activar → favorito «SPY Meta»',
    note: 'Safari no iPhone com 4G/5G. Mantém este ecrã aberto.',
  },
} as const

export function spyStartBlockedMessage(choice: SpyDeviceChoice = getSpyDeviceChoice()): string {
  const ctx = platformToContext(choice)
  const mode = SPY_MODE_INFO[choice]

  if (isBrowserAgentChoice(choice)) {
    return (
      `🚫 SPY bloqueado — ${ctx.formLabel} · ${ctx.osLabel}\n\n` +
      '1. Liga dados móveis (desliga Wi‑Fi)\n' +
      '2. Toca Activar e mantém este ecrã aberto\n' +
      '3. Favorito «SPY Meta» no Safari (1×)'
    )
  }

  return (
    `🚫 SPY bloqueado — ${mode.title}\n\n` +
    '1. Liga o dispositivo aos dados móveis (hotspot ou USB tether)\n' +
    '2. Corre a ponte local e toca Activar\n' +
    '3. Aguarda «Dados móveis OK» antes de pesquisar'
  )
}

export function mobileAgentPagePath(): string {
  return '/spy/ipad-agent'
}
