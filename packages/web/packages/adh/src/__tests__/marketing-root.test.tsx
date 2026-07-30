import { describe, expect, it } from 'vitest'
import { MarketingRootHtml, MarketingSiteHeader } from '../marketing'

describe('@agentic-toolkit/adh/marketing', () => {
  it('exports the root document shell and the session-aware header', () => {
    expect(typeof MarketingRootHtml).toBe('function')
    expect(typeof MarketingSiteHeader).toBe('function')
  })

  it('defaults silentSso to true — the feature-site behaviour', () => {
    // The default lives in the signature; a regression here silently disables the
    // cross-site cold-load SSO probe on 22 sites, which no render test would catch.
    expect(MarketingRootHtml.length).toBe(1)
    const src = MarketingRootHtml.toString()
    expect(src).toMatch(/silentSso\s*=\s*true/)
  })
})
