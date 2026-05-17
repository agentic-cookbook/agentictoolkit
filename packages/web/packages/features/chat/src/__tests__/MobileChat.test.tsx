import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MobileChat } from '../modes/MobileChat'
import type { ChatBackend } from '../backends/types'

function createBackend(response: string = 'reply'): ChatBackend {
  return { sendMessage: vi.fn().mockResolvedValue(response) }
}

describe('MobileChat', () => {
  it('renders overlay with open class when open', () => {
    const { container } = render(
      <MobileChat
        backend={createBackend()}
        persona={{ name: 'Bot' }}
        open={true}
        onClose={() => {}}
      />,
    )
    expect(container.querySelector('.pc-mobile-overlay.open')).toBeInTheDocument()
  })

  it('renders overlay without open class when closed', () => {
    const { container } = render(
      <MobileChat
        backend={createBackend()}
        persona={{ name: 'Bot' }}
        open={false}
        onClose={() => {}}
      />,
    )
    const overlay = container.querySelector('.pc-mobile-overlay')
    expect(overlay).toBeInTheDocument()
    expect(overlay?.classList.contains('open')).toBe(false)
  })

  it('calls onClose when close button clicked', () => {
    const onClose = vi.fn()
    render(
      <MobileChat
        backend={createBackend()}
        persona={{ name: 'Bot' }}
        open={true}
        onClose={onClose}
      />,
    )
    fireEvent.click(screen.getByText(/back/))
    expect(onClose).toHaveBeenCalled()
  })

  it('renders welcome message', () => {
    render(
      <MobileChat
        backend={createBackend()}
        persona={{ name: 'Bot' }}
        welcomeMessage="Welcome!"
        open={true}
        onClose={() => {}}
      />,
    )
    expect(screen.getByText('Welcome!')).toBeInTheDocument()
  })

  it('sends messages', async () => {
    render(
      <MobileChat
        backend={createBackend('Mobile reply')}
        persona={{ name: 'Bot' }}
        open={true}
        onClose={() => {}}
      />,
    )

    const input = screen.getByPlaceholderText('Type a message...')
    fireEvent.change(input, { target: { value: 'hi' } })
    fireEvent.keyDown(input, { key: 'Enter' })

    await waitFor(() => {
      expect(screen.getByText('Mobile reply')).toBeInTheDocument()
    })
  })
})
