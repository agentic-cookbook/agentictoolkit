/** The colour-mode control: `mode` in, the NEXT mode out, and an accessible name that
 *  says nothing until the browser has one. What it drives is the host's business (on adh
 *  that is `useAppearanceSettings` → the appearance store → the account), so the store
 *  side is asserted there — see adh/src/auth/__tests__/useAppearanceSettings.test.tsx.
 *  Interactions use fireEvent (no userEvent), matching the other ui component tests. */
/// <reference types="@testing-library/jest-dom/vitest" />
import { render, screen, fireEvent } from '@testing-library/react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { ColorModeToggle, type ColorMode } from '../components/color-mode-toggle'

/** The OS setting, which the label (and only the label) resolves `auto` against. */
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

function renderToggle(mode: ColorMode) {
  const onChange = vi.fn()
  const utils = render(<ColorModeToggle mode={mode} onChange={onChange} />)
  return { ...utils, onChange, button: screen.getByRole('button') }
}

describe('ColorModeToggle', () => {
  beforeEach(() => systemPrefersDark(false))
  afterEach(() => vi.unstubAllGlobals())

  it('hands the caller the next mode: auto → dark → light → auto', () => {
    for (const [mode, next] of [
      ['auto', 'dark'],
      ['dark', 'light'],
      ['light', 'auto'],
    ] as const) {
      const { onChange, button, unmount } = renderToggle(mode)
      fireEvent.click(button)
      expect(onChange).toHaveBeenCalledWith(next)
      unmount()
    }
  })

  it('names the mode and the next mode for a screen reader', async () => {
    const { button } = renderToggle('auto')
    expect(await screen.findByLabelText(/Auto \(currently light\)/)).toBeTruthy()
    expect(button.getAttribute('aria-label')).toMatch(/switch to dark/)
  })

  it('resolves `auto` against the OS, which only the browser can answer', async () => {
    systemPrefersDark(true)
    renderToggle('auto')
    expect(await screen.findByLabelText(/Auto \(currently dark\)/)).toBeTruthy()
  })

  it('says nothing about the mode in server HTML', () => {
    // The saved mode and the resolved theme exist only in the browser, so neither may
    // appear in prerendered HTML — this markup is served to everyone. A mode-specific
    // label here is a hydration mismatch AND a wrong label on a cached page.
    const markup = renderToStaticMarkup(<ColorModeToggle mode="dark" onChange={() => {}} />)
    expect(markup).toContain('aria-label="Theme"')
    expect(markup).not.toContain('title=')
  })

  it('renders all three glyphs in every mode — which one shows is CSS', () => {
    // The sun/moon pair and the auto badge are chosen by `html.dark` / `html[data-color-mode]`,
    // both of which the appearance pre-paint script sets before first paint. A JS branch here
    // would be a frame late and wrong in prerendered HTML. Rendering all three unconditionally
    // is what makes that possible, so it is asserted rather than left to the CSS to imply.
    for (const mode of ['auto', 'dark', 'light'] as const) {
      const { container, unmount } = renderToggle(mode)
      const glyphs = [
        container.querySelector('.adh-color-mode-toggle__moon'),
        container.querySelector('.adh-color-mode-toggle__sun'),
        container.querySelector('.adh-color-mode-toggle__badge'),
      ]
      expect(glyphs.every(Boolean)).toBe(true)
      unmount()
    }
  })

  it('keeps its own class and takes the host identity alongside it', () => {
    // The host dresses the button (adh chrome passes `.adh-header__icon-button`); the
    // control's own class has to survive that, because its faces and badge are styled
    // through it.
    const { container } = render(
      <ColorModeToggle mode="auto" onChange={() => {}} className="adh-header__icon-button" />,
    )
    const button = container.querySelector('button')
    expect(button).toHaveClass('adh-color-mode-toggle')
    expect(button).toHaveClass('adh-header__icon-button')
  })
})
