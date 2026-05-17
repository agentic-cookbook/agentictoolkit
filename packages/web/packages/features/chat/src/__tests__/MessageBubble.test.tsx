import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MessageBubble } from '../components/MessageBubble'
import type { ChatMessage } from '../types'

function makeMessage(overrides: Partial<ChatMessage> = {}): ChatMessage {
  return {
    id: '1',
    sender: { name: 'Bot' },
    text: 'Hello world',
    timestamp: new Date('2026-01-01T12:00:00'),
    isPersona: true,
    ...overrides,
  }
}

describe('MessageBubble', () => {
  it('renders message text', () => {
    render(<MessageBubble message={makeMessage()} />)
    expect(screen.getByText('Hello world')).toBeInTheDocument()
  })

  it('renders timestamp', () => {
    render(<MessageBubble message={makeMessage()} />)
    expect(screen.getByText('12:00 PM')).toBeInTheDocument()
  })

  it('applies persona class for persona messages', () => {
    const { container } = render(
      <MessageBubble message={makeMessage({ isPersona: true })} />,
    )
    expect(container.querySelector('.pc-persona')).toBeInTheDocument()
  })

  it('applies user class for user messages', () => {
    const { container } = render(
      <MessageBubble message={makeMessage({ isPersona: false })} />,
    )
    expect(container.querySelector('.pc-user')).toBeInTheDocument()
  })

  it('applies selected class when selected', () => {
    const { container } = render(
      <MessageBubble message={makeMessage()} isSelected />,
    )
    expect(container.querySelector('.pc-message-selected')).toBeInTheDocument()
  })

  it('renders rich content when present', () => {
    const message = makeMessage({
      content: [{ type: 'link', url: 'https://example.com', label: 'Example' }],
    })
    render(<MessageBubble message={message} />)
    expect(screen.getByText('Example')).toBeInTheDocument()
  })

  it('renders images in rich content', async () => {
    vi.stubGlobal(
      'Image',
      class {
        onload: (() => void) | null = null
        onerror: (() => void) | null = null
        set src(_v: string) {
          queueMicrotask(() => this.onload?.())
        }
      },
    )
    const message = makeMessage({
      content: [{ type: 'image', src: 'https://example.com/img.png', alt: 'test image' }],
    })
    render(<MessageBubble message={message} />)
    expect(await screen.findByAltText('test image')).toBeInTheDocument()
    vi.unstubAllGlobals()
  })

  it('fires onClick handler', () => {
    const onClick = vi.fn()
    render(<MessageBubble message={makeMessage()} onClick={onClick} />)
    fireEvent.click(screen.getByText('Hello world'))
    expect(onClick).toHaveBeenCalled()
  })

  it('shows detail arrow when enabled and message has popover', () => {
    const message = makeMessage({
      popover: { title: 'Details' },
    })
    render(<MessageBubble message={message} showDetailArrow />)
    expect(screen.getByLabelText('Show details')).toBeInTheDocument()
  })

  it('does not show detail arrow when disabled', () => {
    const message = makeMessage({
      popover: { title: 'Details' },
    })
    render(<MessageBubble message={message} showDetailArrow={false} />)
    expect(screen.queryByLabelText('Show details')).not.toBeInTheDocument()
  })

  it('fires onDetailArrowClick without triggering message click', () => {
    const onClick = vi.fn()
    const onArrowClick = vi.fn()
    const message = makeMessage({ popover: { title: 'Details' } })
    render(
      <MessageBubble
        message={message}
        onClick={onClick}
        showDetailArrow
        onDetailArrowClick={onArrowClick}
      />,
    )
    fireEvent.click(screen.getByLabelText('Show details'))
    expect(onArrowClick).toHaveBeenCalled()
    expect(onClick).not.toHaveBeenCalled()
  })
})
