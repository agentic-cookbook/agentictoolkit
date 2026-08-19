// @vitest-environment jsdom
import { useState, type ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'

/**
 * Whether SiteHomeShell HOSTS the home bar for every templated site — mounting `HomeBarHost`
 * around the resolved workspace's children, so a feature underneath can publish its controls
 * into the strip between the workspace bar and whatever the site renders below it.
 *
 * `HomeBarHost` and `HomeBarPortal` themselves are exercised in
 * `packages/resource/src/__tests__/home-bar.test.tsx` — this file is not re-proving that
 * mechanism, only that the shell actually wires it in. What it DOES need is a workspace to
 * resolve, because the shell holds `children` (and now, everything `HomeBarHost` wraps) until
 * one has — so the harness below borrows the resolution mocks from `siteHomeShell.test.tsx`
 * next door (the router double, the `@agentic-toolkit/data` stub, the WorkspacePicker stub —
 * mocked there, and here, because its trigger is a Base UI menu needing pointer plumbing this
 * package does not have as a devDependency) rather than inventing a second way to get a
 * workspace onto the screen.
 */

let liveSetSlug: (slug: string | undefined) => void = () => {}
const extractSlug = (href: string): string =>
  href.split(/[?#]/)[0]!.split('/').filter(Boolean)[0]!
const replace = vi.fn((href: string) => {
  void Promise.resolve().then(() => liveSetSlug(extractSlug(href)))
})
const push = vi.fn((href: string) => {
  void Promise.resolve().then(() => liveSetSlug(extractSlug(href)))
})
const routerDouble = { replace, push, prefetch: vi.fn() }
vi.mock('next/navigation', () => ({
  useRouter: () => routerDouble,
  usePathname: () => '',
}))

const list = vi.fn()
const prefsGet = vi.fn()
const prefsPut = vi.fn()
const readCached = vi.fn()
const writeCached = vi.fn()
const itemWrite = vi.fn()

// Mirrors the data-boundary stub in `siteHomeShell.test.tsx`, trimmed to what this file needs:
// a workspace has to actually resolve (via `useResourceList` + `useResourceItemQuery`, both of
// which `useWorkspaceRoute` drives real effects off), or the shell never reaches the `HomeBarHost`
// wrapper at all. See that file for why these are hand-rolled rather than a fixed return value.
vi.mock('@agentic-toolkit/data', async () => {
  const { useEffect, useState } = await import('react')
  return {
    useResourceList: (_cacheKey: string, load: () => Promise<unknown[]>) => {
      const [items, setItems] = useState<unknown[] | null>(null)
      const [error, setError] = useState<string | null>(null)
      const [isFetching, setIsFetching] = useState(true)
      useEffect(() => {
        let alive = true
        void load().then((rows) => {
          if (alive) {
            setError(null)
            setItems(rows)
            setIsFetching(false)
          }
        })
        return () => {
          alive = false
        }
      }, [load, _cacheKey])
      return { items, reload: vi.fn(), error, isFetching, setItems }
    },
    useResourceItemQuery: (
      _cacheKey: string,
      id: string | null,
      load: (id: string) => Promise<unknown>,
    ) => {
      const [item, setItem] = useState<unknown>(null)
      const [error, setError] = useState<string | null>(null)
      useEffect(() => {
        if (id == null) return
        let alive = true
        void load(id).then((value) => {
          if (alive) setItem(value)
        })
        return () => {
          alive = false
        }
      }, [load, id, _cacheKey])
      return {
        item,
        isSettled: id == null || item !== null || error !== null,
        isFetching: id != null && item === null && error === null,
        error,
        reload: vi.fn(),
        isMissing: false,
      }
    },
    useResourceItemWriter: () => itemWrite,
    workspacesApi: { list: () => list() },
    workspacePrefsApi: {
      get: () => prefsGet(),
      put: (p: unknown) => {
        prefsPut(p)
        return Promise.resolve()
      },
    },
    readCachedWorkspace: () => readCached(),
    writeCachedWorkspace: (s: string) => writeCached(s),
  }
})

vi.mock('../WorkspacePicker', () => ({
  WorkspacePicker: () => <div data-testid="picker" />,
}))

const { SiteHomeShell } = await import('../SiteHomeShell')
const { __resetSeededWorkspace } = await import('../useWorkspaceRoute')
const { HomeBarPortal } = await import('@agentic-toolkit/resource')

const WORKSPACES = [{ slug: 'mine', name: 'My Workspace', kind: 'individual' as const }]

/** Live-URL harness, trimmed from `siteHomeShell.test.tsx`'s `Shell`: this file only needs the
 *  shell to resolve to its one workspace and mount `content` where `children(...)` would go —
 *  resolution itself is that file's job, not this one's. */
function renderShell(content: ReactNode) {
  function Harness() {
    const [slug, setSlug] = useState<string | undefined>(undefined)
    liveSetSlug = setSlug
    return <SiteHomeShell workspaceSlug={slug}>{() => content}</SiteHomeShell>
  }
  return render(<Harness />)
}

beforeEach(() => {
  vi.clearAllMocks()
  __resetSeededWorkspace()
  liveSetSlug = () => {}
  list.mockResolvedValue(WORKSPACES)
  prefsGet.mockResolvedValue({})
  readCached.mockReturnValue(null)
})
afterEach(cleanup)

describe('SiteHomeShell home bar', () => {
  it('renders no bar strip when the site publishes no controls', async () => {
    renderShell(<p>content</p>)
    expect(await screen.findByText('content')).toBeInTheDocument()
    expect(screen.queryByTestId('home-bar')).toBeNull()
  })

  it('hosts the bar, so a feature below can publish into it', async () => {
    renderShell(
      <HomeBarPortal>
        <button type="button">New Thing</button>
      </HomeBarPortal>,
    )
    const strip = await screen.findByTestId('home-bar')
    expect(strip).toContainElement(screen.getByRole('button', { name: 'New Thing' }))
  })
})
