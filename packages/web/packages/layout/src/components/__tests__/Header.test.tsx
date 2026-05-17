import { describe, it, expect, vi } from 'vitest'
import { render, fireEvent } from '@testing-library/react'
import { Header } from '../Header'

describe('Header', () => {
  it('renders title and emphasis', () => {
    const { container } = render(<Header title="Site" titleEmphasis="The" />)
    expect(container.textContent).toContain('The')
    expect(container.textContent).toContain('Site')
  })

  it('fires onSearchOpen when search button clicked', () => {
    const onSearchOpen = vi.fn()
    const { getByRole } = render(<Header title="x" onSearchOpen={onSearchOpen} />)
    fireEvent.click(getByRole('button', { name: /search/i }))
    expect(onSearchOpen).toHaveBeenCalled()
  })

  it('omits search button when onSearchOpen not provided', () => {
    const { queryByRole } = render(<Header title="x" />)
    expect(queryByRole('button', { name: /search/i })).toBeNull()
  })
})
