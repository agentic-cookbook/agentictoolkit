/**
 * The footer dock, rendered FOR REAL.
 *
 * footerBitbag.test.tsx stubs `../footer/FooterChat` down to a marker, which is right for what
 * it asserts (bitbag is not gated — the assertion is about him being MOUNTED, not about his
 * internals). The cost is that nothing anywhere mounted him: he now ships in the footer of
 * every site, and the two things the footer itself owns were untested. Both are pinned here,
 * against the real `BitbagDock`:
 *
 *   1. the positioning class — the dock is deliberately unpositioned, so `.adh-footer__chat`
 *      landing on its column is what bottom-anchors him out of the footer bar;
 *   2. the chat theme arriving as a PROP — the hub's Debug console writes a key into the
 *      shared store, and it has to reach the component that owns the theme scope. A host
 *      <ThemeStyle> around the dock sets the same custom properties on a FARTHER ancestor and
 *      silently loses, which is exactly how the picker spent a while looking wired and
 *      theming nothing (see footer/chat-theme-store.ts).
 *
 * `FooterChatInner` is rendered directly rather than through `FooterChat`: the loader is a
 * three-line `next/dynamic` wrapper whose import resolves to the package's built dist, so
 * going through it would test the last build instead of the source.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
// Type-side too, not just the runtime setup — see footerBitbag.test.tsx.
import '@testing-library/jest-dom/vitest'
import { render, cleanup } from '@testing-library/react'
import { ThemeStyle } from '@agenticdevelopertoolkit/themes'
import FooterChatInner from '../footer/FooterChatInner'

/** Mirrors footer/chat-theme-store.ts — the localStorage key the Debug console writes. */
const STORAGE_KEY = 'adh-chat-theme'
/** bitbag scopes his own theme block to `.pc-theme-scope` (BitbagChat). */
const THEME_SCOPE = '.pc-theme-scope'

/** The one <style> scoped to bitbag's theme root, picked by CONTENT rather than by id or
 *  position — the dock is free to emit other style tags, and the id is the toolkit's
 *  business. Empty string if he emitted no theme block at all, so a miss reads as a
 *  mismatch instead of a crash. */
function themeCss(container: HTMLElement): string {
  const marker = `@scope (${THEME_SCOPE})`
  return (
    [...container.querySelectorAll('style')]
      .map((s) => s.textContent ?? '')
      .find((css) => css.includes(marker)) ?? ''
  )
}

/** The CSS `ThemeStyle` emits for a theme at bitbag's scope — used as an ORACLE, so these
 *  assertions say "the dock is wearing theme X" rather than restating X's stylesheet. */
function cssFor(theme: 'adh' | 'terminal'): string {
  const { container, unmount } = render(<ThemeStyle theme={theme} scope={THEME_SCOPE} />)
  const css = themeCss(container)
  unmount()
  return css
}

describe('footer dock', () => {
  beforeEach(() => {
    window.localStorage.removeItem(STORAGE_KEY)
  })
  afterEach(() => {
    cleanup()
    window.localStorage.removeItem(STORAGE_KEY)
  })

  it('mounts the real dock under the footer positioning class', () => {
    const { container } = render(<FooterChatInner />)
    const dock = container.querySelector('.bb-dock')
    expect(dock).not.toBeNull()
    // The host's wrapper class rides on the dock column itself, not on some div around it —
    // adh-components.css positions `.adh-footer__chat` directly.
    expect(dock).toHaveClass('adh-footer__chat')
    // His face and his chat, the two halves of the fixture.
    expect(container.querySelector('.bb-dock__avatar')).not.toBeNull()
    expect(container.querySelector('.bb-dock__chat')).not.toBeNull()
  })

  it('wears bitbag’s own skin when nothing is stored', () => {
    const { container } = render(<FooterChatInner />)
    expect(themeCss(container)).toBe(cssFor('adh'))
  })

  it('wears the theme the Debug console stored', () => {
    window.localStorage.setItem(STORAGE_KEY, 'terminal')
    const { container } = render(<FooterChatInner />)
    const css = themeCss(container)
    expect(css).toBe(cssFor('terminal'))
    // Stated as a difference too: an assertion that only matched the oracle would also pass
    // if the store were ignored and both keys happened to build the same block.
    expect(css).not.toBe(cssFor('adh'))
  })

  it('ignores a stored key that is not a theme', () => {
    // The store validates against the toolkit's manifest, so a stale or hand-edited value
    // falls back to his default instead of reaching `themes[key]` and throwing on undefined.
    window.localStorage.setItem(STORAGE_KEY, 'not-a-theme')
    const { container } = render(<FooterChatInner />)
    expect(themeCss(container)).toBe(cssFor('adh'))
  })
})
