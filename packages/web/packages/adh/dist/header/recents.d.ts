/** A recorded place: the deep URL to reopen, a human label, and an optional icon
 *  key the caller resolves to a row glyph. `ts` orders newest-first. */
export type RecentPlace = {
    /** The deep URL to reopen (a same-origin path). */
    url: string;
    /** Human label for the row (the destination's title). */
    label: string;
    /** Optional trailing tagline for the row, in the same slot every other menu row
     *  puts one. What the label cannot say: the label is a route, this is what the
     *  route points AT (the hub records a breadcrumb of the selections it reflects). */
    description?: string;
    /** Optional icon key, opaque to this store: whatever identifier the caller's own
     *  icon map is keyed by (e.g. a feature route or a site id). */
    iconKey?: string;
    /** When it was recorded (ms epoch); the list is kept newest-first. */
    ts: number;
};
/** The list is capped; recording past the cap evicts the oldest. */
export declare const RECENTS_CAP = 10;
/** The current recents, newest-first (a stable reference until the next write). */
export declare function readRecents(): RecentPlace[];
/** Record a place the user landed on: de-duplicated by URL (an existing entry moves
 *  to the front rather than duplicating), newest-first, capped at {@link RECENTS_CAP}
 *  (evicting the oldest). Safe to call repeatedly — idempotent for the same URL. */
export declare function recordRecent(place: Omit<RecentPlace, 'ts'>): void;
/** Clear all recents (e.g. on sign-out). */
export declare function clearRecents(): void;
/**
 * Subscribe a component to the recents list. Server render + first paint yield the
 * empty list (localStorage is client-only) — matching the initial client snapshot
 * pre-hydration, so no mismatch — then updates flow through on write.
 */
export declare function useRecents(): RecentPlace[];
//# sourceMappingURL=recents.d.ts.map