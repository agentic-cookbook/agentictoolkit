'use client'

import { type ReactElement } from 'react'
import { useParams } from 'next/navigation'
import { SiteHomeShell } from './SiteHomeShell'
import type { SiteHomeModel } from './SiteHomeModel'

/**
 * The whole workspace route, for every site. A site's page.tsx renders this and nothing else.
 *
 * This is the ONE place the arrangement lives: read the workspace segment and the path below it,
 * hand the rest to the site's parser, and mount the site's view inside the shell at the
 * workspace-scoped base. A site supplies a model (see ./SiteHomeModel) and supplies no assembly.
 *
 * MOUNTED TWICE per site, and that is the whole redirect mechanism:
 *
 *   - `app/[workspace]/[[...path]]/page.tsx` — the workspace route itself, `/<ws>/<rest…>`.
 *   - `app/home/page.tsx` — no params at all, so the shell resolves the user's workspace and
 *     replaces the URL with it. `/home` is a redirect, not a page, and it needs no resolution
 *     logic of its own: "no workspace in the URL" is a state the shell already owns.
 *
 * A CLIENT component, and that is load-bearing rather than incidental. A model carries functions
 * (`parse`, `render`), and functions cannot cross from a Server Component into a Client one — so
 * if the assembly stayed in a server page.tsx, the model could never reach the client shell and
 * every site would be back to hand-assembling. Moving the assembly here makes each site's page a
 * client module, nothing crosses a boundary, and the shell can therefore take a FUNCTION child.
 * That last part is what lets `scopedBase` be built from the resolved workspace instead of from
 * the raw URL segment — see SiteHomeShell's `children`.
 *
 * Reading the path from `useParams` rather than a prop follows from the same thing: a server page
 * that awaited `params` to pass them down would be a server→client crossing again, for data the
 * client can read directly.
 */
export function SiteHomeRoute<View>({ model }: { model: SiteHomeModel<View> }): ReactElement {
  // Two params, from the route's two segments — `[workspace]` and the `[[...path]]` below it.
  // Both are absent at `/home`, which is what makes that mount a redirect.
  //
  // The workspace arrives as its OWN param rather than as `segments[0]`, so the file layout and
  // this code agree by construction: a site that mounts this anywhere but `[workspace]/[[...path]]`
  // gets `undefined` and an immediate replace to the resolved workspace, rather than silently
  // treating its first path segment as a workspace slug.
  const params = useParams<{ workspace?: string; path?: string | string[] }>()
  // `[[...path]]` gives `string[]` when there are segments and `undefined` at the bare route.
  // Next types catch-all params as `string | string[]`, so narrow rather than assert: a single
  // segment can arrive unwrapped.
  const raw = params?.path
  const rest = raw === undefined ? [] : Array.isArray(raw) ? raw : [raw]
  const workspaceSlug = params?.workspace

  // Parsed HERE, above the shell, rather than inside the child it hands to `children`. A parser is
  // also where a site says a path does not exist (see SiteHomeModel.parse and `noSubPath`), and a
  // refusal made inside the shell would arrive after the workspace list had been fetched and the
  // chooser drawn — a bar and a spinner on the way to a 404. Above it, a path the site has no
  // grammar for 404s on the first render and asks the backend nothing.
  const view = model.parse(rest)

  return (
    <SiteHomeShell workspaceSlug={workspaceSlug}>
      {(scope) => model.render({ ...scope, view })}
    </SiteHomeShell>
  )
}
