// Shared request/response shaping for the `api/*` clients.
//
// Every generic-CRUD client repeats the same handful of operations: encode an id
// for a URL, drop undefined keys before sending a partial body, narrow a backend
// string to a known union, and scope/sort a list the server returns unfiltered.
// Those four pieces of knowledge live here so each has a single home. (Transport
// + the 409→friendly mapping live alongside in `./http`.)

/** `encodeURIComponent`, aliased for terse path-segment building. */
export const enc = encodeURIComponent;

/**
 * Drop `undefined` keys so a PUT sends a true partial body (and a POST omits
 * absent optionals). `null` is preserved — it is an explicit "clear this column".
 */
export function compact<T extends Record<string, unknown>>(body: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(body).filter(([, v]) => v !== undefined),
  ) as Partial<T>;
}

/**
 * Coerce an arbitrary backend string to one of a known set of literals, falling
 * back when it is not recognized. Replaces hand-rolled `v === "a" || v === "b"`
 * narrowers.
 */
export function narrow<T extends string>(
  value: string,
  allowed: readonly T[],
  fallback: T,
): T {
  return (allowed as readonly string[]).includes(value) ? (value as T) : fallback;
}

/**
 * Generic-CRUD LIST is unscoped, so clients narrow to an owner themselves.
 * Returns the rows unchanged when no owner id is given.
 */
export function scopeByOwner<T>(
  rows: T[],
  ownerId: string | undefined,
  ownerOf: (row: T) => string,
): T[] {
  return ownerId ? rows.filter((r) => ownerOf(r) === ownerId) : rows;
}

/** Locale-aware sort by a string field, without mutating the input array. */
export function sortByText<T>(rows: T[], key: (row: T) => string): T[] {
  return [...rows].sort((a, b) => key(a).localeCompare(key(b)));
}
