"use client";

// An ORGANIZATION workspace's people roster.

import { authedJson } from "../http";
import { enc } from "../client-helpers";
import type { WorkspaceMembersResponse } from "./wire";

export type { WorkspaceMember, WorkspaceMembersResponse } from "./wire";

export const workspaceMembersApi = {
  /** An ORGANIZATION workspace's roster: the distinct customers across the org's
   *  org-owned teams. 404 for non-org slugs and orgs the caller isn't a member of. */
  list(slug: string): Promise<WorkspaceMembersResponse> {
    return authedJson<WorkspaceMembersResponse>(`/api/workspaces/${enc(slug)}/members`);
  },
};
