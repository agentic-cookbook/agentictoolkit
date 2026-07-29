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
