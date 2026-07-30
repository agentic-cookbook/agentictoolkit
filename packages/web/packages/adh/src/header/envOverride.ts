'use client'

import { useSyncExternalStore } from 'react'
import { detectEnv, type SiteEnv } from '@agentic-toolkit/adh-registry'

/** localStorage key holding the dev-only environment override. */
const STORAGE_KEY = 'adh:debug:env-override'

const ENV_VALUES: readonly SiteEnv[] = ['production', 'staging', 'testing', 'local']

/**
 * Parse a raw stored value into a valid {@link SiteEnv}, or `null` when it's
 * absent or not a known env. Pure — the single validation point shared by the
 * store reader and the tests.
 */
export function parseEnvOverride(raw: string | null | undefined): SiteEnv | null {
  return raw != null && (ENV_VALUES as readonly string[]).includes(raw) ? (raw as SiteEnv) : null
}

/**
 * The effective environment: the dev override when set, otherwise the env
 * detected from the host. Pure — the source of truth both {@link useEffectiveEnv}
 * and the tests use.
 */
export function resolveEffectiveEnv(
  override: SiteEnv | null,
  detected: SiteEnv | null,
): SiteEnv | null {
  return override ?? detected
}

function readOverride(): SiteEnv | null {
  if (typeof window === 'undefined') return null
  try {
    return parseEnvOverride(window.localStorage.getItem(STORAGE_KEY))
  } catch {
    return null
  }
}

// The Routes/old-link gating reads this from the always-loaded header chunk while
// the Debug control that WRITES the override is a separate dynamic chunk. tsup
// bundles each entry independently (splitting off), so this module is duplicated
// into both — meaning a write in one copy's subscriber set wouldn't notify
// subscribers in the other, and the header wouldn't react to the toggle. Pinning
// the set on globalThis makes both copies share one subscriber list; the override
// VALUE itself lives in localStorage, which is shared regardless. (In dev the
// package's source is consumed once, so there's a single copy anyway.)
const listeners: Set<() => void> = ((
  globalThis as { __adhEnvOverrideListeners?: Set<() => void> }
).__adhEnvOverrideListeners ??= new Set())

function emit(): void {
  for (const fn of listeners) fn()
}

function subscribe(onChange: () => void): () => void {
  listeners.add(onChange)
  // The native `storage` event only fires in OTHER tabs; same-tab writes are
  // delivered via the in-memory emit above. Listening to both keeps every tab
  // in sync. Guarded for non-browser callers (React only invokes subscribe on
  // the client, but tests / SSR edge cases may not have `window`) — matching the
  // guards in readOverride and setEnvOverride.
  const onStorage = (e: StorageEvent): void => {
    if (e.key === STORAGE_KEY) onChange()
  }
  if (typeof window !== 'undefined') window.addEventListener('storage', onStorage)
  return () => {
    listeners.delete(onChange)
    if (typeof window !== 'undefined') window.removeEventListener('storage', onStorage)
  }
}

/** The current override (client-only; `null` on the server). */
export function getEnvOverride(): SiteEnv | null {
  return readOverride()
}

/** Set or clear the dev environment override, persisting it and notifying subscribers. */
export function setEnvOverride(env: SiteEnv | null): void {
  if (typeof window === 'undefined') return
  try {
    if (env !== null) window.localStorage.setItem(STORAGE_KEY, env)
    else window.localStorage.removeItem(STORAGE_KEY)
  } catch {
    /* storage disabled (private mode) — the emit below still updates this tab */
  }
  emit()
}

/**
 * Subscribe to the override: `null` on the server and the first client render
 * (so it can't cause a hydration mismatch), then live thereafter.
 */
export function useEnvOverride(): SiteEnv | null {
  return useSyncExternalStore(subscribe, readOverride, () => null)
}

/**
 * The effective environment for `hostname`, honoring the dev override. `null`
 * until the host is known (SSR / first render) and no override is set.
 */
export function useEffectiveEnv(hostname: string | null): SiteEnv | null {
  const override = useEnvOverride()
  return resolveEffectiveEnv(override, hostname ? detectEnv(hostname) : null)
}
