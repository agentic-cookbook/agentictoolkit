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
})

describe('Checklist', () => {
  it('groups items under headings and wraps each item in a span', () => {
    const { container } = render(
      <Checklist groups={[{ heading: 'Capture', items: ['One', 'Two'] }]} />
    )
    expect(container.querySelector('.lp-checklist h3')!.textContent).toBe('Capture')
    expect(container.querySelectorAll('.lp-checklist li span')).toHaveLength(2)
  })
})
