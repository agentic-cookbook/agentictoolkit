'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'

/**
 * The feature-flag set, delivered to EVERY site.
 *
 * One home, because the flags gate SHARED chrome (the footer's bitbag assistant) as well as
 * per-site pages — a second copy per site is how the hub and learntruefacts each ended up with
 * their own BFF route and their own context around the same three lines.
 *
 * Sources (union; a key absent from all of them ⇒ the flag is OFF):
 *   1. `GET /api/system/feature-flags` — the backend's PUBLIC, unauthenticated flag table, reached
 *      same-origin through the baseline BFF proxy every site gets from `withAdhConfig`
 *      (websites/next-config-base.mjs). Best-effort: any error leaves the set empty, so local dev
 *      without a backend — and a backend outage in production — simply mean "no flags on".
 *      Sites whose backend serves no such route pass `backendFlags={false}` (see the prop).
 *   2. `NEXT_PUBLIC_DEV_FEATURE_FLAGS` (comma-separated) — a build-time override. Known at BUILD
 *      time, so it seeds the FIRST render (see `buildFlags`) rather than waiting for the fetch.
 *   3. a `dev_flags` cookie (comma-separated), NON-PRODUCTION only — the live override: set it,
 *      refresh, no restart. It is what the hub's real-path e2e drives.
 */

/**
 * What is known about one flag — deliberately THREE states, not a boolean.
 *
 * "Off" and "we haven't asked yet" are different facts, and a boolean has nowhere to put the
 * second: it reports `false` — "we know this is off" — when the truth is "we don't know". The
 * caller can't tell, so the wrong guess renders and then corrects itself, which is a flash at
 * best and a lie at worst. That cost a real bug once already: /signup showed the "signups are
 * closed" alert to someone holding a valid invite, because the invitations flag read `false`
 * while its own fetch was still in flight.
 *
 * The state was only reconstructible by pairing the boolean with a set-wide `isLoading` from a
 * second hook, which is what /signup ended up doing by hand — so the knowledge existed, it just
 * wasn't in the type where every caller would see it. Here it is unignorable: there is no
 * truthiness to lean on, and `Fetching` has to be answered on purpose.
 *
 * Answering it is still the caller's call, and the two kinds differ:
 *   - a GATE (show the bitbag, show the diagram) treats Fetching as No — stay hidden until told
 *     otherwise, so nothing flashes in and back out. That convention has ONE home: {@link flagEnabled}
 *     / {@link useFlagEnabled}. Don't re-spell it per call site.
 *   - a SWITCH between two renderable things has no safe default and must pick one knowingly.
 */
export const FlagState = {
  Yes: 'yes',
  No: 'no',
  Fetching: 'fetching',
} as const
export type FlagState = (typeof FlagState)[keyof typeof FlagState]

/**
 * The GATE answer for one state: only an explicit Yes shows a gated thing — `Fetching` and `No`
 * both read as hidden, so nothing flashes in and back out.
 *
 * The one authoritative spelling of that convention. It was briefly copied into each call site as a
 * local `flagOn` helper; three copies of a rule is how the rule drifts.
 */
export function flagEnabled(state: FlagState): boolean {
  return state === FlagState.Yes
}

interface FeatureFlagsValue {
  /** What is known about one flag. The ONLY way to ask: the raw key set is deliberately not
   *  exposed, because `set.has(key)` is false-while-fetching and would reproduce exactly the
   *  off-vs-not-yet ambiguity FlagState exists to remove. */
  flagState: (key: string) => FlagState
}

const FeatureFlagsContext = createContext<FeatureFlagsValue>({
  // The default context is what a tree with no provider sees, and no provider means no fetch is
  // coming — so this is a settled No, not a Fetching that would never resolve.
  flagState: () => FlagState.No,
})

function parseList(raw: string | undefined | null): string[] {
  return (raw ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
}

/** The non-production `dev_flags` live override. Read from `document.cookie` (it is not httpOnly —
 *  it exists to be flipped by hand and by tests), so no per-site server route is needed for it. */
function devCookieFlags(): string[] {
  if (process.env.NODE_ENV === 'production') return []
  if (typeof document === 'undefined') return []
  const m = document.cookie.match(/(?:^|; )dev_flags=([^;]*)/)
  return m?.[1] ? parseList(decodeURIComponent(m[1])) : []
}

/**
 * The build-time override, and the ONLY source that can seed the first render.
 *
 * `NEXT_PUBLIC_*` is inlined at build, so this evaluates to the same set on the server and on the
 * client — seeding initial state with it therefore cannot cause a hydration mismatch, and a flag
 * turned on this way is `Yes` from FIRST PAINT: no flash, and no remount for a switch.
 *
 * The cookie deliberately does NOT seed: the server can't see it (`document` is undefined there), so
 * seeding from it would make the server's HTML disagree with the first client render. Reading it
 * server-side instead would mean `cookies()`, which opts every page using AppShell out of static
 * rendering — far too much to pay for one render of one flag. So a cookie-driven flag resolves one
 * render late, by design.
 */
const buildFlags: ReadonlySet<string> = new Set(parseList(process.env.NEXT_PUBLIC_DEV_FEATURE_FLAGS))

/** The client-only sources, merged in once mounted. */
function clientFlags(): string[] {
  return [...buildFlags, ...devCookieFlags()]
}

export function FeatureFlagsProvider({
  children,
  backendFlags = true,
}: {
  children: ReactNode
  /**
   * Fetch the backend's public flag table (default true).
   *
   * Pass `false` on a site whose backend serves no `/system/feature-flags` route — the builds and
   * status boards proxy `/api/*` to their OWN Hono backends, which have no flag table, so the
   * request is a guaranteed 404 on every page load. It was silently swallowed, which made the miss
   * invisible: those boards can only ever be driven by the build-time/cookie overrides above, and
   * saying so here is honest where a 404 an error handler eats is not.
   */
  backendFlags?: boolean
}) {
  // Seeded with the build-time flags (identical on server + client — see `buildFlags`), so an
  // env-driven flag is already Yes at first paint.
  const [flags, setFlags] = useState<ReadonlySet<string>>(buildFlags)
  // Whether the answer is SETTLED. Until it is, a key we haven't seen is `Fetching`, not `No` —
  // that distinction is the whole point of FlagState.
  const [settled, setSettled] = useState(false)

  useEffect(() => {
    let live = true
    if (!backendFlags) {
      // Nothing to wait for: the client-only sources are readable right now, so the set is settled
      // as soon as we've merged the cookie in.
      setFlags(new Set(clientFlags()))
      setSettled(true)
      return
    }
    // `no-store`: the flag set is the live switchboard — a cached answer is a stale gate.
    fetch('/api/system/feature-flags', { cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(String(res.status)))))
      .then((rows: Array<{ key: string; enabled?: boolean }>) =>
        Array.isArray(rows) ? rows.filter((f) => f.enabled === true).map((f) => f.key) : [],
      )
      .catch(() => [] as string[]) // backend down ⇒ no flags ⇒ everything gated stays off
      .then((backendKeys) => {
        if (!live) return
        setFlags(new Set([...backendKeys, ...clientFlags()]))
        setSettled(true)
      })
    return () => {
      live = false
    }
  }, [backendFlags])

  // Memoised: this context sits above the WHOLE shell (header, main, footer) on every site, so a
  // fresh value object each render would re-render every flag consumer on the page.
  const flagState = useCallback(
    (key: string): FlagState =>
      flags.has(key) ? FlagState.Yes : settled ? FlagState.No : FlagState.Fetching,
    [flags, settled],
  )
  const value = useMemo(() => ({ flagState }), [flagState])

  return <FeatureFlagsContext.Provider value={value}>{children}</FeatureFlagsContext.Provider>
}

/** The whole set's reader — for a caller that must ask about SEVERAL keys, or about keys it only
 *  knows at runtime (the auth pages walk a provider list). One key ⇒ {@link useFeatureFlag}. */
export function useFeatureFlags(): FeatureFlagsValue {
  return useContext(FeatureFlagsContext)
}

/** One flag, the common case — see {@link FlagState}: `Yes`, `No`, or `Fetching` while the set is
 *  still in flight. A gate wants {@link useFlagEnabled} instead; reach for this raw state only when
 *  `Fetching` needs an answer of its own. */
export function useFeatureFlag(key: string): FlagState {
  return useContext(FeatureFlagsContext).flagState(key)
}

/** One flag as a GATE — true only on an explicit Yes. The common case by far: show/hide something.
 *  See {@link flagEnabled}. */
export function useFlagEnabled(key: string): boolean {
  return flagEnabled(useFeatureFlag(key))
}
