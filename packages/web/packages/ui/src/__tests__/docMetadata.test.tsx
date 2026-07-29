/** DocMetadata (HDV) — the right-aligned frontmatter <dl>. Parity with what the
 *  cookbook site rendered before the extraction. */

import * as React from 'react'
import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'

import { DocMetadata } from '../blocks/doc-metadata'

describe('DocMetadata', () => {
  it('renders nothing when there are no fields', () => {
    const { container } = render(<DocMetadata fields={[]} />)
    expect(container.firstChild).toBeNull()
  })

  it('renders one dt/dd row per field, in the order given', () => {
    render(
      <DocMetadata
        data-testid="meta"
        fields={[
          { label: 'version', value: '1.2.0' },
          { label: 'modified', value: '2026-07-28' },
        ]}
      />,
    )
    const list = screen.getByTestId('meta')
    expect(list.tagName).toBe('DL')
    expect(list.className).toContain('items-end')
    expect(list.className).toContain('font-mono')
    expect(list.className).toContain('text-[11px]')

    const labels = [...list.querySelectorAll('dt')].map((el) => el.textContent)
    expect(labels).toEqual(['version', 'modified'])
    const values = [...list.querySelectorAll('dd')].map((el) => el.textContent)
    expect(values).toEqual(['1.2.0', '2026-07-28'])
    expect(list.querySelector('dt')!.className).toBe(
      'text-[var(--color-text-dim)]',
    )
    expect(list.querySelector('dd')!.className).toBe(
      'text-[var(--color-text-secondary)]',
    )
  })

  it('wraps an array value in a right-aligned wrapping group', () => {
    render(
      <DocMetadata
        data-testid="meta"
        fields={[
          {
            label: 'references',
            value: [
              <a key="a" href="https://example.com">
                example.com
              </a>,
              <span key="b">Osborn, Applied Imagination, 1953</span>,
            ],
          },
        ]}
      />,
    )
    const group = screen.getByTestId('meta').querySelector('dd > span')!
    expect(group.className).toBe('flex flex-wrap justify-end gap-x-3')
    expect(group.children).toHaveLength(2)
    expect(screen.getByRole('link').getAttribute('href')).toBe(
      'https://example.com',
    )
  })

  it('renders a scalar value with no wrapping group around it', () => {
    render(<DocMetadata data-testid="meta" fields={[{ label: 'author', value: 'Mike' }]} />)
    const value = screen.getByTestId('meta').querySelector('dd')!
    expect(value.querySelector('span')).toBeNull()
    expect(value.textContent).toBe('Mike')
  })
})
