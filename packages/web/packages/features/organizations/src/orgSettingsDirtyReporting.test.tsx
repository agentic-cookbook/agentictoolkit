// @vitest-environment jsdom
import { useState } from 'react'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest'
import { SettingsDirtyProvider, useSettingsDirty } from '@agentic-toolkit/resource'

// Same shape as paneDirtyReporting.test.tsx: the provider mounts its own UnsavedChangesGuard
// when no rail host is above it, and that guard calls router.push.
const { push } = vi.hoisted(() => ({ push: vi.fn() }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }))

vi.mock('@agentic-toolkit/auth', () => ({ reportUnexpectedAuthError: vi.fn() }))

// The slug field probes the shared user/org handle namespace. Dirt is what's under test here, so
// the probe is stubbed permissive — its own behaviour is covered by orgSlugAvailability.test.tsx.
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

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

beforeEach(() => {
  checkWorkspaceSlugAvailable.mockResolvedValue({ available: true })
})

/** Reads the registry the way the overlay's close gate does — from an event handler. */
function DirtyReadout() {
  const { isAnyDirty } = useSettingsDirty()
  const [seen, setSeen] = useState<string | null>(null)
  return (
    <div>
      <button type="button" onClick={() => setSeen(isAnyDirty() ? 'dirty' : 'clean')}>
        Read
      </button>
      {seen && <p>registry sees {seen}</p>}
    </div>
  )
}

/** A real anchor: what the browser-level UnsavedChangesGuard intercepts. */
function Elsewhere() {
  // eslint-disable-next-line @next/next/no-html-link-for-pages
  return <a href="/elsewhere">Elsewhere</a>
}

function readRegistry() {
  fireEvent.click(screen.getByRole('button', { name: 'Read' }))
}

function expectRegistry(state: 'dirty' | 'clean') {
  expect(screen.getByText(`registry sees ${state}`)).toBeTruthy()
}

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
      <SettingsDirtyProvider>
        <DirtyReadout />
        <Elsewhere />
        <OrgSettingsForm org={ORG} hrefs={HREFS} onSaved={() => {}} />
      </SettingsDirtyProvider>
    </QueryClientProvider>,
  )
}

describe('OrgSettingsForm reports its unsaved edits to the settings registry', () => {
  it('stays clean while the loaded org is untouched', () => {
    renderForm()
    readRegistry()
    expectRegistry('clean')
  })

  it('reports dirty once the name is edited', () => {
    renderForm()
    fireEvent.change(screen.getByLabelText('name'), { target: { value: 'FishLamp Studio' } })
    readRegistry()
    expectRegistry('dirty')
  })

  it('reports dirty once the slug is edited', () => {
    renderForm()
    fireEvent.change(screen.getByLabelText('slug'), { target: { value: 'fishlamp-two' } })
    readRegistry()
    expectRegistry('dirty')
  })

  it('goes clean again when the edit is typed back to the stored value', () => {
    renderForm()
    const input = screen.getByLabelText('name')
    fireEvent.change(input, { target: { value: 'FishLamp Studio' } })
    fireEvent.change(input, { target: { value: 'FishLamp Design' } })
    readRegistry()
    expectRegistry('clean')
  })

  it('raises the discard alert on a link click while the draft is unsaved', () => {
    renderForm()
    fireEvent.change(screen.getByLabelText('name'), { target: { value: 'FishLamp Studio' } })
    fireEvent.click(screen.getByText('Elsewhere'))
    expect(screen.getByRole('button', { name: 'Discard' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Stay' })).toBeTruthy()
  })

  it('lets a link click through while the form is untouched', () => {
    renderForm()
    fireEvent.click(screen.getByText('Elsewhere'))
    expect(screen.queryByRole('button', { name: 'Discard' })).toBeNull()
  })
})
