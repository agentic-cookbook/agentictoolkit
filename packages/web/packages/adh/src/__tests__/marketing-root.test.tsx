import { Fragment, type ReactNode } from 'react'
import { describe, expect, it } from 'vitest'
import { MarketingRootHtml, MarketingSiteHeader, type MarketingRootHtmlProps } from '../marketing'

/**
 * Open the document without rendering it.
 *
 * `MarketingRootHtml` is a server component with no hooks, so CALLING it returns its
 * element tree and nothing below it runs — no AuthProvider, no AppShell, no DOM, no
 * jsdom. Every prop below is settled in that tree, so plain function calls assert the
 * whole document contract.
 *
 * The nesting this walks — html > body > AuthProvider > providers > AppShell — is the
 * contract, not an implementation detail: a site's providers must sit BELOW the family
 * auth provider (so `useAuth()` in them reads the shared session) and ABOVE the shell
 * (so the header, which is one of AppShell's props, is a consumer of them).
 */
function openDocument(props: Partial<MarketingRootHtmlProps> = {}) {
  /* eslint-disable @typescript-eslint/no-explicit-any */
  const html: any = MarketingRootHtml({ siteId: 'hub', children: 'CHILDREN', ...props })
  const [head, body] = html.props.children
  const auth = body.props.children
  const providers = auth.props.children
  return { html, head, body, auth, providers, shell: providers.props.children as any }
  /* eslint-enable @typescript-eslint/no-explicit-any */
}

describe('@agentic-toolkit/adh/marketing', () => {
  it('exports the root document shell and the session-aware header', () => {
    expect(typeof MarketingRootHtml).toBe('function')
    expect(typeof MarketingSiteHeader).toBe('function')
  })

  it('writes the locale seam and the pre-paint escape hatch onto <html>', () => {
    // These three are what a hand-rolled document costs. Four sites wrote their own to
    // reach one AppShell prop, and all four settled for `lang="en"` with no `dir` — so
    // for as long as the copies existed those sites sat outside the locale seam and
    // nothing said so. suppressHydrationWarning is the other half: AdhThemeStyle's
    // appearance pre-paint script sets class/data-* on <html> before hydration, so the
    // client tree legitimately differs from the server's here.
    const { html } = openDocument()
    expect(html.type).toBe('html')
    expect(html.props.lang).toBe('en')
    expect(html.props.dir).toBe('ltr')
    expect(html.props.suppressHydrationWarning).toBe(true)
  })

  it('mounts the family AuthProvider with the one client id and token store', () => {
    // The single place these two are written. The hub used to restate both in a
    // `src/context/auth.tsx` wrapper; it agreed, which is exactly why it survived —
    // the failure mode of a second copy is not a wrong value today, it is the value
    // that only one of the two is ever updated to.
    const { auth } = openDocument()
    expect(auth.props.clientId).toBe('adh')
    expect(auth.props.storageKey).toBe('auth_tokens')
  })

  it('defaults silentSso to true — the feature-site behaviour — and passes false through', () => {
    // A regression in the default silently disables the cross-site cold-load SSO probe
    // on 22 sites; nothing about a site that has stopped recognising its visitors reads
    // as a bug locally, because the header still renders.
    expect(openDocument().auth.props.silentSso).toBe(true)
    expect(openDocument({ silentSso: false }).auth.props.silentSso).toBe(false)
  })

  it('falls back to Fragment for `providers` — a STABLE component identity', () => {
    // `providers ?? (({ children }) => <>{children}</>)` reads as the same thing and is
    // not: an arrow written in the render body is a new component TYPE every render, and
    // React unmounts and remounts everything below a type that changed. Every site would
    // lose its whole client tree — the cookbook's chrome coordinator, the hub's debug
    // console, settings overlay and workspaces menu — on each render of the root layout,
    // and the symptom (state resetting for no reason) points nowhere near this line.
    // Fragment has one identity and emits no DOM.
    expect(openDocument().providers.type).toBe(Fragment)
    expect(openDocument().providers.type).toBe(openDocument().providers.type)
  })

  it('mounts a site’s providers between the auth provider and the shell', () => {
    const SiteProviders = ({ children }: { children: ReactNode }) => <>{children}</>
    const { auth, providers, shell } = openDocument({ providers: SiteProviders })
    expect(providers.type).toBe(SiteProviders)
    expect(auth.props.children).toBe(providers)
    expect(shell.props.children).toBe('CHILDREN')
  })

  it('gives AppShell the shared header, or the site’s own in its place', () => {
    expect(openDocument().shell.props.header.type).toBe(MarketingSiteHeader)
    const own = <header id="site-own" />
    expect(openDocument({ header: own }).shell.props.header).toBe(own)
  })
})
