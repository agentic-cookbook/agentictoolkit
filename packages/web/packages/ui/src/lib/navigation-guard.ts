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
