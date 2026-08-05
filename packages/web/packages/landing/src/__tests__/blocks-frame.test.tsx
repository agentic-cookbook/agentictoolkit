import { describe, expect, it } from 'vitest'
import { render } from '@testing-library/react'
import { Card, Cards, Code, Head, Lede, Points, Shot, Table } from '../index'

describe('Head', () => {
  it('is an eyebrow, an h2 and whatever follows', () => {
    const { container, getByText } = render(
      <Head eyebrow="The difference" title={<>Every other tool is a <b>gauge</b>.</>}>
        <Lede>Body.</Lede>
      </Head>
    )
    expect(container.querySelector('.lp-head')).toBeTruthy()
    expect(container.querySelector('.lp-eyebrow')!.textContent).toBe('The difference')
    expect(container.querySelector('h2 b')!.textContent).toBe('gauge')
    expect(getByText('Body.').className).toContain('lp-lede')
  })

  it('omits the eyebrow when not given one', () => {
    const { container } = render(<Head title="Just a title" />)
    expect(container.querySelector('.lp-eyebrow')).toBeNull()
    expect(container.querySelector('h2')!.textContent).toBe('Just a title')
  })

  // A section with no `###` subheading has no title to show — the generator
  // omits the prop entirely rather than passing an empty fragment, so this
  // must render no <h2> at all, not an empty one (an empty <h2></h2> is
  // invisible to TypeScript, a snapshot diff, and a green build alike).
  it('renders no heading when no title is given', () => {
    const { container } = render(<Head eyebrow="The difference" />)
    expect(container.querySelector('h2')).toBeNull()
  })
})

describe('Cards', () => {
  it('carries the pair modifier only when asked', () => {
    const { container, rerender } = render(<Cards><Card title="A">a</Card></Cards>)
    expect(container.firstElementChild!.className).toBe('lp-cards')
    rerender(<Cards pair><Card title="A">a</Card></Cards>)
    expect(container.firstElementChild!.className).toContain('lp-cards--pair')
  })

  it('carries the trio modifier only when asked', () => {
    const { container, rerender } = render(<Cards><Card title="A">a</Card></Cards>)
    expect(container.firstElementChild!.className).toBe('lp-cards')
    rerender(<Cards trio><Card title="A">a</Card></Cards>)
    expect(container.firstElementChild!.className).toContain('lp-cards--trio')
  })

  // Both set `grid-template-columns` on the same element, so which one won
  // would depend on the order the two rules happen to sit in the sheet — a
  // layout that changes when someone reorders a stylesheet, and that no test
  // of either modifier alone can see.
  it('refuses pair and trio together rather than letting the sheet order decide', () => {
    expect(() => render(<Cards pair trio><Card title="A">a</Card></Cards>)).toThrow(/at most one/)
  })

  it('puts a card title in an h3', () => {
    const { container } = render(<Cards><Card title="One SQLite file"><p>x</p></Card></Cards>)
    expect(container.querySelector('.lp-card h3')!.textContent).toBe('One SQLite file')
  })

  // The kicker is a slot of its own, not a prefix on the title: a card with a
  // kicker and a card without have to produce the same `h3` text, or every
  // heading-based locator on a host's page becomes a function of whether the
  // content author happened to supply a label.
  it('keeps a kicker out of the heading', () => {
    const { container } = render(
      <Cards><Card kicker="Preview" title="Memory"><p>x</p></Card></Cards>
    )
    expect(container.querySelector('.lp-card__kicker')!.textContent).toBe('Preview')
    expect(container.querySelector('.lp-card h3')!.textContent).toBe('Memory')
  })

  it('renders no kicker element when none is given', () => {
    const { container } = render(<Cards><Card title="Memory"><p>x</p></Card></Cards>)
    expect(container.querySelector('.lp-card__kicker')).toBeNull()
  })
})

describe('Points', () => {
  // The row is a two-column grid, so everything after the marker has to be ONE
  // grid item. A lead-in rendered as a sibling of its own sentence would put
  // three items across two columns and wrap every point onto a second row —
  // invisible to jsdom, which resolves no layout, so the structure is what is
  // asserted.
  it('wraps each point in a single element so the marker grid stays two-column', () => {
    const { container } = render(
      <Points entries={[{ term: 'Anchor checking.', detail: 'Every cited line is checked.' }]} />
    )
    const li = container.querySelector('.lp-points li')!
    expect(li.children).toHaveLength(1)
    expect(li.firstElementChild!.tagName).toBe('SPAN')
    expect(li.querySelector('b')!.textContent).toBe('Anchor checking.')
    expect(li.textContent).toBe('Anchor checking. Every cited line is checked.')
  })

  it('renders no lead-in element for a point that has no term', () => {
    const { container } = render(<Points entries={[{ detail: 'Just the sentence.' }]} />)
    expect(container.querySelector('.lp-points li b')).toBeNull()
    expect(container.querySelector('.lp-points li')!.textContent).toBe('Just the sentence.')
  })

  // `ordered` has to change the ELEMENT and not only the class: the sequence
  // is part of the claim, and `ol` is the only thing that says so to a screen
  // reader. A `ul` styled with a counter shows the digits and announces
  // bullets.
  it('is an ol carrying no number in its text when ordered', () => {
    const { container } = render(
      <Points ordered entries={[{ detail: 'First.' }, { detail: 'Second.' }]} />
    )
    const list = container.querySelector('.lp-points')!
    expect(list.tagName).toBe('OL')
    expect(list.classList.contains('lp-points--ordered')).toBe(true)
    // The digits are the counter's, so they are absent from the DOM text —
    // which is what keeps a re-ordered source from disagreeing with the page.
    expect(list.textContent).toBe('First.Second.')
  })

  it('is a ul with no ordered class by default', () => {
    const { container } = render(<Points entries={[{ detail: 'First.' }]} />)
    const list = container.querySelector('.lp-points')!
    expect(list.tagName).toBe('UL')
    expect(list.classList.contains('lp-points--ordered')).toBe(false)
  })
})

describe('Code', () => {
  it('keeps the text exactly as given, newlines and all', () => {
    const { container } = render(<Code text={'myteams devteam review\nmyteams devteam build'} />)
    expect(container.querySelector('.lp-code code')!.textContent).toBe(
      'myteams devteam review\nmyteams devteam build'
    )
  })
})

describe('Table', () => {
  it('lays the header and rows out under a caption', () => {
    const { container } = render(
      <Table
        caption="Three of the ten recorded runs"
        columns={['Run', 'Outcome']}
        rows={[['land-the-beast', 'halted'], ['adh-test-infra', 'ready']]}
      />
    )
    expect(container.querySelector('caption')!.textContent).toBe('Three of the ten recorded runs')
    expect(container.querySelector('caption')!.className).toBe('lp-sr-only')
    expect(container.querySelectorAll('.lp-table th')).toHaveLength(2)
    expect(container.querySelectorAll('.lp-table tbody tr')).toHaveLength(2)
    expect(container.querySelectorAll('.lp-table tbody tr')[0].textContent).toBe(
      'land-the-beasthalted'
    )
  })

  it('shows the caption when asked', () => {
    const { container } = render(
      <Table caption="All ten runs" showCaption columns={['Run']} rows={[['x']]} />
    )
    expect(container.querySelector('caption')!.className).toBe('')
  })

  // A short row shifts every cell after it one column left. Nothing fails: the
  // table still renders, and the defect reads as a typo in the content rather
  // than as a bug, so it survives review of the copy.
  it('refuses a row that is not as wide as the header', () => {
    expect(() =>
      render(<Table caption="c" columns={['A', 'B', 'C']} rows={[['a', 'b']]} />)
    ).toThrow(/row 0 has 2 cells but there are 3 columns/)
  })
})

describe('Shot', () => {
  it('names the frame and shows the placeholder when there is no media', () => {
    const { container } = render(<Shot title="Insights" caption="Events per day" />)
    expect(container.querySelector('.lp-shot .lp-shot__name')!.textContent).toBe('Insights')
    expect(container.querySelector('.lp-shot__placeholder')!.textContent).toContain('Events per day')
    expect(container.querySelectorAll('.lp-shot__dot')).toHaveLength(3)
  })

  it('shows the media instead when given some', () => {
    const { container } = render(
      <Shot title="Insights" caption="c" media={<video data-testid="v" />} />
    )
    expect(container.querySelector('.lp-shot__placeholder')).toBeNull()
    expect(container.querySelector('video')).toBeTruthy()
  })

  // The package renders no word the host did not choose, so the placeholder's
  // status line is a prop with no default. It used to be the literal string
  // "Screenshot pending", which shipped the package's editorial voice to every
  // host that never asked for it.
  it('renders a host-supplied pending label, and none of its own', () => {
    const { container } = render(<Shot title="T" caption="Events per day" />)
    expect(container.querySelector('.lp-shot__placeholder')!.textContent).toBe('Events per day')

    const { container: labelled } = render(
      <Shot title="T" caption="Events per day" pendingLabel="Coming soon" />
    )
    expect(labelled.querySelector('.lp-shot__placeholder')!.textContent).toBe(
      'Coming soonEvents per day'
    )
  })
})
