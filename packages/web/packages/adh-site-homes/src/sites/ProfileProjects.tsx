import type { ReactElement } from 'react'
import type { ProfilePrincipal } from '@agentic-toolkit/adh/profile'

/**
 * This site's section of a principal's profile at `/<slug>/profile` — declared as
 * `profileSection` on `home-model.tsx` (the `SiteHomeModel` field documented in
 * `@agentic-toolkit/adh/home`).
 *
 * Lives here, in the site, rather than in `@agentic-toolkit/projects`: it imports the adh
 * vocabulary tier (`@agentic-toolkit/adh/profile`) directly, which a portable feature package may
 * not do (`scripts/check_boundaries.py`) — a site is a consumer of that vocabulary, not a package
 * other products reuse, and this component's whole job is rendering one site's `profileSection`.
 *
 * Renders the empty state ONLY, and that is a correct, current statement rather than an
 * unfinished one: `projectsInProject` (in `backend/src/adh/src/db/schema/project.ts`) has no
 * `visibility`, `is_public`, or `audience` column. It carries polymorphic OWNERSHIP
 * (`ownerKind`/`ownerId`) and tenancy, which answers whose project a row is, never who may see it.
 * Contrast `backend/src/adh/src/routes/public.ts`, where personas and papers each own a real
 * `visibility` column and every public caller pins `visibility = 'public'` in its WHERE clause —
 * projects have no such column to pin. So no project can be public today, and "This user has no
 * public projects" is the honest answer for every principal, not a placeholder for one this
 * component hasn't fetched yet.
 *
 * `principal` is read for one thing only — whether to say "user" or "organization". Every
 * principal reaching a profile page is one or the other (`ProfilePrincipal['kind']` is
 * `'user' | 'organization'`), and an org told it has no public projects as "This user" is simply
 * wrong about who it is looking at. Nothing else is read from it, because there is nothing to key
 * a request on while there is no request.
 *
 * When a visibility column arrives on `project`, this component grows a client-side fetch keyed on
 * `principal.slug`, and the site gains the endpoint pair the plan for this task originally called
 * for: `GET /public/projects?owner=<slug>` on the public router, gated on `AUDIENCE.PUBLIC`, plus
 * an authed twin `GET /projects?owner=<slug>` under `jwtAuth` — the pair doctrine documented at the
 * foot of `backend/src/adh/src/routes/public.ts` and modeled on
 * `backend/src/adh/src/routes/org-card.ts`.
 */
export function ProfileProjects({ principal }: { principal: ProfilePrincipal }): ReactElement {
  const subject = principal.kind === 'organization' ? 'This organization' : 'This user'
  return (
    <section className="mt-8">
      <p className="text-sm text-apt-text-muted">{subject} has no public projects.</p>
    </section>
  )
}
