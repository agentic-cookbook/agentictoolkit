'use client'

import { useEffect, useState } from 'react'

export type AppearanceModeToggleProps = {
  className?: string
}

type AppearanceMode = 'auto' | 'light' | 'dark'
type ResolvedAppearance = 'light' | 'dark'

const APPEARANCE_CYCLE_EVENT = 'awt:appearance-cycle'
const APPEARANCE_CHANGED_EVENT = 'awt:appearance-changed'

function readAppearance(): { mode: AppearanceMode; resolved: ResolvedAppearance } {
  if (typeof document === 'undefined') return { mode: 'auto', resolved: 'light' }
  const raw = document.documentElement.dataset.appearanceMode
  const mode: AppearanceMode = raw === 'light' || raw === 'dark' || raw === 'auto' ? raw : 'auto'
  const resolved: ResolvedAppearance = document.documentElement.classList.contains('dark') ? 'dark' : 'light'
  return { mode, resolved }
}

function useAppearanceState() {
  const [state, setState] = useState(readAppearance)
  useEffect(() => {
    const onChange = () => setState(readAppearance())
    window.addEventListener(APPEARANCE_CHANGED_EVENT, onChange)
    return () => window.removeEventListener(APPEARANCE_CHANGED_EVENT, onChange)
  }, [])
  return state
}

export function AppearanceModeToggle({ className }: AppearanceModeToggleProps) {
  const { mode, resolved } = useAppearanceState()
  const isDark = resolved === 'dark'
  const isAuto = mode === 'auto'

  const label = isAuto
    ? `Appearance: Auto (currently ${resolved}). Click to switch to dark.`
    : mode === 'dark'
      ? 'Dark mode — click for light'
      : 'Light mode — click for auto'

  const cls = ['awt-appearance-mode-toggle', className].filter(Boolean).join(' ')

  const handleClick = () => {
    if (typeof window === 'undefined') return
    window.dispatchEvent(new CustomEvent(APPEARANCE_CYCLE_EVENT))
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className={cls}
      aria-label={label}
      title={label}
    >
      {isDark ? <MoonIcon /> : <SunIcon />}
      {isAuto && <AutoBadge />}
    </button>
  )
}

function MoonIcon() {
  return (
    <svg
      className="awt-appearance-mode-toggle__icon"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"
      />
    </svg>
  )
}

function SunIcon() {
  return (
    <svg
      className="awt-appearance-mode-toggle__icon"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"
      />
    </svg>
  )
}

function AutoBadge() {
  return (
    <span className="awt-appearance-mode-toggle__badge">
      <svg
        className="awt-appearance-mode-toggle__badge-icon"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={3}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
      </svg>
    </span>
  )
}
