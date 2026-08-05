import { describe, expect, it } from 'vitest'
import { render } from '@testing-library/react'
import { Checklist, Chips, Roadmap, Rule, Stats, Versus } from '../index'

describe('Versus', () => {
  it('lays the two sides out and marks which is which', () => {
    const { container } = render(
      <Versus
        them={{ title: 'A usage meter', lede: 'Reports.', points: ['a', 'b'] }}
        us={{ title: 'Stenographer', lede: 'Acts.', points: ['c'] }}
      />
    )
    expect(container.querySelector('.lp-versus__them h3')!.textContent).toBe('A usage meter')
    expect(container.querySelector('.lp-versus__us h3')!.textContent).toBe('Stenographer')
    expect(container.querySelectorAll('.lp-versus__them li')).toHaveLength(2)
    expect(container.querySelectorAll('.lp-versus__us li')).toHaveLength(1)
  })

  // A side written as bullets with no opening claim. The generator omits the
  // prop rather than passing `<></>`, and what has to be asserted is the
  // ABSENCE of the <p>, not that the render survived: an empty <p></p> still
  // carries `.lp-versus p`'s margins, and it is invisible to TypeScript, to a
  // snapshot diff and to a screenshot alike.
  it('renders no paragraph on a side with no lede', () => {
    const { container } = render(
      <Versus
        them={{ title: 'A usage meter', points: ['a', 'b'] }}
        us={{ title: 'Stenographer', points: ['c'] }}
      />
    )
    expect(container.querySelectorAll('.lp-versus p')).toHaveLength(0)
    expect(container.querySelectorAll('.lp-versus__them li')).toHaveLength(2)
  })

  // The mirror image: a side that is a claim with no bullets under it.
  it('renders no list on a side with no points', () => {
    const { container } = render(
      <Versus them={{ title: 'A usage meter', lede: 'Reports.' }} us={{ title: 'Stenographer', lede: 'Acts.' }} />
    )
    expect(container.querySelectorAll('.lp-versus ul')).toHaveLength(0)
    expect(container.querySelector('.lp-versus__us p')!.textContent).toBe('Acts.')
  })

  // An empty array is the other way to say "no points", and it has to be
  // treated as absence too — `points={[]}` renders `<ul></ul>` under a naive
  // `.map`, which is the same empty styled element by a different route.
  it('renders no list for an empty points array', () => {
    const { container } = render(
      <Versus them={{ title: 'T', lede: 'a', points: [] }} us={{ title: 'U', lede: 'b', points: [] }} />
    )
    expect(container.querySelectorAll('.lp-versus ul')).toHaveLength(0)
  })

  // Both guards on one side at once: the panel is its heading and nothing else.
  it('renders a bare heading when a side has neither lede nor points', () => {
    const { container } = render(
      <Versus them={{ title: 'T' }} us={{ title: 'U', lede: 'b', points: ['c'] }} />
    )
    const them = container.querySelector('.lp-versus__them')!
    expect(Array.from(them.children).map((c) => c.tagName)).toEqual(['H3'])
  })
})

describe('Rule', () => {
  it('is a definition list, one dt/dd pair per step, in order', () => {
    const { container } = render(
      <Rule steps={[{ term: 'When', detail: 'idle' }, { term: 'Then', detail: 'compact' }]} />
    )
    const dl = container.querySelector('dl.lp-rule')!
    expect(Array.from(dl.children).map((c) => c.tagName)).toEqual(['DT', 'DD', 'DT', 'DD'])
    expect(dl.querySelectorAll('dt')[1].textContent).toBe('Then')
  })
})

describe('Stats', () => {
  it('wraps each pair in the div the grid lays out', () => {
    const { container } = render(
      <Stats entries={[{ term: '5h', detail: 'window' }, { term: '1 line', detail: 'HUD' }]} />
    )
    const wrappers = container.querySelectorAll('dl.lp-stats > div')
    expect(wrappers).toHaveLength(2)
    expect(wrappers[0].querySelector('dt')!.textContent).toBe('5h')
    expect(wrappers[0].querySelector('dd')!.textContent).toBe('window')
  })
})

describe('Chips', () => {
  it('marks the open one and nothing else', () => {
    const { container } = render(
      <Chips entries={[{ label: 'Ollama', open: true }, { label: 'Anthropic' }]} />
    )
    const items = container.querySelectorAll('li')
    expect(items[0].className).toContain('lp-chip--open')
    expect(items[1].className).not.toContain('lp-chip--open')
  })

  it('carries the soon modifier on the list', () => {
    const { container } = render(<Chips soon entries={[{ label: 'Codex' }]} />)
    expect(container.firstElementChild!.className).toContain('lp-chips--soon')
  })
})

describe('Roadmap', () => {
  it('is an eyebrowed aside', () => {
    const { container } = render(<Roadmap eyebrow="Planned agents"><p>x</p></Roadmap>)
    expect(container.querySelector('.lp-roadmap .lp-eyebrow')!.textContent).toBe('Planned agents')
  })

  // An aside nested inside a section that already carries a heading has
  // nothing left to label. An empty span would still take `.lp-roadmap
  // .lp-eyebrow`'s margin and open the box with a blank line — invisible in
  // the JSX, and nothing to fail on.
  it('renders no eyebrow element when not given one', () => {
    const { container } = render(<Roadmap><p>x</p></Roadmap>)
    expect(container.querySelector('.lp-eyebrow')).toBeNull()
    expect(container.querySelector('.lp-roadmap p')!.textContent).toBe('x')
  })
})

describe('Checklist', () => {
  it('groups items under headings and wraps each item in a span', () => {
    const { container } = render(
      <Checklist groups={[{ heading: 'Capture', items: [{ text: 'One' }, { text: 'Two' }] }]} />
    )
    expect(container.querySelector('.lp-checklist h3')!.textContent).toBe('Capture')
    expect(container.querySelectorAll('.lp-checklist li span')).toHaveLength(2)
  })

  // The mark is a `::before` the host picks, so jsdom can see the class and
  // nothing else — which is exactly what has to be asserted: the CSS keys off
  // this modifier, and an item that loses it silently claims to be shipped.
  it('marks the not-yet item and nothing else', () => {
    const { container } = render(
      <Checklist
        groups={[{ heading: 'Testing', items: [{ text: 'Shipped' }, { text: 'On a branch', soon: true }] }]}
      />
    )
    const items = container.querySelectorAll('.lp-checklist li')
    expect(items[0].className).toBe('')
    expect(items[1].className).toContain('lp-checklist__item--soon')
  })

  // A group with no items renders its heading and no list — not an empty
  // <ul></ul>, which is invisible on screen while still taking the list's
  // spacing. The generator refuses this shape outright (a group with nothing
  // under it is incomplete content); the guard is what a different caller gets.
  it('renders no list for a group with no items', () => {
    const { container } = render(
      <Checklist groups={[{ heading: 'Capture', items: [] }, { heading: 'Review', items: [{ text: 'One' }] }]} />
    )
    expect(container.querySelectorAll('.lp-checklist ul')).toHaveLength(1)
    const empty = container.querySelectorAll('.lp-checklist > div')[0]
    expect(Array.from(empty.children).map((c) => c.tagName)).toEqual(['H3'])
  })
})
