import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { MarkdownView } from '../MarkdownView'

describe('MarkdownView', () => {
  it('renders pre-rendered HTML inside an awt-markdown container', () => {
    const { container } = render(<MarkdownView html="<h1>Hi</h1><p>Body</p>" />)
    const root = container.querySelector('.awt-markdown')
    expect(root).not.toBeNull()
    expect(root?.querySelector('h1')?.textContent).toBe('Hi')
    expect(root?.querySelector('p')?.textContent).toBe('Body')
  })

  it('renders empty container for empty html', () => {
    const { container } = render(<MarkdownView html="" />)
    const root = container.querySelector('.awt-markdown') as HTMLElement
    expect(root).not.toBeNull()
    expect(root.innerHTML).toBe('')
  })
})
