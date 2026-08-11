/// <reference types="@testing-library/jest-dom/vitest" />
import type * as React from 'react'
import { render, screen, waitFor, cleanup, act } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { notifyManager } from '@tanstack/react-query'
import { useResourceItemQuery, useResourceItemPrefetch } from '../use-resource-item'
import { getToolkitQueryClient } from '../query'

// Notify observers SYNCHRONOUSLY. react-query's default scheduler is a real `setTimeout(fn, 0)` —
// it batches notifications into a macrotask — and `act(async …)` drains microtasks only, so a
// render driven by a settled query has NOT happened when `await act(…)` returns. Without this the
// assertions below would each have to become a `waitFor`, which is strictly weaker: `waitFor` also
// passes on the value already on screen, so it cannot catch a stale response arriving one tick
// late — the exact defect the out-of-order tests exist to pin. See use-resource-list.test.tsx.
notifyManager.setScheduler((cb) => cb())

const base64url = (json: string) =>
  btoa(json).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
const tokenForTenant = (id: string) => `x.${base64url(JSON.stringify({ ecosystem_id: id }))}.y`
const signInAs = (tenant: string) =>
  localStorage.setItem('auth_tokens', JSON.stringify({ accessToken: tokenForTenant(tenant) }))

afterEach(() => {
  cleanup()
  getToolkitQueryClient().clear()
  localStorage.clear()
})

/** A 404 shaped the way the toolkit's HTTP layer throws them, so `isNotFound` recognises it. */
const notFound = () => Object.assign(new Error('Not found'), { status: 404 })

function Probe({
  id,
  load,
  seedFrom,
  absent,
}: {
  id: string | null
  load: (id: string) => Promise<{ body: string }>
  seedFrom?: () => { body: string } | undefined
  absent?: boolean
}) {
  const { item, isSettled, isFetching, error } = useResourceItemQuery('/docs', id, load, {
    seedFrom,
    absent,
  })
  return (
    <div
      data-testid="item"
      data-settled={isSettled}
      data-fetching={isFetching}
      data-error={error ?? ''}
    >
      {item?.body ?? 'none'}
    </div>
  )
}

function MissingProbe(props: React.ComponentProps<typeof Probe>) {
  const { isMissing } = useResourceItemQuery('/docs', props.id, props.load, {
    absent: props.absent,
  })
  return <div data-testid="missing">{String(isMissing)}</div>
}

describe('useResourceItemQuery', () => {
  it('paints the seed immediately and is NOT settled until the read lands', async () => {
    signInAs('A')
    let resolve!: (v: { body: string }) => void
    render(
      <Probe
        id="d1"
        load={() => new Promise((r) => (resolve = r))}
        seedFrom={() => ({ body: 'from the list' })}
      />,
    )

    // The seed is on screen on the FIRST paint, and the pane knows not to trust it yet.
    expect(screen.getByTestId('item')).toHaveTextContent('from the list')
    expect(screen.getByTestId('item')).toHaveAttribute('data-settled', 'false')

    await act(async () => resolve({ body: 'from the server' }))
    expect(screen.getByTestId('item')).toHaveTextContent('from the server')
    expect(screen.getByTestId('item')).toHaveAttribute('data-settled', 'true')
  })

  // The seed must NEVER be written into the cache: a list row is a PARTIAL item, and a cached
  // partial would be served to every later reader as if it were the server's full answer.
  it('does not leave the seed in the cache', async () => {
    signInAs('A')
    render(
      <Probe id="d2" load={() => new Promise(() => {})} seedFrom={() => ({ body: 'partial' })} />,
    )
    expect(screen.getByTestId('item')).toHaveTextContent('partial')
    expect(getToolkitQueryClient().getQueryData(['resource-item', 'A', '/docs', 'd2'])).toBeUndefined()
  })

  it('settles on a FAILED read too — settled is not the same as successful', async () => {
    signInAs('A')
    render(<Probe id="d3" load={() => Promise.reject(new Error('boom'))} />)
    await waitFor(() =>
      expect(screen.getByTestId('item')).toHaveAttribute('data-settled', 'true'),
    )
    expect(screen.getByTestId('item')).toHaveAttribute('data-error', 'boom')
  })

  it('is settled with nothing to read', () => {
    signInAs('A')
    render(<Probe id={null} load={() => Promise.resolve({ body: 'never' })} />)
    expect(screen.getByTestId('item')).toHaveAttribute('data-settled', 'true')
  })

  it('reports missing on a 404', async () => {
    signInAs('A')
    render(<MissingProbe id="d4" load={() => Promise.reject(notFound())} />)
    await waitFor(() => expect(screen.getByTestId('missing')).toHaveTextContent('true'))
  })

  it('reports missing when a settled list says the row is absent', () => {
    signInAs('A')
    render(<MissingProbe id="d5" load={() => new Promise(() => {})} absent />)
    expect(screen.getByTestId('missing')).toHaveTextContent('true')
  })

  it('does not report missing for an ordinary failure', async () => {
    signInAs('A')
    render(<MissingProbe id="d6" load={() => Promise.reject(new Error('offline'))} />)
    await waitFor(() => expect(screen.getByTestId('missing')).toHaveTextContent('false'))
  })
})

describe('useResourceItemPrefetch', () => {
  it('warms the cache so the click that follows paints from it', async () => {
    signInAs('A')
    const load = vi.fn((id: string) => Promise.resolve({ body: `body-${id}` }))
    let prefetch!: (id: string) => void
    function Warmer() {
      prefetch = useResourceItemPrefetch('/docs', load)
      return null
    }
    render(<Warmer />)

    await act(async () => {
      prefetch('d7')
    })
    expect(load).toHaveBeenCalledTimes(1)

    // The click: the item is already there, painted with no second read.
    render(<Probe id="d7" load={load} />)
    expect(screen.getAllByTestId('item')[0]).toHaveTextContent('body-d7')
    expect(load).toHaveBeenCalledTimes(1)
  })

  it('swallows a failing warm — a prefetch nobody asked for must not surface', async () => {
    signInAs('A')
    let prefetch!: (id: string) => void
    function Warmer() {
      prefetch = useResourceItemPrefetch('/docs', () => Promise.reject(new Error('nope')))
      return null
    }
    render(<Warmer />)
    await act(async () => {
      expect(() => prefetch('d8')).not.toThrow()
    })
  })
})
