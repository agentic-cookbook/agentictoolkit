// The caller's ARCHIVED organizations — moved from adh's hub
// (frontend/src/sites/hub/src/api/archived-workspaces.ts). The backing read for
// the Archived section in personal settings. Deliberately separate from
// `./workspaces.ts`: that list is the live switcher feed and must never include
// these.
//
// Request/response shapes below are TRANSCRIBED from the backend rather than
// imported from `@agentic-toolkit/adh-api-types`, unlike hub's original (which typed
// them as `SuccessBody<'/workspaces/archived', 'get'>`). That package's name starts
// with `@agentic-toolkit/adh`, which `scripts/check_boundaries.py`'s
// `_is_vocabulary` check classifies as the adh VOCABULARY tier — this package is
// MECHANISM tier (see package.json's `comment:tier`) and may never import it. See
// `./auth.ts`'s header for the fuller rationale and the guard evidence.
//
// Fields copied verbatim from `packages/adh-api-types/src/schema.ts` as of this
// move: `components.schemas.ArchivedWorkspace`. Unlike the generated SuccessBody
// helper, this does NOT auto-track a backend schema change.
import { useQuery } from "@tanstack/react-query";
import { authedJson } from "@agentic-toolkit/auth/client";

export interface ArchivedWorkspace {
  /** The organization id — what POST /organization/organizations/{id}/restore takes */
  id: string;
  slug: string;
  name: string;
  type: "organization";
  /** When the organization was archived (DB timestamp text, not RFC3339) */
  archivedAt: string;
  /** False once org.<slug> has been claimed by someone else — a restore would 409 */
  handleAvailable: boolean;
  /** False when the caller can see the org (they are a member) but may not restore it. True for
   *  the org's creator, an admin of one of its live org-owned teams, or a site admin. */
  canRestore: boolean;
}

export type ArchivedWorkspaceList = ArchivedWorkspace[];

export const ARCHIVED_WORKSPACES_QUERY_KEY = ["archived-workspaces"] as const;

export function useArchivedWorkspaces() {
  return useQuery<ArchivedWorkspaceList>({
    queryKey: ARCHIVED_WORKSPACES_QUERY_KEY,
    queryFn: () => authedJson<ArchivedWorkspaceList>("/api/workspaces/archived"),
    retry: false,
  });
}
