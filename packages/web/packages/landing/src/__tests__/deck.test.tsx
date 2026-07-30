import { describe, expect, it } from 'vitest'
import { render } from '@testing-library/react'
import { Deck, Screen, Wrap, deckScript } from '../index'

describe('deckScript', () => {
  it('arms snapping on the first pointer, wheel or key input', () => {
    const s = deckScript()
    expect(s).toContain('pointerdown')
    expect(s).toContain('wheel')
    expect(s).toContain('keydown')
    expect(s).toContain('data-snap')
    expect(s).toContain('once:true')
  })

  it('opens the page at the top', () => {
    expect(deckScript()).toContain('history.scrollRestoration="manual"')
  })

  it('drops each half when asked', () => {
    expect(deckScript({ openAtTop: false })).not.toContain('scrollRestoration')
    expect(deckScript({ armSnapping: false })).not.toContain('data-snap')
    expect(deckScript({ restoreZoomOffIos: false })).not.toContain('maximum-scale')
  })

  it('emits one statement per enabled part and nothing else', () => {
    expect(deckScript({ openAtTop: false, armSnapping: false, restoreZoomOffIos: false }))
      .toBe('')
  })
})

describe('Screen', () => {
  it('is a <section> that carries the id and the snap class', () => {
    const { container } = render(<Screen id="different">x</Screen>)
    const el = container.querySelector('section')
    expect(el).toBeTruthy()
    expect(el!.id).toBe('different')
    expect(el!.className).toContain('lp-screen')
    expect(el!.className).not.toContain('lp-screen--center')
  })

  it('centres when asked, and can be a div for the hero', () => {
    const { container } = render(<Screen as="div" align="center">x</Screen>)
    const el = container.firstElementChild!
    expect(el.tagName).toBe('DIV')
    expect(el.className).toContain('lp-screen--center')
  })

  it('keeps a caller class alongside its own', () => {
    const { container } = render(<Screen className="lp-hero">x</Screen>)
    expect(container.firstElementChild!.className).toContain('lp-screen')
    expect(container.firstElementChild!.className).toContain('lp-hero')
  })
})

describe('Deck', () => {
  it('is a focusable-but-untabbable <main>', () => {
    const { container } = render(<Deck><Screen>x</Screen></Deck>)
    const el = container.querySelector('main')!
    expect(el.getAttribute('tabindex')).toBe('-1')
    expect(el.className).toContain('lp-deck')
  })
})

describe('Wrap', () => {
  it('is the content column', () => {
    const { container } = render(<Wrap>x</Wrap>)
    expect(container.firstElementChild!.className).toContain('lp-wrap')
  })
})
