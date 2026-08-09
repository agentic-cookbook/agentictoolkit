"use client";

import { useCallback, useMemo, type ReactElement } from "react";
import { Badge } from "@agentic-toolkit/ui/components/badge";
import { EmptyState } from "@agentic-toolkit/ui/components/empty-state";
import { Select } from "@agentic-toolkit/ui/components/select";
import { Card, CardContent } from "@agentic-toolkit/ui/components/card";
import {
  SortableItem,
  SortableSurface,
  SortableZone,
  type SortableDrop,
} from "@agentic-toolkit/ui/components/dnd";
import { cn } from "@agentic-toolkit/ui/lib/utils";
import { compareRank, type WorkItem } from "@agentic-toolkit/data/projects";
import {
  type EstimateScale,
  type PriorityScale,
  type ProjectStatus,
  type ProjectParticipant,
} from "@agentic-toolkit/data/projects";
import { priorityMeta } from "../WorkItemEditor";
import { ItemKey } from "../ItemKey";
import { assigneeLabel, categoryVariant, estimateLabel, type BadgeVariant } from "../helpers";
import { DEFAULT_ITEM_WORDS, type ItemWords } from "../vocabulary";

/**
 * The Board VIEW of the work-items surface: the work items laid out as a
 * horizontal row of status columns (one per project status, in `position` order),
 * each listing its cards in board order. PRESENTATIONAL — it loads no data and owns
 * no state; the optimistic-with-revert writes live in the WorkItemsSurface (over the
 * shared items), so a move repaints List and Board alike. Extracted from the former
 * ProjectBoardPane.
 *
 * ## Two ways to move a card, and they are not the same act
 *
 *  - **Drag it.** Across columns it changes STATUS and takes a place in the new column;
 *    within one column it only changes its place. Both arrive as `onCardDrop`.
 *  - **The per-card "Move to…" Select.** Status only, and it is the keyboard path — a
 *    pointer drag is a gesture nobody can perform with a keyboard, so the Select is not
 *    a leftover from before the drag existed, it is the half of the feature a keyboard
 *    user gets. (The card also carries dnd-kit's own keyboard handle, so the drag itself
 *    is operable from the keyboard; the Select stays because reaching for a status by
 *    name is faster than steering to a column.)
 *
 * ## A drop names a SIBLING, or it names nothing
 *
 * A column groups by status, but rank is ordered among a card's SIBLINGS — same project,
 * same parent — and the backend refuses a neighbour that is not one rather than quietly
 * re-parenting. A column can therefore hold cards from several parents, and the card a
 * drop physically landed beside may not be a sibling at all. So the drop is resolved to
 * the nearest sibling ABOVE the slot (else the nearest below, landing above it); when the
 * column holds no sibling of the dragged card, the rank is left alone and only the status
 * is written — the drag could not have expressed an order that means anything.
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

/** Where a dragged card landed: a column, and a place in it among the card's siblings.
 *  `afterId`/`beforeId` are absent when the column offered no sibling to name. */
export interface BoardCardDrop {
  /** The status the card now has — null when it landed in the synthetic "No status" column,
   *  which is not a status anyone can be moved INTO, so such a drop carries no status write. */
  statusId: string | null;
  afterId?: string | null;
  beforeId?: string;
}

/* ── Card ─────────────────────────────────────────────────────────────────── */

function BoardCard({
  item,
  participants,
  statuses,
  known,
  estimateScale,
  priorityScale,
  onMove,
}: {
  item: WorkItem;
  participants: ProjectParticipant[];
  /** move targets, in position order. */
  statuses: ProjectStatus[];
  /** the set of live status ids (a card whose statusId is stale renders "No status"). */
  known: Set<string>;
  /** the project's scale — what the size chip's digits mean. */
  estimateScale: EstimateScale;
  /** whether the board ranks — `none` drops the priority badge, for the same reason an unsized
   *  card shows no size chip: a column of identical "None" badges is a column of noise. */
  priorityScale: PriorityScale;
  onMove: (itemId: string, statusId: string) => void;
}): ReactElement {
  const priority = priorityMeta(item.priority);
  const isKnown = known.has(item.statusId);
  // An unsized card shows NO chip rather than a dash: a board is read by scanning down a column
  // for the sizes, and a column of "—" is a row of noise between the real numbers.
  const estimate = estimateLabel(item.estimate, estimateScale);
  return (
    <SortableItem id={item.id}>
      {({ setNodeRef, style, handleProps, dragging }) => (
        <Card
          ref={setNodeRef}
          style={style}
          // The whole card is the handle: a board card is a thing you pick up, and a grip
          // in its corner would be a smaller target for the same gesture. The Select and
          // the key inside it keep their own clicks — the pointer sensor only arms after a
          // few px, so a click still reaches whatever it landed on.
          {...handleProps}
          className={cn(
            "touch-none gap-2 rounded-lg py-3",
            dragging ? "cursor-grabbing" : "cursor-grab",
          )}
        >
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
              <span className="flex shrink-0 items-center gap-1">
                {estimate ? (
                  <Badge variant="neutral" aria-label={`Estimate ${estimate}`}>
                    {estimate}
                  </Badge>
                ) : null}
                {priorityScale === "none" ? null : (
                  <Badge variant={priority.variant}>{priority.label}</Badge>
                )}
              </span>
            </div>
            <Select
              aria-label={`Move ${item.title}`}
              value={isKnown ? item.statusId : ""}
              onChange={(e) => onMove(item.id, e.target.value)}
              // The card is the drag handle, so a pointerdown anywhere on it arms the sensor.
              // The Select has to opt out or opening it would read as the start of a drag.
              onPointerDown={(e) => e.stopPropagation()}
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
      )}
    </SortableItem>
  );
}

/* ── View ─────────────────────────────────────────────────────────────────── */

/** The synthetic column for cards whose status no longer exists. Never a move target. */
const NO_STATUS = "__no_status__";

export function BoardView({
  items,
  statuses,
  participants,
  estimateScale,
  priorityScale = "standard",
  words = DEFAULT_ITEM_WORDS,
  onMove,
  onCardDrop,
}: {
  items: WorkItem[];
  statuses: ProjectStatus[];
  participants: ProjectParticipant[];
  /** The project's estimate scale; `none` means no card carries a size chip. */
  estimateScale: EstimateScale;
  /** The project's priority scale; `none` means no card carries a priority badge. */
  priorityScale?: PriorityScale;
  /** What this board calls its cards. */
  words?: ItemWords;
  /** The Select's status-only move. */
  onMove: (itemId: string, statusId: string) => void;
  /** A drag landed. `statusId` may be unchanged (a reorder within one column). */
  onCardDrop: (itemId: string, drop: BoardCardDrop) => void;
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
    // Board order WITHIN a column, so a card's place among its siblings reads the same here as
    // it does in the List — and so a drop's neighbours are the ones actually on screen.
    const inOrder = (of: (i: WorkItem) => boolean) =>
      items.filter(of).sort((a, b) => compareRank(a.rank, b.rank));
    const cols: BoardColumn[] = sortedStatuses.map((s) => ({
      key: s.id,
      label: s.label,
      variant: categoryVariant(s.category),
      statusId: s.id,
      items: inOrder((i) => i.statusId === s.id),
    }));
    const orphans = inOrder((i) => !known.has(i.statusId));
    if (orphans.length > 0) {
      cols.push({
        key: NO_STATUS,
        label: "No status",
        variant: "neutral",
        statusId: null,
        items: orphans,
      });
    }
    return cols;
  }, [sortedStatuses, known, items]);

  const zones = useMemo(
    () => columns.map((c) => ({ id: c.key, itemIds: c.items.map((i) => i.id) })),
    [columns],
  );
  const byId = useMemo(() => new Map(items.map((i) => [i.id, i] as const)), [items]);
  const columnByKey = useMemo(() => new Map(columns.map((c) => [c.key, c] as const)), [columns]);

  const onDrop = useCallback(
    (drop: SortableDrop) => {
      const card = byId.get(drop.itemId);
      const column = columnByKey.get(drop.toZoneId);
      if (!card || !column) return;

      // The slot the card landed in, as an index into the column WITHOUT it — the same list the
      // surface derived the neighbours from.
      const rest = column.items.filter((i) => i.id !== drop.itemId);
      const at =
        drop.afterId === null
          ? 0
          : rest.findIndex((i) => i.id === drop.afterId) + 1;

      // Resolve to a real sibling: the nearest one above the slot, else the nearest below it.
      // Anything else is a 400 from the ordering endpoint, which refuses a cross-parent
      // neighbour rather than re-parenting behind the user's back.
      let place: Pick<BoardCardDrop, "afterId" | "beforeId"> = {};
      let found = false;
      for (let k = at - 1; k >= 0 && !found; k -= 1) {
        const sibling = rest[k];
        if (sibling && sibling.parentId === card.parentId) {
          place = { afterId: sibling.id };
          found = true;
        }
      }
      for (let k = at; k < rest.length && !found; k += 1) {
        const sibling = rest[k];
        if (sibling && sibling.parentId === card.parentId) {
          place = { beforeId: sibling.id };
          found = true;
        }
      }
      // Landed at the top of a column that holds siblings only BELOW is already covered above
      // (`beforeId`). A column with no sibling at all leaves `place` empty: there is no order
      // here for the drag to have expressed.
      onCardDrop(drop.itemId, { statusId: column.statusId, ...place });
    },
    [byId, columnByKey, onCardDrop],
  );

  if (columns.length === 0) {
    return (
      <EmptyState
        title="No board columns yet."
        description={`This project has no statuses to group ${words.many} by.`}
      />
    );
  }

  return (
    <SortableSurface
      zones={zones}
      onDrop={onDrop}
      describeItem={(id) => byId.get(id)?.title ?? id}
      describeZone={(id) => columnByKey.get(id)?.label ?? id}
      renderOverlay={(id) => {
        const item = byId.get(id);
        return item ? (
          <Card className="w-72 rotate-1 gap-2 rounded-lg py-3 shadow-lg">
            <CardContent className="flex flex-col gap-2 px-3">
              <ItemKey itemKey={item.itemKey} />
              <span className="text-sm font-medium text-apt-text">{item.title}</span>
            </CardContent>
          </Card>
        ) : null;
      }}
    >
      <div
        role="list"
        aria-label="Board columns"
        className="flex min-h-0 flex-1 gap-4 overflow-x-auto pb-2"
      >
        {columns.map((col) => (
          <SortableZone key={col.key} id={col.key} itemIds={col.items.map((i) => i.id)}>
            {({ setNodeRef, isOver }) => (
              <div
                ref={setNodeRef}
                role="listitem"
                aria-label={col.label}
                className={cn(
                  "flex w-72 shrink-0 flex-col gap-3 rounded-lg border bg-apt-surface p-3 transition-colors",
                  isOver ? "border-apt-gold bg-apt-surface-2" : "border-apt-border",
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <Badge variant={col.variant}>{col.label}</Badge>
                  <span className="text-xs text-apt-text-muted">{col.items.length}</span>
                </div>
                <div className="flex flex-col gap-2 overflow-y-auto">
                  {col.items.length === 0 ? (
                    <EmptyState title={`No ${words.many}`} className="min-h-[80px]" />
                  ) : (
                    col.items.map((item) => (
                      <BoardCard
                        key={item.id}
                        item={item}
                        participants={participants}
                        statuses={sortedStatuses}
                        known={known}
                        estimateScale={estimateScale}
                        priorityScale={priorityScale}
                        onMove={onMove}
                      />
                    ))
                  )}
                </div>
              </div>
            )}
          </SortableZone>
        ))}
      </div>
    </SortableSurface>
  );
}
