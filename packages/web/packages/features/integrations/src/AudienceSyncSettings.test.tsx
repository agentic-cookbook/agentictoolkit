// AudienceSyncSettings reports its unsaved draft to the settings registry.
//
// Moved here with the component (it was the first describe in the hub's
// settings/__tests__/paneDirtyReporting.test.tsx, whose other two describes cover hub-owned
// notification cards and stayed behind). The behaviour under test is entirely this package's:
// the form saves straight through `patchSettings` and is nowhere in IntegrationsPane's form
// state, so nothing else knows the draft exists — if it doesn't report itself, every exit the
// pane can't see discards a half-typed opt-in in silence.
import { useState } from 'react'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { describe, it, expect, afterEach, vi } from 'vitest'
import { SettingsDirtyProvider, useSettingsDirty } from '@agentic-toolkit/resource'

// The provider mounts its own UnsavedChangesGuard when there is no rail host above it, and that
// guard passes onNavigate={(href) => router.push(href)}. There is no app-router context under
// vitest, so useRouter is mocked.
const { push } = vi.hoisted(() => ({ push: vi.fn() }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }))

vi.mock('@agentic-toolkit/auth', () => ({ reportUnexpectedAuthError: vi.fn() }))

const { patchSettings } = vi.hoisted(() => ({ patchSettings: vi.fn() }))
vi.mock('@agentic-toolkit/data/integrations', () => ({
  integrationsApi: {
    listConnections: vi.fn(),
    sync: vi.fn(),
    disconnect: vi.fn(),
    patchSettings,
  },
}))

import { AudienceSyncSettings } from './AudienceSyncSettings'

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

/** Reads the registry the way the overlay's close gate does — from an event handler, not render. */
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

/** A real anchor: what the browser-level UnsavedChangesGuard intercepts. A next/link would route
 *  through the router instead and never reach the interception path. */
function Elsewhere() {
  return <a href="/elsewhere">Elsewhere</a>
}

function readRegistry() {
  fireEvent.click(screen.getByRole('button', { name: 'Read' }))
}

function expectRegistry(state: 'dirty' | 'clean') {
  expect(screen.getByText(`registry sees ${state}`)).toBeTruthy()
}

function expectAlert() {
  expect(screen.getByRole('button', { name: 'Discard' })).toBeTruthy()
  expect(screen.getByRole('button', { name: 'Stay' })).toBeTruthy()
}

describe('AudienceSyncSettings reports its unsaved draft to the settings registry', () => {
  function renderPane(initial: Record<string, unknown> = {}) {
    return render(
      <SettingsDirtyProvider>
        <DirtyReadout />
        <Elsewhere />
        <AudienceSyncSettings connectionId="conn-1" initial={initial} />
      </SettingsDirtyProvider>,
    )
  }

  it('stays clean while the prefilled form is untouched', () => {
    renderPane({ audienceIds: ['a1b2c3'] })
    readRegistry()
    expectRegistry('clean')
  })

  it('reports dirty once the audience ids are edited', () => {
    renderPane({ audienceIds: ['a1b2c3'] })
    fireEvent.change(screen.getByLabelText('Audience ids'), { target: { value: 'a1b2c3, zz9' } })
    readRegistry()
    expectRegistry('dirty')
  })

  it('goes clean again when the edit is typed back to the stored value', () => {
    renderPane({ audienceIds: ['a1b2c3'] })
    const input = screen.getByLabelText('Audience ids')
    fireEvent.change(input, { target: { value: 'a1b2c3, zz9' } })
    fireEvent.change(input, { target: { value: 'a1b2c3' } })
    readRegistry()
    expectRegistry('clean')
  })

  it('raises the discard alert on a link click while the draft is unsaved', () => {
    renderPane({ audienceIds: ['a1b2c3'] })
    fireEvent.change(screen.getByLabelText('Audience ids'), { target: { value: 'a1b2c3, zz9' } })
    fireEvent.click(screen.getByText('Elsewhere'))
    expectAlert()
  })

  it('lets a link click through while the form is untouched', () => {
    renderPane({ audienceIds: ['a1b2c3'] })
    fireEvent.click(screen.getByText('Elsewhere'))
    expect(screen.queryByRole('button', { name: 'Discard' })).toBeNull()
  })
})
