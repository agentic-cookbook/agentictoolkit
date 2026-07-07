"use client"

import * as React from "react"

import { AlertModal } from "./alert-modal"
import { GUARDED_NAV_ATTR, registerNavigationGuard } from "../lib/navigation-guard"

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
 * - Browser Back/Forward: while dirty, a same-URL sentinel history entry is
 *   pushed so the first Back lands on it (no route change); the confirm is
 *   raised, and discarding re-issues the Back for real. Cost of the
 *   technique: after the page goes clean again the consumed-or-not sentinel
 *   may leave one extra same-URL entry (a second Back press) — the only
 *   reliable way to interpose on popstate without desyncing the app router.
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
  // A same-URL sentinel history entry exists (Back-button interposer).
  const sentinelRef = React.useRef(false)

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
      if (approvedRef.current) return
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
      if (approvedRef.current) return
      // Back consumed the same-URL sentinel, so the app router saw no route
      // change. Ask; discard re-issues the Back for real, stay re-arms.
      sentinelRef.current = false
      void requestConfirm().then((ok) => {
        if (ok) {
          approveBriefly()
          window.history.back()
        } else {
          window.history.pushState(window.history.state, "", window.location.href)
          sentinelRef.current = true
        }
      })
    }

    if (!sentinelRef.current) {
      window.history.pushState(window.history.state, "", window.location.href)
      sentinelRef.current = true
    }
    const unregister = registerNavigationGuard(requestConfirm)
    window.addEventListener("beforeunload", onBeforeUnload)
    window.addEventListener("popstate", onPopState)
    document.addEventListener("click", onClick, true)
    return () => {
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
    <AlertModal
      open={confirm != null}
      destructive
      title="Discard unsaved changes?"
      description="You have unsaved changes. If you leave this page they will be lost."
      confirmLabel="Discard"
      cancelLabel="Stay"
      onConfirm={() => settle(true)}
      onCancel={() => settle(false)}
    />
  )
}
