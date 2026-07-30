/**
 * bitbag rides in the shared footer UNCONDITIONALLY — every site, every environment.
 *
 * He used to be gated on the `show_bitbag` feature flag, which meant the family's assistant was
 * invisible wherever the flag table said no, wherever it hadn't been seeded, and wherever the flag
 * backend was unreachable. These drive the REAL chain — FeatureFlagsProvider's fetch of the
 * backend's public flag table → the context → SiteFooter — and assert he shows up regardless, so a
 * flag gate can't be reintroduced by accident.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
// Type-side too, not just the runtime setup: `tsc --noEmit` (this package's lint) doesn't
// compile vitest.setup.ts, so the jest-dom Assertion augmentation must load HERE.
import '@testing-library/jest-dom/vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { FeatureFlagsProvider } from '@agentic-toolkit/adh/flags'
import { SiteFooter } from '../footer/SiteFooter'

// bitbag is a next/dynamic chunk (his avatar rig + gsap + his chat); stub it to a marker so these
// assertions are about him being MOUNTED, not about his internals.
vi.mock('../footer/FooterChat', () => ({
  FooterChat: () => <div data-testid="bitbag-chat" />,
}))

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

const renderFooter = () =>
  render(
    <FeatureFlagsProvider>
      <SiteFooter />
    </FeatureFlagsProvider>,
  )

describe('SiteFooter — bitbag is ungated', () => {
  beforeEach(() => {
    document.cookie = 'dev_flags=;max-age=0;path=/'
  })
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('shows bitbag with an empty flag table', async () => {
    mockFlagTable([])
    renderFooter()
    await waitFor(() => expect(screen.getByTestId('bitbag-chat')).toBeInTheDocument())
  })

  it('shows bitbag even with the retired show_bitbag row present and DISABLED', async () => {
    // The row still exists in prod's system.feature_flags — seeded by migration 0123, which is
    // immutable. Nothing reads it any more, and this pins that: an old `false` can't hide him.
    mockFlagTable([{ id: 1, key: 'show_bitbag', enabled: false }])
    renderFooter()
    await waitFor(() => expect(screen.getByTestId('bitbag-chat')).toBeInTheDocument())
  })

  it('shows bitbag when the flag backend is unreachable', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Promise.reject(new Error('ECONNREFUSED'))))
    renderFooter()
    await waitFor(() => expect(screen.getByTestId('bitbag-chat')).toBeInTheDocument())
    // The footer bar itself is unaffected either way.
    expect(screen.getByRole('contentinfo')).toBeInTheDocument()
  })
})
