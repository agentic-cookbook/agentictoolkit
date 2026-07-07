// The one navigation-guard registry. Guards (e.g. UnsavedChangesGuard) register
// a callback; code that navigates PROGRAMMATICALLY (router.push from a menu
// handler, a keyboard chooser, a logout flow) awaits confirmNavigation() first.
// With no guard registered it resolves true synchronously, so chrome shared by
// every site pays nothing on pages that don't guard.
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

const guards = new Set<NavigationGuard>()

/** Register a guard; returns the unregister function. */
export function registerNavigationGuard(guard: NavigationGuard): () => void {
  guards.add(guard)
  return () => {
    guards.delete(guard)
  }
}

/** Ask every registered guard; the navigation may proceed only if all allow. */
export async function confirmNavigation(): Promise<boolean> {
  for (const guard of guards) {
    if (!(await guard())) return false
  }
  return true
}
