'use client'

import type { ComponentType, SVGProps } from 'react'
import { usePathname } from 'next/navigation'

export type NavLinkIcon = ComponentType<SVGProps<SVGSVGElement> & { className?: string }>

export type NavLink = {
  label: string
  href: string
  matchPaths?: string[]
  icon?: NavLinkIcon
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
      className="adh-header__nav-link"
      data-active={active ? '' : undefined}
    >
      {link.label}
    </a>
  )
}
