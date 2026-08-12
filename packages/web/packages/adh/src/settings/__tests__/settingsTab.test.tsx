// @vitest-environment jsdom
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { describe, it, expect, afterEach, vi } from 'vitest'
import { useSettingsDirty } from '@agentic-toolkit/resource'
import { SettingsTab } from '../registry'

/**
 * SettingsTab mounts its OWN SettingsDirtyProvider, and this file is the only thing that says so.
 *
 * It is the routed-page half of User Settings (hub's /settings), which renders under no workspace
 * chrome — so the provider it builds is the one that reaches `host === null` in
 * @agentic-toolkit/resource's settings-dirty.tsx and mounts the browser-level UnsavedChangesGuard.
 * Drop the provider and nothing else fails: `useSettingsDirty()` quietly returns the NOOP context,
 * every panel's reportDirty becomes a no-op, and the route loses its unsaved-changes prompt with a
 * green suite. hub used to own this test (components/settings/__tests__/settingsDirtyBridge.test.tsx,
 * "the /settings route mounts the registry and its own browser guard"), rendering hub's local
 * SettingsTab with hub-local panel mocks; SettingsTab moved here, its panels are the shared
 * packages' now, and that block was rewritten to test the provider directly — leaving the
 * "SettingsTab mounts one" claim unasserted anywhere. This restores it next to the component.
 */

// SettingsLayout (and settings-dirty's own standalone guard) call useRouter() unconditionally,
// and jsdom has no App Router. Same shape as userSettingsOverlay.test.tsx; the two next/*
// subpaths are aliased to ONE copy in vitest.config.ts, or this mock would miss the copy
// account/resource resolve for themselves.
const { push } = vi.hoisted(() => ({ push: vi.fn() }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }))

// The real topic list builds every live API/context-bound panel. What is under test is the
// PROVIDER SettingsTab wraps around the layout, so the layout itself stands in as a probe panel
// and the panels are stubs. `@agentic-toolkit/account` is mocked as a whole because registry.tsx
// imports the layout and five panels from that one specifier — every name it takes has to be
// present here or the module fails to load.
vi.mock('@agentic-toolkit/account', () => ({
  SettingsLayout: () => <ProbePanel />,
  AccountPanel: () => null,
  ArchivedPanel: () => null,
  ContactInfoPanel: () => null,
  NotificationsWorkspace: () => null,
  ProfilePanel: () => null,
  SecurityWorkspace: () => null,
  SubscriptionPanel: () => null,
}))
// AppearancePanel reaches @agentic-toolkit/themes, whose src/theme-data.ts is GENERATED and
// gitignored — importing it makes this file's outcome depend on whether someone has built the
// themes package. buildSettingsTopics() only constructs its element (the mocked layout never
// renders one), so a stub is exact.
vi.mock('../AppearancePanel', () => ({ AppearancePanel: () => null }))
vi.mock('@agentic-toolkit/profile', () => ({
  UsagePanel: () => null,
  SocialLinksPanel: () => null,
  AddressesPanel: () => null,
}))
vi.mock('@agentic-toolkit/authentication', () => ({ TokensPanel: () => null }))
vi.mock('@agentic-toolkit/personas', () => ({ AssistantsPanel: () => null }))
vi.mock('@agentic-toolkit/api-explorer', () => ({ RecordApiButton: () => null }))

// This package's vitest config sets `globals: true` but has no auto-cleanup setup file, so each
// render must be torn down explicitly or the next test's queries see BOTH mounted trees.
afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

/** A settings panel: reports dirty on demand, and offers a REAL anchor — a next/link would route
 *  through the router and never reach the browser-level guard's interception path. */
function ProbePanel() {
  const { reportDirty } = useSettingsDirty()
  return (
    <div>
      <button type="button" onClick={() => reportDirty('probe', true)}>
        Edit
      </button>
      <a href="/elsewhere">Elsewhere</a>
    </div>
  )
}

describe('SettingsTab mounts a SettingsDirtyProvider, so the routed page guards its own exits', () => {
  it('lets a link click through while no panel is dirty', () => {
    render(<SettingsTab />)
    fireEvent.click(screen.getByText('Elsewhere'))
    expect(screen.queryByRole('button', { name: 'Discard' })).toBeNull()
  })

  it('raises the unsaved-changes alert on a link click while a panel is dirty', () => {
    render(<SettingsTab />)
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }))
    fireEvent.click(screen.getByText('Elsewhere'))
    expect(screen.getByRole('button', { name: 'Discard' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Stay' })).toBeTruthy()
  })
})
