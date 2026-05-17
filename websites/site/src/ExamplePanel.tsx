'use client'

import type { CSSProperties, ReactNode } from 'react'

type Props = {
  children: ReactNode
  style?: CSSProperties
}

const baseStyle: CSSProperties = {
  position: 'relative',
  width: '100%',
  height: '100%',
  overflow: 'auto',
  padding: '1.5rem',
  textAlign: 'left',
  background: 'var(--color-surface)',
  color: 'var(--color-text-primary)',
}

export function ExamplePanel({ children, style }: Props) {
  return (
    <div className="awt-example-content" style={{ ...baseStyle, ...style }}>
      {children}
    </div>
  )
}
