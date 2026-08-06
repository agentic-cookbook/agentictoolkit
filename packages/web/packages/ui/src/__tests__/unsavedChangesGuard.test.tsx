import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react'
import { describe, it, expect, vi, afterEach } from 'vitest'
import { UnsavedChangesGuard } from '../components/unsaved-changes-guard'
import {
  approveNavigation,
  confirmNavigation,
  GUARDED_NAV_ATTR,
} from '../lib/navigation-guard'

afterEach(() => {
  cleanup() // no globals-driven auto-cleanup is guaranteed here; unmount so the
  // guards' effects tear down (they hold document/window listeners) before the
  // next test, and put the URL back so sentinel assertions start from one place.
  // restoreAllMocks matters more than usual here: vi.spyOn on an ALREADY-spied
  // method hands back the same spy, so a history spy a failing test never
  // restored would carry its call count into the next test's assertions.
  vi.restoreAllMocks()
  window.history.replaceState(null, '', '/')
})

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

// A long-lived guard mount (hub workspace chrome, StandaloneRailHost) outlives many
// routes, so `when` cycles clean->dirty repeatedly against a MOVING url. The sentinel
// therefore has to be identified by the url it was pushed for, not by "have I ever
// pushed one".
describe('UnsavedChangesGuard — the Back sentinel tracks the URL it was pushed for', () => {
  it('re-arming at the same URL does not stack a second sentinel', () => {
    const push = vi.spyOn(window.history, 'pushState')
    const { rerender } = render(<UnsavedChangesGuard when />)
    expect(push).toHaveBeenCalledTimes(1)
    rerender(<UnsavedChangesGuard when={false} />) // saved
    rerender(<UnsavedChangesGuard when />) // dirtied again, same page
    // Still one entry: a second would cost the user two Back presses.
    expect(push).toHaveBeenCalledTimes(1)
    push.mockRestore()
  })

  it('re-arming after the page navigated pushes a fresh sentinel', () => {
    const push = vi.spyOn(window.history, 'pushState')
    const { rerender } = render(<UnsavedChangesGuard when />)
    expect(push).toHaveBeenCalledTimes(1) // sentinel for the first route
    rerender(<UnsavedChangesGuard when={false} />) // saved; that sentinel is now stale
    window.history.pushState(null, '', '/second-pane') // the app routes elsewhere (call 2)
    rerender(<UnsavedChangesGuard when />) // a pane on the NEW route goes dirty
    // Without a fresh sentinel here the next Back is a real route change and the
    // edits are gone before the confirm can mean anything.
    expect(push).toHaveBeenCalledTimes(3)
    push.mockRestore()
  })

  it('Stay after a Back press re-pushes the sentinel for the current URL', async () => {
    render(<UnsavedChangesGuard when />)
    const push = vi.spyOn(window.history, 'pushState')
    fireEvent.popState(window) // consumes the sentinel
    fireEvent.click(await screen.findByRole('button', { name: 'Stay' }))
    await waitFor(() => expect(push).toHaveBeenCalledTimes(1))
    push.mockRestore()
  })
})

// Several guards can be armed at once — hub's root layout mounts the settings
// overlay's guard as a SIBLING of the workspace chrome's. One navigation is one
// decision, so it gets one confirm: the registry's first-registered guard owns
// the prompt, the sentinel and the popstate response.
describe('UnsavedChangesGuard — one prompt per navigation, however many are armed', () => {
  function TwoGuards({ first = true }: { first?: boolean }): React.ReactElement {
    return (
      <>
        <UnsavedChangesGuard when={first} />
        <UnsavedChangesGuard when />
      </>
    )
  }

  it('confirmNavigation asks only the primary guard and returns its answer', async () => {
    render(<TwoGuards />)
    let resolved: boolean | undefined
    void confirmNavigation().then((ok) => {
      resolved = ok
    })
    fireEvent.click(await screen.findByRole('button', { name: 'Discard' }))
    await waitFor(() => expect(resolved).toBe(true))
    // The second guard must NOT get its turn — Discard already meant
    // "leave, discard everything".
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('Stay from the primary blocks the navigation without a second prompt', async () => {
    render(<TwoGuards />)
    let resolved: boolean | undefined
    void confirmNavigation().then((ok) => {
      resolved = ok
    })
    fireEvent.click(await screen.findByRole('button', { name: 'Stay' }))
    await waitFor(() => expect(resolved).toBe(false))
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('with no guard registered confirmNavigation still resolves true', async () => {
    await expect(confirmNavigation()).resolves.toBe(true)
  })

  it('only the primary arms a sentinel, and only it answers Back', async () => {
    const push = vi.spyOn(window.history, 'pushState')
    render(<TwoGuards />)
    expect(push).toHaveBeenCalledTimes(1) // one entry => one Back press
    fireEvent.popState(window)
    expect(await screen.findAllByRole('dialog')).toHaveLength(1)
  })

  it('the survivor takes over the sentinel and Back when the primary disarms', async () => {
    const push = vi.spyOn(window.history, 'pushState')
    const { rerender } = render(<TwoGuards />)
    expect(push).toHaveBeenCalledTimes(1)
    rerender(<TwoGuards first={false} />) // the primary saves and unregisters
    // Back must not be left unguarded: the survivor is primary now and has no
    // sentinel of its own yet.
    expect(push).toHaveBeenCalledTimes(2)
    fireEvent.popState(window)
    expect(await screen.findAllByRole('dialog')).toHaveLength(1)
  })

  it('an intercepted link click prompts once — the rest see defaultPrevented', () => {
    render(
      <div>
        <a href="/elsewhere">Elsewhere</a>
        <TwoGuards />
      </div>,
    )
    const ev = fireEvent.click(screen.getByText('Elsewhere'))
    expect(ev).toBe(false) // defaultPrevented
    expect(screen.getAllByRole('dialog')).toHaveLength(1)
  })

  it('every armed guard keeps its beforeunload — the browser coalesces them', () => {
    const add = vi.spyOn(window, 'addEventListener')
    render(<TwoGuards />)
    const unloads = add.mock.calls.filter(([type]) => type === 'beforeunload')
    expect(unloads).toHaveLength(2)
  })
})

// A guard reads "this surface is dirty" and infers "leaving now would lose work". The two
// come apart the instant a save resolves and navigates: the draft has been PERSISTED but
// not re-rendered — and on a rename that moves the URL, never will be — so `when` is still
// true and the guard vetoes an exit that loses nothing. approveNavigation() is how the code
// that awaited the write tells the guards which of the two this is.
describe('UnsavedChangesGuard — a navigation the save itself started', () => {
  /** Fire a cancelable beforeunload and report whether a guard vetoed it. */
  function unloadVetoed(): boolean {
    const evt = new Event('beforeunload', { cancelable: true })
    window.dispatchEvent(evt)
    return evt.defaultPrevented
  }

  // The approval is module-scoped and outlives any component, so close the window
  // explicitly rather than leaking an open one into the next test.
  afterEach(() => approveNavigation(0))

  it('vetoes an unapproved unload while dirty', () => {
    render(<UnsavedChangesGuard when />)
    expect(unloadVetoed()).toBe(true)
  })

  it('stands down for an approved one', () => {
    render(<UnsavedChangesGuard when />)
    approveNavigation()
    expect(unloadVetoed()).toBe(false)
  })

  it('re-arms once the approval lapses', () => {
    render(<UnsavedChangesGuard when />)
    approveNavigation(0)
    // Still dirty, and this unload is NOT the one the save started — the page stayed put
    // (a client-side push), so the draft is once again worth defending.
    expect(unloadVetoed()).toBe(true)
  })

  // Why the approval is module-scoped rather than a per-instance ref: sibling guards each
  // keep their own beforeunload listener, and any ONE of them vetoing is enough to put the
  // browser's native prompt in front of a save that already succeeded.
  it('reaches sibling guards, not just the primary', () => {
    render(
      <>
        <UnsavedChangesGuard when />
        <UnsavedChangesGuard when />
      </>,
    )
    approveNavigation()
    expect(unloadVetoed()).toBe(false)
  })

  it('does not raise the confirm on the popstate of an approved navigation', () => {
    render(<UnsavedChangesGuard when />)
    approveNavigation()
    fireEvent.popState(window)
    expect(screen.queryByRole('dialog')).toBeNull()
  })
})
