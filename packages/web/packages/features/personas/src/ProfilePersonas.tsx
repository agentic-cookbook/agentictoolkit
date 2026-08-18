'use client'

import type { ReactElement } from 'react'
import type { ProfilePrincipal } from '@agentic-toolkit/adh/profile'
import { registryUserPersonaPath, siteUrl } from '@agentic-toolkit/adh-registry'

/**
 * This site's section of a principal's profile at `/<slug>/profile` — declared as
 * `profileSection` on `frontend/src/sites/personas/src/home-model.tsx` (the `SiteHomeModel`
 * field documented in `@agentic-toolkit/adh/home`).
 *
 * `ProfileView` (`packages/web/packages/adh/src/profile/ProfileView.tsx:84`) renders `UserCard`
 * directly above whatever this returns, and `UserCard` already draws a `Personas` section
 * (`packages/web/packages/ui/src/blocks/user-card.tsx:333-360`) listing each persona's `name`, a
 * `Badge` for its `visibility`, and its `description`. Repeating those here would be the same
 * list twice, one scroll apart, so this section renders what the card does NOT: each persona's
 * public ADDRESS — where to go and read it. That is genuinely this site's own contribution; the
 * card states attributes, this says where.
 *
 * Fetches nothing: `principal.personas` is already part of the public card both principal
 * endpoints return (`UserCardDto.personas`, `user-card.tsx:62`), and `ProfilePrincipal.personas`
 * carries it through non-optionally, so there is no data layer to add for a roster already in the
 * prop. The roster is already audience-filtered by the backend, so this renders every entry it
 * was handed and makes no visibility decision of its own — in particular it does NOT filter on
 * `visibility` to try to guess which links will resolve.
 *
 * A persona is not addressable on THIS site — agenticdeveloperpersonas.com is where personas are
 * defined (its registry entry reads `description: 'Define your personas'`,
 * `packages/web/packages/adh-registry/src/sites/registry.ts:221`), not where they are read.
 * Public personas are read on `personaregistry` (`agenticpersonaregistry.com`), so the link is
 * built with that package's own helpers rather than a hand-rolled host or path:
 * `registryUserPersonaPath` (`registry.ts:907`) is "the address that says whose it is" — the
 * owner-scoped form `/<owner>/<persona>` — and `siteUrl` (`registry.ts:933`) resolves the right
 * host for the current environment (local suite / testing / staging / prod).
 *
 * Reads `location.hostname` off `globalThis` rather than `window`, mirroring
 * `personaProfileUrl`'s own comment (`registry.ts:926-930`): this pattern is shared with contexts
 * that have no dom lib, where a bare `window` reference is TS2304 even behind a typeof guard.
 *
 * A link built this way is not a promise the recipient can open it — a `hub`-visibility persona
 * resolves for a signed-in viewer and 404s for an anonymous one. That is carried over from
 * `personaProfileUrl`'s own caveat and applies here verbatim; it is not corrected by filtering the
 * roster, since the backend already audience-filtered what it returned.
 */
export function ProfilePersonas({ principal }: { principal: ProfilePrincipal }): ReactElement {
  const personas = principal.personas
  const subject = principal.kind === 'organization' ? 'This organization' : 'This user'
  if (personas.length === 0) {
    return (
      <section className="mt-8">
        <p className="text-sm text-apt-text-muted">{subject} has no public personas.</p>
      </section>
    )
  }
  // globalThis, not `window`: see the docblock above.
  const hostname = (globalThis as { location?: { hostname?: string } }).location?.hostname ?? ''
  return (
    <section className="mt-8">
      <h2 className="mb-3 font-mono text-[0.6rem] uppercase tracking-[0.1em] text-apt-text-dim">
        Public personas
      </h2>
      <ul className="space-y-2">
        {personas.map((p) => (
          <li
            key={p.slug}
            className="rounded-lg border border-apt-border bg-apt-surface px-4 py-3"
          >
            <div className="font-medium text-apt-text">{p.name}</div>
            <a
              href={siteUrl(
                'personaregistry',
                registryUserPersonaPath(principal.slug, p.slug),
                hostname,
              )}
              className="text-sm text-apt-text-muted underline underline-offset-4 hover:text-apt-text"
            >
              View persona
            </a>
          </li>
        ))}
      </ul>
    </section>
  )
}
