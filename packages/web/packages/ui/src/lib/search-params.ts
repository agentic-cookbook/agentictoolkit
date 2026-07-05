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
}
