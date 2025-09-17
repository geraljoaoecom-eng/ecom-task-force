// Esquema de cores para filtros - mantém consistência em toda a aplicação

export const FILTER_COLORS = {
  nichos: {
    emoji: '❤️',
    bg: 'bg-red-500/20',
    text: 'text-red-400',
    border: 'border-red-500/30',
    classes: 'bg-red-500/20 text-red-400 border-red-500/30'
  },
  estrategias: {
    emoji: '📈',
    bg: 'bg-yellow-500/20',
    text: 'text-yellow-400',
    border: 'border-yellow-500/30',
    classes: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'
  },
  produtos: {
    emoji: '📦',
    bg: 'bg-purple-500/20',
    text: 'text-purple-400',
    border: 'border-purple-500/30',
    classes: 'bg-purple-500/20 text-purple-400 border-purple-500/30'
  },
  idiomas: {
    emoji: '🌐',
    bg: 'bg-blue-500/20',
    text: 'text-blue-400',
    border: 'border-blue-500/30',
    classes: 'bg-blue-500/20 text-blue-400 border-blue-500/30'
  },
  paises: {
    emoji: '🌍',
    bg: 'bg-green-500/20',
    text: 'text-green-400',
    border: 'border-green-500/30',
    classes: 'bg-green-500/20 text-green-400 border-green-500/30'
  },
  status: {
    emoji: '📊',
    bg: 'bg-orange-500/20',
    text: 'text-orange-400',
    border: 'border-orange-500/30',
    classes: 'bg-orange-500/20 text-orange-400 border-orange-500/30'
  }
} as const

export type FilterType = keyof typeof FILTER_COLORS

export function getFilterColors(filterType: string): string {
  const type = filterType as FilterType
  return FILTER_COLORS[type]?.classes || 'bg-gray-500/20 text-gray-400 border-gray-500/30'
}

export function getFilterEmoji(filterType: string): string {
  const type = filterType as FilterType
  return FILTER_COLORS[type]?.emoji || '🏷️'
}

export function getFilterTextColor(filterType: string): string {
  const type = filterType as FilterType
  return FILTER_COLORS[type]?.text || 'text-gray-400'
}
