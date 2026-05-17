import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { TableOfContents } from '../TableOfContents'

describe('TableOfContents', () => {
  it('renders one item per heading', () => {
    const { container } = render(
      <TableOfContents
        headings={[
          { id: 'a', text: 'A', depth: 2 },
          { id: 'b', text: 'B', depth: 3 },
        ]}
      />,
    )
    expect(container.querySelectorAll('.awt-toc__item')).toHaveLength(2)
  })

  it('applies depth-based class for indentation', () => {
    const { container } = render(
      <TableOfContents headings={[{ id: 'a', text: 'A', depth: 3 }]} />,
    )
    expect(container.querySelector('.awt-toc__item--depth-3')).not.toBeNull()
  })

  it('renders nothing when no headings', () => {
    const { container } = render(<TableOfContents headings={[]} />)
    expect(container.querySelector('.awt-toc')).toBeNull()
  })

  it('respects minDepth filter', () => {
    const { container } = render(
      <TableOfContents
        minDepth={3}
        headings={[
          { id: 'a', text: 'A', depth: 2 },
          { id: 'b', text: 'B', depth: 3 },
        ]}
      />,
    )
    expect(container.querySelectorAll('.awt-toc__item')).toHaveLength(1)
  })
})
