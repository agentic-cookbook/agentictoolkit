import { Fragment, type ReactNode } from 'react'
import { describe, expect, it } from 'vitest'
import { MarketingRootHtml, MarketingSiteHeader, type MarketingRootHtmlProps } from '../marketing'
import { AuthProvider } from '@agentic-toolkit/adh/auth'
import { HelpContentProvider } from '@agentic-toolkit/ui/components/help-content'

/**
 * Open the document without rendering it.
 *
 * `MarketingRootHtml` is a server component with no hooks, so CALLING it returns its
 * element tree and nothing below it runs — no AuthProvider, no AppShell, no DOM, no
 * jsdom. Every prop below is settled in that tree, so plain function calls assert the
 * whole document contract.
 *
 * The ORDER of the chain below <body> is the contract, not an implementation detail: a
 * site's providers must sit BELOW the family auth provider (so `useAuth()` in them reads
 * the shared session) and ABOVE the shell (so the header, which is one of AppShell's
 * props, is a consumer of them).
 *
 * The walk is BY NAME rather than by depth. It used to index the chain positionally
 * (`body.props.children` was AuthProvider), which made every assertion below silently
 * re-bind to a different component the day HelpContentProvider was inserted above it —
 * `auth.props.clientId` reads undefined on a node that has no such prop, and the failure
 * names the assertion rather than the insertion. `descend` asserts the order explicitly
 * instead, so an inserted provider is either declared here or fails loudly.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
function nameOf(node: any): string {
  if (node?.type === Fragment) return 'Fragment'
  return typeof node?.type === 'string' ? node.type : (node?.type?.name ?? '<unknown>')
}

/** Follow a single-child chain from `node`, asserting each component in turn.
 *
 *  Identity, not just the name: two providers can share a name across a barrel
 *  re-export, and a build that mangles function names would make a name-only check
 *  vacuous. `nameOf` is asserted first purely so a failure reads as
 *  "AuthProvider ≠ HelpContentProvider" rather than as two opaque functions. */
function descend(node: any, expected: any[]): any[] {
  const found: any[] = []
  let current = node
  for (const component of expected) {
    current = current.props.children
    expect(nameOf(current)).toBe(nameOf({ type: component }))
    expect(current.type).toBe(component)
    found.push(current)
  }
  return found
}

function openDocument(props: Partial<MarketingRootHtmlProps> = {}) {
  const html: any = MarketingRootHtml({ siteId: 'hub', children: 'CHILDREN', ...props })
  const [head, body] = html.props.children
  // The providers slot defaults to `Fragment` — a site that owns no context of its
  // own still gets a node here, so the chain's depth never varies.
  const [help, auth, providers] = descend(body, [
    HelpContentProvider,
    AuthProvider,
    props.providers ?? Fragment,
  ])
  return { html, head, body, help, auth, providers, shell: providers.props.children as any }
}
/* eslint-enable @typescript-eslint/no-explicit-any */

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

  it('publishes the site help at the document level, defaulting to empty', () => {
    // At <body>, above everything — not passed to the shared header — because four
    // sites replace that header entirely through the `header` slot, and a prop would
    // reach the shared one and miss them.
    expect(openDocument().help.props.help).toEqual({})
    const copy = { 'site-title': { body: 'What this site is for.' } }
    expect(openDocument({ help: copy }).help.props.help).toBe(copy)
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
