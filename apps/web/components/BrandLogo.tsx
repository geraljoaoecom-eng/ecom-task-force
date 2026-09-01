'use client'

import type { CSSProperties } from 'react'
import { APP_NAME, LOGO_SRC } from '@/lib/brand'

type BrandLogoProps = {
  /** Largura máxima do logo (a imagem já inclui o nome) */
  maxWidth?: number | string
  maxHeight?: number | string
  className?: string
  style?: CSSProperties
  showName?: boolean
}

export function BrandLogo({
  maxWidth = 200,
  maxHeight = 72,
  className,
  style,
  showName = false,
}: BrandLogoProps) {
  return (
    <div
      className={className}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: showName ? '0.35rem' : 0,
        ...style,
      }}
    >
      <img
        src={LOGO_SRC}
        alt={APP_NAME}
        style={{
          width: '100%',
          maxWidth,
          maxHeight,
          height: 'auto',
          objectFit: 'contain',
          display: 'block',
        }}
      />
      {showName && (
        <span
          style={{
            color: '#94a3b8',
            fontSize: '0.6875rem',
            letterSpacing: '0.04em',
            textTransform: 'none',
          }}
        >
          {APP_NAME}
        </span>
      )}
    </div>
  )
}
