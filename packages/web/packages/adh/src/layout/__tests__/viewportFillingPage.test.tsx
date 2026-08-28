import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { HierarchicalTopicDetail, type TopicLevel } from '@agenticdevelopertoolkit/ui/blocks'
import { AdhAppShell } from '../AdhAppShell'

/**
 * THE BOTTOM BAND, AND WHO IS ALLOWED TO KEEP IT.
 *
 * "the HTDV content should be pinned to the top of the footer, there is currently a gap — this is
 * likely a code in the shared code, fixing it here will fix it everywhere" (Mike). Measured on his
 * screenshot: the band between the console's last row and the footer is 6rem at adh's 12px root,
 * i.e. exactly `.adh-app-shell__main`'s reservation for the bitbag dock to overhang.
 *
 * That reservation is right for a page that SCROLLS — you pass it once and never see it again —
 * and wrong for a page that is MEASURED against the viewport, where it is a permanent strip of
 * empty that the layout has already shrunk itself to fit above. So the page declares
 * `data-fills-viewport` and the shell hands the space back.
 *
 * WHY THIS IS A TEST AND NOT A COMMENT. The mechanism spans two packages and a stylesheet, and no
 * compiler can see any of it: `ui` writes an attribute nothing imports, `adh` writes a `:has()`
 * rule keyed on that attribute and on a class name that only exists as a string in a `.tsx`. Any
 * one of the three can be renamed with every build still green and every test still passing —
 * and the failure is 72px of nothing above the footer on every console in the family, which is
 * precisely how it got reported twice.
 *
 * The three halves, each pinned where it lives:
 *   - the attribute, here and in `ui/src/__tests__/hierarchicalTopicDetail.test.tsx`;
 *   - the rules and the class, here;
 *   - and whether the CSS a browser actually received still does it, in
 *     `sites/shipr/tests/smoke.spec.ts` ("hands its bottom band back…") — the half that a stale
 *     package build defeats, and the reason a source-only test is not enough on its own.
 */

/**
 * The stylesheet, as a FILE.
 *
 * Read off disk rather than imported, and walked to rather than resolved from this module's own
 * path, because neither shortcut works here: importing a `.css` under Vite hands back the
 * processed stylesheet (`?raw` yields an empty string — the CSS pipeline claims the request
 * first), and `import.meta.url` arrives as an `http:` URL in the jsdom environment. Walking up
 * from the runner's cwd is the one route that holds however the suite was started, and the last
 * assertion in the block below is what stops a missed file from passing as an empty one.
 */
const RELATIVE = join('src', 'styles', 'adh-site.css')
function findStylesheet(): string | null {
  let dir = resolve(process.cwd())
  for (;;) {
    const candidate = join(dir, RELATIVE)
    if (existsSync(candidate)) return candidate
    const up = dirname(dir)
    if (up === dir) return null
    dir = up
  }
}
const STYLESHEET = findStylesheet()

/** …with its comments removed. Those comments explain the two rules below AND quote the selectors
 *  while doing it, so a test that grepped the raw file would pass on the prose alone. */
const CSS = (STYLESHEET === null ? '' : readFileSync(STYLESHEET, 'utf-8')).replace(
  /\/\*[\s\S]*?\*\//g,
  '',
)

/** The declarations of the rule with exactly this selector, or null if there is no such rule. */
function ruleBody(selector: string): string | null {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const match = CSS.match(new RegExp(`(^|\\})\\s*${escaped}\\s*\\{([^}]*)\\}`))
  return match ? match[2]!.trim() : null
}

const LEVELS: TopicLevel[] = [
  {
    id: 'things',
    title: 'Things',
    items: [{ id: 'a', label: 'A' }],
    selectedId: 'a',
    onSelect: () => {},
    onClear: () => {},
  },
]

describe('a viewport-filling page keeps the band the app shell reserves', () => {
  it('found the stylesheet it means to read', () => {
    // The footing. A file-reading test that misses its file asserts on an empty string, and an
    // empty string has no rules to be wrong about — every case below would go green over nothing.
    expect(STYLESHEET, `no ${RELATIVE} above ${process.cwd()}`).not.toBeNull()
    expect(CSS.length).toBeGreaterThan(1000)
  })

  it('reserves a bottom band on every page', () => {
    // The base rule. Asserted first because the cancel below is meaningless without it — a test
    // that only checked the override would go on passing after the reservation was deleted, and
    // report a fix for a problem that no longer exists.
    expect(ruleBody('.adh-app-shell__main')).toMatch(/padding-bottom:\s*[1-9][\d.]*rem/)
  })

  it('hands it back to a page that declares data-fills-viewport', () => {
    expect(ruleBody('.adh-app-shell__main:has([data-fills-viewport])')).toMatch(
      /padding-bottom:\s*0\b/,
    )
  })

  it('keys both rules on the class the shell actually renders', () => {
    // The one link in the chain a rename breaks silently in the OTHER direction: the stylesheet is
    // a string, so `main`'s class can change without CSS noticing, and the page keeps its band.
    const { container } = render(
      <AdhAppShell header={null} footer={<footer>F</footer>}>
        <p>body</p>
      </AdhAppShell>,
    )
    expect(container.querySelector('main')?.className).toBe('adh-app-shell__main')
  })

  it('puts a real HTDV inside the shell where the :has() selector can find it', () => {
    // The composition, not the two halves separately: `:has()` looks for a DESCENDANT of `main`,
    // so a shell that portalled its children elsewhere — or an HTDV that moved the attribute onto
    // something the portal leaves behind — would satisfy both assertions above and still leave the
    // band on screen. jsdom cannot lay this out, but it can answer the question the selector asks.
    const { container } = render(
      <AdhAppShell header={null} footer={<footer>F</footer>}>
        <HierarchicalTopicDetail levels={LEVELS} />
      </AdhAppShell>,
    )
    const main = container.querySelector('main')
    expect(main).not.toBeNull()
    expect(main!.querySelector('[data-fills-viewport]')).not.toBeNull()
  })

  it('leaves an ordinary page’s band alone', () => {
    // The other side of the pair. Without it, "hands the space back" could regress to "never
    // reserved it", and every scrolling page in the family would lose its last row under the dock.
    const { container } = render(
      <AdhAppShell header={null} footer={<footer>F</footer>}>
        <p>body</p>
      </AdhAppShell>,
    )
    expect(container.querySelector('main')!.querySelector('[data-fills-viewport]')).toBeNull()
  })
})
