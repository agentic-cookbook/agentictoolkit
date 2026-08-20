import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Flow } from '../flow/Flow'
import { Band } from '../flow/Band'
import { Bleed } from '../flow/Bleed'
import { FlowHero } from '../flow/FlowHero'

const FLOW = readFileSync(join(__dirname, '..', 'css', 'flow.css'), 'utf8')

// The assertions below are about what the sheet DECLARES. flow.css's comments
// explain at length why there is no viewport-height rule and no snapping here,
// so the prose contains both substrings on purpose — matching against it would
// fail the sheet for saying what it does. Strip comments, then match.
const FLOW_RULES = FLOW.replace(/\/\*[\s\S]*?\*\//g, '')

/** The declarations of the first rule with exactly this selector, or null. */
function body(selector: string): string | null {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp(`(^|[},])\\s*${escaped}\\s*\\{([^}]*)\\}`, 'm').exec(FLOW_RULES)?.[2] ?? null
}

describe('Flow', () => {
  it('is a <main> that does not scroll itself', () => {
    const { container } = render(<Flow>content</Flow>)
    const main = container.querySelector('main')
    expect(main).not.toBeNull()
    expect(main!.className).toContain('lp-flow')
  })

  it('stays focusable without entering the tab order', () => {
    const { container } = render(<Flow>content</Flow>)
    expect(container.querySelector('main')!.getAttribute('tabindex')).toBe('-1')
  })
})

describe('Band', () => {
  it('defaults to the dark tone with a seam', () => {
    const { container } = render(<Band id="x">body</Band>)
    const section = container.querySelector('section')!
    expect(section.id).toBe('x')
    expect(section.className).toContain('lp-band')
    expect(section.className).toContain('lp-band--dark')
    expect(section.className).toContain('lp-band--seam')
  })

  it('takes a tone and can drop the seam', () => {
    const { container } = render(
      <Band tone="paper" seam={false}>
        body
      </Band>,
    )
    const section = container.querySelector('section')!
    expect(section.className).toContain('lp-band--paper')
    expect(section.className).not.toContain('lp-band--seam')
  })

  it('puts its children in the content column', () => {
    const { container } = render(<Band>body</Band>)
    expect(container.querySelector('.lp-band > .lp-wrap')).not.toBeNull()
  })
})

describe('flow.css', () => {
  it('reserves the host dock at the tail only, never on every band', () => {
    // A fixed dock covers a strip of the VIEWPORT, so mid-page content is only
    // transiently behind it — one more scroll clears it. The only content that
    // can be trapped is content with nothing left to scroll, i.e. the last
    // element. On every band the reservation was ~1460px of dead scroll and a
    // visibly bottom-heavy rhythm; here it is asserted off the shared rule and
    // onto the three places a document can actually end.
    for (const selector of ['.lp-band', '.lp-band--paper']) {
      const rule = body(selector)
      expect(rule, selector).not.toBeNull()
      expect(rule!, selector).not.toContain('--lp-dock-clear')
    }

    for (const selector of ['.lp-band:last-child', '.lp-band--paper:last-child', '.lp-site-foot']) {
      const rule = body(selector)
      expect(rule, selector).not.toBeNull()
      expect(rule!, selector).toContain('var(--lp-dock-clear, 0px)')
    }
  })

  it("keeps the paper band's foot-cut allowance when it is also the last band", () => {
    // Different concern, same declaration: the foot cut removes real estate the
    // last line needs back. A single generic `:last-child` rule would outweigh
    // `.lp-band--paper` (0,2,0 against 0,1,0) and silently drop it.
    const rule = body('.lp-band--paper:last-child')
    expect(rule).not.toBeNull()
    expect(rule!).toContain('var(--lp-seam, 4.5vw)')
  })

  it('never sets a fixed viewport height — a band is as tall as its content', () => {
    expect(FLOW_RULES).not.toMatch(/min-height:\s*100vh/)
  })

  it('declares no snapping', () => {
    expect(FLOW_RULES).not.toContain('scroll-snap')
  })

  it("composes the paper band's top cut onto a two-class selector, not the bare tone", () => {
    expect(FLOW_RULES).toContain('.lp-band--paper.lp-band--seam')
  })

  it('cuts only its own foot on the bare paper rule, leaving the top edge flat', () => {
    const bare = FLOW_RULES.match(/\.lp-band--paper\s*\{([^}]*)\}/)
    expect(bare).not.toBeNull()
    expect(bare![1]).toMatch(/clip-path:\s*polygon\(\s*0\s+0,/)
  })
})

describe('Bleed', () => {
  it('bleeds right by default', () => {
    const { container } = render(<Bleed>shot</Bleed>)
    expect(container.querySelector('.lp-bleed--right')).not.toBeNull()
  })

  it('takes a side', () => {
    const { container } = render(<Bleed side="left">shot</Bleed>)
    expect(container.querySelector('.lp-bleed--left')).not.toBeNull()
  })

  it('only bleeds once there is room — the offset is behind a breakpoint', () => {
    const at = FLOW.indexOf('.lp-bleed--right')
    const media = FLOW.lastIndexOf('@media', at)
    expect(media).toBeGreaterThan(-1)
    expect(FLOW.slice(media, at)).toContain('min-width')
  })
})

describe('FlowHero', () => {
  it('renders the headline as the page h1', () => {
    const { container } = render(<FlowHero headline="A claim" sub="A sub" />)
    expect(container.querySelector('h1')!.textContent).toBe('A claim')
  })

  it('is not a landmark section — the bands are', () => {
    const { container } = render(<FlowHero headline="A claim" sub="A sub" />)
    expect(container.querySelector('section')).toBeNull()
    expect(container.querySelector('.lp-hero-flow')).not.toBeNull()
  })

  it('omits the meta line and the shot when not given one', () => {
    const { container } = render(<FlowHero headline="A claim" sub="A sub" />)
    expect(container.querySelector('.lp-hero-meta')).toBeNull()
    expect(container.querySelector('.lp-hero-shot')).toBeNull()
  })

  it('wraps children in the actions row, and omits the row without them', () => {
    const { container: bare } = render(<FlowHero headline="A claim" sub="A sub" />)
    expect(bare.querySelector('.lp-hero-actions')).toBeNull()

    const { container } = render(
      <FlowHero headline="A claim" sub="A sub">
        <a href="#get">Get it</a>
      </FlowHero>,
    )
    expect(container.querySelector('.lp-hero-actions a')!.textContent).toBe('Get it')
  })

  it('renders the mark, meta and shot when given them', () => {
    const { container } = render(
      <FlowHero
        mark={<img alt="mark" src="/m.png" />}
        headline="A claim"
        sub="A sub"
        meta="Free"
        shot={<div data-testid="shot" />}
      />,
    )
    expect(container.querySelector('.lp-hero-meta')!.textContent).toBe('Free')
    expect(container.querySelector('.lp-hero-shot [data-testid="shot"]')).not.toBeNull()
    expect(container.querySelector('img[alt="mark"]')).not.toBeNull()
  })
})

describe('the barrels', () => {
  const INDEX = readFileSync(join(__dirname, '..', 'index.ts'), 'utf8')
  const CLIENT = readFileSync(join(__dirname, '..', 'client.ts'), 'utf8')

  it('exports the server-safe flow components from the main barrel', () => {
    for (const name of ['Flow', 'Band', 'Bleed', 'FlowHero', 'SiteFooter']) {
      expect(INDEX).toContain(name)
    }
  })

  it('keeps the client modules OUT of the main barrel', () => {
    // A `'use client'` module re-exported here hoists its directive onto
    // dist/index.js and turns every block into a Client Component.
    expect(INDEX).not.toMatch(/export\s*\{[^}]*\bSiteHeader\b/)
    expect(INDEX).not.toMatch(/export\s*\{[^}]*\bReveal\b/)
    // A named re-export is not the only way in. `export * from './flow/Reveal'`
    // hoists the directive just as thoroughly and matches neither pattern
    // above, so bar the star form by module path as well.
    expect(INDEX).not.toMatch(/export\s*\*\s*from\s*['"][^'"]*\/(SiteHeader|Reveal|NavChrome|Clip)['"]/)
    expect(CLIENT).toContain('SiteHeader')
    expect(CLIENT).toContain('Reveal')
  })

  it('ships flow.css as an entry point', () => {
    const pkg = JSON.parse(readFileSync(join(__dirname, '..', '..', 'package.json'), 'utf8'))
    expect(pkg.exports['./css/flow.css']).toBe('./dist/css/flow.css')
  })
})

/** The body of the first rule with this exact selector, without its braces. */
function ruleBody(css: string, selector: string): string {
  const at = css.indexOf(`${selector} {`)
  expect(at).toBeGreaterThan(-1)
  const rest = css.slice(at)
  return rest.slice(rest.indexOf('{') + 1, rest.indexOf('}'))
}

describe('SiteFooter', () => {
  it('dresses its own links — nothing else in this stack styles a bare <a>', () => {
    // No sheet here may write a bare `a` selector (every selector must carry a
    // `.lp-` class), and the consuming site has no `a` rule either. Without
    // this, a footer credit and a mailto render as user-agent blue.
    //
    // Read the rule's BODY, not just its selector. A regression that kept the
    // selector and dropped the declarations would reintroduce the exact bug
    // this rule exists to prevent, and a substring search for the selector
    // would sail straight past it.
    const body = ruleBody(FLOW, '.lp-site-foot a')
    expect(body).toContain('color:')
    expect(body).toContain('text-decoration: none')
  })
})

describe('Reveal', () => {
  it('rests VISIBLE, so no-JS and reduced-motion readers see a finished page', () => {
    expect(ruleBody(FLOW, '.lp-reveal')).not.toContain('opacity: 0')
  })

  it('puts the hidden state on the armed class, which only JS adds', () => {
    // The pair is the whole mechanism: the resting rule is visible and the
    // armed one is not, so a page whose JS never runs shows finished content.
    // Asserting only that the class NAME appears would pass on an empty rule.
    expect(ruleBody(FLOW, '.lp-reveal--armed')).toContain('opacity: 0')
  })
})

describe('the document gate', () => {
  const BASE = readFileSync(join(__dirname, '..', 'css', 'base.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')
  const gated = BASE.split('\n').filter((line) => line.includes(':has(.lp-deck'))

  it('lets a flow page through every document rule the deck gets', () => {
    // base.css is the only sheet here that addresses the document. Gated on the
    // deck alone, a flow page gets no root type size, no Dynamic Type, no
    // reduced-motion reset — see this task's brief for the full list.
    const deckOnly = gated.filter((line) => !line.includes('.lp-flow'))
    // Snapping is the one thing a flow page must NOT inherit: it has no snap
    // points, and `[data-snap]` is set by DeckScript, which it does not render.
    expect(deckOnly.every((line) => line.includes('[data-snap]'))).toBe(true)
  })

  it('still gates them — an ungated document rule repaints the whole host site', () => {
    expect(gated.length).toBeGreaterThan(8)
  })
})
