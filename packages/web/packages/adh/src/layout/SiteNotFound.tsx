'use client'

import { useEffect, type ReactNode } from 'react'
import { usePathname, useRouter } from 'next/navigation'

export type SiteNotFoundProps = {
  /** The URL-fragment marker a site-switch navigation carries, e.g. `#site-switch`. Injected
   *  rather than imported: the constant is adh VOCABULARY living in
   *  `@agentic-toolkit/adh-registry`. This package does declare that sibling now — the prop is
   *  a DESIGN choice, not a boundary the build enforces: it keeps this 404 body a registry-free
   *  primitive a non-adh host can render. `@agentic-toolkit/adh/layout`'s AppShell wraps it and
   *  passes `SITE_SWITCH_HASH`, so adh call sites keep their current props. */
  siteSwitchHash: string
  /** The normal 404 UI to show when this isn't a site-switch up-walk. */
  children?: ReactNode
}

/**
 * Shared `not-found` body. When a navigation came from the site-switcher (the
 * URL carries the site-switch hash) and the exact route doesn't exist here,
 * walk the path up one segment at a time until a real route resolves —
 * `…/home/foo` → `…/home` → `/`. Normal 404s (no marker) render as-is.
 * Cross-origin-safe: each site resolves its own routes; no knowledge of others.
 */
export function SiteNotFound({ siteSwitchHash, children }: SiteNotFoundProps) {
  const pathname = usePathname() ?? '/'
  const router = useRouter()

  useEffect(() => {
    if (typeof window === 'undefined') return
    // Recognize the marker even when an SSO exchange code rode in alongside it:
    // a signed-in switch lands as `#site-switch&code=…` (the AS appends the code
    // to the existing fragment), and the auth provider may have already stripped
    // it back to a bare `#site-switch`. Either form means "site-switch up-walk".
    const hash = window.location.hash
    if (hash !== siteSwitchHash && !hash.startsWith(`${siteSwitchHash}&`)) return
    const segments = pathname.split('/').filter(Boolean)
    if (segments.length === 0) return // already at root — let the 404 render
    segments.pop()
    const parent = segments.length ? `/${segments.join('/')}` : '/'
    // Keep the marker while walking up; drop it once we reach root so a genuine
    // missing root doesn't loop.
    router.replace(parent === '/' ? '/' : `${parent}${siteSwitchHash}`)
  }, [pathname, router, siteSwitchHash])

  return (
    <>
      {children ?? (
        <div className="adh-not-found">
          <h1 className="adh-not-found__title">404</h1>
          <p className="adh-not-found__text">This page could not be found.</p>
          <a className="adh-not-found__link" href="/">
            Go to the home page
          </a>
        </div>
      )}
    </>
  )
}
