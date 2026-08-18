'use client'

import type { ReactElement, ReactNode } from 'react'
import { usePathname } from 'next/navigation'

export interface PublicProfileEscapeProps {
  /** The tree to render on a principal's profile path: the same children, WITHOUT the gate. */
  ungated: ReactNode
  /** The gated tree — the gate already wrapped around those same children by the caller. */
  children: ReactNode
}

/**
 * The one hole in the `[workspace]` gate, and the only one.
 *
 * `/<slug>/profile` is a page ABOUT a principal and has to be readable by a visitor with no
 * session; every other route under `/<slug>` is that principal's workspace and must not be. Both
 * live under one layout, so one of them has to opt out — and WHICH way round that opt-out points
 * is the whole design.
 *
 * It points this way because the alternative already failed here. The gate was briefly moved DOWN
 * into `[workspace]/[[...path]]/layout.tsx`, leaving `[workspace]/layout.tsx` ungated so that
 * `profile/` — its sibling — would be public. On 39 sites there were no other siblings and it
 * looked correct. On the hub there were 27 more (`settings`, `billing`, `tokens`, `auth`,
 * `all-data`, `members`, `teams`, …), every one of them a static directory with no layout of its
 * own, and every one of them silently became reachable with no auth check, no membership check and
 * no workspace shell. Nothing failed: not the types, not the tests, not the guards. A gate whose
 * default is "open" cannot report the routes it is not covering.
 *
 * So the gate covers the subtree by DEFAULT and this component is the single named exception. The
 * next static directory anyone adds under `[workspace]/` is gated on the day it is created,
 * without anyone remembering to say so.
 *
 * A CLIENT component because the branch is a client-side fact: a layout is not told which of its
 * children matched, so the only thing that can distinguish `/acme/profile` from `/acme/settings`
 * at this level is the pathname the browser is on. The layout renders BOTH trees and hands them
 * over; this picks one. Rendering both costs the gated payload on the profile route and vice
 * versa — the same exposure the gate already had, since it is a client gate and its children were
 * always serialized past it.
 */
export function PublicProfileEscape({ ungated, children }: PublicProfileEscapeProps): ReactElement {
  // Widened, not trusted. `next/navigation`'s .d.ts declares `usePathname(): string`, but the
  // implementation returns `useContext(PathnameContext)` and carries its own comment saying that
  // when that is `null` a compat overload in `next-env.d.ts` changes the return type to include
  // it. So `null` is reachable at runtime while the type says otherwise; the predicate below is
  // what decides, and it decides `false` — gated — for it.
  const pathname: string | null = usePathname()
  return <>{isPrincipalProfilePath(pathname) ? ungated : children}</>
}

/**
 * EXACTLY `/<slug>/profile`, and nothing else.
 *
 * Every path this answers `true` for is a path with no gate on it, so the match is deliberately
 * the narrowest one that admits the route:
 *
 *   - `/acme/profile` → true, the public profile.
 *   - `/acme/settings/profile` → false. Three segments; a gated feature route that happens to end
 *     in the same word is not this route.
 *   - `/acme/profile/edit` → false, for the same reason. There is no such route today, and if one
 *     is ever added it is a page for the profile's OWNER — the last thing that should be public.
 *   - `/acme/Profile` → false. The match is case-SENSITIVE because Next's routing is: only the
 *     literal `profile/` directory serves `/acme/profile`, so `/acme/Profile` resolves to the
 *     catch-all — the gated app — and admitting it here would ungate the app under an alias.
 *
 * Empty segments are dropped, which makes `/acme/profile/` match as well. That is not a way in:
 * with Next's default `trailingSlash: false` the trailing form is redirected to the canonical one
 * before any layout renders, and where it does arrive it is the same route, so it needs the same
 * answer.
 *
 * `null` (and `''`) is FALSE, which means GATED. That direction is not arbitrary: this predicate
 * is the only thing standing between the un-gated tree and every route under `/<slug>`, so an
 * unknown path has to fail toward the gate. Failing the other way would open the whole subtree on
 * exactly the render where we do not know where we are.
 */
function isPrincipalProfilePath(pathname: string | null): boolean {
  if (!pathname) return false
  const segments = pathname.split('/').filter(Boolean)
  return segments.length === 2 && segments[1] === 'profile'
}
