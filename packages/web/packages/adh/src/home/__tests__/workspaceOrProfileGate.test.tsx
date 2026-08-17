// @vitest-environment jsdom
import { render, screen, cleanup } from '@testing-library/react'
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest'

/**
 * `WorkspaceOrProfileGate` becomes the default gate for `/<workspace>` on 40 sites, and
 * `useSiteId`'s failure mode is a thrown render — neither had a test before this file.
 */

const { auth } = vi.hoisted(() => ({ auth: { isAuthenticated: false, isLoading: false } }))
vi.mock('@agentic-toolkit/auth', () => ({
  useAuth: () => auth,
}))

const { params } = vi.hoisted(() => ({
  params: { current: {} as { workspace?: string } },
}))
vi.mock('next/navigation', () => ({
  useParams: () => params.current,
}))

// `ProfileFallback` is captured rather than reproduced: what the gate decides is WHICH slug and
// site it hands over, not how the profile itself renders.
const { profileFallbackProps } = vi.hoisted(() => ({
  profileFallbackProps: { current: null as { slug: string; siteId: string } | null },
}))
vi.mock('../../profile/ProfileFallback', () => ({
  ProfileFallback: ({ slug, siteId }: { slug: string; siteId: string }) => {
    profileFallbackProps.current = { slug, siteId }
    return <div>profile</div>
  },
}))

const { WorkspaceOrProfileGate } = await import('../WorkspaceOrProfileGate')
const { SiteIdProvider, useSiteId, useSiteIdOrNull } = await import('../../site/site-id')

beforeEach(() => {
  vi.clearAllMocks()
  params.current = {}
  profileFallbackProps.current = null
  auth.isAuthenticated = false
  auth.isLoading = false
})
afterEach(cleanup)

describe('WorkspaceOrProfileGate', () => {
  it('renders nothing while auth is still loading', () => {
    // Catches a flash of the profile (or of children) ahead of a session that is about to
    // resolve either way.
    auth.isLoading = true
    params.current = { workspace: 'mike' }
    render(
      <SiteIdProvider siteId="hub">
        <WorkspaceOrProfileGate>
          <div>pane</div>
        </WorkspaceOrProfileGate>
      </SiteIdProvider>,
    )
    expect(screen.queryByText('pane')).toBeNull()
    expect(screen.queryByText('profile')).toBeNull()
  })

  it('renders children, and no profile, when signed in', () => {
    // Catches the gate rendering BOTH, or the profile instead of the workspace, for a caller
    // who has a session.
    auth.isAuthenticated = true
    params.current = { workspace: 'mike' }
    render(
      <SiteIdProvider siteId="hub">
        <WorkspaceOrProfileGate>
          <div>pane</div>
        </WorkspaceOrProfileGate>
      </SiteIdProvider>,
    )
    expect(screen.getByText('pane')).toBeTruthy()
    expect(screen.queryByText('profile')).toBeNull()
  })

  it('renders the principal profile, handed the URL slug and the provider site id, when signed out with a workspace param', () => {
    // Catches the gate forwarding the wrong slug, the wrong site id, or rendering children
    // instead — the whole point of the feature.
    auth.isAuthenticated = false
    params.current = { workspace: 'mike' }
    render(
      <SiteIdProvider siteId="hub">
        <WorkspaceOrProfileGate>
          <div>pane</div>
        </WorkspaceOrProfileGate>
      </SiteIdProvider>,
    )
    expect(screen.getByText('profile')).toBeTruthy()
    expect(screen.queryByText('pane')).toBeNull()
    expect(profileFallbackProps.current).toEqual({ slug: 'mike', siteId: 'hub' })
  })

  it('useSiteId throws outside a provider, and useSiteIdOrNull returns null instead', () => {
    // Catches a regression to the throwing hook's contract (it must still throw) and to the
    // nullable one's (it must still swallow the missing provider rather than throwing too) — the
    // distinction Critical 2 depends on.
    function ThrowingReader() {
      useSiteId()
      return null
    }
    function NullableReader() {
      return <div>{String(useSiteIdOrNull())}</div>
    }
    expect(() => render(<ThrowingReader />)).toThrow(
      'useSiteId must be used within <SiteIdProvider>',
    )
    cleanup()
    render(<NullableReader />)
    expect(screen.getByText('null')).toBeTruthy()
  })
})
