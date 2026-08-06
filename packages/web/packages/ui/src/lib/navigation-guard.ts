// The one navigation-guard registry. Guards (e.g. UnsavedChangesGuard) register
// a callback; code that navigates PROGRAMMATICALLY (router.push from a menu
// handler, a keyboard chooser, a logout flow) awaits confirmNavigation() first.
// With no guard registered it resolves true synchronously, so chrome shared by
// every site pays nothing on pages that don't guard.
//
// THE PRIMARY RULE. Several guards are armed at once whenever two independently
// mounted surfaces are both dirty — hub's root layout renders the user-settings
// overlay's guard as a SIBLING of the workspace chrome's, and each publishes its
// own dirtiness. One navigation is one decision, so it raises exactly ONE
// confirm: the FIRST guard still registered (insertion order, which a Set keeps)
// is the primary, and confirmNavigation() asks it alone and returns its answer.
// That is sound because the prompt is generic — "you have unsaved changes, if
// you leave they will be lost" — and Discard means leave and discard EVERYTHING,
// not just this surface. Asking the rest would be asking the same question again.
//
// The primary also owns the Back-button sentinel and the popstate response, so
// Back takes one press and prompts once (see UnsavedChangesGuard). Non-primary
// guards keep their beforeunload listener — the browser coalesces those into one
// native prompt — and their click listener, whose `if (e.defaultPrevented)`
// early return lets the primary's preventDefault de-dupe the anchor path.
//
// Primary status is live, not latched: subscribeNavigationGuards() fires on every
// membership change so a survivor can take over (and arm its own sentinel) the
// moment the primary unregisters.
//
// Anchor clicks are intercepted by UnsavedChangesGuard's document listener
// instead — a component whose anchor handler ALSO navigates programmatically
// (so it would be double-prompted) opts out of the click interception by
// setting GUARDED_NAV_ATTR on the anchor and calling confirmNavigation() in
// its own handler.

/** Attribute an anchor sets to say "my handler consults confirmNavigation()
 *  itself — don't click-intercept me". */
export const GUARDED_NAV_ATTR = "data-guarded-nav"

/** Resolve true to allow the navigation, false to block it. */
export type NavigationGuard = () => boolean | Promise<boolean>

// Insertion-ordered by construction, which is what makes "the first one" a
// stable, cheap definition of the primary.
const guards = new Set<NavigationGuard>()
const membershipListeners = new Set<() => void>()

function notifyMembershipChanged(): void {
  // Snapshot: a listener may register or unregister a guard in response.
  for (const listener of [...membershipListeners]) listener()
}

/** Register a guard; returns the unregister function. */
export function registerNavigationGuard(guard: NavigationGuard): () => void {
  if (guards.has(guard)) return () => {}
  guards.add(guard)
  notifyMembershipChanged()
  return () => {
    if (guards.delete(guard)) notifyMembershipChanged()
  }
}

/**
 * True when `guard` is the primary — the first still-registered guard, the one
 * that owns the single confirm, the Back sentinel and the popstate response.
 */
export function isPrimaryNavigationGuard(guard: NavigationGuard): boolean {
  const first = guards.values().next()
  return !first.done && first.value === guard
}

/** Subscribe to registry membership changes (i.e. to primary handover); returns
 *  the unsubscribe function. */
export function subscribeNavigationGuards(listener: () => void): () => void {
  membershipListeners.add(listener)
  return () => {
    membershipListeners.delete(listener)
  }
}

/** Ask the primary guard; the navigation may proceed only if it allows. With no
 *  guard registered this returns true without awaiting anything. */
export async function confirmNavigation(): Promise<boolean> {
  const first = guards.values().next()
  if (first.done) return true
  return await first.value()
}

// THE SAVE-THEN-LEAVE HOLE. A guard reads one signal — "this surface is dirty" —
// and infers from it the thing it actually cares about, "leaving now would lose
// work". The two come apart in exactly one place: the instant a save resolves and
// navigates. The draft still differs from the entity the form was handed (React
// has not re-rendered, and on a slug rename it never will — the page is leaving),
// so `when` is still true and the guard vetoes an exit that loses nothing. The
// user is left on a URL that no longer resolves.
//
// Dirtiness cannot answer this on its own: "the draft differs from what I was
// given" is true of an abandoned edit and a just-persisted one alike. Only the
// code that awaited the write knows which, so it says so.
//
// Module-scoped because one navigation is one decision (see THE PRIMARY RULE) —
// an approval has to reach the sibling guards whose beforeunload listeners would
// otherwise coalesce into the same native prompt.

/** Wall-clock ms until the current approval lapses, or 0 for none. */
let approvedUntil = 0

/**
 * Declare that the navigation about to be started follows a COMPLETED save, so no
 * guard should challenge it. Call it immediately before navigating — never on a
 * write that might still fail, and never to silence a prompt that is telling the
 * truth.
 *
 * Self-expiring, and deliberately not a token to be released: the two exits it
 * covers (unload, popstate) both end this document, so nothing would run the
 * release. `windowMs` need only outlive the synchronous hop to the browser's
 * navigation; a client-side push leaves the page mounted and re-arms the guard as
 * soon as it lapses.
 */
export function approveNavigation(windowMs = 1000): void {
  approvedUntil = Date.now() + windowMs
}

/** True while an {@link approveNavigation} window is open. */
export function isNavigationApproved(): boolean {
  return Date.now() < approvedUntil
}
