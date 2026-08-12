/// <reference types="@testing-library/jest-dom/vitest" />
import { render } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { describe, expect, it } from 'vitest'
import { ToolkitQueryProvider, useToolkitQueryClient } from '../index'

/** Reads whichever QueryClient this point in the tree resolves to and hands it to the
 *  caller — a render-time read, not a snapshot, so it reflects exactly what
 *  useToolkitQueryClient (and every real react-query hook) would see mounted here. */
function ClientProbe({ onClient }: { onClient: (client: unknown) => void }) {
  onClient(useToolkitQueryClient())
  return null
}

// The bug this pins: ToolkitQueryProvider used to build a fresh QueryClient
// unconditionally, so a <ToolkitQueryProvider> nested inside another (a feature that
// mounts its own alongside a host shell that already has one — the User Settings overlay
// inside hub's own providers.tsx is exactly this shape) got a SEPARATE cache from the
// outer one. Every open refetched cold, and a write inside the inner one invalidated
// only the throwaway cache, leaving the outer panels showing pre-write data.
//
// The provider now hands down the module-scope singleton (see query/index.tsx), so the
// nested case cannot split the cache — there is no per-provider client to split. These
// assert that property through a RENDERED TREE, which is the shape the bug appeared in;
// __tests__/query-client.test.tsx asserts the singleton itself, by direct call.
describe('ToolkitQueryProvider nesting', () => {
  it('hands a nested provider the SAME QueryClient instance as the outer one, not a second one', () => {
    let outer: unknown
    let inner: unknown

    render(
      <ToolkitQueryProvider>
        <ClientProbe onClient={(c) => (outer = c)} />
        <ToolkitQueryProvider>
          <ClientProbe onClient={(c) => (inner = c)} />
        </ToolkitQueryProvider>
      </ToolkitQueryProvider>,
    )

    expect(outer).toBeDefined()
    expect(inner).toBeDefined()
    // Identity, not mere structural equality: two independently constructed QueryClients
    // would also both be "a QueryClient", but only sharing the SAME instance shares a
    // cache, which is the property a write-then-invalidate actually depends on.
    expect(inner).toBe(outer)
  })

  it('gives two separate, non-nested mounts that same one client', () => {
    let first: unknown
    let second: unknown

    render(
      <>
        <ToolkitQueryProvider>
          <ClientProbe onClient={(c) => (first = c)} />
        </ToolkitQueryProvider>
        <ToolkitQueryProvider>
          <ClientProbe onClient={(c) => (second = c)} />
        </ToolkitQueryProvider>
      </>,
    )

    expect(first).toBeDefined()
    expect(second).toBeDefined()
    // Two unrelated top-level mounts are not "nesting", and they share the client too:
    // reuse is not an ancestor lookup, it is the one tab-scoped client every mount hands
    // down. Sibling panels therefore invalidate each other's entries — which is what makes
    // a write in the settings overlay show up in the page behind it.
    expect(first).toBe(second)
  })

  // The reuse test above must not be paid for by adopting a NON-toolkit client. The first
  // implementation read react-query's own QueryClientContext, which is shared by every
  // consumer of one physical copy of the library — so a host whose copy deduped with this
  // package's (the vendored backends hoist to the app's single copy; aligning a site's pin
  // with data's would do it too) silently replaced the documented toolkit defaults
  // (staleTime 5min / retry 1) with its own. Same physical copy here, since this test file
  // resolves @tanstack/react-query exactly as src/query/index.tsx does.
  it('does NOT adopt a host-mounted QueryClient from the same react-query copy', () => {
    const hostClient = new QueryClient({
      defaultOptions: { queries: { staleTime: 30_000, retry: 3 } },
    })
    let toolkit: unknown

    render(
      <QueryClientProvider client={hostClient}>
        <ToolkitQueryProvider>
          <ClientProbe onClient={(c) => (toolkit = c)} />
        </ToolkitQueryProvider>
      </QueryClientProvider>,
    )

    expect(toolkit).toBeDefined()
    expect(toolkit).not.toBe(hostClient)
    expect((toolkit as QueryClient).getDefaultOptions().queries?.staleTime).toBe(5 * 60 * 1000)
  })
})
