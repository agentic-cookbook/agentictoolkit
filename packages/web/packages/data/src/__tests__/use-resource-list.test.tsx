/// <reference types="@testing-library/jest-dom/vitest" />
import { render, screen, waitFor, cleanup, act } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { useResourceList } from '../use-resource-list'

// Drive the module cache's tenant scoping through the real path: the cache is
// keyed by the current access token's `ecosystem_id`, which useResourceList
// reads via useTenantId → readAccessToken → localStorage['auth_tokens']. Set the
// token, then the cache scope follows.
const base64url = (json: string) =>
  btoa(json).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
const tokenForTenant = (id: string) => `x.${base64url(JSON.stringify({ ecosystem_id: id }))}.y`
const signInAs = (tenant: string) =>
  localStorage.setItem('auth_tokens', JSON.stringify({ accessToken: tokenForTenant(tenant) }))

function Probe({ cacheKey, load }: { cacheKey: string; load: () => Promise<string[]> }) {
  const { items } = useResourceList(cacheKey, load)
  return <div data-testid="items">{items === null ? 'null' : items.join(',')}</div>
}

afterEach(() => {
  cleanup()
  localStorage.clear()
})

describe('useResourceList cache scoping', () => {
  it('seeds a remount from the cache only when the tenant scope matches', async () => {
    const cacheKey = '/scoped-things'

    // Mount 1 (tenant A): resolve rows so the module cache records scope A.
    signInAs('A')
    render(<Probe cacheKey={cacheKey} load={() => Promise.resolve(['a1', 'a2'])} />)
    await waitFor(() => expect(screen.getByTestId('items')).toHaveTextContent('a1,a2'))
    cleanup()

    // Mount 2 (SAME tenant A): the first paint must seed from the cache — assert
    // synchronously before the (pending) refetch could change anything.
    signInAs('A')
    render(<Probe cacheKey={cacheKey} load={() => new Promise<string[]>(() => {})} />)
    expect(screen.getByTestId('items')).toHaveTextContent('a1,a2')
    cleanup()

    // Mount 3 (DIFFERENT tenant B): the cached scope-A rows must be REJECTED —
    // no seed, so the first paint is the loading (null) state, not B reading A's rows.
    signInAs('B')
    render(<Probe cacheKey={cacheKey} load={() => new Promise<string[]>(() => {})} />)
    expect(screen.getByTestId('items')).toHaveTextContent('null')
  })
})

// The reload-after-write pattern (mutate, then `reload()`) routinely has two GETs in flight at
// once, and nothing makes the earlier one land first. These pin the rule that decides who wins:
// the most recently ISSUED request, never the last to arrive.
describe('useResourceList out-of-order responses', () => {
  /** A probe that exposes `reload` so a test can fire overlapping ones. */
  function ReloadProbe({
    cacheKey,
    load,
    onReady,
  }: {
    cacheKey: string
    load: () => Promise<string[]>
    onReady: (reload: () => Promise<void>) => void
  }) {
    const { items, reload } = useResourceList(cacheKey, load)
    onReady(reload)
    return <div data-testid="items">{items === null ? 'null' : items.join(',')}</div>
  }

  /** A load() whose responses are settled by hand, in whatever order a test wants. `settle(n)`
   *  resolves the n-th call (0 = the mount fetch) and names the call if it never happened,
   *  rather than failing as a TypeError on an undefined resolver. */
  function pendingLoads() {
    const resolvers: ((rows: string[]) => void)[] = []
    return {
      load: () => new Promise<string[]>((res) => resolvers.push(res)),
      settle: (n: number, rows: string[]) => {
        const res = resolvers[n]
        if (!res) throw new Error(`load() call #${n} was never made (${resolvers.length} so far)`)
        res(rows)
      },
    }
  }

  it('drops an overtaken response instead of reverting the list', async () => {
    signInAs('A')
    const { load, settle } = pendingLoads()

    let reload!: () => Promise<void>
    render(
      <ReloadProbe cacheKey="/ooo" load={load} onReady={(r) => (reload = r)} />,
    )

    // Settle the mount fetch so the assertions below are about the reloads alone.
    await act(async () => settle(0, ['seed']))
    expect(screen.getByTestId('items')).toHaveTextContent('seed')

    // Two reloads issued in order — the caller's mental model is "after the delete" then
    // "after the second delete".
    const first = reload()
    const second = reload()

    // …resolved out of order: the NEWER request lands first with the true state…
    await act(async () => settle(2, ['final']))
    expect(screen.getByTestId('items')).toHaveTextContent('final')

    // …and the older one lands last, carrying rows the server has already moved past.
    await act(async () => settle(1, ['stale', 'rows']))
    expect(screen.getByTestId('items')).toHaveTextContent('final')

    // Both promises still settle for their own callers.
    await act(async () => {
      await Promise.all([first, second])
    })
  })

  it('does not leave the overtaken rows in the cache for the next mount to seed from', async () => {
    signInAs('A')
    const { load, settle } = pendingLoads()

    let reload!: () => Promise<void>
    render(
      <ReloadProbe cacheKey="/ooo-cache" load={load} onReady={(r) => (reload = r)} />,
    )
    await act(async () => settle(0, ['seed']))

    const first = reload()
    const second = reload()
    await act(async () => settle(2, ['final']))
    await act(async () => settle(1, ['stale']))
    await act(async () => {
      await Promise.all([first, second])
    })
    cleanup()

    // A remount seeds from the module cache. If the losing response had written it, the stale
    // rows would reappear here — the same defect, one navigation later.
    signInAs('A')
    render(<Probe cacheKey="/ooo-cache" load={() => new Promise<string[]>(() => {})} />)
    expect(screen.getByTestId('items')).toHaveTextContent('final')
  })
})
