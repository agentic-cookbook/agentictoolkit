// Project activity API client — the audit trail + comments side of `/api/project/*`.
//
// Both activity trails (project-scoped and work-item-scoped) are newest-first and
// keyset-paginated on `{ limit?, before? }`: `before` is an OPAQUE composite cursor
// token ("<createdAt>|<id>" of the last row you already have), which the client splits
// into the backend's (before, beforeId) keyset so millisecond-tied rows never straddle
// a page boundary. Each list method returns `{ rows, nextBefore }`, where `nextBefore`
// is that token to pass as the NEXT `before` when a full `limit` page came back, else
// null (no more pages, or the caller asked for no limit so there's nothing to page against).
//
// `addComment` POSTs to a work item and the backend answers with the created
// `comment.added` activity row.

import { authedJson } from "../http";
import { enc } from "../client-helpers";
import type { ProjectActivityRow, CommentCreateBody } from "./wire";

const PROJECTS = "/api/project/projects";
const ITEMS = "/api/project/work-items";

export interface ProjectActivity {
  id: string;
  projectId: string;
  /** set when the event is card-scoped. */
  workItemId: string | null;
  actorKind: string | null;
  actorId: string | null;
  actorLabel: string | null;
  /** the event, e.g. project.created, work_item.status_changed, comment.added. */
  action: string;
  /** action-specific payload (jsonb). */
  detail: Record<string, unknown> | null;
  createdAt: string;
}

export function toProjectActivity(r: ProjectActivityRow): ProjectActivity {
  return {
    id: r.id,
    projectId: r.projectId,
    workItemId: r.workItemId ?? null,
    actorKind: r.actorKind ?? null,
    actorId: r.actorId ?? null,
    actorLabel: r.actorLabel ?? null,
    action: r.action,
    detail: r.detail ?? null,
    createdAt: r.createdAt,
  };
}

/** A newest-first keyset page. */
export interface ActivityPage {
  rows: ProjectActivity[];
  /** cursor for the next `before`, or null when there are no more rows. */
  nextBefore: string | null;
}

interface Keyset {
  limit?: number;
  before?: string;
}

/** Build the `?limit=&before=&beforeId=` query for a keyset page (empty when neither set). */
function keysetQuery({ limit, before }: Keyset): string {
  const parts: string[] = [];
  if (limit !== undefined) parts.push(`limit=${enc(String(limit))}`);
  if (before !== undefined) {
    // `before` is an opaque cursor token "<createdAt>|<id>" (see fetchActivityPage). Split it
    // into the composite (before, beforeId) keyset the backend pages on, so millisecond-tied
    // rows never straddle a page boundary and get silently dropped. A createdAt timestamp
    // contains no "|", so the last separator cleanly divides the two halves; a legacy token
    // with no id still sends `before` alone.
    const sep = before.lastIndexOf("|");
    const beforeTs = sep >= 0 ? before.slice(0, sep) : before;
    const beforeId = sep >= 0 ? before.slice(sep + 1) : "";
    parts.push(`before=${enc(beforeTs)}`);
    if (beforeId) parts.push(`beforeId=${enc(beforeId)}`);
  }
  return parts.length ? `?${parts.join("&")}` : "";
}

/** Fetch + map a keyset page, deriving `nextBefore` from a full-page heuristic. */
async function fetchActivityPage(url: string, limit: number | undefined): Promise<ActivityPage> {
  const rows = (await authedJson<ProjectActivityRow[]>(url)).map(toProjectActivity);
  const last = rows.at(-1);
  // A full page (rows === limit) means there may be more — hand back the last row's
  // composite "<createdAt>|<id>" cursor token as the next `before`; otherwise this is the tail.
  const nextBefore =
    limit !== undefined && rows.length === limit && last ? `${last.createdAt}|${last.id}` : null;
  return { rows, nextBefore };
}

export const projectActivityApi = {
  projectActivity(projectId: string, opts: Keyset = {}): Promise<ActivityPage> {
    return fetchActivityPage(
      `${PROJECTS}/${enc(projectId)}/activity${keysetQuery(opts)}`,
      opts.limit,
    );
  },

  workItemActivity(workItemId: string, opts: Keyset = {}): Promise<ActivityPage> {
    return fetchActivityPage(
      `${ITEMS}/${enc(workItemId)}/activity${keysetQuery(opts)}`,
      opts.limit,
    );
  },

  async addComment(workItemId: string, body: string): Promise<ProjectActivity> {
    const payload: CommentCreateBody = {
      body,
    };
    return toProjectActivity(
      await authedJson<ProjectActivityRow>(
        `${ITEMS}/${enc(workItemId)}/comments`,
        { method: "POST", body: JSON.stringify(payload) },
      ),
    );
  },
};
