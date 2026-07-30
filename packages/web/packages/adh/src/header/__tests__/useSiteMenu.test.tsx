import { describe, it, expect, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import { Users, Network } from 'lucide-react'

// useSiteMenu resolves the declarative config into PopoverEntry rows — this covers
// the enhanced bits (recipe T4/T5): `inline` groups become INDENTED leaf entries,
// and every row's icon resolves from the menu-icons single source of truth.

vi.mock('next/navigation', () => ({
  usePathname: () => '/',
  useRouter: () => ({ push: vi.fn() }),
}))

import { useSiteMenu } from '../useSiteMenu'
import { hubCoreGroups } from '../hubCoreGroups'
import { type PopoverEntry } from '@agentic-toolkit/adh/header'

const leaf = (entries: PopoverEntry[], key: string) =>
  entries.find((e): e is Extract<PopoverEntry, { kind: 'leaf' }> => e.kind === 'leaf' && e.item.key === key)

describe('useSiteMenu', () => {
  it('renders inline groups as indented leaf entries and resolves icons from the SoT (T4/T5)', () => {
    const { result } = renderHook(() => useSiteMenu(hubCoreGroups(true), { currentSiteId: 'hub' }))
    const entries = result.current.entries

    // The Hub row is a leaf and NOT indented (it's the parent).
    expect(leaf(entries, 'hub')?.indent).toBeFalsy()

    // An inline SITE sub-item is indented and carries its reused icon (Community → Users).
    const community = leaf(entries, 'community')
    expect(community?.indent).toBe(true)
    expect(community?.item.icon).toBe(Users)

    // An inline ROUTE sub-item resolves its icon by route path (Products → Network).
    const eco = leaf(entries, 'route:/products')
    expect(eco?.indent).toBe(true)
    expect(eco?.item.icon).toBe(Network)
  })

  // The SSO wrap is what makes a cross-site hop land ALREADY signed in (the AS bounces
  // an exchange #code straight to the destination). The suite has a real AS that
  // allow-lists `https://*.dev.local`, so a local hop must be wrapped exactly like a
  // deployed one — skipping it is why switching to a satellite showed a logged-out
  // header until the destination probed for itself.
  it('SSO-wraps a cross-site hop in the local dev suite (same env as the current site)', () => {
    const loc = Object.getOwnPropertyDescriptor(window, 'location')
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { host: 'hub-mybranch.dev.local', hostname: 'hub-mybranch.dev.local' },
    })
    try {
      const resolveHref = vi.fn((href: string) => `https://as.test/authorize?return=${encodeURIComponent(href)}`)
      const { result } = renderHook(() =>
        useSiteMenu(hubCoreGroups(true), { currentSiteId: 'hub', resolveHref }),
      )

      const href = leaf(result.current.entries, 'community')?.item.href
      expect(resolveHref).toHaveBeenCalled()
      expect(href).toContain('https://as.test/authorize?return=')
      expect(decodeURIComponent(href ?? '')).toContain('community.hub-mybranch.dev.local')
    } finally {
      if (loc) Object.defineProperty(window, 'location', loc)
    }
  })

  it('exposes a homeHref for the auth top section', () => {
    const { result } = renderHook(() => useSiteMenu(hubCoreGroups(true), { currentSiteId: 'hub' }))
    expect(typeof result.current.homeHref).toBe('string')
    expect(result.current.homeHref.length).toBeGreaterThan(0)
  })

  it('resolves authed in-hub route rows against personalSlug off a workspace path (hub apex)', () => {
    // usePathname is mocked to '/' (the apex) — no active workspace slug — so the shared authed
    // rows must fall back to the personal slug instead of a slug-less /products (which 404s).
    const { result } = renderHook(() =>
      useSiteMenu(hubCoreGroups(true), { currentSiteId: 'hub', personalSlug: 'me' }),
    )
    expect(leaf(result.current.entries, 'route:/products')?.item.href).toBe('/me/products')
  })
})
