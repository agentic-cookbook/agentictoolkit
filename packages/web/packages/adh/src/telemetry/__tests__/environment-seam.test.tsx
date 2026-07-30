import { render } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'

// TelemetryProvider latches start-up on a MODULE-level `started` flag, so the SECOND and
// later mounts in one module instance never reach startTelemetry at all. That makes any
// later test in this file vacuous unless the registry is reset first — a "renders children
// when no DSN is configured" assertion would pass identically with the whole no-DSN branch
// deleted, because the mount short-circuits before it. So each test resets the module
// registry and imports the provider fresh, and asserts resolveEnvironment ran as proof
// that startTelemetry really executed rather than short-circuiting again.
//
// startTelemetry also calls instrumentFetch(), which wraps window.fetch behind its own
// module-level guard; a fresh module instance re-wraps, so snapshot and restore fetch
// around each test rather than letting the wrappers nest. (React and @sentry/react are
// externalized deps, so resetModules leaves those single instances alone.)
let originalFetch: typeof window.fetch

beforeEach(() => {
  originalFetch = window.fetch
  vi.resetModules()
})

afterEach(() => {
  window.fetch = originalFetch
})

async function freshProvider() {
  return (await import('../TelemetryProvider')).TelemetryProvider
}

describe('TelemetryProvider environment seam', () => {
  it('asks the host to classify the hostname rather than importing a site registry', async () => {
    const TelemetryProvider = await freshProvider()
    const resolveEnvironment = vi.fn().mockReturnValue('staging')
    render(
      <TelemetryProvider resolveEnvironment={resolveEnvironment}>
        <span>ok</span>
      </TelemetryProvider>,
    )
    expect(resolveEnvironment).toHaveBeenCalledWith(window.location.hostname)
  })

  it('starts up and renders its children even when no DSN is configured', async () => {
    const TelemetryProvider = await freshProvider()
    const resolveEnvironment = vi.fn().mockReturnValue('local')
    const { getByText } = render(
      <TelemetryProvider resolveEnvironment={resolveEnvironment}>
        <span>ok</span>
      </TelemetryProvider>,
    )
    // No NEXT_PUBLIC_GLITCHTIP_DSN / NEXT_PUBLIC_POSTHOG_KEY in the test env, so this mount
    // takes the both-engines-absent path. resolveEnvironment having run proves the mount
    // entered startTelemetry, so "children still render" is a statement about that path.
    expect(resolveEnvironment).toHaveBeenCalledTimes(1)
    expect(getByText('ok')).toBeTruthy()
  })
})
