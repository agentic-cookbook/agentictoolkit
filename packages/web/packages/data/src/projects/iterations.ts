// Project iterations API client — the time-box side of the `/api/project/*` surface.
//
// Its own file, and its own route stem, for the reason the backend gives at length: an
// iteration belongs to a WORKSPACE, not to a project. There is no
// `/projects/{id}/iterations` to call, because a fortnight is not a thing a board owns — one
// box holds cards from every board its owner runs, and the same list answers for all of them.
// So the list is pinned with `?workspace=` exactly as the projects list is, and everything
// else hangs off `/project/iterations/{id}`.
//
// Two of these calls answer with a COUNT rather than the rows they touched (`remove`,
// `rollover`). That is the backend's disclosure rule, not an omission to work around: both
// sweep the whole box under a workspace-level verb, so returning the cards would report rows
// the caller may not be allowed to read. Refetch the affected board to see the result.

import { authedJson } from "../http";
import { compact, enc, workspaceQuery } from "../client-helpers";
import { toWorkItem, type WorkItem } from "./work-items";
import type {
  EstimateScale,
  IterationRow,
  IterationState,
  IterationWorkItemRow,
  PriorityScale,
  StatusCategory,
  IterationCreateBody,
  IterationPatchBody,
  IterationRolloverBody,
} from "./wire";

const BASE = "/api/project/iterations";

/* ── Iteration ────────────────────────────────────────────────────────── */

export interface Iteration {
  id: string;
  name: string;
  description: string;
  /** inclusive first day (YYYY-MM-DD). */
  startDate: string;
  /** inclusive last day (YYYY-MM-DD). Both ends always exist — a box with an open end is not
   *  a time-box, and the state below could not be derived from one. */
  endDate: string;
  /** where the box sits relative to today, DERIVED by the server from the two dates and never
   *  stored. Read it rather than comparing the dates yourself: the server's "today" is the one
   *  every other client sees, and re-deriving it invites two answers at midnight. */
  state: IterationState;
  /** the workspace that owns the box. A card may only be committed to a box whose owner
   *  matches its project's — which is what makes one box legal across several boards. */
  ownerKind: string;
  ownerId: string;
  ecosystemId: string;
  createdAt: string;
  updatedAt: string;
}

export function toIteration(r: IterationRow): Iteration {
  return {
    id: r.id,
    name: r.name,
    description: r.description ?? "",
    startDate: r.startDate,
    endDate: r.endDate,
    state: r.state,
    ownerKind: r.ownerKind,
    ownerId: r.ownerId,
    ecosystemId: r.ecosystemId,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  };
}

/** A card in an iteration — a {@link WorkItem} plus the board it came from and the column it
 *  sits in, by name. The extra fields exist because this one list SPANS projects, so a row can
 *  be read against neither a project header nor a single status set the way every other
 *  work-item list can: the `statusId`s here come from as many sets as there are boards in the
 *  box. `statusCategory` is what "still open" means, and it is the same field the rollover
 *  reads, so a pane's count and the server's sweep can never disagree. */
export interface IterationWorkItem extends WorkItem {
  projectName: string;
  statusName: string;
  statusCategory: StatusCategory;
  /** the scale the card's own board estimates in. Third field carried for the same reason as the
   *  two above: `estimate` is a number in ITS project's units, so a box whose boards disagree
   *  has no summable total — and only this field makes that detectable rather than reporting a
   *  fibonacci 8 added to a t-shirt 3 as if it meant something. */
  estimateScale: EstimateScale;
  /** and whether that board ranks at all. Fourth field for the same reason as the third: a card
   *  from a board that turned ranking off must not show a rank in a box its owner never opens. */
  priorityScale: PriorityScale;
}

export function toIterationWorkItem(r: IterationWorkItemRow): IterationWorkItem {
  return {
    ...toWorkItem(r),
    projectName: r.projectName,
    statusName: r.statusName,
    statusCategory: r.statusCategory,
    estimateScale: r.estimateScale,
    // The board's default when a backend that predates the column answered.
    priorityScale: r.priorityScale ?? "standard",
  };
}

/* ── Client ───────────────────────────────────────────────────────────── */

export const projectIterationsApi = {
  /** The workspace's boxes, in calendar order (the server's, oldest first). `workspace` pins
   *  the list to that workspace's owning principal, exactly as `projectsApi.list` does; without
   *  it the caller sees every box their reach admits. */
  async list(opts?: { workspace?: string }): Promise<Iteration[]> {
    const rows = await authedJson<IterationRow[]>(`${BASE}${workspaceQuery(opts)}`);
    return rows.map(toIteration); // server orders by startDate, then id
  },

  async get(id: string): Promise<Iteration | null> {
    try {
      return toIteration(await authedJson<IterationRow>(`${BASE}/${enc(id)}`));
    } catch {
      // Backend 404s with a thrown error; the UI contract is null-for-missing.
      return null;
    }
  },

  /** Create a box in a workspace. Both dates are required, and `endDate` may equal `startDate`
   *  (a one-day box is legal); `endDate` BEFORE `startDate` is a 400, and a name already used
   *  by a live box in the same workspace is a 409. */
  async create(
    input: {
      name: string;
      description?: string;
      startDate: string;
      endDate: string;
    },
    opts?: { workspace?: string },
  ): Promise<Iteration> {
    const body: IterationCreateBody = {
      name: input.name,
      startDate: input.startDate,
      endDate: input.endDate,
      ...compact({ description: input.description }),
    };
    return toIteration(
      await authedJson<IterationRow>(`${BASE}${workspaceQuery(opts)}`, {
        method: "POST",
        body: JSON.stringify(body),
      }),
    );
  },

  /** Rename a box or move either end of it. Sending ONE date is the ordinary edit — extending
   *  a live cycle — and is accepted: the server validates the pair the box will END UP as, not
   *  the pair that was sent. */
  async update(id: string, patch: IterationPatchBody): Promise<Iteration> {
    const body: IterationPatchBody = compact(patch);
    return toIteration(
      await authedJson<IterationRow>(`${BASE}/${enc(id)}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      }),
    );
  },

  /**
   * Delete a box, UN-ASSIGNING every card in it — the count of those cards is what comes back.
   *
   * It never refuses, which is the deliberate difference from deleting a board COLUMN: a card
   * must have a status, so a column with cards in it has no defined outcome, whereas "no
   * iteration" is the backlog — an ordinary state a card is allowed to be in.
   */
  async remove(id: string): Promise<{ unassigned: number }> {
    return authedJson<{ unassigned: number }>(`${BASE}/${enc(id)}`, {
      method: "DELETE",
    });
  },

  /** The box's cards, across every project in the workspace — the iteration board. Unlike the
   *  two sweeps this READS content, so it is reach-filtered: a card in a project the caller
   *  cannot open does not appear here just because they can see the cycle. */
  async workItems(id: string): Promise<IterationWorkItem[]> {
    const rows = await authedJson<IterationWorkItemRow[]>(
      `${BASE}/${enc(id)}/work-items`,
    );
    return rows.map(toIterationWorkItem); // server orders by rank
  },

  /**
   * Close a cycle: move everything that did not finish into `toIterationId`, or to the backlog
   * when that is `null`. Answers with how many cards moved.
   *
   * "Did not finish" is read from each card's status CATEGORY, so a board may call its columns
   * anything: `done` and `canceled` stay put, and everything else moves — including `backlog`,
   * because a card nobody started is precisely what rolls over.
   */
  async rollover(
    id: string,
    toIterationId: string | null,
  ): Promise<{ moved: number; toIterationId: string | null }> {
    const body: IterationRolloverBody = { toIterationId };
    return authedJson<{ moved: number; toIterationId: string | null }>(
      `${BASE}/${enc(id)}/rollover`,
      { method: "POST", body: JSON.stringify(body) },
    );
  },
};
