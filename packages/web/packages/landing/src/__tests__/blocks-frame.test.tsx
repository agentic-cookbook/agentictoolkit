import { describe, expect, it } from 'vitest'
import { render } from '@testing-library/react'
import { Card, Cards, Head, Lede, Shot } from '../index'

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
})

describe('Cards', () => {
  it('carries the pair modifier only when asked', () => {
    const { container, rerender } = render(<Cards><Card title="A">a</Card></Cards>)
    expect(container.firstElementChild!.className).toBe('lp-cards')
    rerender(<Cards pair><Card title="A">a</Card></Cards>)
    expect(container.firstElementChild!.className).toContain('lp-cards--pair')
  })

  it('puts a card title in an h3', () => {
    const { container } = render(<Cards><Card title="One SQLite file"><p>x</p></Card></Cards>)
    expect(container.querySelector('.lp-card h3')!.textContent).toBe('One SQLite file')
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
})
