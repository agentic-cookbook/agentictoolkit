"use client";

import { useCallback } from "react";
import { revalidateResources } from "@agentic-toolkit/data";
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
  }, [projectId, listKey]);

  useProjectLive(projectId, revalidate);
}
