'use client'

import type { ReactNode } from 'react'
import { useLink } from '@agentic-toolkit/model'

export type HeaderProps = {
  title: string
  titleEmphasis?: string
  homeHref?: string
  onMenuToggle?: () => void
  onSearchOpen?: () => void
  rightSlot?: ReactNode
}

export function Header({
  title,
  titleEmphasis,
  homeHref = '/',
  onMenuToggle,
  onSearchOpen,
  rightSlot,
}: HeaderProps) {
  const Link = useLink()
  return (
    <header className="awt-header" role="banner">
      {onMenuToggle && (
        <button
          type="button"
          className="awt-header__action awt-header__action--icon"
          aria-label="Toggle menu"
          onClick={onMenuToggle}
        >
          ☰
        </button>
      )}
      <Link to={homeHref} className="awt-header__brand">
        {titleEmphasis && <span className="awt-header__brand-emphasis">{titleEmphasis}</span>}
        <span>{title}</span>
      </Link>
      <div className="awt-header__spacer" />
      {onSearchOpen && (
        <button
          type="button"
          className="awt-header__action"
          aria-label="Open search"
          onClick={onSearchOpen}
        >
          Search
        </button>
      )}
      {rightSlot}
    </header>
  )
}
