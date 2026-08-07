"use client";

import { useMemo, type ReactElement } from "react";
import { Badge } from "@agentic-toolkit/ui/components/badge";
import { EmptyState } from "@agentic-toolkit/ui/components/empty-state";
import { Select } from "@agentic-toolkit/ui/components/select";
import { Card, CardContent } from "@agentic-toolkit/ui/components/card";
import { type WorkItem } from "@agentic-toolkit/data/projects";
import { type ProjectStatus, type ProjectParticipant } from "@agentic-toolkit/data/projects";
import { priorityMeta } from "../WorkItemEditor";
import { ItemKey } from "../ItemKey";
import { assigneeLabel, categoryVariant, type BadgeVariant } from "../helpers";

/**
 * The Board VIEW of the work-items surface: the work items laid out as a
 * horizontal row of status columns (one per project status, in `position` order),
 * each listing its cards. NO drag-and-drop — a card moves between statuses via a
 * per-card "Move to…" Select that calls the surface's `onMove(itemId, statusId)`.
 * PRESENTATIONAL — it loads no data and owns no state; the optimistic-with-revert
 * move lives in the WorkItemsSurface (over the shared items), so a move repaints
 * List and Board alike. Extracted from the former ProjectBoardPane.
 *
 * Reuse over duplication: the priority Badge reads WorkItemEditor's `priorityMeta`;
 * the category→tone map, assignee resolver, and `BadgeVariant` come from the shared
 * `../helpers` module (also used by the List view) so both views read one source.
 */

/* ── Column model ─────────────────────────────────────────────────────────── */

interface BoardColumn {
  key: string;
  label: string;
  variant: BadgeVariant;
  /** the status id a card moves to; null for the synthetic "No status" column. */
  statusId: string | null;
  items: WorkItem[];
}

/* ── Card ─────────────────────────────────────────────────────────────────── */

function BoardCard({
  item,
  participants,
  statuses,
  known,
  onMove,
}: {
  item: WorkItem;
  participants: ProjectParticipant[];
  /** move targets, in position order. */
  statuses: ProjectStatus[];
  /** the set of live status ids (a card whose statusId is stale renders "No status"). */
  known: Set<string>;
  onMove: (itemId: string, statusId: string) => void;
}): ReactElement {
  const priority = priorityMeta(item.priority);
  const isKnown = known.has(item.statusId);
  return (
    <Card className="gap-2 rounded-lg py-3">
      <CardContent className="flex flex-col gap-2 px-3">
        {/* The key sits ABOVE the title, the way a card is introduced out loud ("ADH-42, the
            login bug") — and a board is where someone is most likely to be reading one off to
            put in a branch name. */}
        <ItemKey itemKey={item.itemKey} />
        <span className="text-sm font-medium text-apt-text">{item.title}</span>
        <div className="flex items-center justify-between gap-2">
          <span className="truncate text-xs text-apt-text-muted">
            {assigneeLabel(item, participants)}
          </span>
          <Badge variant={priority.variant}>{priority.label}</Badge>
        </div>
        <Select
          aria-label={`Move ${item.title}`}
          value={isKnown ? item.statusId : ""}
          onChange={(e) => onMove(item.id, e.target.value)}
        >
          {!isKnown && (
            <option value="" disabled>
              No status
            </option>
          )}
          {statuses.map((s) => (
            <option key={s.id} value={s.id}>
              {s.label}
            </option>
          ))}
        </Select>
      </CardContent>
    </Card>
  );
}

/* ── View ─────────────────────────────────────────────────────────────────── */

export function BoardView({
  items,
  statuses,
  participants,
  onMove,
}: {
  items: WorkItem[];
  statuses: ProjectStatus[];
  participants: ProjectParticipant[];
  onMove: (itemId: string, statusId: string) => void;
}): ReactElement {
  // Columns in position order (server already sorts, but sort defensively), plus
  // a trailing "No status" column ONLY when a card's statusId is stale — so
  // orphaned cards stay visible (and movable) instead of silently vanishing.
  const sortedStatuses = useMemo(
    () => [...statuses].sort((a, b) => a.position - b.position),
    [statuses],
  );
  const known = useMemo(
    () => new Set(sortedStatuses.map((s) => s.id)),
    [sortedStatuses],
  );
  const columns = useMemo<BoardColumn[]>(() => {
    const cols: BoardColumn[] = sortedStatuses.map((s) => ({
      key: s.id,
      label: s.label,
      variant: categoryVariant(s.category),
      statusId: s.id,
      items: items.filter((i) => i.statusId === s.id),
    }));
    const orphans = items.filter((i) => !known.has(i.statusId));
    if (orphans.length > 0) {
      cols.push({
        key: "__no_status__",
        label: "No status",
        variant: "neutral",
        statusId: null,
        items: orphans,
      });
    }
    return cols;
  }, [sortedStatuses, known, items]);

  if (columns.length === 0) {
    return (
      <EmptyState
        title="No board columns yet."
        description="This project has no statuses to group work items by."
      />
    );
  }

  return (
    <div
      role="list"
      aria-label="Board columns"
      className="flex min-h-0 flex-1 gap-4 overflow-x-auto pb-2"
    >
      {columns.map((col) => (
        <div
          key={col.key}
          role="listitem"
          aria-label={col.label}
          className="flex w-72 shrink-0 flex-col gap-3 rounded-lg border border-apt-border bg-apt-surface p-3"
        >
          <div className="flex items-center justify-between gap-2">
            <Badge variant={col.variant}>{col.label}</Badge>
            <span className="text-xs text-apt-text-muted">{col.items.length}</span>
          </div>
          <div className="flex flex-col gap-2 overflow-y-auto">
            {col.items.length === 0 ? (
              <EmptyState title="No items" className="min-h-[80px]" />
            ) : (
              col.items.map((item) => (
                <BoardCard
                  key={item.id}
                  item={item}
                  participants={participants}
                  statuses={sortedStatuses}
                  known={known}
                  onMove={onMove}
                />
              ))
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
