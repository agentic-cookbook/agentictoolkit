// @vitest-environment jsdom
import { render, screen, cleanup } from '@testing-library/react'
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest'

/**
 * `PublicProfileEscape` is the ONLY hole in the `[workspace]` gate on 40 sites, so every case
 * below is a security case: a path this component gets wrong is a route rendered with no gate.
 *
 * The two trees are stand-in markers rather than the real gate and the real profile page — what
 * is under test is WHICH of the two a path selects, and reproducing either one here would test
 * their contents instead.
 */

const { pathname } = vi.hoisted(() => ({
  pathname: { current: null as string | null },
}))
vi.mock('next/navigation', () => ({
  usePathname: () => pathname.current,
}))

const { PublicProfileEscape } = await import('../PublicProfileEscape')

function renderAt(path: string | null) {
  pathname.current = path
  return render(
    <PublicProfileEscape ungated={<div>public-profile</div>}>
      <div>gated-app</div>
    </PublicProfileEscape>,
  )
}

beforeEach(() => {
  pathname.current = null
})
afterEach(cleanup)

describe('PublicProfileEscape', () => {
  it('renders the UNGATED tree on a principal profile path', () => {
    // The feature itself: without this the profile route is gated and a signed-out visitor
    // following a link to somebody's page is sent through SSO instead of seeing them.
    renderAt('/acme/profile')
    expect(screen.getByText('public-profile')).toBeTruthy()
    expect(screen.queryByText('gated-app')).toBeNull()
  })

  it('keeps a THREE-segment path ending in profile gated', () => {
    // `/acme/settings/profile` is a feature route inside the signed-in app that happens to end in
    // the same word. Matching on the last segment — or on "contains profile" — un-gates it.
    renderAt('/acme/settings/profile')
    expect(screen.getByText('gated-app')).toBeTruthy()
    expect(screen.queryByText('public-profile')).toBeNull()
  })

  it('keeps a path BELOW the profile gated', () => {
    // `/acme/profile/edit` starts with the exempt path. A prefix match, or a `segments[1] ===
    // 'profile'` test without the length check, would hand it the un-gated tree.
    renderAt('/acme/profile/edit')
    expect(screen.getByText('gated-app')).toBeTruthy()
    expect(screen.queryByText('public-profile')).toBeNull()
  })

  it('keeps a two-segment path whose second segment is NOT profile gated', () => {
    // The hub's 27 static siblings are all exactly this shape — two segments, second one a
    // feature name. This is the case whose failure is the outage this component was written for.
    renderAt('/acme/settings')
    expect(screen.getByText('gated-app')).toBeTruthy()
    expect(screen.queryByText('public-profile')).toBeNull()
  })

  it('keeps the bare workspace path gated', () => {
    // `/acme` is the workspace itself, and its own gate decides between the app and the profile
    // (WorkspaceOrProfileGate). One segment must never reach the escape.
    renderAt('/acme')
    expect(screen.getByText('gated-app')).toBeTruthy()
    expect(screen.queryByText('public-profile')).toBeNull()
  })

  it('keeps a case variation of the profile segment gated', () => {
    // Next serves `/acme/profile` from the literal `profile/` directory, so `/acme/Profile` is the
    // CATCH-ALL — the gated app. A case-insensitive match here would un-gate the app at an alias.
    renderAt('/acme/Profile')
    expect(screen.getByText('gated-app')).toBeTruthy()
    expect(screen.queryByText('public-profile')).toBeNull()
  })

  it('fails CLOSED when usePathname() returns null', () => {
    // The type says `string`; the implementation reads a context that can be null. An unknown path
    // must take the gate, not the escape — the opposite direction opens all 27 hub routes on
    // exactly the render where we do not know where we are.
    renderAt(null)
    expect(screen.getByText('gated-app')).toBeTruthy()
    expect(screen.queryByText('public-profile')).toBeNull()
  })

  it('renders the ungated tree on the trailing-slash form of the profile path', () => {
    // Dropping empty segments is what makes `/acme/profile/` the SAME route as `/acme/profile`
    // rather than a three-segment path with an empty tail. It is not a way in: it is the profile
    // route either way, so it gets the profile answer.
    renderAt('/acme/profile/')
    expect(screen.getByText('public-profile')).toBeTruthy()
    expect(screen.queryByText('gated-app')).toBeNull()
  })
})
