/// <reference types="@testing-library/jest-dom/vitest" />
import { render, screen, waitFor, cleanup } from '@testing-library/react'
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
