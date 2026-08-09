'use client'

import { useCallback, type ReactElement, type ReactNode } from 'react'
import { usePathname } from 'next/navigation'
import { TopicSelectHint } from '@agentic-toolkit/ui/blocks'
import { useResourceList, workspacesApi, type Workspace } from '@agentic-toolkit/data'
import { WorkspaceBar } from './WorkspaceBar'
import { useWorkspaceRoute } from './useWorkspaceRoute'
import { workspacePathTail } from './workspacePathTail'
import type { SiteHomeScope } from './SiteHomeModel'

// Module scope, so its identity is stable: useResourceList takes `load` as a fetch dependency and
// a new identity each render would loop.
const loadWorkspaces = (): Promise<Workspace[]> => workspacesApi.list()

/**
 * The shared shell for a feature site's workspace route: one labelled workspace chooser in a bar
 * directly under the header, and below it that site's own HTDV scoped to the chosen workspace.
 *
 * Every site that scopes to a workspace used to grow its own chooser inside its HTDV stack —
 * eating the widest column, reimplemented per feature package, and the answer did not travel.
 * This owns all of it once:
 *
 *   - The ONE workspacesApi.list() fetch. The bar and the resolution read it.
 *   - Resolution, the URL-as-truth replace, and persistence of an explicit choice — all of it
 *     useWorkspaceRoute's, which the hub mounts too (its workspace lives at `/<slug>/home`, so
 *     it cannot use this shell's URL shape, but the behaviour behind the bar is the same one).
 *   - Holding `children` until resolution, so no feature mounts unscoped and fires a list
 *     request the backend would answer with the wrong reach. `children` is a FUNCTION for that
 *     reason: a node would be CONSTRUCTED on every render, including the ones before a workspace
 *     exists, so its props could only be built from the raw URL segment — which is `undefined`
 *     at `/home` and stale mid-redirect. Called instead, it runs once the answer is known and is
 *     handed that answer.
 *   - Rendering the chooser ONCE, in a labelled bar directly under the header, at every width.
 *
 * Signed-out visitors never reach here: the workspace route sits behind HomeGate.
 */
export function SiteHomeShell({
  workspaceSlug,
  children,
}: {
  /** The workspace segment as it stands in the URL, if any. */
  workspaceSlug?: string
  /** This site's HTDV. Called — not rendered — once a workspace is resolved AND in the URL, with
   *  that workspace and the base already scoped to it. Sites do not implement this directly;
   *  SiteHomeRoute does, from the site's SiteHomeModel. */
  children: (scope: SiteHomeScope) => ReactNode
}): ReactElement {
  // `error` is not optional to read here. A failed list leaves `items` at its previous value —
  // null on a cold mount (use-resource-list only calls setError on the catch path) — and a null
  // list is indistinguishable from a list still loading: resolution stays `undefined` forever, so
  // the children never mount, the empty-state hint never fires, and the page sits blank behind a
  // chooser with nothing in it. Every one of the 35 sites' gated surface has that same failure, so
  // the shell owns saying so.
  //
  // The cache key is a bare literal, and can be: it identifies a REQUEST, not a mount point, and
  // there is one workspace list per signed-in caller across the whole family. It used to be keyed
  // on the shell's base so two mounts at different bases could not read each other's rows — a
  // distinction that never existed, since both would have fetched the same list.
  const { items: workspaces, error } = useResourceList<Workspace>('workspaces', loadWorkspaces)
  // Memoized with no dependencies, because useWorkspaceRoute holds this in two effects' dependency
  // arrays — a fresh closure each render would re-run both on every render.
  const hrefFor = useCallback((slug: string) => `/${slug}`, [])
  // Switching workspace KEEPS what you were looking at: the segments below the workspace are this
  // site's own selected path (`model.parse` reads exactly these — see SiteHomeRoute), so moving
  // them onto the new workspace is what makes the HTDV land on the same place rather than back at
  // the site's root.
  //
  // Carried WHOLE and unvalidated, which is the honest answer here rather than a shortcut. Below
  // the workspace a feature site's segments are entity ids, and whether one exists in the
  // destination is a question only that workspace's own list can answer — a round trip this bar
  // has not made and should not make to service a click. It does not need to: every deep-linkable
  // pane on the platform already resolves its id against the rows it loads and treats an unknown
  // one as "nothing open", showing the list instead (ServicesSection, PersonasSection,
  // StackGroupDetail all say so in as many words). So an id the destination does not have settles
  // by itself onto the parent level — which IS the fallback this feature is specified to have —
  // and one it does have (the user-scoped lists, where the row is the same row) stays selected.
  const pathname = usePathname() ?? ''
  const switchHrefFor = useCallback(
    (slug: string) => `/${[slug, ...workspacePathTail(pathname)].join('/')}`,
    [pathname],
  )
  // No `canPersist`: every row this list carries is an owner-scopable workspace (workspacesApi
  // drops teams), so any of them is legitimate cross-site preference material.
  const { resolved, onSelect } = useWorkspaceRoute({
    workspaces,
    workspaceSlug,
    hrefFor,
    switchHrefFor,
  })
  // The resolved workspace's own row, for the scope below (see SiteHomeScope.workspace). `resolved`
  // can only ever BE a member of this list — useWorkspaceRoute resolves through its `known()`
  // check, which rejects any slug the list does not carry, and otherwise falls back to the list's
  // own first row — so this lookup is total wherever the guard below has already passed. Written as
  // a lookup rather than an assertion so a future change to that resolution cannot turn a wrong
  // slug into a wrong ROW: a miss holds `children` exactly as an unresolved slug does, which is a
  // state this shell already renders (the bar, and nothing under it).
  const workspace = workspaces?.find((w) => w.slug === resolved) ?? null

  return (
    <>
      <WorkspaceBar workspaces={workspaces} selected={resolved ?? null} onSelect={onSelect} />
      {/* Said only while the list is genuinely missing: a reload that fails AFTER a successful one
          leaves the workspaces on screen, and replacing a working page with an error would be a
          worse answer than the slightly stale one it already has. */}
      {error !== null && workspaces === null && (
        <TopicSelectHint title="Couldn't load your workspaces. Reload the page to try again." />
      )}
      {/* No error clause needed here, and one would be wrong: `resolved` is `null` only once the
          list has ARRIVED and was empty (it stays `undefined` while `workspaces` is null), so a
          failed request cannot reach this line. The one state that could — a successful empty list
          followed by a failed refetch — is still a user with no workspaces, and saying so beats
          replacing a true statement with an apology. */}
      {resolved === null && (
        <TopicSelectHint title="No workspaces yet — create one from the hub to get started." />
      )}
      {/* `resolved === workspaceSlug` is what narrows `resolved` to the settled string: it is
          `undefined` while resolving and `null` when there is nothing to resolve to, and neither
          equals a slug. So the scope below is built from the RESOLVED workspace — the URL segment
          merely has to agree before anything mounts. */}
      {resolved !== undefined &&
        resolved !== null &&
        resolved === workspaceSlug &&
        workspace !== null &&
        children({
          workspaceSlug: resolved,
          scopedBase: `/${resolved}`,
          workspace,
        })}
    </>
  )
}
