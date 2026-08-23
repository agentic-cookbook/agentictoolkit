import { describe, it, expect, vi, afterEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import { dirname, resolve as resolvePath } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Users, Hexagon, Handshake } from 'lucide-react'
import { DEV_DEPLOYMENT_ENVS } from '@agentic-toolkit/adh-registry/deployment-env'

// useSiteMenu resolves the declarative config into PopoverEntry rows: icons from the
// menu-icons single source of truth, hrefs per DEPLOYMENT_ENV, the SSO wrap, the
// cross-site theme carry — and the WORKSPACE carry, which is what makes picking a site
// from inside a workspace land in that same workspace rather than on a landing page.
//
// One row resolves two different ways now, which is the thing to hold on to while reading
// below: from inside a hub workspace, a signed-in visitor picking "Storage" gets the hub's
// own `/<slug>/storage` route onto that site's implementation; from anywhere else — another
// site's header, or the hub signed out — the same row is still the absolute
// `https://agenticdeveloperstorage.com/<slug>` it has always been.

const path = { current: '/' }
vi.mock('next/navigation', () => ({
  usePathname: () => path.current,
  useRouter: () => ({ push: vi.fn() }),
}))

import { useSiteMenu } from '../useSiteMenu'
import { FLEET_MENU_GROUPS } from '../fleetMenuGroups'
import { type PopoverEntry, type PopoverItem } from '@agentic-toolkit/adh/header'

/** A row anywhere in the resolved tree — top level or inside a flyout. */
const row = (entries: PopoverEntry[], key: string): PopoverItem | undefined =>
  entries
    .flatMap((e) => (e.kind === 'topic' ? e.items : [e.item]))
    .find((i) => i.key === key)

const topic = (entries: PopoverEntry[], label: string) =>
  entries.find((e): e is Extract<PopoverEntry, { kind: 'topic' }> => e.kind === 'topic' && e.label === label)

/** Render at a given location, restoring whatever jsdom had. */
function at<T>(hostname: string, pathname: string, fn: () => T): T {
  const loc = Object.getOwnPropertyDescriptor(window, 'location')
  Object.defineProperty(window, 'location', { configurable: true, value: { host: hostname, hostname } })
  const before = path.current
  path.current = pathname
  try {
    return fn()
  } finally {
    path.current = before
    if (loc) Object.defineProperty(window, 'location', loc)
  }
}

afterEach(() => {
  path.current = '/'
})

describe('useSiteMenu', () => {
  it('resolves every row\'s icon from the menu-icons SoT, submenu children included', () => {
    const { result } = renderHook(() => useSiteMenu(FLEET_MENU_GROUPS, { currentSiteId: 'hub' }))
    const entries = result.current.entries
    // A registry site inside a flyout takes the glyph the platform already uses for it.
    expect(row(entries, 'community')?.icon).toBe(Users)
    // A topic that IS a site wears that site's glyph without restating it.
    expect(topic(entries, 'Hub')?.icon).toBe(Hexagon)
    // A row with no registry site keys its own (see MenuLink's `href` variant). The
    // Studio is the family's one such row: it is a real destination the menu points at,
    // and deliberately NOT a registry entry, so it names its own `iconKey`.
    expect(row(entries, 'href:https://agenticdevelopmentstudio.com')?.icon).toBe(Handshake)
  })

  it('marks the current site, and points its row at a bare same-origin path', () => {
    const { result } = renderHook(() => useSiteMenu(FLEET_MENU_GROUPS, { currentSiteId: 'hub' }))
    expect(topic(result.current.entries, 'Hub')?.current).toBe(true)
    expect(topic(result.current.entries, 'Hub')?.href).toBe('/')
    expect(row(result.current.entries, 'cookbook')?.current).toBeFalsy()
  })

  it('leaves a row with no registry site unmarked and unwrapped', () => {
    const resolveHref = vi.fn((href: string) => `https://as.test/authorize?return=${href}`)
    const { result } = renderHook(() =>
      useSiteMenu(FLEET_MENU_GROUPS, { currentSiteId: 'hub', resolveHref }),
    )
    const studio = row(result.current.entries, 'href:https://agenticdevelopmentstudio.com')
    expect(studio?.href).toBe('https://agenticdevelopmentstudio.com')
    expect(studio?.current).toBeUndefined()
    // Verbatim means verbatim: the wrap DID run for its neighbour in the same submenu —
    // Hire ▸ Consultants, asserted here rather than pointed at, so this reads as the row
    // opting out and can never be the wrap being off for the whole render.
    expect(row(result.current.entries, 'consultants')?.href).toContain('https://as.test/authorize?return=')
    expect(resolveHref).not.toHaveBeenCalledWith('https://agenticdevelopmentstudio.com')
  })

  // ── The workspace carry ────────────────────────────────────────────────────────
  // This menu is a cross-site navigator: from inside a workspace, picking another site
  // lands in the SAME workspace on THAT site, at that site's own workspace route.
  describe('workspace carry', () => {
    it('carries the slug as ONE shape — `/<slug>` — to every site in the family', () => {
      // The three rows that used to disagree, asserted together because agreeing is the
      // point: `projects` was already `/<slug>`, `cookbook` arrived at `/home/<slug>` and
      // the hub at `/<slug>/home`. All three are `/<slug>` now, so a site's shape is no
      // longer something the carry has to know — and never the raw path we came from.
      const entries = at('agenticdeveloperstorage.com', '/acme/buckets', () =>
        renderHook(() =>
          useSiteMenu(FLEET_MENU_GROUPS, { currentSiteId: 'storage', authenticated: true }),
        ).result.current.entries,
      )
      expect(row(entries, 'projects')?.href).toBe('https://agenticdeveloperprojects.com/acme')
      expect(row(entries, 'cookbook')?.href).toBe('https://agenticdevelopercookbook.com/acme')
      expect(topic(entries, 'Hub')?.href).toBe('https://agenticdeveloperhub.com/acme')
      // The site we are already on stays a bare path — and stays IN the workspace.
      expect(row(entries, 'storage')?.href).toBe('/acme')
    })

    it('carries the slug off a hub workspace path too — as a hub ROUTE', () => {
      const entries = at('agenticdeveloperhub.com', '/acme/products', () =>
        renderHook(() =>
          useSiteMenu(FLEET_MENU_GROUPS, { currentSiteId: 'hub', authenticated: true }),
        ).result.current.entries,
      )
      // This asserted `https://agenticdeveloperstorage.com/acme` until the fleet came home.
      // The slug is still carried — that is what this describe block is about, and it is
      // unchanged — but the hub mounts Storage's own implementation at `/acme/storage`, so
      // the nearer copy wins. The full rule is the block below.
      expect(row(entries, 'storage')?.href).toBe('/acme/storage')
    })

    it('carries nothing to a site that has no workspace of its own', () => {
      const entries = at('agenticdeveloperstorage.com', '/acme/buckets', () =>
        renderHook(() =>
          useSiteMenu(FLEET_MENU_GROUPS, { currentSiteId: 'storage', authenticated: true }),
        ).result.current.entries,
      )
      // status is a deployed site with no workspace at all — no `hasHome`, no
      // `workspaceRoute`. It is the reason `workspaceRoute` is a field rather than a
      // thing read off the route tree: a site can be in the menu and in the fleet and
      // still have nowhere for a workspace slug to land. (community used to be this
      // example, and stopped being one the day it grew an `app/[workspace]`.)
      expect(row(entries, 'status')?.href).toBe('https://status.agenticdeveloperhub.com/')
    })

    it('carries nothing signed OUT, where a first segment is only a public page', () => {
      // Same path, no session. Every workspace route in the family is auth-gated, so
      // without one this is a public page that merely shares the shape — guessing a
      // slug from it would send an anonymous visitor to a stranger's workspace URL.
      const entries = at('agenticdeveloperstorage.com', '/acme/buckets', () =>
        renderHook(() => useSiteMenu(FLEET_MENU_GROUPS, { currentSiteId: 'storage' })).result
          .current.entries,
      )
      expect(row(entries, 'projects')?.href).toBe('https://agenticdeveloperprojects.com/')
    })

    it('carries nothing from a landing path, even signed in', () => {
      const entries = at('agenticdeveloperstorage.com', '/details', () =>
        renderHook(() =>
          useSiteMenu(FLEET_MENU_GROUPS, { currentSiteId: 'storage', authenticated: true }),
        ).result.current.entries,
      )
      expect(row(entries, 'projects')?.href).toBe('https://agenticdeveloperprojects.com/')
    })
  })

  // ── The in-hub reroute ─────────────────────────────────────────────────────────
  // The hub routes every fleet site's own workspace implementation under
  // `/<slug>/<segment>`, so a row picked from inside a hub workspace changes the ROUTE
  // instead of the origin: same pane, no page load, no sign-in hop. It is the narrowest
  // possible override of the carry above — one branch, four conditions — and every one of
  // those conditions is a case here, because each is a way to send someone to the wrong
  // origin (or to no destination at all).
  describe('in-hub reroute', () => {
    /** The resolved rows for a signed-in visitor inside `/acme` on the hub. */
    const inHub = (opts: { authenticated?: boolean } = { authenticated: true }) =>
      at('agenticdeveloperhub.com', '/acme/products', () =>
        renderHook(() => useSiteMenu(FLEET_MENU_GROUPS, { currentSiteId: 'hub', ...opts }))
          .result.current.entries,
      )

    it('answers a routed site with a same-origin path under the active slug', () => {
      const entries = inHub()
      // A site whose segment IS its id — the default, and the shape 30 of the 47 take.
      expect(row(entries, 'storage')?.href).toBe('/acme/storage')
      expect(row(entries, 'games')?.href).toBe('/acme/games')
      // A placeholder site routes exactly like an implemented one: the hub mounts whatever
      // model that site exports, and "coming soon" is a model. Nothing here knows which is
      // which, and that is deliberate — the day academy's model becomes real, this row is
      // already pointing at it.
      expect(row(entries, 'academy')?.href).toBe('/acme/academy')
    })

    it('uses the REGISTRY segment, not the site id, wherever the two differ', () => {
      const entries = inHub()
      // Five entries in HUB_FEATURE_SEGMENT depart from `<id>: <id>` (and two sites share
      // `products`, so 47 ids make 45 segments), always because the hub routed the feature
      // under its own name before the site existed. Taking the id would mint URLs no route
      // serves — `/acme/teamregistry` is a 404 — so the row has to ask the registry rather
      // than assume. Three of the five departures, one per reason:
      expect(row(entries, 'teamregistry')?.href).toBe('/acme/teams')      // hub's older name
      expect(row(entries, 'authentication')?.href).toBe('/acme/auth')     // hub's older name
      expect(row(entries, 'ecosystems')?.href).toBe('/acme/products')     // two sites, one pane
    })

    it('leaves a site the hub does NOT route on its own origin', () => {
      // `status` has no workspace at all, so no segment, so nothing to route to — the
      // fallback below the branch runs and it lands on its landing, exactly as it does from
      // every other site. The branch returning a path for every row is the failure this
      // guards: `/acme/status` would be a hub 404 reached from a working menu.
      expect(row(inHub(), 'status')?.href).toBe('https://status.agenticdeveloperhub.com/')
    })

    it('stays a cross-site hop signed OUT, where the hub has no workspace to show', () => {
      // The hub's workspace paths are self-identifying (the first segment is a slug unless
      // the route tree claimed the word), so a signed-out visitor on `/acme/products` still
      // resolves a slug — which is exactly why the branch checks the session as well. Every
      // one of these hub routes is behind the workspace gate, so rerouting here would put a
      // sign-in wall between the visitor and a page the site itself would have shown them.
      expect(row(inHub({}), 'storage')?.href).toBe('https://agenticdeveloperstorage.com/acme')
    })

    it('stays a cross-site hop from another SITE, even in the same workspace', () => {
      // The reroute is the hub's alone: nowhere else mounts these implementations, so the
      // menu is still the cross-site navigator `siteWorkspaceHref` describes. Same slug,
      // same target, different header — and a different answer.
      const entries = at('agenticdeveloperproducts.com', '/acme', () =>
        renderHook(() =>
          useSiteMenu(FLEET_MENU_GROUPS, { currentSiteId: 'products', authenticated: true }),
        ).result.current.entries,
      )
      expect(row(entries, 'storage')?.href).toBe('https://agenticdeveloperstorage.com/acme')
    })

    it('stays a cross-site hop off a hub path with no workspace', () => {
      // The hub landing. There is no slug to build a route from, and inventing one from the
      // personal slug would answer "switch to Storage" with someone's own workspace on a
      // page they were reading anonymously.
      const entries = at('agenticdeveloperhub.com', '/explore', () =>
        renderHook(() =>
          useSiteMenu(FLEET_MENU_GROUPS, { currentSiteId: 'hub', authenticated: true }),
        ).result.current.entries,
      )
      expect(row(entries, 'storage')?.href).toBe('https://agenticdeveloperstorage.com/')
    })

    it('neither SSO-wraps nor theme-tags a reroute — it never leaves the document', () => {
      // Both wraps exist to survive an ORIGIN change: `resolveHref` establishes a session at
      // a destination that has none, and the theme fragment re-plants a preview the next
      // document would not otherwise have. A route change carries both by staying put, and
      // running either would corrupt the href — the SSO wrap would turn `/acme/storage` into
      // an absolute AS URL and bounce the visitor out of the app to come back to where they
      // already were.
      //
      // Asserted with the wrap PROVEN LIVE on the same render (status, which is not routed,
      // goes through it), so this reads as the branch opting out rather than as a render
      // with no wrap configured.
      const resolveHref = vi.fn((href: string) => `https://as.test/authorize?return=${href}`)
      const entries = at('agenticdeveloperhub.com', '/acme/products', () =>
        renderHook(() =>
          useSiteMenu(FLEET_MENU_GROUPS, {
            currentSiteId: 'hub',
            authenticated: true,
            resolveHref,
          }),
        ).result.current.entries,
      )
      expect(row(entries, 'storage')?.href).toBe('/acme/storage')
      expect(row(entries, 'status')?.href).toContain('https://as.test/authorize?return=')
      expect(resolveHref).not.toHaveBeenCalledWith('/acme/storage')
    })

    it('leaves the hub\'s OWN row a bare workspace path', () => {
      // `hub` has no HUB_FEATURE_SEGMENT entry — it is the host, not a guest — but the row
      // is answered before the branch is even reached, by the same-site return. Both facts
      // point the same way here, and if either changed alone this row would start pointing
      // at a segment for itself.
      expect(topic(inHub(), 'Hub')?.href).toBe('/acme')
    })
  })

  // The SSO wrap is what makes a cross-site hop land ALREADY signed in (the AS bounces
  // an exchange #code straight to the destination). The suite has a real AS that
  // allow-lists `https://*.dev.local`, so a local hop must be wrapped exactly like a
  // deployed one — skipping it is why switching to a satellite showed a logged-out
  // header until the destination probed for itself.
  it('SSO-wraps a cross-site hop in the local dev suite (same env as the current site)', () => {
    at('hub-mybranch.dev.local', '/', () => {
      const resolveHref = vi.fn((href: string) => `https://as.test/authorize?return=${encodeURIComponent(href)}`)
      const { result } = renderHook(() =>
        useSiteMenu(FLEET_MENU_GROUPS, { currentSiteId: 'hub', resolveHref }),
      )

      const href = row(result.current.entries, 'community')?.href
      expect(resolveHref).toHaveBeenCalled()
      expect(href).toContain('https://as.test/authorize?return=')
      expect(decodeURIComponent(href ?? '')).toContain('community.hub-mybranch.dev.local')
    })
  })

  it('exposes a homeHref for the auth top section', () => {
    const { result } = renderHook(() => useSiteMenu(FLEET_MENU_GROUPS, { currentSiteId: 'hub' }))
    expect(typeof result.current.homeHref).toBe('string')
    expect(result.current.homeHref.length).toBeGreaterThan(0)
  })

  it('leaves homeHref slug-less on the hub, even holding a personalSlug', () => {
    // `/home` is the family's "take me to my workspace" URL: it resolves the stored
    // preference (falling back to the user's own workspace) and replaces itself with
    // `/<workspace>`. So it is a redirect SIGNAL, not a page under a slug — prefixing it
    // to `/me/home` would name a route no site has since the workspace moved to the root
    // segment. Asserted while holding a personalSlug, because that is exactly the input
    // that used to produce the prefix.
    const { result } = renderHook(() =>
      useSiteMenu(FLEET_MENU_GROUPS, { currentSiteId: 'hub', personalSlug: 'me' }),
    )
    expect(result.current.homeHref).toBe('/home')
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
      const [{ useSiteMenu: hook }, { FLEET_MENU_GROUPS: groups }, { renderHook: render }] =
        await Promise.all([
          import('../useSiteMenu'),
          import('../fleetMenuGroups'),
          import('@testing-library/react'),
        ])
      const { result } = render(() => hook(groups, { currentSiteId: 'hub' }))
      return row(result.current.entries, 'community')?.href
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
      const src = readFileSync(resolvePath(here, '../useSiteMenu.ts'), 'utf8').replace(/\s+/g, ' ')
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
})
