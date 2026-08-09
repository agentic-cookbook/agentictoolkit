import { describe, it, expect } from 'vitest'
import '@testing-library/jest-dom/vitest'
import { render, screen } from '@testing-library/react'
import { LandingDeck, LandingTour } from '../landing'
import type { LandingContent } from '../landing'

// The properties asserted here used to be asserted against generated TSX, one copy per site,
// by the landing tool's Python tests. They are shape, not words, so they moved here with the
// shape — a fixture stands in for a site's content, and every site gets the same answer.
const CONTENT: LandingContent = {
  hero: {
    headline: <>Ecosystems</>,
    tagline: <>The wiring that turns parts into a product.</>,
    blocks: [{ kind: 'Trust', items: [<>MIT licensed</>] }],
  },
  sections: [
    {
      id: 'what-it-is',
      eyebrow: 'What it is',
      title: <>An ecosystem is where the pieces meet.</>,
      blocks: [{ kind: 'Lede', children: <>Pick the features you use.</> }],
    },
    {
      id: 'what-it-does',
      eyebrow: 'What it does',
      blocks: [
        {
          kind: 'Cards',
          items: [{ title: <>Group features</>, body: [<>One.</>, <>Two.</>] }],
        },
      ],
    },
    {
      id: 'the-shape',
      eyebrow: 'The shape',
      headingInBlock: true,
      blocks: [{ kind: 'Roadmap', eyebrow: <>In flight</>, children: [] }],
    },
  ],
  tour: {
    eyebrow: 'The agentic developer story',
    promise: <>Everything your agents need.</>,
    position: { step: 3, total: 12 },
    back: { site: 'personas', label: 'Personas' },
    next: { site: 'hub', label: 'Hub', note: 'The platform' },
  },
}

/** Every `<Screen>`'s id on the page, in document order.
 *
 *  The hero is a screen with no id — it is the top of the page, which the browser's own Home
 *  key already reaches — so it comes back as `''` and is written that way below rather than
 *  filtered out: it is a screen, and its POSITION is what the tour assertions are about. */
function screenIds(container: HTMLElement): string[] {
  return Array.from(container.querySelectorAll('.lp-screen')).map((el) => el.id)
}

/** Every index row's `(href, label)`, in the order the drawer lists them. */
function indexRows(container: HTMLElement): [string, string][] {
  return Array.from(container.querySelectorAll('a.lp-nav')).map((a) => [
    a.getAttribute('href') ?? '',
    a.textContent ?? '',
  ])
}

describe('LandingDeck', () => {
  it('renders the hero, its blocks, and one screen per section', () => {
    const { container } = render(<LandingDeck content={CONTENT} />)
    expect(screen.getByText('Ecosystems')).toBeInTheDocument()
    expect(screen.getByText('The wiring that turns parts into a product.')).toBeInTheDocument()
    expect(screen.getByText('MIT licensed')).toBeInTheDocument()
    expect(screenIds(container)).toEqual(['', 'what-it-is', 'what-it-does', 'the-shape'])
  })

  it('gives every screen a row in the index, labelled with its eyebrow', () => {
    // The property, not a count: a deck's index is only useful if it reaches every screen,
    // and both lists are built from the same sections so they cannot drift the way a
    // hand-kept menu does.
    const { container } = render(<LandingDeck content={CONTENT} />)
    expect(indexRows(container)).toEqual([
      ['#what-it-is', 'What it is'],
      ['#what-it-does', 'What it does'],
      ['#the-shape', 'The shape'],
    ])
  })

  it('renders a body paragraph per paragraph', () => {
    // The kit dresses a block body through a `p` child — `.lp-card p`, `.lp-closer p`,
    // `.lp-faq details p` — so a body rendered as a bare text child arrives at the page's
    // inherited weight, size and colour. Valid JSX, the right words, and only the pixels
    // wrong: nothing but this assertion sees it.
    const { container } = render(<LandingDeck content={CONTENT} />)
    expect(Array.from(container.querySelectorAll('.lp-card p')).map((p) => p.textContent)).toEqual(
      ['One.', 'Two.'],
    )
  })

  it('omits the section heading where the block carries it', () => {
    // Two eyebrows on one screen read as two sections. The `{roadmap}` spelling puts the
    // `## ` heading on the Roadmap itself, so the screen renders no `<Head>` above it.
    const { container } = render(<LandingDeck content={CONTENT} />)
    const roadmapScreen = container.querySelector('#the-shape')!
    expect(roadmapScreen.querySelector('.lp-head')).toBeNull()
    expect(roadmapScreen.textContent).toContain('In flight')
  })

  it('does not render the tour strip', () => {
    const { container } = render(<LandingDeck content={CONTENT} />)
    expect(container.querySelector('#tour')).toBeNull()
    expect(screen.queryByText('Everything your agents need.')).toBeNull()
  })
})

describe('LandingTour', () => {
  it('puts the strip AHEAD of the hero, as the first screen', () => {
    // Every screen in the deck is a full viewport with `scroll-snap-align: start`, so the
    // second one is off screen on arrival. Behind the hero, the step counter, the promise and
    // the way on to the next site were all below the fold and `/tour` opened on a screen
    // identical to `/`. A tour stop announces itself or it is not a tour stop.
    const { container } = render(<LandingTour content={CONTENT} />)
    expect(screenIds(container)[0]).toBe('tour')
    expect(screen.getByText('Everything your agents need.')).toBeInTheDocument()
  })

  it('indexes the strip as its first row, ahead of the deck rows', () => {
    // The strip is the one screen a tour reader most needs to reach — it is the way on to the
    // next site — and it is the only screen the deck does not render itself. It takes the
    // FIRST row because it is the first screen: the rows are a table of contents, and one
    // that listed the opening screen last would be describing a different page.
    const { container } = render(<LandingTour content={CONTENT} />)
    const rows = indexRows(container)
    expect(rows[0]).toEqual(['#tour', 'The agentic developer story'])
    expect(rows.slice(1)).toEqual(indexRows(render(<LandingDeck content={CONTENT} />).container))
  })

  it('points each edge at the OTHER site, not at the page the reader is on', () => {
    // Both edges once shipped as the literal "/tour" — visible back and next controls that
    // navigate to the page you are already on. The href is the other site's `/tour`, and only
    // the registry knows its host, so it is resolved here rather than carried in the content.
    render(<LandingTour content={CONTENT} />)
    expect(screen.getByRole('link', { name: /Personas/ })).toHaveAttribute(
      'href',
      'https://agenticdeveloperpersonas.com/tour',
    )
    expect(screen.getByRole('link', { name: /Hub/ })).toHaveAttribute(
      'href',
      'https://agenticdeveloperhub.com/tour',
    )
  })

  it('renders the same deck below the strip', () => {
    const { container } = render(<LandingTour content={CONTENT} />)
    expect(screenIds(container)).toEqual(['tour', '', 'what-it-is', 'what-it-does', 'the-shape'])
    expect(screen.getByText('Ecosystems')).toBeInTheDocument()
  })

  it('omits an edge the walk does not have', () => {
    // `TourStrip` omits the control when the prop is absent, so absence is the whole
    // mechanism: an edge control that points nowhere is the tour's dead end.
    const { tour, ...rest } = CONTENT
    const { back, next, ...stop } = tour
    render(<LandingTour content={{ ...rest, tour: stop }} />)
    expect(screen.queryByRole('link', { name: /Personas/ })).toBeNull()
    expect(screen.queryByRole('link', { name: /Hub/ })).toBeNull()
  })
})
