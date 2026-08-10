// @vitest-environment jsdom
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest'
import { SettingsDirtyProvider } from '@agentic-toolkit/resource'

// The provider mounts its own UnsavedChangesGuard when no rail host is above it — the same guard
// the hub's WorkspaceChromeProvider mounts around every /[workspace]/… route. That guard is the point
// of these tests, so it must really be there.
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }))
vi.mock('@agentic-toolkit/auth', () => ({ reportUnexpectedAuthError: vi.fn() }))

const { checkWorkspaceSlugAvailable } = vi.hoisted(() => ({ checkWorkspaceSlugAvailable: vi.fn() }))
// Only the probe is stubbed: `WORKSPACES_QUERY_KEY` is a real export of this module and the
// form invalidates it, so a whole-module factory would replace the key the assertion checks.
vi.mock('@agentic-toolkit/data', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@agentic-toolkit/data')>()),
  checkWorkspaceSlugAvailable,
}))

const { rename } = vi.hoisted(() => ({ rename: vi.fn() }))
vi.mock('@agentic-toolkit/data/organizations', () => ({ organizationsApi: { rename } }))

import { OrgSettingsForm } from './OrgSettingsPane'

// The two navigations a save can start, in the HUB's URL space — the same strings the pane
// used to hardcode, so the assertions below still describe real behaviour.
const HREFS = { renamed: (slug: string) => `/${slug}/settings`, archived: '/home' }

const ORG = {
  id: 'org-1',
  slug: 'fishlamp',
  name: 'FishLamp Design',
  description: null,
} as never

const REAL_LOCATION = window.location

/** True when the exit guard vetoed the unload that `location.assign` kicked off. */
let unloadBlocked = false
let assign: ReturnType<typeof vi.fn>

beforeEach(() => {
  checkWorkspaceSlugAvailable.mockResolvedValue({ available: true })
  unloadBlocked = false
  // Models the browser faithfully: `assign` starts a navigation, and `beforeunload` fires on the
  // CURRENT document at that instant — before React has re-rendered, run effects or torn the guard
  // down. Awaiting first and firing the event afterwards would test a moment the browser never has.
  assign = vi.fn(() => {
    const evt = new Event('beforeunload', { cancelable: true })
    window.dispatchEvent(evt)
    unloadBlocked = evt.defaultPrevented
  })
  // Same origin as the jsdom document on purpose: the guard arms its Back sentinel with
  // history.pushState(…, window.location.href), which a cross-origin href makes a SecurityError.
  const url = new URL('/fishlamp/settings', REAL_LOCATION.origin)
  Object.defineProperty(window, 'location', {
    configurable: true,
    // A URL already exposes href/origin/pathname/search/hash — every field the guard reads.
    value: Object.assign(url, { assign }),
  })
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
  Object.defineProperty(window, 'location', { configurable: true, value: REAL_LOCATION })
})

function renderForm() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const invalidate = vi.spyOn(qc, 'invalidateQueries')
  render(
    <QueryClientProvider client={qc}>
      <SettingsDirtyProvider>
        <OrgSettingsForm org={ORG} hrefs={HREFS} onSaved={() => {}} />
      </SettingsDirtyProvider>
    </QueryClientProvider>,
  )
  return { invalidate }
}

const saveButton = () => screen.getByRole('button', { name: /^Sav/ })

async function renameSlugTo(next: string) {
  fireEvent.change(screen.getByLabelText('slug'), { target: { value: next } })
  await waitFor(() => expect(screen.getByText('Available.')).toBeTruthy())
  fireEvent.click(saveButton())
  await waitFor(() => expect(rename).toHaveBeenCalled())
}

describe('a saved org rename reaches the rest of the UI', () => {
  // The pane writes the saved entity into its OWN cache entry and stops there. Every other surface
  // that shows the org name — the workspace bar, the chrome's WorkspaceContext — reads the
  // ["workspaces"] list, so without an invalidation a rename is invisible everywhere but the form
  // the user typed it into.
  it('invalidates the workspaces list after a name-only save', async () => {
    rename.mockResolvedValue({ id: 'org-1', slug: 'fishlamp', name: 'FishLamp Studio', description: null })
    const { invalidate } = renderForm()

    fireEvent.change(screen.getByLabelText('name'), { target: { value: 'FishLamp Studio' } })
    await waitFor(() => expect(saveButton()).toHaveProperty('disabled', false))
    fireEvent.click(saveButton())
    await waitFor(() => expect(rename).toHaveBeenCalled())

    await waitFor(() =>
      expect(invalidate).toHaveBeenCalledWith(expect.objectContaining({ queryKey: ['workspaces'] })),
    )
  })
})

describe('a slug rename lands the browser on the renamed workspace', () => {
  beforeEach(() => {
    rename.mockResolvedValue({
      id: 'org-1',
      slug: 'fishlamp-two',
      name: 'FishLamp Design',
      description: null,
    })
  })

  it('navigates to the renamed workspace settings', async () => {
    renderForm()
    await renameSlugTo('fishlamp-two')
    await waitFor(() => expect(assign).toHaveBeenCalledWith('/fishlamp-two/settings'))
  })

  // THE REGRESSION. The draft is still "dirty" at the instant `save()` navigates — React has not
  // re-rendered with the saved org yet — so the exit guard's beforeunload listener is armed and has
  // no idea the edits were PERSISTED rather than abandoned. It vetoes the unload, the browser keeps
  // the old URL, and a manual reload then 404s on a slug that no longer exists.
  it('does not let the exit guard veto the unload the save itself triggered', async () => {
    renderForm()
    await renameSlugTo('fishlamp-two')
    await waitFor(() => expect(assign).toHaveBeenCalled())
    expect(unloadBlocked).toBe(false)
  })
})
