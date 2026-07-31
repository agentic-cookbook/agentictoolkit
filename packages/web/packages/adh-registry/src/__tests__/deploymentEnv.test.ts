/**
 * The dev-deployment gate — the single fact that decides whether a dev-only affordance
 * (the site-theme switcher/editor, the site menu's dev tail, the cross-site theme carry)
 * exists at all. It replaced three drifting copies of the same allowlist, so these tests
 * pin BOTH reads of it and the reason they can't be merged.
 *
 * The failure mode being guarded is silent in the worst way: production keeps working
 * either way. A gate that wrongly says "dev" doesn't crash — it just ships a half-working
 * theme editor and its client chunk to real visitors, which nothing in CI would notice.
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { DEV_DEPLOYMENT_ENVS, isDevDeploymentEnv } from '../deployment-env'

// `fileURLToPath(import.meta.url)` directly, not `new URL(…, import.meta.url)`. This package
// runs vitest on the node environment, where either spelling works — but the module under test
// is consumed almost entirely by React code whose suites run on jsdom, where the global URL is
// jsdom's and node's fileURLToPath rejects a foreign URL object. Written so it survives being
// moved back.
const here = dirname(fileURLToPath(import.meta.url))

describe('isDevDeploymentEnv', () => {
  it('allowlists exactly local / testing / staging', () => {
    expect([...DEV_DEPLOYMENT_ENVS]).toEqual(['local', 'testing', 'staging'])
    for (const env of DEV_DEPLOYMENT_ENVS) expect(isDevDeploymentEnv(env)).toBe(true)
  })

  it('rejects production', () => {
    expect(isDevDeploymentEnv('production')).toBe(false)
  })

  it('fails SAFE on anything unrecognised — hidden, never shown by accident', () => {
    // Allowlisting rather than `!== 'production'` is the whole point: a typo, a renamed
    // env or an unset var must hide the affordance, not expose it.
    for (const env of [null, undefined, '', 'prod', 'Production', 'preview', 'LOCAL']) {
      expect(isDevDeploymentEnv(env)).toBe(false)
    }
  })
})

describe('DEV_BUILD', () => {
  // Evaluated once at module load from NEXT_PUBLIC_DEPLOYMENT_ENV, so both branches need a
  // fresh import under a stubbed env.
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.resetModules()
  })

  const buildGateFor = async (env: string | undefined): Promise<boolean> => {
    vi.resetModules()
    vi.stubEnv('NEXT_PUBLIC_DEPLOYMENT_ENV', env)
    return (await import('../deployment-env')).DEV_BUILD
  }

  it('is on in the three dev envs', async () => {
    for (const env of ['local', 'testing', 'staging']) {
      expect(await buildGateFor(env)).toBe(true)
    }
  })

  it('is OFF in production, in an unknown env, and when unset', async () => {
    // `staging ` with a stray trailing space is the shape of a real .env typo, and
    // `Local` of a hand-set var: both are the accident this gate has to fail closed on.
    for (const env of ['production', 'preview', undefined, '', 'Local', 'staging ']) {
      expect(await buildGateFor(env)).toBe(false)
    }
  })

  it('agrees with isDevDeploymentEnv on every env either one accepts', async () => {
    // Two reads of ONE fact. They are separate declarations for a bundler reason (below),
    // not because they may disagree — a disagreement is how production ends up shipping a
    // dev affordance while the server-side gate insists it didn't.
    for (const env of ['local', 'testing', 'staging', 'production', 'preview', 'prod', '']) {
      expect(await buildGateFor(env)).toBe(isDevDeploymentEnv(env))
    }
  })

  it('stays written as constant-foldable literal comparisons', () => {
    // The one test here that reads source text instead of behaviour, because the property
    // is invisible at runtime: DEV_BUILD must be foldable by the BUNDLER, and every form
    // below behaves identically under vitest while quietly defeating that.
    //
    // Next substitutes the `process.env.NEXT_PUBLIC_*` text and then folds what remains,
    // which needs a comparison against a string literal. Route it through
    // `DEV_DEPLOYMENT_ENVS.includes(...)` — the obvious DRY cleanup — and the fold cannot
    // see through the array lookup, so `dynamic(() => import('./SiteThemeConsole'))` stops
    // being dead code and the site-theme editor ships to production. Nothing fails; the
    // chunk is just there. So the duplicated allowlist is load-bearing, and this asserts it
    // survives, with the reason attached where a future refactor will read it.
    const src = readFileSync(resolve(here, '../deployment-env.ts'), 'utf8')
    const expr = /export const DEV_BUILD =([\s\S]*?)(?:\n\n|$)/.exec(src)?.[1]
    expect(expr, 'DEV_BUILD declaration not found').toBeDefined()
    for (const env of DEV_DEPLOYMENT_ENVS) {
      expect(expr).toContain(`process.env.NEXT_PUBLIC_DEPLOYMENT_ENV === '${env}'`)
    }
    expect(expr).not.toMatch(/\.includes\(|\.some\(|\.indexOf\(/)
  })
})
