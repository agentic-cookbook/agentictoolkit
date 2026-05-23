'use client'

import { themeIds, themes, type ThemeKey } from '@agentic-toolkit/themes'

export interface ThemePickerProps {
  value: ThemeKey
  onChange: (next: ThemeKey) => void
  className?: string
}

export function ThemePicker({ value, onChange, className }: ThemePickerProps) {
  return (
    <div className={['awt-theme-picker', className].filter(Boolean).join(' ')}>
      {themeIds.map((id) => (
        <button
          key={id}
          type="button"
          className="awt-theme-picker__btn"
          aria-pressed={id === value}
          onClick={() => onChange(id)}
        >
          {themes[id].label}
        </button>
      ))}
    </div>
  )
}
