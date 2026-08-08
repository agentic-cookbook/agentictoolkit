'use client'

import { useSyncExternalStore } from 'react'

// ─────────────────────────────────────────────────────────────────────────────
// Recents store — the last places the user actually landed on, persisted per
// device in localStorage. The hub's recorder writes here (settle-debounced, so
// only the eventual destination is recorded, not each drill-through click); the
// site menu reads here to render its Recents flyout. No backend, no table: recents
// are inherently ephemeral and per-device (see the site-menu recipe).
//
// Follows the platform localStorage conventions: an `adh:` key prefix, an SSR
// guard (`typeof window`), and try/catch that swallows storage failures (private
// mode / quota) so a broken store never breaks the menu — reads just return [].

/** A recorded place: the deep URL to reopen, a human label, and an optional icon
 *  key the caller resolves to a row glyph. `ts` orders newest-first. */
export type RecentPlace = {
  /** The deep URL to reopen (a same-origin path). */
  url: string
  /** Human label for the row (the destination's title). */
  label: string
  /** Optional trailing tagline for the row, in the same slot every other menu row
   *  puts one. What the label cannot say: the label is a route, this is what the
   *  route points AT (the hub records a breadcrumb of the selections it reflects). */
  description?: string
  /** Optional icon key, opaque to this store: whatever identifier the caller's own
   *  icon map is keyed by (e.g. a feature route or a site id). */
  iconKey?: string
  /** When it was recorded (ms epoch); the list is kept newest-first. */
  ts: number
}

const KEY = 'adh:recents'
/** The list is capped; recording past the cap evicts the oldest. */
export const RECENTS_CAP = 10

// A cached snapshot with a STABLE reference between writes, so useSyncExternalStore
// doesn't loop (it compares snapshots by identity). Only reassigned on a real change.
let snapshot: RecentPlace[] = []

/** Read + validate the persisted list (SSR/private-mode/corrupt ⇒ []). */
function readStorage(): RecentPlace[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    // Keep only well-formed entries — a partial/corrupt row never crashes the menu.
    return parsed.filter(
      (r): r is RecentPlace =>
        typeof r === 'object' &&
        r !== null &&
        typeof (r as RecentPlace).url === 'string' &&
        typeof (r as RecentPlace).label === 'string' &&
        typeof (r as RecentPlace).ts === 'number',
    )
  } catch {
    return []
  }
}

function writeStorage(list: RecentPlace[]): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(KEY, JSON.stringify(list))
  } catch {
    // ignore storage failures (private mode, quota) — the in-memory snapshot still
    // reflects the change for this session.
  }
}

// Pub/sub so the menu (via useRecents) re-renders the instant the recorder writes,
// without waiting for the next open. Cross-tab updates arrive via the `storage`
// event wired in `subscribe`.
type Listener = () => void
const listeners = new Set<Listener>()
function emit(): void {
  for (const l of listeners) l()
}

// Hydrate the snapshot once on the client so the first getSnapshot is accurate.
if (typeof window !== 'undefined') snapshot = readStorage()

/** The current recents, newest-first (a stable reference until the next write). */
export function readRecents(): RecentPlace[] {
  return snapshot
}

/** Record a place the user landed on: de-duplicated by URL (an existing entry moves
 *  to the front rather than duplicating), newest-first, capped at {@link RECENTS_CAP}
 *  (evicting the oldest). Safe to call repeatedly — idempotent for the same URL. */
export function recordRecent(place: Omit<RecentPlace, 'ts'>): void {
  const next = [
    { ...place, ts: Date.now() },
    ...snapshot.filter((r) => r.url !== place.url),
  ].slice(0, RECENTS_CAP)
  snapshot = next
  writeStorage(next)
  emit()
}

/** Clear all recents (e.g. on sign-out). */
export function clearRecents(): void {
  snapshot = []
  writeStorage(snapshot)
  emit()
}

function subscribe(listener: Listener): () => void {
  listeners.add(listener)
  // Cross-tab: another tab's write fires a `storage` event here — refresh + notify.
  const onStorage = (e: StorageEvent) => {
    if (e.key !== null && e.key !== KEY) return
    snapshot = readStorage()
    emit()
  }
  window.addEventListener('storage', onStorage)
  return () => {
    listeners.delete(listener)
    window.removeEventListener('storage', onStorage)
  }
}

const EMPTY: RecentPlace[] = []

/**
 * Subscribe a component to the recents list. Server render + first paint yield the
 * empty list (localStorage is client-only) — matching the initial client snapshot
 * pre-hydration, so no mismatch — then updates flow through on write.
 */
export function useRecents(): RecentPlace[] {
  return useSyncExternalStore(subscribe, readRecents, () => EMPTY)
}
