import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { UnsavedChangesGuard } from '../components/unsaved-changes-guard'
import { confirmNavigation, GUARDED_NAV_ATTR } from '../lib/navigation-guard'

function renderWithLink(when: boolean, onNavigate = vi.fn()) {
  const utils = render(
    <div>
      <a href="/elsewhere">Elsewhere</a>
      <UnsavedChangesGuard when={when} onNavigate={onNavigate} />
    </div>,
  )
  return { ...utils, onNavigate, link: screen.getByText('Elsewhere') }
}

describe('UnsavedChangesGuard — link interception', () => {
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

  it('same-page links (no path change) are not intercepted', () => {
    // Anchor resolving to the current pathname+search destroys no state.
    render(
      <div>
        <a href={window.location.pathname + window.location.search}>Here</a>
        <UnsavedChangesGuard when />
      </div>,
    )
    const ev = fireEvent.click(screen.getByText('Here'))
    expect(ev).toBe(true) // not defaultPrevented
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('anchors that opt out via GUARDED_NAV_ATTR are left to their own handler', () => {
    render(
      <div>
        <a href="/elsewhere" {...{ [GUARDED_NAV_ATTR]: '' }}>
          Guarded
        </a>
        <UnsavedChangesGuard when />
      </div>,
    )
    const ev = fireEvent.click(screen.getByText('Guarded'))
    expect(ev).toBe(true) // not intercepted here — its handler consults confirmNavigation()
    expect(screen.queryByRole('dialog')).toBeNull()
  })
})

describe('UnsavedChangesGuard — programmatic navigation registry', () => {
  it('with no guard mounted, confirmNavigation resolves true', async () => {
    await expect(confirmNavigation()).resolves.toBe(true)
  })

  it('a mounted guard makes confirmNavigation raise the confirm; Discard resolves true', async () => {
    render(<UnsavedChangesGuard when />)
    let resolved: boolean | undefined
    void confirmNavigation().then((ok) => {
      resolved = ok
    })
    fireEvent.click(await screen.findByRole('button', { name: 'Discard' }))
    await waitFor(() => expect(resolved).toBe(true))
  })

  it('Stay resolves the programmatic guard false and blocks the navigation', async () => {
    render(<UnsavedChangesGuard when />)
    let resolved: boolean | undefined
    void confirmNavigation().then((ok) => {
      resolved = ok
    })
    fireEvent.click(await screen.findByRole('button', { name: 'Stay' }))
    await waitFor(() => expect(resolved).toBe(false))
  })
})

describe('UnsavedChangesGuard — history and unload', () => {
  it('a Back press (popstate) while dirty raises the confirm', () => {
    render(<UnsavedChangesGuard when />)
    fireEvent.popState(window)
    expect(screen.getByRole('dialog')).toBeTruthy()
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
