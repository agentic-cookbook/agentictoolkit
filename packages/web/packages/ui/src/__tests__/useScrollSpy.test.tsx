/** useScrollSpy — which of a set of element ids the reader is currently at. */

import * as React from 'react'
import { render, act } from '@testing-library/react'
import { describe, it, expect, beforeEach, afterEach } from 'vitest'

import { useScrollSpy } from '../hooks/useScrollSpy'
import {
  FakeIntersectionObserver,
  installIntersectionObserver,
  restoreIntersectionObserver,
} from './fakeIntersectionObserver'

let host: HTMLElement | null = null

beforeEach(installIntersectionObserver)
afterEach(() => {
  restoreIntersectionObserver()
  // Ids repeat between tests; a leftover host would shadow the current one.
  host?.remove()
  host = null
})

function Probe({ ids, options }: { ids: string[]; options?: { rootMargin?: string } }) {
  const activeId = useScrollSpy(ids, options)
  return <span data-testid="active">{activeId}</span>
}

function withTargets(ids: string[]) {
  host = document.createElement('div')
  host.innerHTML = ids.map((id) => `<h2 id="${id}">${id}</h2>`).join('')
  document.body.appendChild(host)
}

describe('useScrollSpy', () => {
  it('starts with no active id and reports the id that comes into view', () => {
    withTargets(['a', 'b'])
    const { getByTestId } = render(<Probe ids={['a', 'b']} />)
    expect(getByTestId('active').textContent).toBe('')

    act(() => FakeIntersectionObserver.current.enter('b'))
    expect(getByTestId('active').textContent).toBe('b')
  })

  it('reads the topmost visible heading, not the last one reported', () => {
    // A tall viewport holds several headings at once, and the entries inside one
    // callback are in no guaranteed order. Taking whichever arrived last would
    // put the marker on an arbitrary one of them.
    withTargets(['a', 'b', 'c'])
    const { getByTestId } = render(<Probe ids={['a', 'b', 'c']} />)

    act(() =>
      FakeIntersectionObserver.current.report([
        { id: 'c', isIntersecting: true },
        { id: 'a', isIntersecting: true },
        { id: 'b', isIntersecting: true },
      ]),
    )
    expect(getByTestId('active').textContent).toBe('a')
  })

  it('remembers headings still visible from an earlier callback', () => {
    // The observer reports only CHANGES, so when `b` enters, `a` — visible since
    // the last scroll — is simply absent from the batch. Scanning the batch alone
    // would move the marker down to `b` while the reader is still under `a`.
    withTargets(['a', 'b'])
    const { getByTestId } = render(<Probe ids={['a', 'b']} />)

    act(() => FakeIntersectionObserver.current.enter('a'))
    act(() => FakeIntersectionObserver.current.enter('b'))
    expect(getByTestId('active').textContent).toBe('a')

    // ...and once `a` scrolls out, `b` is the reader's position.
    act(() => FakeIntersectionObserver.current.leave('a'))
    expect(getByTestId('active').textContent).toBe('b')
  })

  it('holds the last position when the band is empty', () => {
    // Deep inside a long section no heading is in the band. Clearing the marker
    // there would blank the rail exactly where the reader most needs it.
    withTargets(['a', 'b'])
    const { getByTestId } = render(<Probe ids={['a', 'b']} />)

    act(() => FakeIntersectionObserver.current.enter('b'))
    act(() => FakeIntersectionObserver.current.leave('b'))
    expect(getByTestId('active').textContent).toBe('b')
  })

  it('takes document order from the ids, not from the DOM', () => {
    // The hook never reads the document to sort them — `ids` IS the order, which
    // is the contract the ToC's own filtered list satisfies.
    withTargets(['b', 'a'])
    const { getByTestId } = render(<Probe ids={['a', 'b']} />)

    act(() =>
      FakeIntersectionObserver.current.report([
        { id: 'b', isIntersecting: true },
        { id: 'a', isIntersecting: true },
      ]),
    )
    expect(getByTestId('active').textContent).toBe('a')
  })

  it('observes only ids that resolve to a real element', () => {
    withTargets(['a'])
    render(<Probe ids={['a', 'ghost']} />)
    expect(FakeIntersectionObserver.current.observed.map((el) => el.id)).toEqual(['a'])
  })

  it('creates no observer for an empty id list', () => {
    render(<Probe ids={[]} />)
    expect(FakeIntersectionObserver.instances).toHaveLength(0)
  })

  it('re-subscribes on the ids VALUE, not the array identity', () => {
    // Callers derive their ids inline (`headings.filter(...)`), so a fresh array
    // arrives on every render. Keying the effect on identity would tear down and
    // rebuild the observer each time — and drop the active id with it.
    withTargets(['a', 'b'])
    const { rerender, getByTestId } = render(<Probe ids={['a', 'b']} />)
    act(() => FakeIntersectionObserver.current.enter('b'))

    rerender(<Probe ids={['a', 'b']} />)

    expect(FakeIntersectionObserver.instances).toHaveLength(1)
    expect(getByTestId('active').textContent).toBe('b')
  })

  it('rebuilds the observer when the ids actually change', () => {
    withTargets(['a', 'b', 'c'])
    const { rerender } = render(<Probe ids={['a', 'b']} />)
    const first = FakeIntersectionObserver.current

    rerender(<Probe ids={['a', 'c']} />)

    expect(first.disconnected).toBe(true)
    expect(FakeIntersectionObserver.instances).toHaveLength(2)
    expect(FakeIntersectionObserver.current.observed.map((el) => el.id)).toEqual([
      'a',
      'c',
    ])
  })

  it('drops a position the new ids do not contain', () => {
    // A new set of ids is a new document. The rule above — hold the last position
    // when the band is empty — is about staying put inside ONE document; carried
    // across a navigation it points the rail at a heading from the page the reader
    // has left, and nothing corrects it until an observer callback happens to fire.
    withTargets(['a', 'b', 'shared'])
    const { rerender, getByTestId } = render(<Probe ids={['a', 'b']} />)
    act(() => FakeIntersectionObserver.current.enter('b'))
    expect(getByTestId('active').textContent).toBe('b')

    rerender(<Probe ids={['shared', 'c']} />)
    expect(getByTestId('active').textContent).toBe('')
  })

  it('keeps a position the new ids still contain', () => {
    // The other half of the same rule: two documents that share a heading id are
    // not a reason to blank the rail — `shared` is still a place the reader can be.
    withTargets(['a', 'shared'])
    const { rerender, getByTestId } = render(<Probe ids={['a', 'shared']} />)
    act(() => FakeIntersectionObserver.current.enter('shared'))

    rerender(<Probe ids={['shared', 'a']} />)
    expect(getByTestId('active').textContent).toBe('shared')
  })

  it('lets a host widen or narrow the band', () => {
    withTargets(['a'])
    render(<Probe ids={['a']} options={{ rootMargin: '0px' }} />)
    expect(FakeIntersectionObserver.current.options).toEqual({
      rootMargin: '0px',
      threshold: 0,
    })
  })

  it('disconnects on unmount', () => {
    withTargets(['a'])
    const { unmount } = render(<Probe ids={['a']} />)
    const observer = FakeIntersectionObserver.current
    unmount()
    expect(observer.disconnected).toBe(true)
  })
})
