/**
 * The landing diagram is gated by `landing_site_explorer_diagram`. Drives the REAL chain —
 * FeatureFlagsProvider's fetch of the backend's public flag table → the context →
 * LandingHeroGate — with only `fetch` stubbed (same rationale as the footer's bitbag gate).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { FeatureFlagsProvider } from '@agentic-toolkit/adh/flags'
import { LandingHeroGate } from '../marketing/LandingHeroGate'

type FlagRow = { id: number; key: string; enabled: boolean }

function mockFlagTable(rows: FlagRow[]) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => {
      if (String(url).includes('/api/system/feature-flags')) {
        return { ok: true, json: async () => rows } as unknown as Response
      }
      throw new Error(`unexpected fetch: ${url}`)
    }),
  )
}

const renderGate = () =>
  render(
    <FeatureFlagsProvider>
      <LandingHeroGate
        diagram={<div data-testid="diagram" />}
        fallback={<div data-testid="hero" />}
      />
    </FeatureFlagsProvider>,
  )

describe('LandingHeroGate — landing_site_explorer_diagram gate', () => {
  beforeEach(() => {
    document.cookie = 'dev_flags=;max-age=0;path=/'
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.unstubAllEnvs()
    cleanup()
  })

  it('renders the static hero while the flag is absent (the default)', async () => {
    mockFlagTable([])
    renderGate()
    expect(screen.getByTestId('hero')).toBeInTheDocument()
    expect(screen.queryByTestId('diagram')).not.toBeInTheDocument()
    // …and stays the hero once the (empty) flag set has loaded
    await waitFor(() => expect(fetch).toHaveBeenCalled())
    expect(screen.getByTestId('hero')).toBeInTheDocument()
    expect(screen.queryByTestId('diagram')).not.toBeInTheDocument()
  })

  it('mounts the diagram when the flag is enabled', async () => {
    mockFlagTable([{ id: 1, key: 'landing_site_explorer_diagram', enabled: true }])
    renderGate()
    await waitFor(() => expect(screen.getByTestId('diagram')).toBeInTheDocument())
    expect(screen.queryByTestId('hero')).not.toBeInTheDocument()
  })

  it('a BUILD-TIME flag is already on at first paint — no fetch waited on, nothing to swap', async () => {
    // The build-time override is inlined and identical on server + client, so it can seed the
    // provider's first render without risking a hydration mismatch. That is what spares a SWITCH
    // (the hierarchical-view flag) from painting the wrong view and then REMOUNTING onto the right
    // one. Re-import after stubbing: the seed is read once, at module load.
    vi.stubEnv('NEXT_PUBLIC_DEV_FEATURE_FLAGS', 'landing_site_explorer_diagram')
    vi.resetModules()
    const { FeatureFlagsProvider: Provider } = await import('@agentic-toolkit/adh/flags')
    const { LandingHeroGate: Gate } = await import('../marketing/LandingHeroGate')
    mockFlagTable([]) // the table says nothing — the build flag alone must carry it
    render(
      <Provider>
        <Gate diagram={<div data-testid="diagram" />} fallback={<div data-testid="hero" />} />
      </Provider>,
    )
    // Synchronous: asserted BEFORE the fetch resolves, so this fails if the seed is dropped.
    expect(screen.getByTestId('diagram')).toBeInTheDocument()
    expect(screen.queryByTestId('hero')).not.toBeInTheDocument()
    // …and the empty table doesn't take it away again.
    await waitFor(() => expect(fetch).toHaveBeenCalled())
    expect(screen.getByTestId('diagram')).toBeInTheDocument()
  })

  it('skips the backend fetch entirely when backendFlags is false', async () => {
    // The builds/status boards proxy /api/* to their own backends, which serve no flag table, so
    // the request would 404 on every page load. Opting out must not cost them the overrides.
    vi.stubEnv('NEXT_PUBLIC_DEV_FEATURE_FLAGS', 'landing_site_explorer_diagram')
    vi.resetModules()
    const { FeatureFlagsProvider: Provider } = await import('@agentic-toolkit/adh/flags')
    const { LandingHeroGate: Gate } = await import('../marketing/LandingHeroGate')
    mockFlagTable([])
    render(
      <Provider backendFlags={false}>
        <Gate diagram={<div data-testid="diagram" />} fallback={<div data-testid="hero" />} />
      </Provider>,
    )
    expect(screen.getByTestId('diagram')).toBeInTheDocument()
    await waitFor(() => expect(screen.getByTestId('diagram')).toBeInTheDocument())
    expect(fetch).not.toHaveBeenCalled()
  })
})
