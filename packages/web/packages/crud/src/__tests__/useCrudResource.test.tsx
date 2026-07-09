import { describe, it, expect, vi, beforeEach } from 'vitest'
import { act, renderHook, waitFor } from '@testing-library/react'
import { itemUrl, rowKey, useCrudResource } from '../useCrudResource'
import type { CrudTableMeta } from '../types'

vi.mock('@agentic-toolkit/auth/client', () => ({
  authedJson: vi.fn(),
  authedRequest: vi.fn(),
}))

const { authedJson, authedRequest } = vi.mocked(
  await import('@agentic-toolkit/auth/client'),
)

const tiers: CrudTableMeta = {
  key: 'billing/subscription-tiers',
  schema: 'billing',
  table: 'subscription-tiers',
  basePath: '/billing/subscription-tiers',
  itemPath: '/billing/subscription-tiers/{id}',
  pkParams: ['id'],
  columns: [],
}

const links: CrudTableMeta = {
  key: 'persona-memory/links',
  schema: 'persona-memory',
  table: 'links',
  basePath: '/persona-memory/links',
  itemPath: '/persona-memory/links/{srcId}/{dstId}/{relation}',
  pkParams: ['srcId', 'dstId', 'relation'],
  columns: [],
}

beforeEach(() => {
  authedJson.mockReset()
  authedRequest.mockReset()
})

describe('itemUrl', () => {
  it('substitutes a single id, URL-encoded', () => {
    expect(itemUrl(tiers, { id: 'a b' })).toBe('/api/billing/subscription-tiers/a%20b')
  })
  it('substitutes composite primary keys in order', () => {
    expect(itemUrl(links, { srcId: 's1', dstId: 'd1', relation: 'rel/x' })).toBe(
      '/api/persona-memory/links/s1/d1/rel%2Fx',
    )
  })
})

describe('rowKey', () => {
  it('joins escaped pk values (same escaping as itemUrl)', () => {
    expect(rowKey(links, { srcId: 's1', dstId: 'd1', relation: 'rel/x' })).toBe('s1/d1/rel%2Fx')
  })
  it('is empty when a single-pk row carries no value (caller falls back)', () => {
    expect(rowKey(tiers, {})).toBe('')
  })
})

describe('useCrudResource', () => {
  it('lists on mount through the /api proxy', async () => {
    authedJson.mockResolvedValueOnce([{ id: '1' }])
    const { result } = renderHook(() => useCrudResource(tiers))
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(authedJson).toHaveBeenCalledWith('/api/billing/subscription-tiers')
    expect(result.current.rows).toEqual([{ id: '1' }])
    expect(result.current.error).toBeNull()
  })

  it('surfaces the list error message', async () => {
    authedJson.mockRejectedValueOnce(new Error('Service unavailable'))
    const { result } = renderHook(() => useCrudResource(tiers))
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.error).toBe('Service unavailable')
    expect(result.current.rows).toEqual([])
  })

  it('creates with POST + JSON body, then re-lists', async () => {
    authedJson.mockResolvedValue([])
    const { result } = renderHook(() => useCrudResource(tiers))
    await waitFor(() => expect(result.current.loading).toBe(false))
    await act(() => result.current.create({ key: 'pro', name: 'Pro' }))
    expect(authedJson).toHaveBeenCalledWith('/api/billing/subscription-tiers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: 'pro', name: 'Pro' }),
    })
    // mount list + post + refresh list
    expect(authedJson).toHaveBeenCalledTimes(3)
  })

  it('updates with PUT at the row item path', async () => {
    authedJson.mockResolvedValue([])
    const { result } = renderHook(() => useCrudResource(tiers))
    await waitFor(() => expect(result.current.loading).toBe(false))
    await act(() => result.current.update({ id: 't1' }, { name: 'New name' }))
    expect(authedJson).toHaveBeenCalledWith('/api/billing/subscription-tiers/t1', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'New name' }),
    })
  })

  it('deletes with authedRequest (204 has no body), then re-lists', async () => {
    authedJson.mockResolvedValue([])
    authedRequest.mockResolvedValueOnce(undefined)
    const { result } = renderHook(() => useCrudResource(tiers))
    await waitFor(() => expect(result.current.loading).toBe(false))
    await act(() => result.current.remove({ id: 't1' }))
    expect(authedRequest).toHaveBeenCalledWith('/api/billing/subscription-tiers/t1', {
      method: 'DELETE',
    })
    expect(authedJson).toHaveBeenCalledTimes(2) // mount + refresh
  })

  it('keeps rows rendered (loading stays false) on refreshes after the first load', async () => {
    authedJson.mockResolvedValueOnce([{ id: '1' }])
    const { result } = renderHook(() => useCrudResource(tiers))
    await waitFor(() => expect(result.current.loading).toBe(false))
    let resolveList!: (rows: unknown) => void
    authedJson.mockImplementationOnce(
      () => new Promise((resolve) => { resolveList = resolve }) as never,
    )
    let refreshing!: Promise<void>
    act(() => {
      refreshing = result.current.refresh()
    })
    // the re-list is in flight, but the table must NOT swap to a spinner
    expect(result.current.loading).toBe(false)
    expect(result.current.rows).toEqual([{ id: '1' }])
    await act(async () => {
      resolveList([{ id: '1' }, { id: '2' }])
      await refreshing
    })
    expect(result.current.rows).toEqual([{ id: '1' }, { id: '2' }])
  })

  it('keeps stale rows visible when a refresh after the first load fails', async () => {
    authedJson.mockResolvedValueOnce([{ id: '1' }])
    const { result } = renderHook(() => useCrudResource(tiers))
    await waitFor(() => expect(result.current.loading).toBe(false))
    authedJson.mockRejectedValueOnce(new Error('Service unavailable'))
    await act(() => result.current.refresh())
    expect(result.current.error).toBe('Service unavailable')
    expect(result.current.rows).toEqual([{ id: '1' }])
  })

  it('propagates mutation failures to the caller (no hook-level error)', async () => {
    authedJson.mockResolvedValueOnce([]) // mount list
    const { result } = renderHook(() => useCrudResource(tiers))
    await waitFor(() => expect(result.current.loading).toBe(false))
    authedJson.mockRejectedValueOnce(new Error('key already exists'))
    await expect(
      act(() => result.current.create({ key: 'dup' })),
    ).rejects.toThrow('key already exists')
    expect(result.current.error).toBeNull()
  })
})

describe('useCrudResource filter', () => {
  it('appends the filter as a query string to the list call', async () => {
    authedJson.mockResolvedValueOnce([])
    const { result } = renderHook(() => useCrudResource(tiers, { sourceProvider: 'reddit' }))
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(authedJson).toHaveBeenCalledWith('/api/billing/subscription-tiers?sourceProvider=reddit')
  })

  it('omits the query string for an empty filter object', async () => {
    authedJson.mockResolvedValueOnce([])
    const { result } = renderHook(() => useCrudResource(tiers, {}))
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(authedJson).toHaveBeenCalledWith('/api/billing/subscription-tiers')
  })

  it('URL-encodes filter keys and values', async () => {
    authedJson.mockResolvedValueOnce([])
    const { result } = renderHook(() => useCrudResource(tiers, { externalRef: 'a b/c&d' }))
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(authedJson).toHaveBeenCalledWith(
      '/api/billing/subscription-tiers?externalRef=a+b%2Fc%26d',
    )
  })

  it('does not add the filter to mutation URLs (list-only)', async () => {
    authedJson.mockResolvedValue([])
    const { result } = renderHook(() => useCrudResource(tiers, { sourceProvider: 'reddit' }))
    await waitFor(() => expect(result.current.loading).toBe(false))
    await act(() => result.current.create({ key: 'pro', name: 'Pro' }))
    expect(authedJson).toHaveBeenCalledWith('/api/billing/subscription-tiers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: 'pro', name: 'Pro' }),
    })
  })

  it('does not re-list when an equivalent inline filter object is passed on re-render', async () => {
    authedJson.mockResolvedValue([])
    const { result, rerender } = renderHook(
      ({ filter }) => useCrudResource(tiers, filter),
      { initialProps: { filter: { sourceProvider: 'reddit' } as Record<string, string> } },
    )
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(authedJson).toHaveBeenCalledTimes(1)
    // A brand-new object with identical contents — what an inline `filter={{…}}`
    // literal produces every render. The serialized filterQuery is unchanged, so
    // the list effect must NOT re-fire.
    rerender({ filter: { sourceProvider: 'reddit' } })
    expect(authedJson).toHaveBeenCalledTimes(1)
  })
})

describe('useCrudResource scopeEcosystemId', () => {
  const ECO = 'e1c0/5+15'

  it('prefixes the list query with the ecosystem scope, before any filter', async () => {
    authedJson.mockResolvedValueOnce([])
    const { result } = renderHook(() =>
      useCrudResource(tiers, { sourceProvider: 'reddit' }, 'eco-1'),
    )
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(authedJson).toHaveBeenCalledWith(
      '/api/billing/subscription-tiers?ecosystemId=eco-1&sourceProvider=reddit',
    )
  })

  it('rides every mutation URL (POST / PUT / DELETE), unlike the list-only filter', async () => {
    authedJson.mockResolvedValue([])
    authedRequest.mockResolvedValueOnce(undefined as never)
    const { result } = renderHook(() => useCrudResource(tiers, undefined, 'eco-1'))
    await waitFor(() => expect(result.current.loading).toBe(false))
    await act(() => result.current.create({ key: 'pro' }))
    expect(authedJson).toHaveBeenCalledWith('/api/billing/subscription-tiers?ecosystemId=eco-1', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: 'pro' }),
    })
    await act(() => result.current.update({ id: 't1' }, { name: 'N' }))
    expect(authedJson).toHaveBeenCalledWith(
      '/api/billing/subscription-tiers/t1?ecosystemId=eco-1',
      expect.objectContaining({ method: 'PUT' }),
    )
    await act(() => result.current.remove({ id: 't1' }))
    expect(authedRequest).toHaveBeenCalledWith(
      '/api/billing/subscription-tiers/t1?ecosystemId=eco-1',
      { method: 'DELETE' },
    )
  })

  it('URL-encodes the scope id and omits it entirely when absent', async () => {
    authedJson.mockResolvedValueOnce([])
    const { result } = renderHook(() => useCrudResource(tiers, undefined, ECO))
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(authedJson).toHaveBeenCalledWith(
      `/api/billing/subscription-tiers?ecosystemId=${encodeURIComponent(ECO)}`,
    )
    authedJson.mockResolvedValueOnce([])
    const { result: bare } = renderHook(() => useCrudResource(tiers))
    await waitFor(() => expect(bare.current.loading).toBe(false))
    expect(authedJson).toHaveBeenLastCalledWith('/api/billing/subscription-tiers')
  })
})
