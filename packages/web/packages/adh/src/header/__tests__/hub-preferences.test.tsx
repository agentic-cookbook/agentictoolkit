/** Unit tests for the hub-preferences store (header/hub-preferences).
 *
 *  The store hydrates its snapshot at MODULE scope, which is exactly the behaviour most of
 *  these cases are about — so they seed localStorage and then re-import the module with
 *  `vi.resetModules()`. A single top-level import would test one hydration for the whole
 *  file and could never see a stored value at all. */
/// <reference types="@testing-library/jest-dom/vitest" />
import { render, screen, act } from '@testing-library/react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { type ReactElement } from 'react'

/** The storage key, restated here on purpose: the module does not export it, and a test that
 *  imported it could not tell a renamed key from a working one. */
const KEY = 'adh:hub-preferences'

type Store = typeof import('../hub-preferences')

/** A fresh copy of the store, hydrated from whatever localStorage holds right now. */
async function load(): Promise<Store> {
  vi.resetModules()
  return (await import('../hub-preferences')) as Store
}

function seed(raw: string): void {
  window.localStorage.setItem(KEY, raw)
}

/** Renders the chord the hook reports. `''` is a real value, so it is spelled rather than
 *  rendered as nothing — an empty node and a missing node look the same to a query. */
function probeFor(store: Store): () => ReactElement {
  return function Probe(): ReactElement {
    const { siteMenuShortcut } = store.useHubPreferences()
    return <span data-testid="chord">{siteMenuShortcut === '' ? '(off)' : siteMenuShortcut}</span>
  }
}

beforeEach(() => {
  window.localStorage.clear()
})

describe('the default chord', () => {
  it('is ⌘⇧K — pinned, because the menu and the settings panel both name it', async () => {
    const store = await load()
    expect(store.DEFAULT_SITE_MENU_SHORTCUT).toBe('mod+shift+k')
  })
})

describe('readHubPreferences', () => {
  it('falls back to the default when nothing is stored', async () => {
    const store = await load()
    expect(store.readHubPreferences().siteMenuShortcut).toBe(store.DEFAULT_SITE_MENU_SHORTCUT)
  })

  it('hydrates a stored chord on import', async () => {
    seed(JSON.stringify({ siteMenuShortcut: 'mod+j' }))
    const store = await load()
    expect(store.readHubPreferences().siteMenuShortcut).toBe('mod+j')
  })

  it('keeps a stored empty string — the user turned the shortcut OFF, which is not "unset"', async () => {
    seed(JSON.stringify({ siteMenuShortcut: '' }))
    const store = await load()
    // The whole reason readStorage tests the TYPE rather than truthiness: a falsy-check here
    // would silently hand the default back to a user who deliberately turned the chord off.
    expect(store.readHubPreferences().siteMenuShortcut).toBe('')
  })

  it('falls back on anything it cannot read as preferences', async () => {
    for (const raw of ['not json at all', 'null', '[]', '"mod+j"', '{"siteMenuShortcut":42}', '{}']) {
      window.localStorage.clear()
      seed(raw)
      const store = await load()
      expect(store.readHubPreferences().siteMenuShortcut, raw).toBe(
        store.DEFAULT_SITE_MENU_SHORTCUT,
      )
    }
  })

  it('returns a stable reference until something actually changes', async () => {
    const store = await load()
    const first = store.readHubPreferences()
    expect(store.readHubPreferences()).toBe(first)
    // Setting the value it already holds must not mint a new snapshot: useSyncExternalStore
    // compares by identity, and a fresh object per read re-renders forever.
    store.setSiteMenuShortcut(first.siteMenuShortcut)
    expect(store.readHubPreferences()).toBe(first)
    store.setSiteMenuShortcut('mod+j')
    expect(store.readHubPreferences()).not.toBe(first)
  })
})

describe('setSiteMenuShortcut', () => {
  it('persists the chord where the next page load will find it', async () => {
    const store = await load()
    store.setSiteMenuShortcut('mod+alt+m')
    expect(JSON.parse(window.localStorage.getItem(KEY) ?? 'null')).toEqual({
      siteMenuShortcut: 'mod+alt+m',
    })
  })

  it('persists an empty string rather than clearing the key — off is a choice to remember', async () => {
    const store = await load()
    store.setSiteMenuShortcut('')
    expect(JSON.parse(window.localStorage.getItem(KEY) ?? 'null')).toEqual({ siteMenuShortcut: '' })
    const reloaded = await load()
    expect(reloaded.readHubPreferences().siteMenuShortcut).toBe('')
  })

  it('still changes the chord for this session when storage refuses the write', async () => {
    const store = await load()
    const setItem = vi
      .spyOn(window.localStorage, 'setItem')
      .mockImplementation(() => {
        throw new DOMException('quota', 'QuotaExceededError')
      })
    try {
      expect(() => store.setSiteMenuShortcut('mod+j')).not.toThrow()
      expect(store.readHubPreferences().siteMenuShortcut).toBe('mod+j')
    } finally {
      setItem.mockRestore()
    }
  })
})

describe('useHubPreferences', () => {
  it('renders the stored chord and follows a write', async () => {
    seed(JSON.stringify({ siteMenuShortcut: 'mod+j' }))
    const store = await load()
    const Probe = probeFor(store)
    render(<Probe />)
    expect(screen.getByTestId('chord')).toHaveTextContent('mod+j')
    act(() => store.setSiteMenuShortcut(''))
    expect(screen.getByTestId('chord')).toHaveTextContent('(off)')
  })

  it("follows another tab's write, which arrives as a storage event", async () => {
    const store = await load()
    const Probe = probeFor(store)
    render(<Probe />)
    expect(screen.getByTestId('chord')).toHaveTextContent(store.DEFAULT_SITE_MENU_SHORTCUT)
    act(() => {
      seed(JSON.stringify({ siteMenuShortcut: 'mod+alt+m' }))
      window.dispatchEvent(new StorageEvent('storage', { key: KEY }))
    })
    expect(screen.getByTestId('chord')).toHaveTextContent('mod+alt+m')
  })

  it('re-reads when a whole storage area is cleared, which reports a null key', async () => {
    seed(JSON.stringify({ siteMenuShortcut: 'mod+j' }))
    const store = await load()
    const Probe = probeFor(store)
    render(<Probe />)
    expect(screen.getByTestId('chord')).toHaveTextContent('mod+j')
    act(() => {
      window.localStorage.clear()
      window.dispatchEvent(new StorageEvent('storage', { key: null }))
    })
    expect(screen.getByTestId('chord')).toHaveTextContent(store.DEFAULT_SITE_MENU_SHORTCUT)
  })

  it('ignores a storage event for someone else’s key', async () => {
    const store = await load()
    const Probe = probeFor(store)
    render(<Probe />)
    act(() => {
      // A write this store did not make. The value under OUR key changes too, so a handler
      // that re-read unconditionally would be indistinguishable from one that filtered.
      seed(JSON.stringify({ siteMenuShortcut: 'mod+j' }))
      window.dispatchEvent(new StorageEvent('storage', { key: 'adh:recents' }))
    })
    expect(screen.getByTestId('chord')).toHaveTextContent(store.DEFAULT_SITE_MENU_SHORTCUT)
  })
})
