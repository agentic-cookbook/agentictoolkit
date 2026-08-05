import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { TourStrip } from '../blocks/TourStrip'

const base = {
  eyebrow: 'The agentic developer story',
  promise: 'Everything your AI agents need to become real software.',
  position: { step: 4, total: 12 },
}

describe('TourStrip', () => {
  it('states the position in the walk', () => {
    render(<TourStrip {...base} />)
    expect(screen.getByText(/step 4 of 12/i)).toBeInTheDocument()
  })

  it('links back and next at the siblings\' /tour routes', () => {
    const { container } = render(
      <TourStrip
        {...base}
        back={{ href: 'https://a.example/tour', label: 'Personas' }}
        next={{ href: 'https://b.example/tour', label: 'Hub', note: 'The platform' }}
      />,
    )
    expect(screen.getByRole('link', { name: /personas/i }))
      .toHaveAttribute('href', 'https://a.example/tour')
    expect(screen.getByRole('link', { name: /hub/i }))
      .toHaveAttribute('href', 'https://b.example/tour')
    // Assert the note renders when supplied
    expect(screen.getByText('The platform')).toBeInTheDocument()
    // Assert the back link (which has no note) doesn't render one
    const backLink = container.querySelector('.lp-tour__step--back')
    expect(backLink).not.toBeNull()
    expect(backLink?.querySelector('em')).toBeNull()
  })

  it('omits the back link on the first step', () => {
    const { container } = render(
      <TourStrip {...base} next={{ href: '/tour', label: 'Next' }} />,
    )
    expect(container.querySelector('.lp-tour__step--back')).toBeNull()
    expect(container.querySelector('.lp-tour__step--next')).not.toBeNull()
  })

  it('omits the next link on the terminal site', () => {
    const { container } = render(
      <TourStrip {...base} back={{ href: '/tour', label: 'Back' }} />,
    )
    expect(container.querySelector('.lp-tour__step--next')).toBeNull()
    expect(container.querySelector('.lp-tour__step--back')).not.toBeNull()
  })

  it('renders pillar cards only when given', () => {
    const { container, rerender } = render(<TourStrip {...base} />)
    expect(container.querySelector('.lp-tour__pillars')).toBeNull()
    rerender(
      <TourStrip {...base} pillars={[{ title: 'Agent identity', body: 'Personas…' }]} />,
    )
    expect(screen.getByText('Agent identity')).toBeInTheDocument()
    expect(container.querySelector('.lp-tour__pillars')).not.toBeNull()
  })

  it('is a landmark screen, so the drawer can link to it', () => {
    const { container } = render(<TourStrip {...base} />)
    expect(container.querySelector('section.lp-screen.lp-tour')).not.toBeNull()
  })
})
