/**
 * The minimum a workspace row needs to be routable and pickable: a slug to navigate to and a name
 * to show. Deliberately narrower than `@agentic-toolkit/data`'s `Workspace` (which that client
 * builds by DROPPING team rows, because a team is not an owner-scopable principal) so the hub can
 * pass its own richer list — teams included — through the same bar it navigates to team routes
 * with. Nothing here reads a `kind`/`type` field, so neither shape has to know about the other.
 */
export interface WorkspaceOption {
  slug: string
  name: string
}
