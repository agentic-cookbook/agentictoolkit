'use client'

import { ApiButton } from './ApiButton'

/**
 * The settings-pane "API" affordance: opens the API explorer focused on the open
 * record's endpoint (its path params prefilled), authenticated as the current user.
 * Drop it into a master/detail pane's {@link MasterDetailLayout}/{@link MasterDetailLeaf}
 * `trailing` slot. Renders nothing until every path param has a value (i.e. no row is
 * selected), so a pane can pass it unconditionally.
 */
export function RecordApiButton({
  method = 'GET',
  path,
  pathValues,
  queryValues,
  title,
}: {
  /** HTTP verb to focus. Defaults to the item read (GET). */
  method?: string
  /** Backend-native path (no `/api` prefix), e.g. `/team/teams/{id}`. */
  path: string
  /** Values for the path placeholders; the button hides while any is missing. */
  pathValues: Record<string, string | null | undefined>
  /** Optional query params to seed (e.g. a collection scoped by `?teamId=`). */
  queryValues?: Record<string, string | null | undefined>
  /** Dialog heading, e.g. `"Team API"`. */
  title?: string
}) {
  if (Object.values(pathValues).some((v) => !v)) return null
  // Drop empty query seeds so an unset filter doesn't send `?teamId=`.
  const query = queryValues
    ? Object.fromEntries(Object.entries(queryValues).filter(([, v]) => v))
    : undefined
  return (
    <ApiButton
      endpoint={{ method, path }}
      pathValues={pathValues as Record<string, string>}
      queryValues={query as Record<string, string> | undefined}
      title={title}
    />
  )
}
