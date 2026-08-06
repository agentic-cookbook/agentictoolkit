"use client"

import * as React from "react"

import { UnsavedChangesAlert } from "./unsaved-changes-alert"
import {
  GUARDED_NAV_ATTR,
  isNavigationApproved,
  isPrimaryNavigationGuard,
  registerNavigationGuard,
  subscribeNavigationGuards,
} from "../lib/navigation-guard"

export interface UnsavedChangesGuardProps {
  /** Guard is active — there are unsaved changes on the page. */
  when: boolean
  /**
   * Perform the navigation after the user confirms discarding. Defaults to a
   * full `window.location.assign(href)`; pass the app router's push to keep
   * the navigation client-side (e.g. `(href) => router.push(href)`).
   */
  onNavigate?: (href: string) => void
}

/**
 * Blocks leaving the page while `when` is true. Four exits are guarded:
 *
 * - Hard navigation (reload / tab close / external link) via `beforeunload` —
 *   the browser shows its native leave prompt.
 * - In-app link clicks: a capture-phase document listener intercepts plain
 *   left-clicks on same-origin anchors before the framework's router handler
 *   runs, and raises the platform AlertModal confirm instead. Confirming
 *   navigates via `onNavigate`; cancelling stays put. Anchors marked with
 *   `GUARDED_NAV_ATTR` are skipped — their own handlers consult
 *   `confirmNavigation()` (lib/navigation-guard) instead.
 * - Programmatic navigation that opts in: this component registers itself
 *   with the navigation-guard registry, so chrome that calls
 *   `router.push` (menus, choosers, logout) awaits `confirmNavigation()`
 *   and raises the same confirm.
 * - Browser Back/Forward: while armed and PRIMARY, a same-URL sentinel entry is
 *   pushed so the first Back lands on it (no route change); the confirm is
 *   raised, and discarding re-issues the Back for real. The sentinel is
 *   remembered by the URL it was pushed for, not by a bare "already pushed"
 *   flag: a long-lived mount (the hub's workspace chrome, StandaloneRailHost)
 *   outlives many routes, so re-arming somewhere it has not armed yet has to
 *   push a fresh sentinel, while re-arming at the SAME url must not stack a
 *   second one (that would cost the user two Back presses). Cost of the
 *   technique: after the page goes clean again the consumed-or-not sentinel
 *   may leave one extra same-URL entry — the only reliable way to interpose
 *   on popstate without desyncing the app router.
 *
 * Several of these can be armed at once (hub's root layout mounts the settings
 * overlay's guard as a sibling of the workspace chrome's), and one navigation
 * still gets one confirm. The registry's first-registered guard is the primary;
 * it alone answers `confirmNavigation()`, arms the sentinel and responds to
 * popstate — see lib/navigation-guard for why one generic "discard everything"
 * prompt is the whole answer. The others stay useful without prompting: their
 * `beforeunload` listeners coalesce into the browser's one native prompt, and
 * their click listeners bail on `defaultPrevented` once the primary has
 * intercepted the anchor. Primary status is live, so if the primary disarms
 * while this one is still dirty, this one takes over and arms a sentinel.
 *
 * A surface that navigates as the LAST step of a successful save calls
 * `approveNavigation()` (lib/navigation-guard) first: `when` is still true at
 * that instant — the draft has been persisted, not re-rendered — and every armed
 * guard, this one included, would otherwise veto an exit that loses nothing.
 */
export function UnsavedChangesGuard({
  when,
  onNavigate,
}: UnsavedChangesGuardProps): React.ReactElement {
  // The pending confirm: a link href to navigate to on confirm, or a bare
  // resolver when the requester (registry guard / popstate) owns the follow-up.
  const [confirm, setConfirm] = React.useState<{
    href?: string
    resolve?: (ok: boolean) => void
  } | null>(null)
  // Set while a navigation this guard already approved is underway, so the
  // beforeunload guard doesn't re-prompt on the unload it just allowed.
  const approvedRef = React.useRef(false)
  const approvalTimerRef = React.useRef<number | undefined>(undefined)
  // The URL a live sentinel history entry was pushed for, or null for none.
  // Keyed by URL rather than a boolean because this component's `when` cycles
  // many times per mount and the page moves underneath it: a stale sentinel
  // from a route we have since left must not be mistaken for a live one.
  const sentinelRef = React.useRef<string | null>(null)

  /** Approve the imminent navigation, self-expiring: long enough for the
   *  unload/back it covers to fire, short enough that a client-side push
   *  (no unload) re-arms the guard while the page stays mounted and dirty. */
  const approveBriefly = React.useCallback((): void => {
    approvedRef.current = true
    window.clearTimeout(approvalTimerRef.current)
    approvalTimerRef.current = window.setTimeout(() => {
      approvedRef.current = false
    }, 1000)
  }, [])

  /** Raise the confirm dialog; resolves the caller's promise on user choice. */
  const requestConfirm = React.useCallback((): Promise<boolean> => {
    return new Promise<boolean>((resolve) => {
      setConfirm({ resolve })
    })
  }, [])

  React.useEffect(() => {
    if (!when) return
    approvedRef.current = false

    function onBeforeUnload(e: BeforeUnloadEvent): void {
      if (approvedRef.current || isNavigationApproved()) return
      e.preventDefault()
      // Chromium < 119 and some WebKit builds only honour returnValue.
      e.returnValue = ""
    }

    function onClick(e: MouseEvent): void {
      if (e.defaultPrevented) return
      if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
      const target = e.target instanceof Element ? e.target : null
      const anchor = target?.closest<HTMLAnchorElement>("a[href]")
      if (!anchor) return
      if (anchor.target && anchor.target !== "_self") return
      if (anchor.hasAttribute("download")) return
      // The anchor's own handler consults confirmNavigation() — don't double-prompt.
      if (anchor.hasAttribute(GUARDED_NAV_ATTR)) return
      let url: URL
      try {
        url = new URL(anchor.href, window.location.href)
      } catch {
        return // unparseable href can't navigate anywhere real
      }
      // Cross-origin links unload the page — beforeunload already covers them.
      if (url.origin !== window.location.origin) return
      // Same-page destinations (self-links, hash hops, href="#") destroy no
      // state — let them through untouched.
      if (
        url.pathname === window.location.pathname &&
        url.search === window.location.search
      ) return
      // preventDefault (NOT stopPropagation): the framework Link bails on a
      // defaulted event, while the anchor's other handlers (menu close-on-
      // select, analytics) still run.
      e.preventDefault()
      setConfirm({ href: url.pathname + url.search + url.hash })
    }

    function onPopState(): void {
      if (approvedRef.current || isNavigationApproved()) return
      // Only the primary interposes on Back — it is the only guard that armed a
      // sentinel, so it is the only one whose popstate is the sentinel's. Read
      // live rather than closing over it: the primary can change under us.
      if (!isPrimaryNavigationGuard(requestConfirm)) return
      // Back consumed the same-URL sentinel, so the app router saw no route
      // change. Ask; discard re-issues the Back for real, stay re-arms.
      sentinelRef.current = null
      void requestConfirm().then((ok) => {
        if (ok) {
          approveBriefly()
          window.history.back()
        } else {
          window.history.pushState(window.history.state, "", window.location.href)
          sentinelRef.current = window.location.href
        }
      })
    }

    /** Arm the Back interposer, but only while this guard is the primary — one
     *  sentinel per navigation, so Back costs one press and prompts once. */
    function armSentinel(): void {
      if (!isPrimaryNavigationGuard(requestConfirm)) return
      if (sentinelRef.current === window.location.href) return
      window.history.pushState(window.history.state, "", window.location.href)
      sentinelRef.current = window.location.href
    }

    const unregister = registerNavigationGuard(requestConfirm)
    // Re-arm on every membership change: when the primary disarms mid-edit this
    // guard may inherit the role with no sentinel of its own, and Back must not
    // be left unguarded in the gap.
    const unsubscribe = subscribeNavigationGuards(armSentinel)
    armSentinel()
    window.addEventListener("beforeunload", onBeforeUnload)
    window.addEventListener("popstate", onPopState)
    document.addEventListener("click", onClick, true)
    return () => {
      // Unsubscribe first: our own unregister must not call back into armSentinel.
      unsubscribe()
      unregister()
      window.removeEventListener("beforeunload", onBeforeUnload)
      window.removeEventListener("popstate", onPopState)
      document.removeEventListener("click", onClick, true)
    }
  }, [when, requestConfirm, approveBriefly])

  function settle(ok: boolean): void {
    const current = confirm
    setConfirm(null)
    if (!current) return
    if (ok) approveBriefly() // the caller (or the branch below) navigates now
    current.resolve?.(ok)
    if (!ok || current.href == null) return
    if (onNavigate) onNavigate(current.href)
    else window.location.assign(current.href)
  }

  return (
    <UnsavedChangesAlert
      open={confirm != null}
      onDiscard={() => settle(true)}
      onStay={() => settle(false)}
    />
  )
}
