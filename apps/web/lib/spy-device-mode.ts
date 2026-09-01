/** Dispositivo escolhido pelo utilizador para correr o SPY móvel. */
export type SpyDeviceChoice = 'mac' | 'windows' | 'ipad' | 'iphone'

const STORAGE_KEY = 'ecom_spy_device_choice'

export function getSpyDeviceChoice(): SpyDeviceChoice {
  if (typeof window === 'undefined') return 'mac'
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw === 'mac' || raw === 'windows' || raw === 'ipad' || raw === 'iphone') return raw
  } catch {
    // ignore
  }
  return inferDefaultChoice()
}

export function setSpyDeviceChoice(choice: SpyDeviceChoice) {
  localStorage.setItem(STORAGE_KEY, choice)
}

/** @deprecated use getSpyDeviceChoice */
export type SpyDeviceMode = SpyDeviceChoice

/** @deprecated use getSpyDeviceChoice */
export function getSpyDeviceMode(): SpyDeviceChoice {
  return getSpyDeviceChoice()
}

function inferDefaultChoice(): SpyDeviceChoice {
  if (typeof navigator === 'undefined') return 'mac'
  const ua = navigator.userAgent
  if (/iPad/i.test(ua) || (navigator.maxTouchPoints > 1 && /Macintosh/i.test(ua))) return 'ipad'
  if (/iPhone|iPod/i.test(ua)) return 'iphone'
  if (/Windows/i.test(ua)) return 'windows'
  return 'mac'
}

/** Mac ou Windows — agente Node local (Playwright), não favorito Safari. */
export function isDesktopBridgeChoice(choice: SpyDeviceChoice = getSpyDeviceChoice()): boolean {
  return choice === 'mac' || choice === 'windows'
}

export function isBrowserAgentChoice(choice: SpyDeviceChoice = getSpyDeviceChoice()): boolean {
  return choice === 'ipad' || choice === 'iphone'
}

/** Detecta hardware actual (não a escolha do utilizador). */
export function detectCurrentHardware(): 'mac' | 'windows' | 'ipad' | 'iphone' | 'other' {
  if (typeof navigator === 'undefined') return 'other'
  const ua = navigator.userAgent
  if (/iPad/i.test(ua) || (navigator.maxTouchPoints > 1 && /Macintosh/i.test(ua))) return 'ipad'
  if (/iPhone|iPod/i.test(ua)) return 'iphone'
  if (/Windows/i.test(ua)) return 'windows'
  if (/Macintosh|Mac OS X/i.test(ua)) return 'mac'
  return 'other'
}

export function choiceMatchesCurrentDevice(choice: SpyDeviceChoice = getSpyDeviceChoice()): boolean {
  const hw = detectCurrentHardware()
  if (choice === 'mac') return hw === 'mac'
  if (choice === 'windows') return hw === 'windows'
  if (choice === 'ipad') return hw === 'ipad'
  if (choice === 'iphone') return hw === 'iphone'
  return false
}

/** @deprecated */
export function isSpyTabletDevice(): boolean {
  const hw = detectCurrentHardware()
  return hw === 'ipad' || hw === 'iphone'
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
  return false
}

export const SPY_DEVICE_CHOICES: { id: SpyDeviceChoice; label: string; short: string }[] = [
  { id: 'mac', label: 'Mac', short: 'Ponte local + scroll automático' },
  { id: 'windows', label: 'Windows', short: 'PC + hotspot / dados móveis' },
  { id: 'ipad', label: 'iPad', short: 'Activar + favorito SPY Meta' },
  { id: 'iphone', label: 'iPhone', short: 'Activar + favorito SPY Meta' },
]

export const SPY_MODE_INFO = {
  mac: {
    title: 'Modo Mac',
    activate: 'Activar → ponte local (Wi-Fi + iPhone USB ou hotspot)',
    note: 'O scroll na Meta corre no Mac. iPad/iPhone podem ficar desligados.',
  },
  windows: {
    title: 'Modo Windows',
    activate: 'Liga o PC ao hotspot do telemóvel → PowerShell → Activar',
    note: 'O Windows tem de sair pelo IP dos dados móveis (hotspot/USB tether). Sem Wi‑Fi fixa.',
  },
  ipad: {
    title: 'Modo iPad',
    activate: 'Activar (dados móveis) → Abrir Meta → favorito «SPY Meta»',
    note: 'IP do iPad (dados móveis). O favorito injecta o scroll na Meta — cria-o 1×.',
  },
  iphone: {
    title: 'Modo iPhone',
    activate: 'Activar (dados móveis) → Abrir Meta → favorito «SPY Meta»',
    note: 'IP do iPhone (dados móveis). O favorito injecta o scroll na Meta — cria-o 1×.',
  },
} as const

export function spyStartBlockedMessage(choice: SpyDeviceChoice = getSpyDeviceChoice()): string {
  if (choice === 'ipad' || choice === 'iphone') {
    const label = choice === 'iphone' ? 'iPhone' : 'iPad'
    return (
      `🚫 SPY BLOQUEADO (${label})\n\n` +
      `1. Modo «${label}» + dados móveis\n` +
      '2. Toca Activar e mantém este ecrã aberto\n' +
      '3. Favorito «SPY Meta» criado no Safari (1×)'
    )
  }
  if (choice === 'windows') {
    return (
      '🚫 SPY BLOQUEADO (Windows)\n\n' +
      '1. Modo «Windows» seleccionado\n' +
      '2. PC ligado ao hotspot / USB tether do telemóvel (dados móveis)\n' +
      '3. PowerShell: corre a ponte local e clica Activar'
    )
  }
  return (
    '🚫 SPY BLOQUEADO (Mac)\n\n' +
    '1. Modo «Mac» seleccionado\n' +
    '2. iPhone USB ao Mac ou hotspot (dados móveis)\n' +
    '3. Clica Activar no SPY (ponte local)'
  )
}

export function mobileAgentPagePath(_choice?: SpyDeviceChoice): string {
  return '/spy/ipad-agent'
}
