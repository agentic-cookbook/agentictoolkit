/**
 * The rule the whole feature comes down to:
 *
 *   signed in  → the colour mode saved against the USER
 *   signed out → the OPERATING SYSTEM setting
 *
 * These drive AppearanceSync against a fake auth context and a fake /me/appearance, and assert on
 * the DOCUMENT (the `dark` class + data-color-mode) — the thing a person actually sees — rather
 * than on the store's internals.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, waitFor } from '@testing-library/react'
import { APPEARANCE_STORAGE_KEY } from '@agenticdevelopertoolkit/themes'

// --- fakes ------------------------------------------------------------------------------------

let auth: { isAuthenticated: boolean; isLoading: boolean; user: { id: string } | null }
vi.mock('@agentic-toolkit/auth', () => ({ useAuth: () => auth }))

const authedJson = vi.fn()
vi.mock('@agentic-toolkit/auth/client', () => ({ authedJson: (...a: unknown[]) => authedJson(...a) }))

// Mocks the specifier AppearanceSync.tsx actually writes — the PACKAGE PATH
// '@agentic-toolkit/adh/telemetry/report-error' (see its import comment) — not
// the former '@adh/chrome/telemetry', which nothing in this merged package imports anymore.
vi.mock('@agentic-toolkit/adh/telemetry/report-error', () => ({ captureException: vi.fn() }))

// The OS setting. Both the store and the prepaint read it through matchMedia.
function systemPrefersDark(dark: boolean) {
  vi.stubGlobal(
    'matchMedia',
    vi.fn((q: string) => ({
      matches: q.includes('prefers-color-scheme: dark') ? dark : false,
      media: q,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  )
}

const html = () => document.documentElement
const isDark = () => html().classList.contains('dark')

// Imported AFTER the mocks are registered (the store attaches a matchMedia listener at module load).
async function renderSync() {
  const { AppearanceSync } = await import('../AppearanceSync')
  return render(<AppearanceSync />)
}

describe('AppearanceSync — whose theme is it?', () => {
  beforeEach(() => {
    vi.resetModules()
    authedJson.mockReset()
    localStorage.clear()
    html().className = ''
    delete html().dataset.colorMode
    systemPrefersDark(false)
    auth = { isAuthenticated: false, isLoading: false, user: null }
  })
  afterEach(() => vi.unstubAllGlobals())

  it('signed OUT: follows the system — light when the OS is light', async () => {
    systemPrefersDark(false)
    await renderSync()
    await waitFor(() => expect(html().dataset.colorMode).toBe('auto'))
    expect(isDark()).toBe(false)
    expect(authedJson).not.toHaveBeenCalled() // no account ⇒ nothing to fetch
  })

  it('signed OUT: follows the system — dark when the OS is dark', async () => {
    systemPrefersDark(true)
    await renderSync()
    await waitFor(() => expect(isDark()).toBe(true))
    expect(html().dataset.colorMode).toBe('auto')
  })

  it("signed OUT: does NOT inherit the previous user's cached theme", async () => {
    // A signed-in user picked light on this browser, then signed out. The OS is dark.
    localStorage.setItem(APPEARANCE_STORAGE_KEY, JSON.stringify({ colorMode: 'light' }))
    systemPrefersDark(true)
    await renderSync()
    await waitFor(() => expect(isDark()).toBe(true)) // the OS wins, not the stale cache
    expect(localStorage.getItem(APPEARANCE_STORAGE_KEY)).toBeNull() // and the cache is cleared
  })

  it('signed IN: the saved pref beats the system setting', async () => {
    systemPrefersDark(true) // OS says dark …
    auth = { isAuthenticated: true, isLoading: false, user: { id: 'u1' } }
    authedJson.mockResolvedValue({ prefs: { colorMode: 'light' } }) // … the user says light
    await renderSync()
    await waitFor(() => expect(isDark()).toBe(false))
    expect(authedJson).toHaveBeenCalledWith('/api/me/appearance')
    expect(html().dataset.colorMode).toBe('light')
  })

  it('signed IN with no saved pref: back to the system setting', async () => {
    systemPrefersDark(true)
    auth = { isAuthenticated: true, isLoading: false, user: { id: 'u1' } }
    authedJson.mockResolvedValue({ prefs: {} }) // a fresh account
    await renderSync()
    await waitFor(() => expect(html().dataset.colorMode).toBe('auto'))
    expect(isDark()).toBe(true)
  })

  it('while auth is still resolving: touches nothing (no flash)', async () => {
    html().classList.add('dark') // what the pre-paint script left
    auth = { isAuthenticated: false, isLoading: true, user: null }
    await renderSync()
    expect(isDark()).toBe(true) // NOT reset to the OS mid-resolution
    expect(authedJson).not.toHaveBeenCalled()
  })

  it("a failed fetch leaves the pre-painted document alone", async () => {
    html().classList.add('dark')
    auth = { isAuthenticated: true, isLoading: false, user: { id: 'u1' } }
    authedJson.mockRejectedValue(new Error('boom'))
    await renderSync()
    await waitFor(() => expect(authedJson).toHaveBeenCalled())
    expect(isDark()).toBe(true) // the theme is not yanked out from under the user
  })
})
