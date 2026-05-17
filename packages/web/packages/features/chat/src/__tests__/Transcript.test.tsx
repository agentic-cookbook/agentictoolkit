import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { Transcript } from '../components/Transcript'
import type { ChatMessage } from '../types'

function makeMessage(overrides: Partial<ChatMessage> = {}): ChatMessage {
  return {
    id: crypto.randomUUID(),
    sender: { name: 'Bot' },
    text: 'Test message',
    timestamp: new Date(),
    isPersona: true,
    ...overrides,
  }
}

describe('Transcript', () => {
  it('renders messages', () => {
    const messages = [
      makeMessage({ text: 'Hello' }),
      makeMessage({ text: 'World', isPersona: false }),
    ]
    render(<Transcript messages={messages} isTyping={false} />)
    expect(screen.getByText('Hello')).toBeInTheDocument()
    expect(screen.getByText('World')).toBeInTheDocument()
  })

  it('renders typing indicator when typing', () => {
    const { container } = render(
      <Transcript messages={[]} isTyping={true} />,
    )
    expect(container.querySelector('.pc-typing')).toBeInTheDocument()
  })

  it('does not render typing indicator when not typing', () => {
    const { container } = render(
      <Transcript messages={[]} isTyping={false} />,
    )
    expect(container.querySelector('.pc-typing')).not.toBeInTheDocument()
  })

  it('highlights selected message', () => {
    const messages = [makeMessage({ text: 'First' }), makeMessage({ text: 'Second' })]
    const { container } = render(
      <Transcript messages={messages} isTyping={false} selectedIndex={1} />,
    )
    const selected = container.querySelectorAll('.pc-message-selected')
    expect(selected).toHaveLength(1)
  })

  it('calls onMessageClick with index', () => {
    const onMessageClick = vi.fn()
    const messages = [makeMessage({ text: 'Click me' })]
    render(
      <Transcript
        messages={messages}
        isTyping={false}
        onMessageClick={onMessageClick}
      />,
    )
    fireEvent.click(screen.getByText('Click me'))
    expect(onMessageClick).toHaveBeenCalledWith(0)
  })

  it('renders inline popovers when renderPopover is provided', () => {
    const messages = [
      makeMessage({
        text: 'With popover',
        popover: { title: 'Details', description: 'More info' },
      }),
    ]
    render(
      <Transcript
        messages={messages}
        isTyping={false}
        renderPopover={(msg) => (
          <div data-testid="popover">{msg.popover?.title}</div>
        )}
      />,
    )
    expect(screen.getByTestId('popover')).toHaveTextContent('Details')
  })

  it('does not render popovers when renderPopover is not provided', () => {
    const messages = [
      makeMessage({
        text: 'With popover',
        popover: { title: 'Details' },
      }),
    ]
    render(<Transcript messages={messages} isTyping={false} />)
    expect(screen.queryByText('Details')).not.toBeInTheDocument()
  })

  it('shows detail arrows when enabled', () => {
    const messages = [
      makeMessage({ popover: { title: 'Details' } }),
    ]
    render(
      <Transcript
        messages={messages}
        isTyping={false}
        showDetailArrows
      />,
    )
    expect(screen.getByLabelText('Show details')).toBeInTheDocument()
  })

  it('does not show detail arrows by default', () => {
    const messages = [
      makeMessage({ popover: { title: 'Details' } }),
    ]
    render(<Transcript messages={messages} isTyping={false} />)
    expect(screen.queryByLabelText('Show details')).not.toBeInTheDocument()
  })

  it('applies custom className', () => {
    const { container } = render(
      <Transcript messages={[]} isTyping={false} className="custom" />,
    )
    expect(container.querySelector('.pc-transcript.custom')).toBeInTheDocument()
  })
})
