// Framework-agnostic URL search-param mirroring via window.location + history.replaceState — the
// single representation of the "read a ?key= on mount, mirror it on change without a reload or a
// history-stack entry" idiom that was hand-rolled in the community board and the persona-registry
// settings app. Deliberately NOT the Next-router mechanism (that lives in ListWithDetailsPane's
// `paramKey`): these callers own their own routing and only need to reflect state into the URL.

/** Read a URL search param from the current location. Client-only: returns null on the server (so
 *  it is safe to call in a `useState` initializer of a component that only mounts client-side). */
export function readSearchParam(key: string): string | null {
  if (typeof window === "undefined") return null;
  return new URLSearchParams(window.location.search).get(key);
}

/**
 * Mirror one or more search params into the URL via `history.replaceState` — a non-null value SETS
 * the param, null (or empty) DELETES it. No reload, no new history entry (a filter click / tab
 * switch shouldn't spam Back). Client-only (a no-op on the server).
 */
export function writeSearchParams(next: Record<string, string | null>): void {
  if (typeof window === "undefined") return;
  const url = new URL(window.location.href);
  for (const [key, value] of Object.entries(next)) {
    if (value) url.searchParams.set(key, value);
    else url.searchParams.delete(key);
  }
  window.history.replaceState(null, "", url);
  notify();
}

/* ── Watching the params ──────────────────────────────────────────────────────
 *
 * `history.replaceState` fires NOTHING — not `popstate`, not `hashchange` — so a param written by
 * one component is invisible to another reading the same key. That was fine while every caller both
 * wrote and read its own param, and stops being fine the moment the writer and the reader are two
 * components (a command palette naming a row; the pane that opens it). This is the missing signal,
 * and it stays here rather than in a React file so the store keeps no framework dependency —
 * `useSearchParam` in ../hooks is the thin subscriber on top.
 *
 * `popstate` is folded in for the same reason: Back and Forward change the same params, and a reader
 * that ignored them would keep showing what the user just navigated away from. */

type Listener = () => void;

const listeners = new Set<Listener>();

function notify(): void {
  // A copy, so a listener that unsubscribes itself while reacting can't skip the next one.
  for (const listener of [...listeners]) listener();
}

/**
 * Subscribe to search-param changes: every {@link writeSearchParams} call, plus the browser's own
 * Back/Forward. Returns the unsubscribe. Client-only — on the server it is inert (and returns a
 * no-op) rather than throwing, so a component may call it unconditionally.
 *
 * NOT a change DIFF: a listener fires on every write, including one that set the same value it
 * already had. Compare in the reader — {@link readSearchParam} returns a primitive, so
 * `useSyncExternalStore`'s own equality check does it for free.
 */
export function subscribeToSearchParams(listener: Listener): () => void {
  if (typeof window === "undefined") return () => {};
  // The `popstate` binding is refcounted by the listener set: attached with the first subscriber,
  // removed with the last, so a page that never watches params never carries a listener.
  if (listeners.size === 0) window.addEventListener("popstate", notify);
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) window.removeEventListener("popstate", notify);
  };
}
