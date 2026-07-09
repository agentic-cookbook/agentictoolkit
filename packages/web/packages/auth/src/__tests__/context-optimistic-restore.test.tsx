import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { StrictMode, type ReactElement } from 'react'
import { act, render, waitFor } from '@testing-library/react'
import { AuthProvider, useAuth } from '../context'

// Returning visitors hold a per-site session (tokens) AND a cached copy of the
// user from a prior visit. The provider renders the signed-in UI IMMEDIATELY
// from that cache and revalidates /api/auth/me in the background — so the
// auth-gated content no longer stares at a "Loading…" gate for a backend
// round-trip. Capability-gated sites (admin) opt out: a stale cache must never
// flash privileged UI to a user whose capability was revoked.

const TOKENS_KEY = 'auth_tokens'
const USER_KEY = 'auth_tokens:user'

function seedSession(user: { id: string; email: string; name: string; capabilities?: string[] }): void {
  window.localStorage.setItem(TOKENS_KEY, JSON.stringify({ accessToken: 'stored', refreshToken: '' }))
  window.localStorage.setItem(
    USER_KEY,
    JSON.stringify({ avatarUrl: '', capabilities: [], authMethods: [], attributes: [], ...user }),
  )
}

/** Shows "<status>:<name>" so a test can assert both the gate state and which
 *  user (cached vs. revalidated) is in context. */
function Probe(): ReactElement {
  const { isLoading, isAuthenticated, user } = useAuth()
  const status = isLoading ? 'loading' : isAuthenticated ? 'user' : 'anon'
  return <div data-testid="probe">{`${status}:${user?.name ?? '-'}`}</div>
}

/** A never-settling response, so revalidation stays in flight while we assert
 *  what rendered synchronously. */
function pending(): Promise<Response> {
  return new Promise<Response>(() => {})
}

beforeEach(() => {
  window.localStorage.clear()
  window.sessionStorage.clear()
  process.env.NEXT_PUBLIC_AUTH_API_URL = 'https://api.example.com'
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  delete process.env.NEXT_PUBLIC_AUTH_API_URL
})

describe('AuthProvider optimistic restore', () => {
  it('renders the cached user immediately, before /api/auth/me resolves', () => {
    seedSession({ id: 'u1', email: 'a@b.com', name: 'Ada' })
    const meCalls: string[] = []
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        meCalls.push(String(input))
        return pending() // revalidation never lands during this test
      }),
    )

    const { getByTestId } = render(
      <AuthProvider clientId="adh">
        <Probe />
      </AuthProvider>,
    )

    // Signed in synchronously from cache — no waitFor, no resolved fetch.
    expect(getByTestId('probe').textContent).toBe('user:Ada')
    // …and the background revalidation was still kicked off.
    expect(meCalls.some((u) => u.includes('/api/auth/me'))).toBe(true)
  })

  it('reconciles to the freshly fetched user when revalidation returns updated data', async () => {
    seedSession({ id: 'u1', email: 'a@b.com', name: 'Stale Name' })
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        if (String(input).includes('/api/auth/me')) {
          return {
            ok: true,
            status: 200,
            json: async () => ({ id: 'u1', email: 'a@b.com', name: 'Fresh Name', capabilities: [] }),
          } as Response
        }
        return { ok: false, status: 401, json: async () => ({}) } as Response
      }),
    )

    const { getByTestId } = render(
      <AuthProvider clientId="adh">
        <Probe />
      </AuthProvider>,
    )

    // Optimistic first…
    expect(getByTestId('probe').textContent).toBe('user:Stale Name')
    // …then reconciled from the live check, and the cache is refreshed.
    await waitFor(() => expect(getByTestId('probe').textContent).toBe('user:Fresh Name'))
    expect(window.localStorage.getItem(USER_KEY)).toContain('Fresh Name')
  })

  it('drops the optimistic session when revalidation fails (revoked/expired)', async () => {
    seedSession({ id: 'u1', email: 'a@b.com', name: 'Ada' })
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 401, json: async () => ({}) }) as Response))

    const { getByTestId } = render(
      <AuthProvider clientId="adh">
        <Probe />
      </AuthProvider>,
    )

    expect(getByTestId('probe').textContent).toBe('user:Ada')
    await waitFor(() => expect(getByTestId('probe').textContent).toBe('anon:-'))
    // Session fully cleared — tokens AND the cached identity.
    expect(window.localStorage.getItem(TOKENS_KEY)).toBeNull()
    expect(window.localStorage.getItem(USER_KEY)).toBeNull()
  })

  it('does NOT optimistically render on capability-gated sites — waits for the live check', () => {
    // Even a cached user that LOOKS like an admin must not flash the console: the
    // cache could be stale (capability revoked). The gate holds until /api/auth/me.
    // (The first test proves the SAME seed DOES render optimistically without
    // requireCapability — that contrast is what makes this assertion load-bearing.)
    seedSession({ id: 'u1', email: 'a@b.com', name: 'Ada', capabilities: ['admin'] })
    vi.stubGlobal('fetch', vi.fn(async () => pending()))

    const { getByTestId } = render(
      <AuthProvider clientId="admin" requireCapability="admin">
        <Probe />
      </AuthProvider>,
    )

    expect(getByTestId('probe').textContent).toBe('loading:-')
  })

  it('keeps the session on a transient 5xx revalidation — a valid user is NOT logged out', async () => {
    // The cold-starting backend (the very latency this path hides) can answer
    // /api/auth/me with a 5xx. That must not evict the already-rendered session.
    seedSession({ id: 'u1', email: 'a@b.com', name: 'Ada' })
    const calls: string[] = []
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        calls.push(String(input))
        return { ok: false, status: 503, json: async () => ({}) } as Response
      }),
    )

    const { getByTestId } = render(
      <AuthProvider clientId="adh">
        <Probe />
      </AuthProvider>,
    )

    expect(getByTestId('probe').textContent).toBe('user:Ada')
    // Drain the rejected revalidation + its catch fully (inside act), giving any
    // wrongful dropTokens() a chance to fire, then confirm the session held.
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0))
    })
    expect(calls.some((u) => u.includes('/api/auth/me'))).toBe(true)
    expect(getByTestId('probe').textContent).toBe('user:Ada')
    expect(window.localStorage.getItem(TOKENS_KEY)).not.toBeNull()
    expect(window.localStorage.getItem(USER_KEY)).not.toBeNull()
  })

  it('survives React StrictMode (double-invoked effect) and reconciles signed-in', async () => {
    seedSession({ id: 'u1', email: 'a@b.com', name: 'Stale' })
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        if (String(input).includes('/api/auth/me')) {
          return {
            ok: true,
            status: 200,
            json: async () => ({ id: 'u1', email: 'a@b.com', name: 'Fresh', capabilities: [] }),
          } as Response
        }
        return { ok: false, status: 401, json: async () => ({}) } as Response
      }),
    )

    const { getByTestId } = render(
      <StrictMode>
        <AuthProvider clientId="adh">
          <Probe />
        </AuthProvider>
      </StrictMode>,
    )

    // Optimistic from cache on the first synchronous pass…
    expect(getByTestId('probe').textContent).toBe('user:Stale')
    // …and the background revalidation still reconciles cleanly through the
    // double mount/cleanup — no stuck loading, no dropped session.
    await waitFor(() => expect(getByTestId('probe').textContent).toBe('user:Fresh'))
  })
})
