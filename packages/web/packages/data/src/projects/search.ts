// Cross-board work-item search — the one read in `/api/project/*` that starts from no id.
//
// Every other list in this domain hangs off something the caller already holds: a board, a
// time-box, a program. This one answers "where is that card?" across every board the caller
// reaches, which is the question those lists cannot be asked — and it is the only reason this
// module is separate from `./work-items`, where every route is already scoped to one board.
//
// WHAT IT IS NOT: an in-board filter. A board's own list is already loaded client-side and the
// features package filters its `text` axis there, instantly and offline. Routing that through
// the network would make a keystroke a request and answer no question the local filter cannot.
// Reach for this when the board is unknown.
//
// The server owns the ORDER (a keyed hit first, then rank, then recency) and the CEILING (it
// clamps a limit rather than refusing it). Neither is re-derived here: `rank` travels so a
// consumer can show relative strength, not so it can re-sort a page it only holds part of.

import { authedJson } from "../http";
import { enc } from "../client-helpers";
import type { WorkItemSearchHitRow, WorkItemSearchPageRow } from "./wire";

const SEARCH = "/api/project/search/work-items";

/** A card the search matched, and the board it is on. See {@link WorkItemSearchHitRow}. */
export interface WorkItemSearchHit {
  id: string;
  projectId: string;
  projectName: string;
  itemKey: string;
  title: string;
  statusId: string;
  updatedAt: string;
  snippet: string;
  rank: number;
}

/** One page of hits, in the server's order. */
export interface WorkItemSearchPage {
  results: WorkItemSearchHit[];
  /** the limit the server ACTUALLY applied — it clamps out-of-range values, so this is not
   *  necessarily what was asked for. */
  limit: number;
  hasMore: boolean;
}

export function toWorkItemSearchHit(r: WorkItemSearchHitRow): WorkItemSearchHit {
  return {
    id: r.id,
    projectId: r.projectId,
    projectName: r.projectName,
    itemKey: r.itemKey,
    title: r.title,
    statusId: r.statusId,
    updatedAt: r.updatedAt,
    snippet: r.snippet ?? "",
    rank: r.rank ?? 0,
  };
}

export interface WorkItemSearchOptions {
  /** narrow to ONE workspace's boards (a customer slug, or an organization the caller belongs
   *  to). Omitted: the caller's whole reach. An unresolvable slug is a 404, never a silent
   *  widening. */
  workspace?: string;
  /** clamped by the server to 1–50; omitted means its default of 20. */
  limit?: number;
}

/** The empty page, so a caller that skipped the request has the same shape as one that made it. */
export const EMPTY_WORK_ITEM_SEARCH: WorkItemSearchPage = {
  results: [],
  limit: 0,
  hasMore: false,
};

export const projectSearchApi = {
  /**
   * Cards matching `q` across every board the caller reaches, ranked.
   *
   * A query shaped like a rendered KEY (`ADH-42`) additionally matches that card by key and
   * sorts it first — quoting a key names a row rather than describing one, and full-text alone
   * would find nothing, because a key tokenizes into lexemes no title contains.
   *
   * A blank `q` is answered HERE with the empty page rather than sent: the server 400s on one,
   * and an empty search box is the ordinary state of a search box, not an error to render.
   */
  async workItems(q: string, opts: WorkItemSearchOptions = {}): Promise<WorkItemSearchPage> {
    const query = q.trim();
    if (!query) return EMPTY_WORK_ITEM_SEARCH;
    const parts = [`q=${enc(query)}`];
    if (opts.workspace) parts.push(`workspace=${enc(opts.workspace)}`);
    if (opts.limit !== undefined) parts.push(`limit=${enc(String(opts.limit))}`);
    const page = await authedJson<WorkItemSearchPageRow>(`${SEARCH}?${parts.join("&")}`);
    return {
      results: (page.results ?? []).map(toWorkItemSearchHit),
      limit: page.limit,
      hasMore: page.hasMore,
    };
  },
};
