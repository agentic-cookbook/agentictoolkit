import { describe, it, expect } from 'vitest'
import { render, fireEvent, screen } from '@testing-library/react'
import { RichContent } from './RichContent'

describe('RichContent image gating', () => {
  it('hides images until they have loaded', () => {
    render(
      <RichContent
        items={[
          { type: 'image', src: '/a.png', alt: 'a' },
        ]}
      />,
    )
    const img = screen.getByAltText('a') as HTMLImageElement
    expect(img.style.display).toBe('none')
    fireEvent.load(img)
    expect(img.style.display).toBe('')
  })

  it('reveals image after error too (fail-open)', () => {
    render(
      <RichContent
        items={[
          { type: 'image', src: '/missing.png', alt: 'x' },
        ]}
      />,
    )
    const img = screen.getByAltText('x') as HTMLImageElement
    expect(img.style.display).toBe('none')
    fireEvent.error(img)
    expect(img.style.display).toBe('')
  })
})
