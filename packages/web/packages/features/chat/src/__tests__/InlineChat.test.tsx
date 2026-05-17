import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { InlineChat } from '../modes/InlineChat'
import type { ChatBackend } from '../backends/types'

function createBackend(response: string = 'reply'): ChatBackend {
  return { sendMessage: vi.fn().mockResolvedValue(response) }
}

describe('InlineChat', () => {
  it('renders with welcome message', () => {
    render(
      <InlineChat
        backend={createBackend()}
        persona={{ name: 'Bot' }}
        welcomeMessage="Hello!"
      />,
    )
    expect(screen.getByText('Hello!')).toBeInTheDocument()
  })

  it('renders input area', () => {
    render(
      <InlineChat backend={createBackend()} persona={{ name: 'Bot' }} />,
    )
    expect(screen.getByPlaceholderText('Type a message...')).toBeInTheDocument()
  })

  it('sends message and shows response', async () => {
    render(
      <InlineChat
        backend={createBackend('Bot says hi')}
        persona={{ name: 'Bot' }}
      />,
    )

    const input = screen.getByPlaceholderText('Type a message...')
    fireEvent.change(input, { target: { value: 'hello' } })
    fireEvent.keyDown(input, { key: 'Enter' })

    await waitFor(() => {
      expect(screen.getByText('Bot says hi')).toBeInTheDocument()
    })
  })

  it('renders inline popovers', async () => {
    const backend: ChatBackend = {
      sendMessage: vi.fn().mockResolvedValue({
        text: 'Check this',
        popover: { title: 'Details', description: 'More info' },
      }),
    }

    render(
      <InlineChat backend={backend} persona={{ name: 'Bot' }} />,
    )

    const input = screen.getByPlaceholderText('Type a message...')
    fireEvent.change(input, { target: { value: 'test' } })
    fireEvent.keyDown(input, { key: 'Enter' })

    await waitFor(() => {
      expect(screen.getByText('Details')).toBeInTheDocument()
      expect(screen.getByText('More info')).toBeInTheDocument()
    })
  })

  it('applies custom className', () => {
    const { container } = render(
      <InlineChat
        backend={createBackend()}
        persona={{ name: 'Bot' }}
        className="custom-chat"
      />,
    )
    expect(container.querySelector('.persona-chat.custom-chat')).toBeInTheDocument()
  })

  it('does not add the hugging class when sizing is omitted (default fixed)', () => {
    const { container } = render(
      <InlineChat backend={createBackend()} persona={{ name: 'Bot' }} />,
    )
    const chat = container.querySelector('.persona-chat')
    expect(chat).toBeInTheDocument()
    expect(chat?.classList.contains('pc-hugging')).toBe(false)
  })

  it('adds the hugging class and inline maxHeight in content-hugging mode', () => {
    const { container } = render(
      <InlineChat
        backend={createBackend()}
        persona={{ name: 'Bot' }}
        sizing={{
          mode: 'content-hugging',
          maxHeight: { kind: 'css', value: '300px' },
        }}
      />,
    )
    const chat = container.querySelector('.persona-chat') as HTMLElement | null
    expect(chat).toBeInTheDocument()
    expect(chat?.classList.contains('pc-hugging')).toBe(true)
    // The hook resolves the css value and applies it as inline maxHeight.
    expect(chat?.style.maxHeight).toBe('300px')
  })
})
