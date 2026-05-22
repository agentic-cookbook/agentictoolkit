'use client'

import { usePathname } from 'next/navigation'
import { cn } from '@agentic-web-toolkit/ui'

export type NavLink = {
  label: string
  href: string
  matchPaths?: string[]
}

export type NavLinkItemProps = {
  link: NavLink
}

function pathMatches(pathname: string, pattern: string): boolean {
  if (pattern === pathname) return true
  if (pattern.endsWith('/*')) {
    const prefix = pattern.slice(0, -2)
    return pathname === prefix || pathname.startsWith(`${prefix}/`)
  }
  return false
}

export function NavLinkItem({ link }: NavLinkItemProps) {
  const pathname = usePathname() ?? ''
  const matchers = link.matchPaths ?? [link.href]
  const active = matchers.some((m) => pathMatches(pathname, m))
  return (
    <a
      href={link.href}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'text-sm transition-colors hover:text-[var(--color-accent)]',
        active ? 'text-[var(--color-accent)]' : 'text-[var(--color-text-secondary)]',
      )}
    >
      {link.label}
    </a>
  )
}
