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
  it('reserves the host dock on every band, as the deck did', () => {
    expect(FLOW).toContain('var(--lp-dock-clear, 0px)')
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
