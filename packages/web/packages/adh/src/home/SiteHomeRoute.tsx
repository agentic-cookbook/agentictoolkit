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
 * MOUNTED ONCE OR MORE per site, and the `/home` mount is the whole redirect mechanism:
 *
 *   - `app/[workspace]/[[...path]]/page.tsx` — the workspace route itself, `/<ws>/<rest…>`.
 *   - `app/home/page.tsx` — no params at all, so the shell resolves the user's workspace and
 *     replaces the URL with it (at `model.workspaceHref`, if the site declares one). `/home`
 *     is a redirect, not a page, and it needs no resolution logic of its own.
 *   - A site MAY mount it at NAMED routes instead of the catch-all — research mounts
 *     `[workspace]/home` and `[workspace]/edit/[paperUuid]`, because its `[workspace]` root is a
 *     public page and the two gated surfaces are gated by their own layouts. Such a route has no
 *     `path` param to read, so it passes `path` explicitly; see that prop.
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
export function SiteHomeRoute<View>({
  model,
  path,
}: {
  model: SiteHomeModel<View>
  /**
   * The segments below the workspace, when the ROUTE knows them and the URL does not spell them
   * as a catch-all. A site whose editor lives at `[workspace]/edit/[paperUuid]` has no `path`
   * param to read — its shape is two named segments — so it reads its own and hands them down:
   * `path={[paperUuid]}`.
   *
   * Note what is NOT passed: the literal `edit`. A host's segments are its own URL grammar, and
   * `model.parse` speaks the FEATURE's grammar — the same one the hub's
   * `/<slug>/research/<docId>` speaks. Passing `['edit', uuid]` would give the feature two
   * grammars to parse and put the site's URL layout inside a shared parser, which is exactly the
   * drift that parser exists to prevent.
   *
   * Overrides the route param when given, INCLUDING when it is empty: `[]` means "this route has
   * no segments below the workspace", which is a statement, not an absence.
   */
  path?: string[]
}): ReactElement {
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
  const fromUrl = raw === undefined ? [] : Array.isArray(raw) ? raw : [raw]
  // `path !== undefined`, not a truthiness or length check: an explicit `[]` is a route saying it
  // has no segments, and falling back to the URL there would re-read a param it deliberately
  // does not use.
  const rest = path !== undefined ? path : fromUrl
  const workspaceSlug = params?.workspace

  // Parsed HERE, above the shell, rather than inside the child it hands to `children`. A parser is
  // also where a site says a path does not exist (see SiteHomeModel.parse and `noSubPath`), and a
  // refusal made inside the shell would arrive after the workspace list had been fetched and the
  // chooser drawn — a bar and a spinner on the way to a 404. Above it, a path the site has no
  // grammar for 404s on the first render and asks the backend nothing.
  const view = model.parse(rest)

  // The site's own shell, or the family's. Read from the model rather than chosen here because
  // it is the same per-site declaration `parse` and `render` are — see SiteHomeModel.shell for
  // the one site that sets it and why. Resolved on every render and not memoized: it is a
  // field read, and the value is a module-scope component either way, so its identity is
  // already stable and React remounts nothing.
  const Shell = model.shell ?? SiteHomeShell

  return (
    <Shell
      workspaceSlug={workspaceSlug}
      // Spread rather than a plain prop: React keeps an explicitly-`undefined`-valued prop KEY on
      // the props object, and a sibling test pins the shell's prop list exactly (`["children",
      // "workspaceSlug"]`) for a model that declares no `workspaceHref` — a bare prop here would
      // add that key back with an `undefined` value and break that pin on 38 of the 39 sites.
      {...(model.workspaceHref !== undefined ? { workspaceHref: model.workspaceHref } : {})}
    >
      {(scope) => model.render({ ...scope, view })}
    </Shell>
  )
}
