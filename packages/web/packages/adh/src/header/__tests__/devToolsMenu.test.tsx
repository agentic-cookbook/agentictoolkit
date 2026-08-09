import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'

// The dev-tools dropdown's UNLOCK — the one thing about this menu that no other test
// can see. `buildDebugSiteGroups` and `buildDevToolsEntries` cover what the menu
// CONTAINS; this covers whether it exists at all, which is the property the whole
// second menu was created for: everything gated lives here, so the site menu beside it
// renders identically in a dev build, a shipped build, and for an admin.
//
// The negative case is the load-bearing one. A menu that leaked into production would
// look correct in every screenshot a developer ever takes — they are, by definition,
// always on the unlocked side of this gate.

vi.mock('next/navigation', () => ({
  usePathname: () => '/',
  useRouter: () => ({ push: vi.fn() }),
}))

afterEach(() => {
  cleanup()
  vi.unstubAllEnvs()
  vi.resetModules()
})

// DEV_TOOLS_BUILD_ENABLED folds at MODULE LOAD from NEXT_PUBLIC_DEPLOYMENT_ENV, so
// both branches need a fresh module registry under a freshly-stubbed env — the same
// dance devToolsEntries.test.ts does for the flag itself, one layer up.
const renderAt = async (
  env: string | undefined,
  props: { userIsAdmin?: boolean } = {},
): Promise<void> => {
  vi.resetModules()
  vi.stubEnv('NEXT_PUBLIC_DEPLOYMENT_ENV', env)
  const { DevToolsMenu } = await import('../DevToolsMenu')
  render(<DevToolsMenu currentSiteId="hub" {...props} />)
}

const trigger = () => screen.queryByRole('button', { name: 'Debug tools' })

describe('DevToolsMenu unlock', () => {
  it('renders nothing in a production build for an ordinary visitor', async () => {
    await renderAt('production')
    expect(trigger()).toBeNull()
    // Nothing at all — not a hidden or disabled trigger. An empty `debugMenu` slot is
    // what makes the brand row lay out exactly as the bare switcher did.
    expect(document.body.textContent).toBe('')
  })

  it('renders nothing when userIsAdmin is merely unresolved', async () => {
    // The auth source settles AFTER first paint, so `undefined` is the state every
    // production page starts in. Only an explicit `true` may open the menu — a truthy
    // check on a still-loading source would flash it for everyone.
    await renderAt('production', { userIsAdmin: undefined })
    expect(trigger()).toBeNull()
  })

  it('renders for everyone in the three dev envs', async () => {
    for (const env of ['local', 'testing', 'staging']) {
      await renderAt(env)
      expect(trigger(), env).not.toBeNull()
      cleanup()
    }
  })

  it('renders for a signed-in adh admin in production', async () => {
    await renderAt('production', { userIsAdmin: true })
    expect(trigger()).not.toBeNull()
  })
})
