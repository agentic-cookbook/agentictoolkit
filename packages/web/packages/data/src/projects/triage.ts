// Project triage API client — the queue of cards nobody has accepted yet.
//
// A card is IN the queue when its `triagedAt` is null, and that is the whole mechanism. It is a
// timestamp rather than a sixth status category because "waiting to be looked at" is not a column
// of a board — it is a statement about whether the board's columns apply to this card yet. The
// timestamp also answers the question a queue is actually worked by: how long has this been
// sitting here.
//
// Nothing lands in the queue unless a caller asks for it (`triage: true` on create), so a board
// that has never used an intake form has an empty inbox and an unchanged list.
//
// TWO reads, because they answer different questions. `listForProject` is one board's inbox with
// full cards — what you open when you are clearing a board. `list` spans every board the caller
// can reach, with signpost rows and paging — what someone clearing an intake that arrives from
// several places actually wants.
//
// There is no `decline`. Declining is `accept`ing into a status in the `canceled` category, which
// leaves the card findable and says what happened to it; a delete would answer neither.

import { authedJson } from "../http";
import { compact, enc, workspaceQuery } from "../client-helpers";
import { toWorkItem, type WorkItem } from "./work-items";
import type { WorkItemRow, TriageHitRow, TriagePageRow, TriageAcceptBody } from "./wire";

const PROJECTS = "/api/project/projects";
const ITEMS = "/api/project/work-items";
const CROSS = "/api/project/triage";

/* ── A queued card, seen from a page that spans boards ────────────────── */

/**
 * A SIGNPOST, like a search hit and for the same reason: enough to recognise the card and open
 * it, plus the board's NAME, which the client cannot join because the boards a cross-workspace
 * queue reaches are exactly the ones it has not loaded.
 *
 * No labels — those resolve per OWNER, and a page crossing workspaces would need a resolution
 * pass each to render a column most triage decisions ignore. {@link projectTriageApi.listForProject}
 * is where a card is opened with everything on it.
 */
export interface TriageHit {
  id: string;
  projectId: string;
  projectName: string;
  /** already rendered against the OWNING board's prefix (`ADH-42`) — a queue crossing boards
   *  crosses prefixes, so the client has none to render it with. '' when that board has none. */
  itemKey: string;
  title: string;
  description: string;
  statusId: string;
  priority: number;
  createdBy: string | null;
  /** when it was FILED. The queue is ordered by this, oldest first, and it is the age a person
   *  triaging is really reading. */
  createdAt: string;
}

export function toTriageHit(r: TriageHitRow): TriageHit {
  return {
    id: r.id,
    projectId: r.projectId,
    projectName: r.projectName,
    itemKey: r.itemKey ?? "",
    title: r.title,
    description: r.description,
    statusId: r.statusId,
    priority: r.priority,
    createdBy: r.createdBy ?? null,
    createdAt: r.createdAt,
  };
}

/** One page of the cross-board queue. `limit` is what the server ACTUALLY applied — it clamps an
 *  out-of-range one rather than refusing it, so read it back rather than assuming what was sent. */
export interface TriagePage {
  results: TriageHit[];
  limit: number;
  hasMore: boolean;
}

/* ── Client ───────────────────────────────────────────────────────────── */

export const projectTriageApi = {
  /**
   * ONE board's inbox — full cards, oldest first, which is the end of a queue that has been
   * waiting longest and the order the index stores.
   *
   * These are the cards MISSING from {@link projectWorkItemsApi.listForProject}: the two lists
   * partition the board, so a count of "everything on this board" is the sum, or one call with
   * `includeUntriaged`.
   */
  async listForProject(projectId: string): Promise<WorkItem[]> {
    const rows = await authedJson<WorkItemRow[]>(
      `${PROJECTS}/${enc(projectId)}/triage`,
    );
    return rows.map(toWorkItem);
  },

  /**
   * EVERY reachable board's inbox in one page, oldest first. `workspace` pins it to one
   * workspace; without it the caller sees every board their reach admits — and the reach IS the
   * bound, so there is no version of this that reads a board the caller cannot open.
   *
   * `limit` is clamped rather than refused (1…200, default 50), so read {@link TriagePage.limit}
   * back instead of assuming. `hasMore` is computed by over-fetching one row, so it is exact.
   */
  async list(opts?: { workspace?: string; limit?: number }): Promise<TriagePage> {
    const ws = workspaceQuery(opts);
    const limit =
      opts?.limit === undefined ? "" : `${ws ? "&" : "?"}limit=${opts.limit}`;
    const page = await authedJson<TriagePageRow>(`${CROSS}${ws}${limit}`);
    return {
      results: page.results.map(toTriageHit),
      limit: page.limit,
      hasMore: page.hasMore,
    };
  },

  /**
   * Accept a card OUT of the queue, with the placement decided in the same request — which is the
   * shape triage actually has: the decision "this belongs here" and the decision "and it goes in
   * that column" are one thought.
   *
   * Every field is optional; an empty placement accepts the card where it already sits. To
   * DECLINE, name a status in the `canceled` category — that is the whole of it, and it is why
   * there is no second verb.
   *
   * IDEMPOTENT on the stamp: accepting an already-accepted card applies any placement it carries
   * and leaves the original timestamp alone, because when a card left the queue is a fact with
   * one answer and a double-click must not rewrite it. Addressable by id OR rendered key.
   */
  async accept(ref: string, placement?: TriageAcceptBody): Promise<WorkItem> {
    const body: TriageAcceptBody = compact(placement ?? {});
    return toWorkItem(
      await authedJson<WorkItemRow>(`${ITEMS}/${enc(ref)}/triage`, {
        method: "POST",
        body: JSON.stringify(body),
      }),
    );
  },
};
