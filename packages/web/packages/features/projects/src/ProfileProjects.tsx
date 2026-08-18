import type { ReactElement } from 'react'
import type { ProfilePrincipal } from '@agentic-toolkit/adh/profile'

/**
 * This site's section of a principal's profile at `/<slug>/profile` — declared as
 * `profileSection` on `frontend/src/sites/projects/src/home-model.tsx` (the
 * `SiteHomeModel` field documented in `@agentic-toolkit/adh/home`).
 *
 * Renders the empty state ONLY, and that is a correct, current statement rather than an
 * unfinished one: `projectsInProject` (`backend/src/adh/src/db/schema/project.ts:176`) has
 * no `visibility`, `is_public`, or `audience` column. It carries polymorphic OWNERSHIP
 * (`ownerKind`/`ownerId`) and tenancy, which answers whose project a row is, never who may
 * see it. Contrast `backend/src/adh/src/routes/public.ts`, where personas and papers each
 * own a real `visibility` column and every public caller pins `visibility = 'public'` in its
 * WHERE clause — projects have no such column to pin. So no project can be public today, and
 * "This user has no public projects" is the honest answer for every principal, not a
 * placeholder for one this component hasn't fetched yet.
 *
 * `principal` is unused here for the same reason: there is nothing to key a request on
 * because there is no request. It stays in the signature because `profileSection`'s contract
 * (Task 11) is `(principal: ProfilePrincipal) => ReactNode`, and every site's section takes
 * it — this one just doesn't need it yet.
 *
 * When a visibility column arrives on `project`, this component grows a client-side fetch
 * keyed on `principal.slug`, and the site gains the endpoint pair the plan for this task
 * originally called for: `GET /public/projects?owner=<slug>` on the public router, gated on
 * `AUDIENCE.PUBLIC`, plus an authed twin `GET /projects?owner=<slug>` under `jwtAuth` — the
 * pair doctrine documented at the foot of `backend/src/adh/src/routes/public.ts` and modeled
 * on `backend/src/adh/src/routes/org-card.ts`.
 */
export function ProfileProjects({ principal }: { principal: ProfilePrincipal }): ReactElement {
  return (
    <section className="mt-8">
      <p className="text-sm text-apt-text-muted">This user has no public projects.</p>
    </section>
  )
}
