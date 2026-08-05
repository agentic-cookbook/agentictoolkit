import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * Where a screen's content sits vertically is the PACKAGE's decision.
 *
 * It was half a decision for a while: `.lp-screen` pushed content past the
 * fixed header and let it run down from there, so a short section hugged the
 * header, a tall one filled the band, and the same deck read as a different
 * layout screen to screen. The missing half is `align-content` on the content
 * column — content centres inside the visible part of the top third — and
 * neither half is exposed as a token, because "put the headings at one height"
 * is not a per-site judgement and a consumer that had to opt in would be a
 * consumer that could forget.
 *
 * None of this is measurable here: jsdom resolves no cascade and lays nothing
 * out, so the assertions below are about the STYLESHEET, plus one that runs the
 * selector through a real selector engine to prove it reaches the elements the
 * package puts on the page (and not the hero).
 */
const BASE = readFileSync(join(__dirname, '..', 'css', 'base.css'), 'utf8')
const BAND = '.lp-screen:not(.lp-screen--center) > .lp-wrap'

/**
 * Every fallback given for `var(--<name>, …)`, in source order.
 *
 * Scanned by paren depth rather than matched by regex: the fallback here is
 * `clamp(5.5rem, 14svh, 9rem)`, and a `[^)]*` would stop inside it — which
 * would still pass the assertions below while reading a truncated string, the
 * one failure mode a drift guard cannot afford.
 */
function fallbacks(name: string): string[] {
  const found: string[] = []
  const open = `var(${name},`
  for (let at = BASE.indexOf(open); at !== -1; at = BASE.indexOf(open, at + 1)) {
    let depth = 1
    let i = at + open.length
    for (; i < BASE.length && depth > 0; i++) {
      if (BASE[i] === '(') depth++
      else if (BASE[i] === ')') depth--
    }
    found.push(BASE.slice(at + open.length, i - 1).trim())
  }
  return found
}

/** The declaration block of the rule whose selector list is exactly `sel`. */
function declarations(sel: string): string {
  const css = BASE.replace(/\/\*[\s\S]*?\*\//g, '')
  const match = css.match(
    new RegExp(`(?:^|[};])\\s*${sel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*\\{([^}]*)\\}`),
  )
  expect(match, `no rule for ${sel}`).not.toBeNull()
  return match![1]
}

describe('a screen centres its content in the top third', () => {
  it('gives the content column the visible part of the top third as its box', () => {
    // A third of the screen, minus the offset that clears the fixed header —
    // the part of the top third a reader can actually see.
    expect(declarations(BAND)).toMatch(/min-height:\s*max\(\s*0px\s*,\s*calc\(100vh \/ 3 -/)
  })

  it('centres SAFELY, so a section taller than the band is never pushed under the header', () => {
    // The whole reason this is an alignment and not a second padding. Unsafe
    // centring moves an overflowing section's first line UP, behind the fixed
    // header, where scrolling cannot reach it; `safe` falls back to start
    // alignment exactly there.
    expect(declarations(BAND)).toMatch(/align-content:\s*safe center/)
  })

  it('leaves the hero alone', () => {
    // The hero centres in the WHOLE screen by design. Asserted through a real
    // selector engine rather than by reading the `:not()` in the text, because
    // a gate that is spelled right and matches the wrong elements is the same
    // defect either way up.
    document.body.innerHTML =
      '<div class="lp-deck">' +
      '<section class="lp-screen lp-screen--center"><div class="lp-wrap" id="hero"></div></section>' +
      '<section class="lp-screen"><div class="lp-wrap" id="section"></div></section>' +
      '</div>'
    expect([...document.querySelectorAll(BAND)].map((el) => el.id)).toEqual(['section'])
  })

  it('measures the band from the same offset the screen and the glow use', () => {
    // Three rules now name `--lp-screen-pad-top`: the screen's padding, the
    // glow's anchor, and the band. They are one measurement — where a screen's
    // content begins — and a fallback edited in one place and not the others
    // would leave the band centring against an offset the page no longer uses.
    // Nothing renders wrong enough to notice; the headings just stop lining up.
    const given = fallbacks('--lp-screen-pad-top')
    expect(given).toHaveLength(3) // the screen's padding, the band, the glow's anchor
    expect(new Set(given).size).toBe(1)
  })
})
