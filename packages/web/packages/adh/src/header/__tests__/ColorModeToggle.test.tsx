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

  it('cycles the document auto → dark → light → auto', async () => {
    await renderToggle()
    expect(mode()).toBeUndefined() // nothing applied until something is chosen

    click()
    expect(mode()).toBe('dark')
    expect(isDark()).toBe(true)

    click()
    expect(mode()).toBe('light')
    expect(isDark()).toBe(false)

    click()
    expect(mode()).toBe('auto')
    expect(isDark()).toBe(false) // …and `auto` re-resolves against the OS, which says light
  })

  it('`auto` follows the OS, not the last explicit choice', async () => {
    systemPrefersDark(true)
    await renderToggle()
    click() // dark
    click() // light — explicitly against the OS
    expect(isDark()).toBe(false)
    click() // auto
    expect(isDark()).toBe(true)
  })

  it('names the mode and the next mode for a screen reader', async () => {
    await renderToggle()
    expect(await screen.findByLabelText(/Auto \(currently light\)/)).toBeTruthy()
    expect(screen.getByRole('button').getAttribute('aria-label')).toMatch(/switch to dark/)
    click()
    expect(screen.getByRole('button').getAttribute('aria-label')).toMatch(
      /Theme: dark\. Click to switch to light\./,
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

  it('renders all three glyphs in every mode — which one shows is CSS', async () => {
    // The sun/moon pair and the auto badge are chosen by `html.dark` / `html[data-color-mode]`,
    // both of which the pre-paint script sets before first paint. A JS branch here would be a
    // frame late and wrong in prerendered HTML. Rendering all three unconditionally is what
    // makes that possible, so it is asserted rather than left to the CSS to imply.
    const { container } = await renderToggle()
    const glyphs = () => [
      container.querySelector('.adh-color-mode-toggle__moon'),
      container.querySelector('.adh-color-mode-toggle__sun'),
      container.querySelector('.adh-color-mode-toggle__badge'),
    ]
    expect(glyphs().every(Boolean)).toBe(true)
    click() // dark
    expect(glyphs().every(Boolean)).toBe(true)
    click() // light
    expect(glyphs().every(Boolean)).toBe(true)
  })

  it('signed OUT: changes the document but saves nothing', async () => {
    await renderToggle()
    click()
    expect(isDark()).toBe(true)
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
    expect(JSON.parse(String(init.body))).toMatchObject({ colorMode: 'dark' })
  })
})
