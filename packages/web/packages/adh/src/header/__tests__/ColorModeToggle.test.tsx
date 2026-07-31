/**
 * The toggle drives the ONE appearance store, and it is asserted through the DOCUMENT —
 * the `dark` class and `data-color-mode` a person actually sees — rather than through a
 * stubbed `set`. Everything below the button (useAppearanceSettings → the themes store)
 * is real; only the two things that would reach the network are faked.
 *
 * Sibling of auth/__tests__/AppearanceSync.test.tsx, which covers the other half of the
 * same store (whose theme wins on sign-in/sign-out).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import { renderToStaticMarkup } from 'react-dom/server'

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

/** The OS setting. Both this component and the themes store read it through matchMedia. */
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

// Imported AFTER the mocks are registered — the themes store attaches its matchMedia
// listener at module load.
async function renderToggle() {
  const { ColorModeToggle } = await import('../ColorModeToggle')
  return render(<ColorModeToggle />)
}

const click = () => act(() => screen.getByRole('button').click())

describe('ColorModeToggle', () => {
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

  // The order is Appearance settings' order — System, Light, Dark — because this button
  // and that panel set the same preference, and a control that cycles them in a different
  // order than the panel lists them is two designs for one setting.
  it('cycles the document auto → light → dark → auto', async () => {
    await renderToggle()
    expect(mode()).toBeUndefined() // nothing applied until something is chosen

    click()
    expect(mode()).toBe('light')
    expect(isDark()).toBe(false)

    click()
    expect(mode()).toBe('dark')
    expect(isDark()).toBe(true)

    click()
    expect(mode()).toBe('auto')
    expect(isDark()).toBe(false) // …and `auto` re-resolves against the OS, which says light
  })

  it('`auto` follows the OS, not the last explicit choice', async () => {
    systemPrefersDark(true)
    await renderToggle()
    click() // light — explicitly against the OS
    expect(isDark()).toBe(false)
    click() // dark
    click() // auto
    expect(isDark()).toBe(true)
  })

  it('names the mode and the next mode for a screen reader', async () => {
    // The family's words, not the store's keys: the panel calls `auto` "System", so a
    // screen reader hears the same three names from either control.
    await renderToggle()
    expect(await screen.findByLabelText(/System \(currently light\)/)).toBeTruthy()
    expect(screen.getByRole('button').getAttribute('aria-label')).toMatch(/switch to Light/)
    click()
    expect(screen.getByRole('button').getAttribute('aria-label')).toMatch(
      /Theme: Light\. Click to switch to Dark\./,
    )
  })

  it('says nothing about the mode in server HTML', async () => {
    // The saved mode (localStorage) and the resolved theme (matchMedia) exist only in the
    // browser, so neither may appear in prerendered HTML — this markup is served to everyone.
    // A mode-specific label here is a hydration mismatch AND a wrong label on a cached page.
    localStorage.setItem('adh:appearance', JSON.stringify({ colorMode: 'dark' }))
    const { ColorModeToggle } = await import('../ColorModeToggle')
    const markup = renderToStaticMarkup(<ColorModeToggle />)
    expect(markup).toContain('aria-label="Theme"')
    expect(markup).not.toContain('title=')
  })

  it('renders all three faces in every mode — which one shows is CSS', async () => {
    // The monitor/sun/moon are chosen by `html[data-color-mode]`, which the pre-paint script
    // sets before first paint. A JS branch here would be a frame late and wrong in prerendered
    // HTML. Rendering all three unconditionally is what makes that possible, so it is asserted
    // rather than left to the CSS to imply.
    const { container } = await renderToggle()
    const faces = () => [
      container.querySelector('.adh-color-mode-toggle__auto'),
      container.querySelector('.adh-color-mode-toggle__light'),
      container.querySelector('.adh-color-mode-toggle__dark'),
    ]
    expect(faces().every(Boolean)).toBe(true)
    expect(container.querySelectorAll('.adh-color-mode-toggle__face')).toHaveLength(3)
    click() // light
    expect(faces().every(Boolean)).toBe(true)
    click() // dark
    expect(faces().every(Boolean)).toBe(true)
  })

  it('signed OUT: changes the document but saves nothing', async () => {
    systemPrefersDark(true) // so `auto` starts dark and the first click has somewhere to go
    await renderToggle()
    click() // light
    expect(mode()).toBe('light')
    expect(isDark()).toBe(false)
    expect(authedRequest).not.toHaveBeenCalled() // no account to save to
  })

  it('signed IN: saves the choice to the account so it follows the user', async () => {
    auth = { isAuthenticated: true }
    await renderToggle()
    click()
    expect(authedRequest).toHaveBeenCalledTimes(1)
    const [path, init] = authedRequest.mock.calls[0] as [string, RequestInit]
    expect(path).toBe('/api/me/appearance')
    expect(init.method).toBe('PUT')
    // The whole shape, not just the patch — PUT is a full replacement.
    expect(JSON.parse(String(init.body))).toMatchObject({ colorMode: 'light' })
  })
})
