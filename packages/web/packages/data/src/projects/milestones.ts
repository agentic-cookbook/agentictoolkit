// Project milestones API client — the plan side of the `/api/project/*` surface.
//
// Unlike an iteration or a program, a milestone IS a thing a board owns: it is a point in ONE
// project's plan, so every route here hangs off `/project/projects/{id}/milestones` and a
// milestoneId from another board is a 404 rather than a cross-board edit. That is the same
// scoping every project-child in this domain follows (statuses, saved views, comments).
//
// Nothing here caches progress. `counts` is DERIVED by the backend on every read, which is why
// moving a card writes nothing to the milestone and why a stale count is not a state this
// client can get into.

import { authedJson } from "../http";
import { compact, enc } from "../client-helpers";
import type {
  MilestoneCounts,
  MilestoneRow,
  MilestoneCreateBody,
  MilestonePatchBody,
  StatusCategory,
} from "./wire";

const PROJECTS = "/api/project/projects";

const stem = (projectId: string) => `${PROJECTS}/${enc(projectId)}/milestones`;

/* ── Milestone ────────────────────────────────────────────────────────── */

export interface Milestone {
  id: string;
  projectId: string;
  name: string;
  description: string;
  /** the date the point is aimed at (YYYY-MM-DD), or null. Undated is a real and common state —
   *  an ordered plan that has not been scheduled — and requiring a date only gets one invented.
   *  Undated milestones sort LAST in {@link projectMilestonesApi.list}. */
  targetDate: string | null;
  /**
   * The milestone's live cards by status category, or null when this response did not carry
   * them — a PATCH answers with the row it wrote, and the row does not hold counts.
   *
   * Null is "not reported here", NOT "no cards": a renderer that reads it as zeros would show a
   * freshly-edited milestone as empty. Refetch the list, which always carries them.
   */
  counts: MilestoneCounts | null;
  ecosystemId: string;
  createdAt: string;
  updatedAt: string;
}

export function toMilestone(r: MilestoneRow): Milestone {
  return {
    id: r.id,
    projectId: r.projectId,
    name: r.name,
    description: r.description,
    targetDate: r.targetDate ?? null,
    counts: r.counts ?? null,
    ecosystemId: r.ecosystemId,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  };
}

/**
 * How many of a milestone's cards are DONE, and how many count toward it at all.
 *
 * The API reports no percentage on purpose — whether a `canceled` card belongs in the
 * denominator is a product question, and freezing one answer on the wire would impose it on
 * every consumer. This is the one answer this package commits to, written down once so two
 * panes cannot disagree: `canceled` is EXCLUDED from both halves, because a card nobody is
 * going to do is not outstanding work and counting it as unfinished makes a finished plan
 * read as stalled forever.
 *
 * Returns `null` for a milestone whose counts did not travel (see {@link Milestone.counts}) —
 * a caller must render "unknown", not a zeroed bar.
 */
export function milestoneProgress(
  m: Milestone,
): { done: number; total: number; ratio: number } | null {
  if (!m.counts) return null;
  const counted: StatusCategory[] = ["backlog", "todo", "in_progress", "done"];
  const total = counted.reduce((sum, c) => sum + (m.counts?.[c] ?? 0), 0);
  const done = m.counts.done;
  // A plan with nothing in it is 0 %, not NaN and not 100 % — an empty milestone has not been
  // achieved, it has not been populated.
  return { done, total, ratio: total === 0 ? 0 : done / total };
}

/* ── Client ───────────────────────────────────────────────────────────── */

export const projectMilestonesApi = {
  /** The board's plan, in the server's order: by `targetDate` ascending with the UNDATED ones
   *  last — a milestone with no date is not overdue and does not belong at the front. Every row
   *  carries its `counts`. */
  async list(projectId: string): Promise<Milestone[]> {
    const rows = await authedJson<MilestoneRow[]>(stem(projectId));
    return rows.map(toMilestone);
  },

  /** Add a point to the board's plan. A name a live milestone of the SAME board already uses is
   *  a 409; the same name on another board is fine, because a plan is per-board. The created row
   *  comes back with all-zero counts rather than none, so a create and a list have one shape. */
  async create(
    projectId: string,
    input: { name: string; description?: string; targetDate?: string | null },
  ): Promise<Milestone> {
    const body: MilestoneCreateBody = {
      name: input.name,
      ...compact({ description: input.description, targetDate: input.targetDate }),
    };
    return toMilestone(
      await authedJson<MilestoneRow>(stem(projectId), {
        method: "POST",
        body: JSON.stringify(body),
      }),
    );
  },

  /** Rename a point or move its date; `targetDate: null` clears it (`compact` keeps explicit
   *  null). The answer is the bare row — refetch the list for the counts. */
  async update(
    projectId: string,
    milestoneId: string,
    patch: MilestonePatchBody,
  ): Promise<Milestone> {
    const body: MilestonePatchBody = compact(patch);
    return toMilestone(
      await authedJson<MilestoneRow>(`${stem(projectId)}/${enc(milestoneId)}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      }),
    );
  },

  /**
   * Remove a point from the plan, DETACHING its cards — the count of those cards comes back.
   *
   * It never refuses, the same way deleting an iteration doesn't and deleting a board COLUMN
   * does: a card must have a status, so a column with cards in it has no defined outcome,
   * whereas "counts toward no milestone" is an ordinary state. The cards themselves are
   * untouched apart from losing the reference.
   */
  async remove(projectId: string, milestoneId: string): Promise<{ unassigned: number }> {
    return authedJson<{ unassigned: number }>(
      `${stem(projectId)}/${enc(milestoneId)}`,
      { method: "DELETE" },
    );
  },
};
