import type { ReactNode } from 'react'
import { SITE_SWITCH_HASH } from '@agentic-toolkit/adh-registry'
import { SiteNotFound as AdhSiteNotFound } from '@agentic-toolkit/adh/layout'

export type SiteSwitchNotFoundProps = {
  /** The normal 404 UI to show when this isn't a site-switch up-walk. */
  children?: ReactNode
}

/**
 * Shared `not-found` body — see `@agentic-toolkit/adh/layout`'s `SiteNotFound` for the up-walk
 * behaviour.
 *
 * The adh seam: the toolkit component takes the marker fragment as a `siteSwitchHash` prop
 * (the toolkit cannot know adh's site-switch protocol); this wrapper supplies
 * `SITE_SWITCH_HASH` from `@agentic-toolkit/adh-registry` so the ~41 `app/not-found.tsx` call
 * sites keep rendering this component with nothing but their optional 404 body.
 *
 * Named `SiteSwitchNotFound` rather than `SiteNotFound`: this barrel already publishes a
 * `SiteNotFound` (the registry-free primitive above, which this component wraps). The two are
 * unrelated components that happened to share a name.
 *
 * No 'use client' here: this is a props-only pass-through with no hooks, and the toolkit
 * component carries its own directive. Leaving it off keeps a server `not-found.tsx` a server
 * component right up to the real client boundary.
 */
export function SiteSwitchNotFound({ children }: SiteSwitchNotFoundProps) {
  return <AdhSiteNotFound siteSwitchHash={SITE_SWITCH_HASH}>{children}</AdhSiteNotFound>
}
