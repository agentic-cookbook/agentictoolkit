'use client'

import { type ReactElement } from 'react'
import { useParams } from 'next/navigation'
import { SiteHomeShell } from './SiteHomeShell'
import type { SiteHomeModel } from './SiteHomeModel'

/**
 * The whole /home route, for every site. A site's page.tsx renders this and nothing else.
 *
 * This is the ONE place the arrangement lives: read the path, split the workspace segment off the
 * front, hand the rest to the site's parser, and mount the site's view inside the shell at the
 * workspace-scoped base. A site supplies a model (see ./SiteHomeModel) and supplies no assembly.
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
  // `[[...path]]` gives `string[]` when there are segments and `undefined` at the bare route.
  // Next types catch-all params as `string | string[]`, so narrow rather than assert: a single
  // segment can arrive unwrapped.
  const raw = useParams<{ path?: string | string[] }>()?.path
  const segments = raw === undefined ? [] : Array.isArray(raw) ? raw : [raw]
  const [workspaceSlug, ...rest] = segments

  return (
    <SiteHomeShell basePath={model.basePath} workspaceSlug={workspaceSlug}>
      {(scope) => model.render({ ...scope, view: model.parse(rest) })}
    </SiteHomeShell>
  )
}
