'use client'

import type { ReactElement, ReactNode } from 'react'
import type { SiteId } from '@agentic-toolkit/adh-registry'
import { siteUrl } from '@agentic-toolkit/adh-registry'
import { UserCard } from '@agentic-toolkit/ui/blocks/user-card'
import type { ProfilePrincipal } from './types'
import { useViewerPrincipal } from './useViewerPrincipal'

export interface ProfileViewProps {
  principal: ProfilePrincipal
  /** The site this profile is being viewed ON, which decides whether the Full Profile link
   *  renders. Passed as a plain string from the server page rather than read from the site config
   *  here: a config is a SERVER-graph module (`site/SiteConfig`) and importing it from this
   *  client component would drag `research`'s sitemap reads into a browser bundle. */
  siteId: SiteId
  /** This site's own public section, or nothing. */
  children?: ReactNode
}

/**
 * A principal's profile, in the arrangement every site in the fleet shares:
 *
 *   [ standard header — avatar, name, general public info ]
 *   [ this site's own section, or nothing ]
 *   [ Full Profile → the hub, unless this IS the hub ]
 *
 * Lives in `@agentic-toolkit/adh` rather than `packages/ui` because it has to know site ids and
 * which one is the hub, and `ui` is the generic layer that must not.
 *
 * The header is `<UserCard>` unchanged — it already renders exactly what "general public info"
 * means here, and the backend has already removed every row the viewer may not see, so this
 * component makes no visibility decision of its own. It renders what it was handed.
 *
 * The one thing it does on its own is the second layer of the two-layer resolution: it runs
 * `useViewerPrincipal` over the principal it was given and renders the wider answer if one
 * arrives. That lives HERE, rather than in each of the six consumers, so every one of them gets
 * the signed-in widening without an API change — the prop stays "the principal you resolved",
 * and whether the viewer is entitled to more is this component's business, not theirs. The seed
 * is always a valid render, so a failed or absent upgrade simply leaves the anonymous view
 * standing.
 */
export function ProfileView({ principal, siteId, children }: ProfileViewProps): ReactElement {
  // Never null: `useViewerPrincipal` returns its seed until an upgrade lands, and the seed here
  // is a required prop. The `??` is for the type, not for a case that can occur.
  const shown = useViewerPrincipal(principal.slug, principal) ?? principal

  // On the hub there is no link: the hub's profile IS the full profile, so a link back to itself
  // would be a link to the page the visitor is already on.
  const fullProfileHref =
    siteId === 'hub'
      ? null
      : siteUrl(
          'hub',
          `/${encodeURIComponent(shown.slug)}`,
          // globalThis, not `window`: this module is typechecked without the dom lib in some
          // consumers, where a bare `window` is TS2304 even behind a typeof guard.
          (globalThis as { location?: { hostname?: string } }).location?.hostname ?? '',
        )

  return (
    <main className="mx-auto max-w-2xl px-4 py-16 sm:px-6">
      <UserCard user={shown} />
      {/* The org's own blurb. Users have no equivalent, so this renders for organizations only —
          it is the "any public facing general info" half of the standardized header, and dropping
          it would show an org's profile without the one sentence the org wrote about itself. */}
      {shown.description && (
        <p className="mt-4 text-apt-text-muted">{shown.description}</p>
      )}
      {children}
      {fullProfileHref && (
        <div className="mt-8 text-center">
          {/* A plain <a>, not next/link: the target is a different origin in every environment,
              so client-side routing cannot serve it. */}
          <a
            href={fullProfileHref}
            className="text-sm text-apt-text-muted underline underline-offset-4 hover:text-apt-text"
          >
            Full Profile
          </a>
        </div>
      )}
    </main>
  )
}
