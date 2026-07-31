import { describe, it, expect, vi, afterEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Users, Network } from 'lucide-react'
import { DEV_DEPLOYMENT_ENVS } from '@agentic-toolkit/adh-registry/deployment-env'

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

  // The cross-site theme carry: picking a theme on one site and hopping to another keeps
  // it, via an `#adh-theme=` fragment on the destination. Dev-only, and this hook runs on
  // every page of every site — so it is gated twice over, and both gates are silent when
  // they break. The presence of AdhThemeStyle's alt-theme <style> nodes is the runtime
  // gate (production emits none); DEV_BUILD is the build-time one that keeps the
  // theme-preview helpers out of the bundle every production page loads.
  describe('cross-site theme carry', () => {
    // Both fixtures AWAIT the body: the hook is imported dynamically below, so a
    // synchronous `finally` would tear the page state down before the render it is for.
    async function atDevLocal<T>(fn: () => Promise<T>): Promise<T> {
      const loc = Object.getOwnPropertyDescriptor(window, 'location')
      Object.defineProperty(window, 'location', {
        configurable: true,
        value: { host: 'hub-mybranch.dev.local', hostname: 'hub-mybranch.dev.local' },
      })
      try {
        return await fn()
      } finally {
        if (loc) Object.defineProperty(window, 'location', loc)
      }
    }

    /** A page that HAS a switcher: one alt-theme block plus a stored choice. */
    async function withSwitcherPayload<T>(fn: () => Promise<T>): Promise<T> {
      const style = document.createElement('style')
      style.setAttribute('data-adh-theme-alt', 'green-matrix')
      document.head.appendChild(style)
      localStorage.setItem('adh-theme', 'green-matrix')
      try {
        return await fn()
      } finally {
        style.remove()
        localStorage.removeItem('adh-theme')
      }
    }

    /**
     * The href of a CROSS-SITE row (community lives on its own subdomain), as resolved by
     * a build for `env`.
     *
     * DEV_BUILD is read from NEXT_PUBLIC_DEPLOYMENT_ENV at module load — that is what makes
     * it foldable — so switching builds means re-importing the hook. React and the renderer
     * come from the same fresh graph deliberately: pulling the hook fresh while rendering
     * with the already-imported React gives two React copies and a null-dispatcher crash.
     */
    async function communityHrefIn(env: string): Promise<string | undefined> {
      vi.resetModules()
      vi.stubEnv('NEXT_PUBLIC_DEPLOYMENT_ENV', env)
      const [{ useSiteMenu: hook }, { hubCoreGroups: groups }, { renderHook: render }] =
        await Promise.all([
          import('../useSiteMenu'),
          import('../hubCoreGroups'),
          import('@testing-library/react'),
        ])
      const { result } = render(() => hook(groups(true), { currentSiteId: 'hub' }))
      return leaf(result.current.entries, 'community')?.item.href
    }

    afterEach(() => {
      vi.unstubAllEnvs()
      vi.resetModules()
    })

    it('carries the previewed theme to another site in a dev build', async () => {
      // The dev half, and the reason the fold is tested from both sides: gating the carry
      // is easy to get wrong in the direction of breaking dev, which no production check
      // would ever notice.
      const href = await atDevLocal(() => withSwitcherPayload(() => communityHrefIn('testing')))
      expect(href).toContain('community.hub-mybranch.dev.local')
      expect(href).toContain('#adh-theme=green-matrix')
    })

    it('carries nothing in a production build, even handed a switcher payload', async () => {
      // The build gate on its own: same page state that carries above — alt-theme block
      // present, choice stored — and the production build still tags nothing. So the two
      // gates are independent rather than one dressed as two.
      const href = await atDevLocal(() =>
        withSwitcherPayload(() => communityHrefIn('production')),
      )
      expect(href).toContain('community.hub-mybranch.dev.local')
      expect(href).not.toContain('adh-theme')
    })

    it('carries nothing when the page has no switcher payload', async () => {
      // The runtime gate on its own: a dev BUILD whose page has no alt-theme <style> nodes
      // — which is what production renders (see themeSwitcherProductionGate.test.tsx), and
      // also a dev page before the payload exists. A theme cookie left on the registrable
      // domain by a dev session must not start tagging hrefs on its own.
      localStorage.setItem('adh-theme', 'green-matrix')
      try {
        const href = await atDevLocal(() => communityHrefIn('testing'))
        expect(href).toContain('community.hub-mybranch.dev.local')
        expect(href).not.toContain('adh-theme')
      } finally {
        localStorage.removeItem('adh-theme')
      }
    })

    it('routes both carry sites through the build fold', () => {
      // Source text, because this is a BUNDLING property with no runtime symptom: the tests
      // above still pass if the ternary is replaced by a plain call plus a null check, but
      // the theme-preview helpers then ship in the chunk every production page loads. The
      // written-out comparison is what lets the bundler drop them — `DEV_BUILD ?` reads the
      // same but is an identifier, which the bundler will not fold through (see the
      // chunk-gate contract in adh-registry's deployment-env, and productionBundleGates.test.ts for
      // the rest of the mechanism).
      const here = dirname(fileURLToPath(import.meta.url))
      const src = readFileSync(resolve(here, '../useSiteMenu.ts'), 'utf8').replace(/\s+/g, ' ')
      const fold = DEV_DEPLOYMENT_ENVS.map(
        (env) => `process.env.NEXT_PUBLIC_DEPLOYMENT_ENV === '${env}'`,
      ).join(' || ')
      for (const helper of ['readPreviewTheme()', 'appendThemePreview(']) {
        const calls = src.split(helper).length - 1
        expect(calls, `${helper} not found`).toBeGreaterThan(0)
        expect(src.split(`${fold} ? ${helper}`).length - 1, `${helper} is called unguarded`).toBe(
          calls,
        )
      }
    })
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
