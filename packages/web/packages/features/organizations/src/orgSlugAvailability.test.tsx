// @vitest-environment jsdom
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react'
import { onlineManager, QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest'

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }))
vi.mock('@agentic-toolkit/auth', () => ({ reportUnexpectedAuthError: vi.fn() }))

const { checkWorkspaceSlugAvailable } = vi.hoisted(() => ({ checkWorkspaceSlugAvailable: vi.fn() }))
// Only the probe is stubbed: `WORKSPACES_QUERY_KEY` is a real export of this module and the
// form invalidates it, so a whole-module factory would replace the key the assertion checks.
vi.mock('@agentic-toolkit/data', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@agentic-toolkit/data')>()),
  checkWorkspaceSlugAvailable,
}))

import { OrgSettingsForm } from './OrgSettingsPane'

// The two navigations a save can start, in the HUB's URL space — the same strings the pane
// used to hardcode, so the assertions below still describe real behaviour.
const HREFS = { renamed: (slug: string) => `/${slug}/settings`, archived: '/home' }

// The debounce before the probe fires. Real timers + waitFor rather than fake ones: the query is
// async too, so a fake-timer test would have to interleave timer ticks with promise flushes.
const DEBOUNCE_MS = 350

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
  // `onlineManager` is module-global, so an offline test would otherwise park every later query.
  onlineManager.setOnline(true)
})
beforeEach(() => {
  checkWorkspaceSlugAvailable.mockResolvedValue({ available: true })
})

const ORG = {
  id: 'org-1',
  slug: 'fishlamp',
  name: 'FishLamp Design',
  description: null,
} as never

function renderForm() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <OrgSettingsForm org={ORG} hrefs={HREFS} onSaved={() => {}} />
    </QueryClientProvider>,
  )
}

function typeSlug(value: string) {
  fireEvent.change(screen.getByLabelText('slug'), { target: { value } })
}

const saveButton = () => screen.getByRole('button', { name: /^Sav/ })

describe('the org slug field is an rdid editor, not a bare text input', () => {
  it('shows the org. prefix the backend mints, outside the editable value', () => {
    renderForm()
    expect(screen.getByText('org.')).toBeTruthy()
    expect((screen.getByLabelText('slug') as HTMLInputElement).value).toBe('fishlamp')
  })

  it('lowercases what the user types, because the handle namespace is lowercase', () => {
    renderForm()
    typeSlug('FishLamp')
    expect((screen.getByLabelText('slug') as HTMLInputElement).value).toBe('fishlamp')
  })

  it('names the grammar violation instead of silently disabling Save', () => {
    renderForm()
    typeSlug('fish_lamp')
    expect(screen.getByText(/no underscores/)).toBeTruthy()
    expect(saveButton()).toHaveProperty('disabled', true)
  })
})

describe('the org slug field checks availability live', () => {
  it('does not probe the org own stored handle', async () => {
    renderForm()
    await new Promise((r) => setTimeout(r, DEBOUNCE_MS + 50))
    expect(checkWorkspaceSlugAvailable).not.toHaveBeenCalled()
  })

  it('reports a free handle as available once the probe answers', async () => {
    renderForm()
    typeSlug('fishlamp-two')
    await waitFor(() => expect(screen.getByText('Available.')).toBeTruthy())
    expect(checkWorkspaceSlugAvailable).toHaveBeenCalledWith('fishlamp-two')
  })

  it('reports a taken handle and blocks Save before the PATCH can 409', async () => {
    checkWorkspaceSlugAvailable.mockResolvedValue({ available: false, reason: 'taken' })
    renderForm()
    typeSlug('someone-else')
    await waitFor(() => expect(screen.getByText('That handle is already taken.')).toBeTruthy())
    expect(saveButton()).toHaveProperty('disabled', true)
  })

  it('says so when the probe itself fails, rather than claiming availability', async () => {
    checkWorkspaceSlugAvailable.mockRejectedValue(new Error('network'))
    renderForm()
    typeSlug('fishlamp-two')
    await waitFor(() =>
      expect(screen.getByText(/Couldn't check availability/)).toBeTruthy(),
    )
  })

  it('keeps Save reachable for a name-only edit, which needs no probe', async () => {
    renderForm()
    fireEvent.change(screen.getByLabelText('name'), { target: { value: 'FishLamp Studio' } })
    await waitFor(() => expect(saveButton()).toHaveProperty('disabled', false))
    expect(checkWorkspaceSlugAvailable).not.toHaveBeenCalled()
  })

  // The probe answers about the DEBOUNCED slug, so its verdict is stale for as long as the draft
  // has moved on. Typing a taken handle and then correcting it back to your own left the debounced
  // value pointing at the taken one — and the only guard against showing its answer was "the draft
  // differs from the stored slug", which is exactly what stops being true when you go back. The
  // pane then told the user their CURRENT handle was already taken.
  it('drops a taken verdict the moment the draft returns to the org own handle', async () => {
    checkWorkspaceSlugAvailable.mockResolvedValue({ available: false, reason: 'taken' })
    renderForm()
    typeSlug('someone-else')
    await waitFor(() => expect(screen.getByText('That handle is already taken.')).toBeTruthy())

    typeSlug('fishlamp')
    expect(screen.queryByText('That handle is already taken.')).toBeNull()
    // And it stays gone once the debounce catches up, rather than flickering back.
    await new Promise((r) => setTimeout(r, DEBOUNCE_MS + 50))
    expect(screen.queryByText('That handle is already taken.')).toBeNull()
  })

  // Save is gated on an ALLOW-list of statuses that positively clear the rename, because the
  // deny-list it replaced let every state nobody had thought of through. A PAUSED probe is one such
  // state and it is not a race: react-query parks a fetch while the browser reports itself offline,
  // so `isFetching` is false with no data and no error, for as long as the connection is out. The
  // field then showed its neutral hint — no "Checking…", no error — and Save was live on a handle
  // nothing had verified.
  it('blocks Save while the probe is parked offline, unverified and not even running', async () => {
    onlineManager.setOnline(false)
    renderForm()
    typeSlug('fishlamp-two')
    await new Promise((r) => setTimeout(r, DEBOUNCE_MS + 50))

    expect(checkWorkspaceSlugAvailable).not.toHaveBeenCalled()
    expect(screen.queryByText('Available.')).toBeNull()
    expect(saveButton()).toHaveProperty('disabled', true)
  })
})
