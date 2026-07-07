import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { UnsavedChangesGuard } from '../components/unsaved-changes-guard'

function renderWithLink(when: boolean, onNavigate = vi.fn()) {
  const utils = render(
    <div>
      <a href="/elsewhere">Elsewhere</a>
      <UnsavedChangesGuard when={when} onNavigate={onNavigate} />
    </div>,
  )
  return { ...utils, onNavigate, link: screen.getByText('Elsewhere') }
}

describe('UnsavedChangesGuard', () => {
  it('inactive guard leaves link clicks alone', () => {
    const { link } = renderWithLink(false)
    const ev = fireEvent.click(link)
    expect(ev).toBe(true) // not defaultPrevented
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('intercepts a same-origin link click and raises the confirm dialog', () => {
    const { link } = renderWithLink(true)
    const ev = fireEvent.click(link)
    expect(ev).toBe(false) // defaultPrevented
    expect(screen.getByRole('dialog')).toBeTruthy()
    expect(screen.getByText('Discard unsaved changes?')).toBeTruthy()
  })

  it('confirming navigates via onNavigate with the intercepted href', () => {
    const { link, onNavigate } = renderWithLink(true)
    fireEvent.click(link)
    fireEvent.click(screen.getByRole('button', { name: 'Discard' }))
    expect(onNavigate).toHaveBeenCalledWith('/elsewhere')
  })

  it('cancelling stays put and closes the dialog', () => {
    const { link, onNavigate } = renderWithLink(true)
    fireEvent.click(link)
    fireEvent.click(screen.getByRole('button', { name: 'Stay' }))
    expect(onNavigate).not.toHaveBeenCalled()
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('modified clicks (cmd/ctrl) pass through untouched', () => {
    const { link } = renderWithLink(true)
    fireEvent.click(link, { metaKey: true })
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('registers/unregisters beforeunload with the when flag', () => {
    const add = vi.spyOn(window, 'addEventListener')
    const remove = vi.spyOn(window, 'removeEventListener')
    const { rerender } = render(<UnsavedChangesGuard when />)
    expect(add).toHaveBeenCalledWith('beforeunload', expect.any(Function))
    rerender(<UnsavedChangesGuard when={false} />)
    expect(remove).toHaveBeenCalledWith('beforeunload', expect.any(Function))
    add.mockRestore()
    remove.mockRestore()
  })
})
