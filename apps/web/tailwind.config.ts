import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        background: '#0c0f14',
        card: '#141823',
        gold: '#F5D26C',
        text: '#E8EDF2',
        muted: '#94a3b8',
        etf: {
          bg: '#0B0F16',
          card: '#121826',
          gold: '#F5D26C',
          text: '#E7ECF3',
          muted: '#93A4B8'
        }
      },
      boxShadow: {
        'gold': '0 0 30px rgba(245,210,108,.25), inset 0 0 12px rgba(245,210,108,.08)',
        etf: '0 6px 24px rgba(0,0,0,.35)',
        etfInner: 'inset 0 0 12px rgba(245,210,108,.08)',
        etfGold: '0 0 28px rgba(245,210,108,.28)'
      },
      dropShadow: {
        gold: '0 0 10px rgba(245,210,108,.35)'
      },
      borderRadius: {
        xl2: '1.25rem'
      },
      keyframes: {
        'pulse-gold': {
          '0%, 100%': {
            boxShadow: '0 0 15px rgba(245,210,108,.15)',
          },
          '50%': {
            boxShadow: '0 0 30px rgba(245,210,108,.35)',
          },
        },
        glow: {
          '0%,100%': { boxShadow: '0 0 0 rgba(245,210,108,0)' },
          '50%': { boxShadow: '0 0 22px rgba(245,210,108,.45)' }
        }
      },
      animation: {
        'pulse-gold': 'pulse-gold 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        glow: 'glow 1.4s ease-in-out infinite'
      }
    },
  },
  plugins: [],
}
export default config
