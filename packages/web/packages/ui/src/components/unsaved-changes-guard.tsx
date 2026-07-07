"use client"

import * as React from "react"

import { AlertModal } from "./alert-modal"

export interface UnsavedChangesGuardProps {
  /** Guard is active — there are unsaved changes on the page. */
  when: boolean
  title?: string
  description?: string
  confirmLabel?: string
  cancelLabel?: string
  /**
   * Perform the navigation after the user confirms discarding. Defaults to a
   * full `window.location.assign(href)`; pass the app router's push to keep
   * the navigation client-side (e.g. `(href) => router.push(href)`).
   */
  onNavigate?: (href: string) => void
}

/**
 * Blocks leaving the page while `when` is true. Two exits are guarded:
 *
 * - Hard navigation (reload / tab close / external link) via `beforeunload` —
 *   the browser shows its native leave prompt.
 * - In-app link clicks: a capture-phase document listener intercepts plain
 *   left-clicks on same-origin anchors before the framework's router handler
 *   runs, and raises the platform AlertModal confirm instead. Confirming
 *   navigates via `onNavigate`; cancelling stays put.
 *
 * Programmatic navigation (router.push from the consumer's own code) is not
 * intercepted — code that navigates while dirty is expected to consult its
 * own state first.
 */
export function UnsavedChangesGuard({
  when,
  title = "Discard unsaved changes?",
  description = "You have unsaved changes. If you leave this page they will be lost.",
  confirmLabel = "Discard",
  cancelLabel = "Stay",
  onNavigate,
}: UnsavedChangesGuardProps): React.ReactElement {
  const [pendingHref, setPendingHref] = React.useState<string | null>(null)
  // Set once the user confirms, so the beforeunload guard doesn't re-prompt on
  // the very navigation it just approved (the default assign() unloads the page).
  const approvedRef = React.useRef(false)

  React.useEffect(() => {
    if (!when) return
    approvedRef.current = false

    function onBeforeUnload(e: BeforeUnloadEvent): void {
      if (approvedRef.current) return
      e.preventDefault()
    }

    function onClick(e: MouseEvent): void {
      if (e.defaultPrevented) return
      if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
      const target = e.target instanceof Element ? e.target : null
      const anchor = target?.closest<HTMLAnchorElement>("a[href]")
      if (!anchor) return
      if (anchor.target && anchor.target !== "_self") return
      if (anchor.hasAttribute("download")) return
      const url = new URL(anchor.href, window.location.href)
      // Cross-origin links unload the page — beforeunload already covers them.
      if (url.origin !== window.location.origin) return
      // Same-page hash hops don't destroy any state.
      if (
        url.pathname === window.location.pathname &&
        url.search === window.location.search &&
        url.hash !== ""
      ) return
      e.preventDefault()
      e.stopPropagation()
      setPendingHref(url.pathname + url.search + url.hash)
    }

    window.addEventListener("beforeunload", onBeforeUnload)
    document.addEventListener("click", onClick, true)
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload)
      document.removeEventListener("click", onClick, true)
    }
  }, [when])

  function confirmLeave(): void {
    const href = pendingHref
    setPendingHref(null)
    if (href == null) return
    approvedRef.current = true
    if (onNavigate) onNavigate(href)
    else window.location.assign(href)
  }

  return (
    <AlertModal
      open={pendingHref != null}
      destructive
      title={title}
      description={description}
      confirmLabel={confirmLabel}
      cancelLabel={cancelLabel}
      onConfirm={confirmLeave}
      onCancel={() => setPendingHref(null)}
    />
  )
}
