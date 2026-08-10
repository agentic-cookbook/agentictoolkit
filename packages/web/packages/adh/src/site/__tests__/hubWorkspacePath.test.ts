import { describe, it, expect } from 'vitest'
import { isHubWorkspacePath, hubWorkspaceSlug } from '../hubWorkspacePath'

/**
 * Moved here from adh-registry's registry.test.ts along with the pair itself, and rewritten
 * around the question that replaced the old one.
 *
 * These used to decide by the SECOND path segment — the hub's root was `[slug]`, a public user
 * profile, so `/acme/knowledgebases` was a workspace and `/acme` was a profile. The route
 * convergence made the root `[workspace]` on all 38 sites, which moves the whole answer to the
 * FIRST segment: it is a workspace slug unless one of the site's own routes has claimed the word.
 *
 * Two cases below are the old suite's assertions INVERTED, and each was a live defect for as long
 * as the second-segment test survived the move.
 */
describe('isHubWorkspacePath', () => {
  it('matches a workspace root, which is the whole point of the convergence', () => {
    // The old test asserted this was FALSE (a bare `/acme` was a public profile). It is the
    // workspace's own address now, and calling it marketing put the signed-out menu on the one
    // page the workspace menu is for.
    expect(isHubWorkspacePath('/acme')).toBe(true)
    expect(hubWorkspaceSlug('/acme')).toBe('acme')
  })

  it('matches every path under a workspace, feature or not', () => {
    expect(isHubWorkspacePath('/acme/knowledgebases')).toBe(true)
    expect(isHubWorkspacePath('/acme/knowledgebases/facts')).toBe(true)
    expect(isHubWorkspacePath('/acme/teams/some-id/members')).toBe(true)
    // Also inverted. `/acme/about` names no feature, so the old test called it marketing — but
    // `app/[workspace]/` catches it, so it is a 404 rendered INSIDE the workspace, wearing the
    // workspace's chrome.
    expect(isHubWorkspacePath('/acme/about')).toBe(true)
  })

  it('matches the two slug-less workspace routes, and reports no slug for them', () => {
    // `/home` resolves a workspace and replaces itself; `/settings` is the account. Both are
    // signed-in surfaces, so the switcher stays in-hub — and both carry no slug, so the caller
    // falls back to the signed-in user's own.
    expect(isHubWorkspacePath('/home')).toBe(true)
    expect(isHubWorkspacePath('/settings')).toBe(true)
    expect(isHubWorkspacePath('/settings/profile')).toBe(true)
    expect(hubWorkspaceSlug('/home')).toBeNull()
    expect(hubWorkspaceSlug('/settings')).toBeNull()
  })

  it('rejects the root and the site’s own routes', () => {
    expect(isHubWorkspacePath('/')).toBe(false)
    expect(isHubWorkspacePath('/details')).toBe(false)
    expect(isHubWorkspacePath('/login')).toBe(false)
    expect(isHubWorkspacePath('/explore')).toBe(false)
    expect(hubWorkspaceSlug('/details')).toBeNull()
  })

  it('answers TRUE for a word the MINT forms refuse but the hub does not route', () => {
    // The inversion this pair got wrong. It used to read `reservedWorkspaceSlugs()`, which is
    // 41 words wider than what the API refuses (`RESERVED_PRINCIPAL_SLUGS` — the rdid type
    // prefixes plus the route words; the rest are the two forms' taste), and both lists refuse
    // only at MINT time. So a principal can be holding any of these, and every one of them read
    // as a hub page: null slug, and useSiteMenu quietly swapping the visitor's own slug into
    // every feature link while they looked at someone else's workspace.
    //
    // `teams` and `support` are hub FEATURE words — second segments, `/<workspace>/teams` —
    // and `about` is pure taste. None of the three is a hub route, so none of them decides
    // anything about a first segment.
    for (const slug of ['teams', 'support', 'about', 'me', 'research']) {
      expect(isHubWorkspacePath(`/${slug}`), slug).toBe(true)
      expect(hubWorkspaceSlug(`/${slug}`), slug).toBe(slug)
    }
  })

  it('rejects a public profile and a marketing feature page', () => {
    // The two destinations the hub's own root segment used to serve. Both took a static prefix
    // when `[workspace]` claimed the root, and both prefixes are reserved words.
    expect(isHubWorkspacePath('/user/mike')).toBe(false)
    expect(isHubWorkspacePath('/features/mcp')).toBe(false)
    // `projects` is both a marketing feature id AND a workspace feature segment. Under the old
    // second-segment test this page read as a workspace route the moment it moved under
    // `/features/`, and wore the signed-in menu.
    expect(isHubWorkspacePath('/features/projects')).toBe(false)
  })

  it('answers TRUE for a slug nobody holds, and that is the honest answer', () => {
    // Not the "route test by exclusion" trap: the claim is about what the URL ADDRESSES, and
    // `/typo` addresses a workspace — one the caller is not in, which the route's own gate
    // resolves against the workspace list and turns into the shared not-found.
    expect(isHubWorkspacePath('/typo')).toBe(true)
    expect(hubWorkspaceSlug('/typo')).toBe('typo')
  })

  it('is case-insensitive about a route word, because a URL is', () => {
    // HUB_ROUTE_SEGMENTS is all lowercase (it mirrors directory names); a path segment arrives
    // however it was typed, and `/Details` is the same page as `/details`.
    expect(isHubWorkspacePath('/Details')).toBe(false)
    expect(hubWorkspaceSlug('/Details')).toBeNull()
  })
})
