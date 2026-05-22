'use client'

import type { ReactNode } from 'react'

export type AdhUser = {
  name: string
  email?: string
  imageUrl?: string
}

export type AdhHeaderProps = {
  siteName: string
  siteNameEmphasis?: string
  homeHref?: string
  children?: ReactNode
}

export function AdhHeader({
  siteName,
  siteNameEmphasis,
  homeHref = '/',
  children,
}: AdhHeaderProps) {
  return (
    <header
      className="flex h-14 items-center gap-3 border-b border-[var(--color-border)] bg-[var(--color-surface)] px-4 text-[var(--color-text-primary)]"
      role="banner"
    >
      <a
        href={homeHref}
        className="flex items-center gap-2 text-sm font-semibold text-[var(--color-text-primary)] hover:text-[var(--color-accent)]"
      >
        {siteNameEmphasis && (
          <span className="text-[var(--color-accent)]">{siteNameEmphasis}</span>
        )}
        <span>{siteName}</span>
      </a>
      <div className="flex-1" />
      <div className="flex items-center gap-2">{children}</div>
    </header>
  )
}
