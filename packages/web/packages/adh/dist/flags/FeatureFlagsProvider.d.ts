import { type ReactNode } from 'react';
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
export declare const FlagState: {
    readonly Yes: "yes";
    readonly No: "no";
    readonly Fetching: "fetching";
};
export type FlagState = (typeof FlagState)[keyof typeof FlagState];
/**
 * The GATE answer for one state: only an explicit Yes shows a gated thing — `Fetching` and `No`
 * both read as hidden, so nothing flashes in and back out.
 *
 * The one authoritative spelling of that convention. It was briefly copied into each call site as a
 * local `flagOn` helper; three copies of a rule is how the rule drifts.
 */
export declare function flagEnabled(state: FlagState): boolean;
interface FeatureFlagsValue {
    /** What is known about one flag. The ONLY way to ask: the raw key set is deliberately not
     *  exposed, because `set.has(key)` is false-while-fetching and would reproduce exactly the
     *  off-vs-not-yet ambiguity FlagState exists to remove. */
    flagState: (key: string) => FlagState;
}
export declare function FeatureFlagsProvider({ children, backendFlags, }: {
    children: ReactNode;
    /**
     * Fetch the backend's public flag table (default true).
     *
     * Pass `false` on a site whose backend serves no `/system/feature-flags` route — the builds and
     * status boards proxy `/api/*` to their OWN Hono backends, which have no flag table, so the
     * request is a guaranteed 404 on every page load. It was silently swallowed, which made the miss
     * invisible: those boards can only ever be driven by the build-time/cookie overrides above, and
     * saying so here is honest where a 404 an error handler eats is not.
     */
    backendFlags?: boolean;
}): import("react").JSX.Element;
/** The whole set's reader — for a caller that must ask about SEVERAL keys, or about keys it only
 *  knows at runtime (the auth pages walk a provider list). One key ⇒ {@link useFeatureFlag}. */
export declare function useFeatureFlags(): FeatureFlagsValue;
/** One flag, the common case — see {@link FlagState}: `Yes`, `No`, or `Fetching` while the set is
 *  still in flight. A gate wants {@link useFlagEnabled} instead; reach for this raw state only when
 *  `Fetching` needs an answer of its own. */
export declare function useFeatureFlag(key: string): FlagState;
/** One flag as a GATE — true only on an explicit Yes. The common case by far: show/hide something.
 *  See {@link flagEnabled}. */
export declare function useFlagEnabled(key: string): boolean;
export {};
//# sourceMappingURL=FeatureFlagsProvider.d.ts.map