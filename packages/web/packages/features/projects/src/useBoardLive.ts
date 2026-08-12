"use client";

import { useCallback } from "react";
import { revalidateResourceItems, revalidateResources } from "@agentic-toolkit/data";
import { useProjectLive } from "@agentic-toolkit/data/projects";

/**
 * Keep every mounted pane of ONE board honest while it is open: subscribe to the board's wake
 * stream and re-read the lists that show its rows.
 *
 * The wake says only THAT the board changed (see `data/src/projects/live.ts` for why it carries
 * nothing else), so the one decision here is which lists that sentence covers. `useResourceList`'s
 * cache keys already answer it:
 *
 *   • `project:<id>:*`  — the board's own lists: work items, statuses, participants, milestones,
 *                         labels, artifacts, saved views, status updates, triage, activity.
 *   • `work-item:*`     — a card's sublists (comments, reactions, relations). The key names the
 *                         CARD, not its board — but a board is open one at a time, so a mounted
 *                         card sublist belongs to this one.
 *   • `iteration:*`     — an iteration's cards. An iteration spans boards; the rows it shows
 *                         still include this board's, and a card that moved in or out of one is
 *                         exactly the change a stale list would hide.
 *   • the project rail's own key, when the caller passes one — a rename, a health change or a
 *     new board is a change that shows up OUTSIDE the board.
 *
 * And the board's own RECORD, which is not a list at all. `revalidateResources` matches only
 * `resource-list` entries, so a rename, a health change or an estimate scale turned off — every one
 * of them a change that lives on the record and in no list — would otherwise sit stale behind the
 * wake that was announcing it. `revalidateResourceItems` is the mirror for those, and it matches on
 * the COLLECTION key (an item key is collection + id), so the two collections holding this record
 * are named outright rather than derived from `projectId`.
 *
 * Deliberately NOT covered: `workspace:*` and `program:*`. Iterations, programs and templates
 * belong to the workspace, not to any board, so one board's activity cannot change them; waking
 * them would be a request per board gesture buying nothing.
 *
 * Panes wire nothing for this. They are reached through the mounted-list registry
 * (`revalidateResources`), so a pane added tomorrow is live by virtue of using `useResourceList`
 * with a board-scoped key — which is the same reason the keys are the seam and not a hand-kept
 * list of `reload`s.
 */
export function useBoardLive(projectId: string | null | undefined, listKey?: string): void {
  const revalidate = useCallback(() => {
    revalidateResources(
      (key) =>
        key === listKey ||
        key.startsWith(`project:${projectId}:`) ||
        key.startsWith("work-item:") ||
        key.startsWith("iteration:"),
    );
    // `project:projects` holds the board record under its own id; `subject-project` holds the same
    // record cached under the persona/product whose Project topic resolved it. An unmounted entry
    // is only marked stale, so naming every id in those two collections costs no request.
    revalidateResourceItems((key) => key === "project:projects" || key === "subject-project");
  }, [projectId, listKey]);

  useProjectLive(projectId, revalidate);
}
