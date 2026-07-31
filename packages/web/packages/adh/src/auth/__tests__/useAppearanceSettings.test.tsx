/**
 * The editing half of the appearance store: a change is live on THIS document immediately
 * and saved to the signed-in user's account, which is what carries it to the other ~44
 * sites instead of leaving it in this origin's localStorage.
 *
 * Asserted through the DOCUMENT (the `dark` class + data-color-mode a person actually
 * sees) and through the one request, with everything between them real. These assertions
 * used to ride on the colour-mode button's test; the button is a generic control in
 * @agentic-toolkit/ui now (`mode` in, `onChange` out) and knows nothing about accounts, so
 * they belong to the hook that does.
 *
 * Sibling of AppearanceSync.test.tsx, which covers the other half of the same store
 * (whose theme wins on sign-in/sign-out).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, act } from '@testing-library/react'
import type { ColorModePref } from '@agentic-toolkit/themes'

// --- fakes ------------------------------------------------------------------------------------

let auth: { isAuthenticated: boolean }
vi.mock('@agentic-toolkit/auth', () => ({ useAuth: () => auth }))

const authedRequest = vi.fn()
vi.mock('@agentic-toolkit/auth/client', () => ({
  authedRequest: (...a: unknown[]) => authedRequest(...a),
}))

// The specifier useAppearanceSettings.ts actually writes — the package path, not a relative
// one (see its import comment).
vi.mock('@agentic-toolkit/adh/telemetry/report-error', () => ({ captureException: vi.fn() }))

/** The OS setting, which is what `auto` resolves against. */
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
const mode = () => html().dataset.colorMode
const isDark = () => html().classList.contains('dark')

/**
 * A minimal host for the hook, standing in for whatever control a site draws. Imported
 * AFTER the mocks are registered — the themes store attaches its matchMedia listener at
 * module load.
 */
async function renderHost() {
  const { useAppearanceSettings } = await import('../useAppearanceSettings')
  let set: (patch: { colorMode: ColorModePref }) => void = () => {}
  function Host() {
    const settings = useAppearanceSettings()
    set = settings.set
    return null
  }
  render(<Host />)
  return { setMode: (colorMode: ColorModePref) => act(() => set({ colorMode })) }
}

describe('useAppearanceSettings', () => {
  beforeEach(() => {
    vi.resetModules()
    authedRequest.mockReset()
    authedRequest.mockResolvedValue(undefined)
    localStorage.clear()
    html().className = ''
    delete html().dataset.colorMode
    systemPrefersDark(false)
    auth = { isAuthenticated: false }
  })
  afterEach(() => vi.unstubAllGlobals())

  it('puts the choice into effect on this document immediately', async () => {
    const { setMode } = await renderHost()
    expect(mode()).toBeUndefined() // nothing applied until something is chosen

    setMode('dark')
    expect(mode()).toBe('dark')
    expect(isDark()).toBe(true)

    setMode('light')
    expect(mode()).toBe('light')
    expect(isDark()).toBe(false)
  })

  it('`auto` follows the OS, not the last explicit choice', async () => {
    systemPrefersDark(true)
    const { setMode } = await renderHost()
    setMode('light') // explicitly against the OS
    expect(isDark()).toBe(false)
    setMode('auto')
    expect(isDark()).toBe(true)
  })

  it('signed OUT: changes the document but saves nothing', async () => {
    const { setMode } = await renderHost()
    setMode('dark')
    expect(isDark()).toBe(true)
    expect(authedRequest).not.toHaveBeenCalled() // no account to save to
  })

  it('signed IN: saves the choice to the account so it follows the user', async () => {
    auth = { isAuthenticated: true }
    const { setMode } = await renderHost()
    setMode('dark')
    expect(authedRequest).toHaveBeenCalledTimes(1)
    const [path, init] = authedRequest.mock.calls[0] as [string, RequestInit]
    expect(path).toBe('/api/me/appearance')
    expect(init.method).toBe('PUT')
    // The whole shape, not just the patch — PUT is a full replacement.
    expect(JSON.parse(String(init.body))).toMatchObject({ colorMode: 'dark' })
  })
})
