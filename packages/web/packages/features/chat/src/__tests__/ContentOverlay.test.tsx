import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ContentOverlay } from '../components/ContentOverlay'

describe('ContentOverlay', () => {
  it('renders with open class when open', () => {
    const { container } = render(
      <ContentOverlay open onClose={() => {}}>
        <div>child</div>
      </ContentOverlay>,
    )
    expect(container.querySelector('.pc-content-overlay.open')).toBeInTheDocument()
  })

  it('omits open class when closed', () => {
    const { container } = render(
      <ContentOverlay open={false} onClose={() => {}}>
        <div>child</div>
      </ContentOverlay>,
    )
    const overlay = container.querySelector('.pc-content-overlay')
    expect(overlay).toBeInTheDocument()
    expect(overlay?.classList.contains('open')).toBe(false)
  })

  it('calls onClose when close button is clicked', () => {
    const onClose = vi.fn()
    render(
      <ContentOverlay open onClose={onClose}>
        <div>child</div>
      </ContentOverlay>,
    )
    fireEvent.click(screen.getByText(/back/))
    expect(onClose).toHaveBeenCalled()
  })

  it('renders children', () => {
    render(
      <ContentOverlay open onClose={() => {}}>
        <div data-testid="kid">payload</div>
      </ContentOverlay>,
    )
    expect(screen.getByTestId('kid')).toHaveTextContent('payload')
  })
})
