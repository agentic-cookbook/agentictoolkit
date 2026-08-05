'use client'

import { type ReactElement, type ReactNode } from 'react'
import { WorkspacePicker } from './WorkspacePicker'
import type { WorkspaceOption } from './WorkspaceOption'

/**
 * The labelled workspace switcher, in a full-width bar directly under the header.
 *
 * Extracted from SiteHomeShell so the hub renders the SAME bar rather than a second copy: the
 * fleet's whole point is that the switcher looks and behaves identically on every site, and the
 * hub is where a user learns what it is. Presentational and data-free — it takes a list, a
 * selection and a callback.
 *
 * The chooser used to be portaled into the header's centre slot above 768px, with this bar as the
 * narrow-only fallback. That arrangement is gone: the header is built by a site's root layout,
 * above the route, so reaching its centre took a context published by a provider the host had to
 * remember to mount — and a host that forgot lost the chooser silently, above 768px only, in
 * production only. One bar the route renders itself has no such precondition and no second copy
 * to keep in step.
 */
export function WorkspaceBar({
  workspaces,
  selected,
  onSelect,
  action,
}: {
  /** The caller's workspaces, or null while the list is still loading. */
  workspaces: readonly WorkspaceOption[] | null
  /** The chosen workspace's slug, or null before resolution. */
  selected: string | null
  onSelect: (slug: string) => void
  /** An optional trailing control — the hub puts "New Organization" here, since org creation is
   *  the hub's alone (its modal, its registries). Feature sites pass nothing, so their bar is the
   *  switcher and nothing else. */
  action?: ReactNode
}): ReactElement {
  return (
    // The visible word is decorative to assistive tech — `aria-hidden`, because the trigger it
    // labels already carries `ariaLabel="Workspace"` (see WorkspacePicker), and a <label> pointing
    // at it would make a screen reader say "Workspace" twice.
    <div className="adh-home__toolbar">
      <span className="adh-home__toolbar-label" aria-hidden>
        Workspace
      </span>
      <WorkspacePicker workspaces={workspaces} selected={selected} onSelect={onSelect} />
      {action}
    </div>
  )
}
