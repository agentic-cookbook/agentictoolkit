import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Flow } from '../flow/Flow'
import { Band } from '../flow/Band'

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
})
