// @vitest-environment jsdom
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react'
import { describe, it, expect, afterEach, vi } from 'vitest'
import { AuthPane } from './AuthPane'
import { ecosystemsApi, type AuthSettings } from '@agentic-toolkit/data/ecosystems'
import { SettingsDirtyProvider, useSettingsDirty } from '@agentic-toolkit/resource'

// The pane's "Manage invitations in Users →" is a <button> (Button variant="link"), so its
// router.push is invisible to the guard's anchor-click interceptor — the router spy is the
// only place a silent navigation shows up.
const { push } = vi.hoisted(() => ({ push: vi.fn() }))
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push }),
  usePathname: () => '/acme/ecosystems/eco1/auth',
}))

vi.mock('@agentic-toolkit/data/ecosystems', () => ({
  ecosystemsApi: {
    authSettings: vi.fn(async () => ({
      signupMode: 'invite_only',
      loginEnabled: true,
      allowedProviders: null,
    })),
    updateAuthSettings: vi.fn(),
  },
}))

// This vitest config has no `globals: true` / auto-cleanup setup file, so each render must be
// torn down explicitly or the next test's queries see BOTH mounted trees.
afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

/** A sibling settings panel with unsaved edits — what the cross-link would abandon. */
function DirtySibling() {
  const { reportDirty } = useSettingsDirty()
  return (
    <button type="button" onClick={() => reportDirty('sibling', true)}>
      Edit sibling
    </button>
  )
}

async function renderPane() {
  render(
    <SettingsDirtyProvider>
      <DirtySibling />
      <AuthPane ecosystemId="eco1" />
    </SettingsDirtyProvider>,
  )
  return await screen.findByRole('button', { name: /Manage invitations in Users/ })
}

// What the conversion is FOR: an ecosystem's policy comes back from cache, so returning to a
// realm already opened paints it on the first frame with no second read. The hand-rolled effect
// this replaced re-fetched on every mount and blanked the pane to "Loading…" while it did.
//
// Each ecosystem keeps its OWN entry — the ecosystem is the cache key's id — so switching shows
// the ecosystem switched to, never the one left behind.
describe('AuthPane caches each ecosystem’s policy', () => {
  const signupMode = () => (screen.getByLabelText('Sign-up') as HTMLSelectElement).value

  it('paints an ecosystem’s policy from cache on the way back, without re-reading', async () => {
    const authSettings = vi.mocked(ecosystemsApi.authSettings)
    authSettings.mockImplementation(
      async (id: string): Promise<AuthSettings> => ({
        signupMode: id === 'eco1' ? 'invite_only' : 'closed',
        loginEnabled: true,
        allowedProviders: null,
      }),
    )

    const { rerender } = render(<AuthPane ecosystemId="eco1" />)
    await waitFor(() => expect(signupMode()).toBe('invite_only'))

    rerender(<AuthPane ecosystemId="eco2" />)
    await waitFor(() => expect(signupMode()).toBe('closed'))
    expect(authSettings).toHaveBeenCalledTimes(2)

    // Back to the first: its policy is on screen with nothing awaited, and no third read.
    rerender(<AuthPane ecosystemId="eco1" />)
    expect(signupMode()).toBe('invite_only')
    expect(screen.queryByText('Loading…')).toBeNull()
    expect(authSettings).toHaveBeenCalledTimes(2)
  })
})

describe('AuthPane’s cross-link to Users consults the navigation guard', () => {
  it('jumps straight to Users while nothing is dirty', async () => {
    const link = await renderPane()
    fireEvent.click(link)
    await waitFor(() => expect(push).toHaveBeenCalledWith('/acme/ecosystems/eco1/invitations'))
    expect(screen.queryByRole('button', { name: 'Discard' })).toBeNull()
  })

  it('raises the alert instead of navigating while a panel is dirty', async () => {
    const link = await renderPane()
    fireEvent.click(screen.getByRole('button', { name: 'Edit sibling' }))
    fireEvent.click(link)
    expect(await screen.findByRole('button', { name: 'Discard' })).toBeTruthy()
    expect(push).not.toHaveBeenCalled()
  })

  it('Discard proceeds; Stay navigates nowhere', async () => {
    const link = await renderPane()
    fireEvent.click(screen.getByRole('button', { name: 'Edit sibling' }))
    fireEvent.click(link)
    fireEvent.click(await screen.findByRole('button', { name: 'Stay' }))
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Stay' })).toBeNull())
    expect(push).not.toHaveBeenCalled()

    fireEvent.click(link)
    fireEvent.click(await screen.findByRole('button', { name: 'Discard' }))
    await waitFor(() => expect(push).toHaveBeenCalledWith('/acme/ecosystems/eco1/invitations'))
  })
})
