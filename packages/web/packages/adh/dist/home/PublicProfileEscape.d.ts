import type { ReactElement, ReactNode } from 'react';
export interface PublicProfileEscapeProps {
    /** The tree to render on a principal's profile path: the same children, WITHOUT the gate. */
    ungated: ReactNode;
    /** The gated tree — the gate already wrapped around those same children by the caller. */
    children: ReactNode;
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
export declare function PublicProfileEscape({ ungated, children }: PublicProfileEscapeProps): ReactElement;
//# sourceMappingURL=PublicProfileEscape.d.ts.map