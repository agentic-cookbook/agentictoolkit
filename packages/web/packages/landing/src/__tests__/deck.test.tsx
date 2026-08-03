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

  // The two halves of the easing gate, and the second is the whole point of it:
  // `scroll-behavior: smooth` also governs the browser's scroll RESTORATION, so a
  // deck that only ever SET `data-smooth` would still animate its way back to where
  // the reader already was when they hit Back.
  it('arms easing on first input and disarms it on a history traversal', () => {
    const s = deckScript()
    expect(s).toContain('data-smooth')
    expect(s).toContain('popstate')
  })

  it('drops each half when asked', () => {
    expect(deckScript({ openAtTop: false })).not.toContain('scrollRestoration')
    expect(deckScript({ armSnapping: false })).not.toContain('data-snap')
    expect(deckScript({ armSmooth: false })).not.toContain('data-smooth')
    expect(deckScript({ armSmooth: false })).not.toContain('popstate')
    expect(deckScript({ restoreZoomOffIos: false })).not.toContain('maximum-scale')
  })

  it('emits one statement per enabled part and nothing else', () => {
    expect(
      deckScript({
        openAtTop: false,
        armSnapping: false,
        armSmooth: false,
        restoreZoomOffIos: false,
      }),
    ).toBe('')
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

  it('has no glow unless asked', () => {
    const { container } = render(<Screen>x</Screen>)
    expect(container.querySelector('.lp-glow')).toBeNull()
  })

  // The glow must PRECEDE the content: it is what the content sits in front of,
  // and `z-index: -1` only settles the paint order within the screen's stacking
  // context, not which siblings the host wrote first.
  it('lights the screen from behind its content when asked', () => {
    const { container } = render(<Screen glow><p>x</p></Screen>)
    const el = container.firstElementChild!
    expect(el.firstElementChild!.className).toBe('lp-glow')
    expect(el.firstElementChild!.getAttribute('aria-hidden')).toBe('true')
  })
})

describe('Deck', () => {
  it('is a focusable-but-untabbable div', () => {
    const { container } = render(<Deck><Screen>x</Screen></Deck>)
    const el = container.firstElementChild!
    expect(el.tagName).toBe('DIV')
    expect(el.getAttribute('tabindex')).toBe('-1')
    expect(el.className).toContain('lp-deck')
  })

  // It was a <main>, and every consumer renders it inside a host shell that
  // already draws one — so the deck nested a second landmark inside the first,
  // which is invalid and announces two "main"s to a screen reader. The class is
  // what `base.css` and the chrome are written against, so the element is free
  // to be the neutral one.
  it('renders no landmark of its own, so a host shell keeps the only <main>', () => {
    const { container } = render(<Deck><Screen>x</Screen></Deck>)
    expect(container.querySelector('main')).toBeNull()
  })
})

describe('Wrap', () => {
  it('is the content column', () => {
    const { container } = render(<Wrap>x</Wrap>)
    expect(container.firstElementChild!.className).toContain('lp-wrap')
  })
})
