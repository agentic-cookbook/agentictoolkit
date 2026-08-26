// @vitest-environment jsdom
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { describe, it, expect, afterEach, vi } from 'vitest'
import { registerShortcut } from '@agenticdevelopertoolkit/ui/hooks/useShortcut'

import { HubPreferencesPanel } from '../HubPreferencesPanel'
// The PACKAGE PATH, exactly as the panel imports it — a relative import here would be the
// same file today, but this test's whole subject is that the panel and its store are ONE
// module, and matching the specifier is how it keeps saying so.
import {
  DEFAULT_SITE_MENU_SHORTCUT,
  readHubPreferences,
  setSiteMenuShortcut,
} from '@agentic-toolkit/adh/header/hub-preferences'

// This package's vitest config has no auto-cleanup setup file, so each render must be torn
// down explicitly or the next test's queries see both mounted trees.
afterEach(cleanup)

// The store and the shortcut registry are both MODULE state, so a chord saved or registered
// by one case would still be there in the next.
const unregisters: Array<() => void> = []
afterEach(() => {
  while (unregisters.length > 0) unregisters.pop()!()
  setSiteMenuShortcut(DEFAULT_SITE_MENU_SHORTCUT)
  window.localStorage.clear()
})

/** Register a chord the way any surface in the app does, for the conflict check to find. */
function register(keys: string, label: string, run = vi.fn()): typeof run {
  unregisters.push(registerShortcut({ keys, label }, run))
  return run
}

/** jsdom reports no Apple platform, so `mod` is Ctrl here — in the events AND in the labels
 *  formatChord renders, which is why every expectation below reads "Ctrl+…". */
function press(init: KeyboardEventInit): void {
  fireEvent.keyDown(document.body, init)
}

function chordDisplay(): string {
  return screen.getByText((_, el) => el?.getAttribute('aria-live') === 'polite')!.textContent ?? ''
}

function clickButton(name: string): void {
  fireEvent.click(screen.getByRole('button', { name }))
}

describe('HubPreferencesPanel — the site-menu chord', () => {
  it('shows the current chord, and offers no reset while it IS the default', () => {
    render(<HubPreferencesPanel />)
    expect(chordDisplay()).toBe('Ctrl+Shift+K')
    expect(screen.getByRole('button', { name: 'Reset' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Turn off' })).not.toBeDisabled()
    expect(screen.getByRole('button', { name: 'Change' })).toBeTruthy()
  })

  it('records the next keystroke and saves it', () => {
    render(<HubPreferencesPanel />)
    clickButton('Change')
    expect(chordDisplay()).toBe('Press keys…')
    press({ key: 'm', ctrlKey: true, altKey: true })
    expect(readHubPreferences().siteMenuShortcut).toBe('mod+alt+m')
    expect(chordDisplay()).toBe('Ctrl+Alt+M')
    // Recording is over — the panel is back to offering a change, not cancelling one.
    expect(screen.queryByRole('button', { name: 'Cancel' })).toBeNull()
  })

  it('keeps listening through a bare modifier — the user is mid-chord', () => {
    render(<HubPreferencesPanel />)
    clickButton('Change')
    press({ key: 'Control', ctrlKey: true })
    press({ key: 'Shift', ctrlKey: true, shiftKey: true })
    expect(chordDisplay()).toBe('Press keys…')
    expect(readHubPreferences().siteMenuShortcut).toBe(DEFAULT_SITE_MENU_SHORTCUT)
    press({ key: 'j', ctrlKey: true })
    expect(readHubPreferences().siteMenuShortcut).toBe('mod+j')
  })

  it('cancels on Escape, leaving the chord alone', () => {
    render(<HubPreferencesPanel />)
    clickButton('Change')
    press({ key: 'Escape' })
    expect(chordDisplay()).toBe('Ctrl+Shift+K')
    expect(readHubPreferences().siteMenuShortcut).toBe(DEFAULT_SITE_MENU_SHORTCUT)
  })

  it('cancels from the button too', () => {
    render(<HubPreferencesPanel />)
    clickButton('Change')
    clickButton('Cancel')
    expect(chordDisplay()).toBe('Ctrl+Shift+K')
    expect(readHubPreferences().siteMenuShortcut).toBe(DEFAULT_SITE_MENU_SHORTCUT)
  })

  it('swallows the keystroke rather than letting it fire what it is bound to', () => {
    const palette = register('mod+j', 'Open palette')
    render(<HubPreferencesPanel />)
    clickButton('Change')
    press({ key: 'j', ctrlKey: true })
    // The registry's own document listener never saw it: while recording, a keystroke is
    // data. Otherwise recording ⌘K would open the palette over the panel doing the recording.
    expect(palette).not.toHaveBeenCalled()
  })
})

describe('HubPreferencesPanel — conflicts', () => {
  it('refuses a chord another shortcut already owns, and names it', () => {
    register('mod+j', 'Open palette')
    render(<HubPreferencesPanel />)
    clickButton('Change')
    press({ key: 'j', ctrlKey: true })
    const alert = screen.getByRole('alert')
    expect(alert).toHaveTextContent('Ctrl+J is already Open palette')
    expect(readHubPreferences().siteMenuShortcut).toBe(DEFAULT_SITE_MENU_SHORTCUT)
  })

  it('matches a conflict across spellings, since neither one is canonical', () => {
    register('shift+mod+enter', 'Send')
    render(<HubPreferencesPanel />)
    clickButton('Change')
    press({ key: 'Enter', ctrlKey: true, shiftKey: true })
    expect(screen.getByRole('alert')).toHaveTextContent('is already Send')
  })

  it('does NOT count the site menu’s own registration as a conflict', () => {
    // The menu registers the chord it is being given, so without the label exclusion every
    // recording would collide with the surface doing the recording.
    register('mod+j', 'Site menu')
    render(<HubPreferencesPanel />)
    clickButton('Change')
    press({ key: 'j', ctrlKey: true })
    expect(screen.queryByRole('alert')).toBeNull()
    expect(readHubPreferences().siteMenuShortcut).toBe('mod+j')
  })

  it('leaves the conflict standing until the user picks something else', () => {
    register('mod+j', 'Open palette')
    render(<HubPreferencesPanel />)
    clickButton('Change')
    press({ key: 'j', ctrlKey: true })
    expect(screen.getByRole('alert')).toBeTruthy()
    clickButton('Change')
    press({ key: 'm', ctrlKey: true, shiftKey: true })
    expect(screen.queryByRole('alert')).toBeNull()
    expect(readHubPreferences().siteMenuShortcut).toBe('mod+shift+m')
  })
})

describe('HubPreferencesPanel — off and back', () => {
  it('turns the shortcut off, and says so rather than showing an empty box', () => {
    render(<HubPreferencesPanel />)
    clickButton('Turn off')
    expect(chordDisplay()).toBe('Off')
    expect(readHubPreferences().siteMenuShortcut).toBe('')
    expect(screen.getByRole('button', { name: 'Turn off' })).toBeDisabled()
    // "Set", not "Change" — there is nothing to change.
    expect(screen.getByRole('button', { name: 'Set' })).toBeTruthy()
  })

  it('restores the default from Reset', () => {
    render(<HubPreferencesPanel />)
    clickButton('Change')
    press({ key: 'm', ctrlKey: true, altKey: true })
    expect(screen.getByRole('button', { name: 'Reset' })).not.toBeDisabled()
    clickButton('Reset')
    expect(readHubPreferences().siteMenuShortcut).toBe(DEFAULT_SITE_MENU_SHORTCUT)
    expect(chordDisplay()).toBe('Ctrl+Shift+K')
    expect(screen.getByRole('button', { name: 'Reset' })).toBeDisabled()
  })

  it('sets a chord again after being turned off', () => {
    render(<HubPreferencesPanel />)
    clickButton('Turn off')
    clickButton('Set')
    press({ key: 'k', ctrlKey: true, shiftKey: true })
    expect(readHubPreferences().siteMenuShortcut).toBe('mod+shift+k')
    expect(chordDisplay()).toBe('Ctrl+Shift+K')
  })
})
