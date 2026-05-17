import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { ThreePaneChat } from '../modes/ThreePaneChat'
import type { ChatBackend } from '../backends/types'

function createBackend(response = 'reply'): ChatBackend {
  return { sendMessage: vi.fn().mockResolvedValue(response) }
}

describe('ThreePaneChat', () => {
  it('renders with welcome message', () => {
    render(
      <ThreePaneChat
        backend={createBackend()}
        persona={{ name: 'Bot' }}
        welcomeMessage="Hello!"
      />,
    )
    expect(screen.getByText('Hello!')).toBeInTheDocument()
  })

  it('renders three-pane frame', () => {
    const { container } = render(
      <ThreePaneChat
        backend={createBackend()}
        persona={{ name: 'Bot' }}
      />,
    )
    expect(container.querySelector('.pc-three-pane-frame')).toBeInTheDocument()
    expect(container.querySelector('.pc-chat-pane')).toBeInTheDocument()
  })

  it('sends messages', async () => {
    render(
      <ThreePaneChat
        backend={createBackend('Bot reply')}
        persona={{ name: 'Bot' }}
      />,
    )

    const input = screen.getByPlaceholderText('Type a message...')
    fireEvent.change(input, { target: { value: 'hi' } })
    fireEvent.keyDown(input, { key: 'Enter' })

    await waitFor(() => {
      expect(screen.getByText('Bot reply')).toBeInTheDocument()
    })
  })

  it('shows detail pane when response has popover', async () => {
    const backend: ChatBackend = {
      sendMessage: vi.fn().mockResolvedValue({
        text: 'Check this out',
        popover: { title: 'Topic Title', description: 'Details here' },
      }),
    }

    const { container } = render(
      <ThreePaneChat backend={backend} persona={{ name: 'Bot' }} />,
    )

    const input = screen.getByPlaceholderText('Type a message...')
    fireEvent.change(input, { target: { value: 'test' } })
    fireEvent.keyDown(input, { key: 'Enter' })

    await waitFor(() => {
      expect(screen.getByText('Topic Title')).toBeInTheDocument()
      expect(screen.getByText('Details here')).toBeInTheDocument()
      expect(container.querySelector('.pc-pane-visible')).toBeInTheDocument()
    })
  })

  it('shows topics pane when multiple popovers exist', async () => {
    let callCount = 0
    const backend: ChatBackend = {
      sendMessage: vi.fn().mockImplementation(async () => {
        callCount++
        return {
          text: `Response ${callCount}`,
          popover: { title: `Topic ${callCount}` },
        }
      }),
    }

    render(
      <ThreePaneChat backend={backend} persona={{ name: 'Bot' }} />,
    )

    const input = screen.getByPlaceholderText('Type a message...')

    fireEvent.change(input, { target: { value: 'first' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    await waitFor(() => expect(screen.getByText('Response 1')).toBeInTheDocument())

    fireEvent.change(input, { target: { value: 'second' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    await waitFor(() => {
      // Both topics now appear as both a panel title and a topic list button
      // (the panel stack keeps prior topics visible).
      expect(screen.getAllByText('Topic 1').length).toBeGreaterThanOrEqual(2)
      expect(screen.getAllByText('Topic 2').length).toBeGreaterThanOrEqual(2)
    })
  })

  it('shows detail arrows on messages with popovers', async () => {
    const backend: ChatBackend = {
      sendMessage: vi.fn().mockResolvedValue({
        text: 'With popover',
        popover: { title: 'Details' },
      }),
    }

    render(
      <ThreePaneChat backend={backend} persona={{ name: 'Bot' }} />,
    )

    const input = screen.getByPlaceholderText('Type a message...')
    fireEvent.change(input, { target: { value: 'test' } })
    fireEvent.keyDown(input, { key: 'Enter' })

    await waitFor(() => {
      expect(screen.getByLabelText('Show details')).toBeInTheDocument()
    })
  })
})
