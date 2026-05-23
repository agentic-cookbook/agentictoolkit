'use client'

import type { ComponentType } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

// Consumers receive Lucide icons through a different @types/react realm
// (workspace pnpm store vs. app's node_modules), so a tight SVGProps type
// triggers "Two different types with this name exist, but they are
// unrelated." Accept any className-bearing component instead.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type NavLinkIcon = ComponentType<any>

export type NavLink = {
  label: string
  href: string
  matchPaths?: string[]
  icon?: NavLinkIcon
}

export type NavLinkItemProps = {
  link: NavLink
}

export function pathMatches(pathname: string, pattern: string): boolean {
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
    <Link
      href={link.href}
      aria-current={active ? 'page' : undefined}
      className="adh-header__nav-link"
      data-active={active ? '' : undefined}
    >
      {link.label}
    </Link>
  )
}
