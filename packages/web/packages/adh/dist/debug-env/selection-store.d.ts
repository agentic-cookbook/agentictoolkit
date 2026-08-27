/**
 * Resolve a raw stored value against the ids currently on offer. Pure — the single
 * validation point shared by {@link usePersistedSelection} and its tests.
 *
 *  - `null` (nothing stored) → `fallback`: the console's own default, for a first visit.
 *  - `''` (stored deselect) → `null`: the user cleared this level; honor it.
 *  - a known id → that id.
 *  - a STALE id (theme deleted, area renamed, chat config withdrawn) → `fallback`,
 *    so a selection that no longer exists can never leave the stack pointing at nothing.
 */
export declare function resolveStoredSelection(raw: string | null, isValid: (id: string) => boolean, fallback: string | null): string | null;
/**
 * `useState` for one level's selection, restored from and written through to localStorage.
 *
 * `isValid` and `fallback` are consulted ONLY by the lazy initializer, i.e. on the first
 * render after the window is shown. That is what makes it safe for a validator to close
 * over a sibling selection restored moments earlier in the same component (the Site-theme
 * branch validates its stored item against its restored area) — by the time a later render
 * could pass a staler closure, the value is already resolved and never re-read.
 */
export declare function usePersistedSelection<T extends string>(key: string, isValid: (id: string) => boolean, fallback: T | null): [T | null, (next: T | null) => void];
//# sourceMappingURL=selection-store.d.ts.map