'use client'

import { useEffect, useState, type ReactNode } from 'react'

export interface DismissibleHintProps {
  id: string
  children?: ReactNode
  className?: string
}

const STORAGE_PREFIX = 'aws-hint-dismissed:'

function readDismissed(id: string): boolean {
  if (typeof window === 'undefined') return false
  try {
    return window.localStorage.getItem(STORAGE_PREFIX + id) === '1'
  } catch {
    return false
  }
}

function writeDismissed(id: string): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(STORAGE_PREFIX + id, '1')
  } catch {
    /* ignore */
  }
}

export function DismissibleHint({ id, children, className }: DismissibleHintProps) {
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    setDismissed(readDismissed(id))
  }, [id])

  if (dismissed) return null

  const cls = ['aws-hint', className].filter(Boolean).join(' ')

  return (
    <div className={cls} role="note">
      <span className="aws-hint__text">{children}</span>
      <button
        type="button"
        className="aws-hint__close"
        aria-label="Dismiss"
        onClick={() => {
          writeDismissed(id)
          setDismissed(true)
        }}
      >
        ×
      </button>
    </div>
  )
}
