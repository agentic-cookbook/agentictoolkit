"use client";

import { useCallback, useMemo, useState, type ReactElement } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { EmptyState } from "@agentic-toolkit/ui/components/empty-state";
import {
  DragItem,
  DragSurface,
  DropTarget,
  type DragDropEvent,
} from "@agentic-toolkit/ui/components/dnd";
import { type WorkItem } from "@agentic-toolkit/data/projects";
import { priorityMeta } from "../WorkItemEditor";
import {
  MS_PER_DAY,
  dayDate,
  dayIndex,
  itemLabel,
  todayIndex,
  type BadgeVariant,
} from "../helpers";

/**
 * The Calendar VIEW of the work-items surface: a month grid (weekday header +
 * weeks × 7 day cells) that places each work item on its `dueDate` cell as a
 * clickable chip. PRESENTATIONAL like its List/Board/Table/Timeline siblings — it
 * loads no data and owns no editor; the WorkItemsSurface loads the items ONCE and
 * owns the shared editor. Clicking a chip calls `onOpenItem(id)`, which the surface
 * turns into an open editor for that item (a click opens the shared editor from ANY
 * view).
 *
 * ## Dragging a chip sets its DUE DATE, and nothing else
 *
 * A day cell is the only drop target here, and landing on one writes `dueDate` — the single
 * field this grid actually renders. It does NOT drag a start date along with it: on a calendar
 * a chip sits on ONE day, so there is no second edge for a duration to be read from, and
 * silently shifting `startDate` by the same amount would be an edit the user never expressed
 * (the Timeline, where a bar HAS two edges, is where moving means "move the whole span").
 * Dropping a chip back on its own day is not a write.
 *
 * The chip is already a `<button>` that opens the item, so it carries the drag's pointer
 * listeners alone — no `role="button"` nested inside one — and the keyboard path to a due date
 * is the editor's Due field, reached by the very click this button performs. `onSetDueDate` is
 * the surface's, like every other write in this feature; the view stays presentational.
 *
 * The visible month is component state (default: the month of "today"), shifted by
 * the prev/next controls. Leading/trailing cells from the adjacent months are
 * greyed via `apt-*` tokens; today's cell (only meaningful in the current month)
 * gets an `apt-*` accent ring. Dates are parsed as calendar-day indices via the
 * shared `../helpers` parser (the SAME one Timeline reads) — on the viewer's LOCAL
 * calendar — and "today" is read from the viewer's LOCAL wall-clock day, so near a
 * day boundary the Today ring and the initially-selected month track the user's
 * clock rather than UTC.
 *
 * Items with NO `dueDate` — or a MALFORMED one (`dayIndex` → null) — can't be placed
 * on a day, so they're kept out of the grid and listed in a small "No due date" strip
 * below (never silently dropped). A month with no due items still renders the (empty)
 * grid with a subtle note; with no items at all it's the shared EmptyState.
 */

/** Fill counterpart of the priority Badge tones: a Badge variant → a solid `apt-*`
 *  dot. Badge itself is an outline pill, so the SAME tone is re-expressed here as a
 *  small filled dot on each chip — colors stay `apt-*` tokens (never raw hex), so
 *  every theme + dark mode work. */
const DOT_TONE: Record<BadgeVariant, string> = {
  neutral: "bg-apt-text-dim",
  accent: "bg-apt-gold",
  orange: "bg-apt-orange",
  blue: "bg-apt-blue",
  success: "bg-apt-green",
  error: "bg-apt-red",
};

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

/** A calendar month, identified by its UTC year + 0-based month. */
type Month = { year: number; month: number };

/** The UTC month a day index falls in. */
function monthOfDay(day: number): Month {
  const d = new Date(day * MS_PER_DAY);
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() };
}

/** Shift a month by ±n months, carrying the year (handles Dec→Jan / Jan→Dec). */
function addMonths({ year, month }: Month, delta: number): Month {
  const m = month + delta;
  return { year: year + Math.floor(m / 12), month: ((m % 12) + 12) % 12 };
}

/** A day index → its long label ("Saturday, August 8, 2026"), at UTC to match the index. One
 *  function so a cell's `aria-label` and the drag announcement can never name different days. */
function dayLabel(day: number): string {
  return new Date(day * MS_PER_DAY).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

/** A month → its long label ("July 2026"), formatted at UTC to match the index. */
function monthLabel({ year, month }: Month): string {
  return new Date(Date.UTC(year, month, 1)).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

/** One rendered day cell: its UTC day index, day-of-month number, whether it
 *  belongs to the visible month (vs. a greyed adjacent-month spill day), whether
 *  it is today, a full aria label, and the items due on it. */
type Cell = {
  day: number;
  dayNum: number;
  inMonth: boolean;
  isToday: boolean;
  label: string;
  items: WorkItem[];
};

/** A day cell's droppable id. Prefixed so it can never be read as an item id. */
const DAY_TARGET = "day:";

export function CalendarView({
  items,
  onOpenItem,
  onSetDueDate,
}: {
  items: WorkItem[];
  onOpenItem: (id: string) => void;
  /** A chip was dropped on a day: this item is now due on that "YYYY-MM-DD". */
  onSetDueDate: (itemId: string, dueDate: string) => void;
}): ReactElement {
  // Today is fixed for the lifetime of the mount (a fake clock in tests pins it).
  const today = useMemo(() => todayIndex(), []);
  const [visibleMonth, setVisibleMonth] = useState<Month>(() => monthOfDay(today));

  // Bucket the items by their dueDate's calendar-day index once; an item with no
  // dueDate — or a malformed one (`dayIndex` → null) — can't be placed on a day, so it
  // goes to the "No due date" strip rather than a dead bucket that matches no cell.
  const { byDay, undated } = useMemo(() => {
    const byDay = new Map<number, WorkItem[]>();
    const undated: WorkItem[] = [];
    for (const it of items) {
      const key = it.dueDate != null ? dayIndex(it.dueDate) : null;
      if (key === null) {
        undated.push(it);
        continue;
      }
      const bucket = byDay.get(key);
      if (bucket) bucket.push(it);
      else byDay.set(key, [it]);
    }
    return { byDay, undated };
  }, [items]);

  // The visible month's weeks: full 7-day rows from the Sunday on/before the 1st to
  // the Saturday on/after the last day, so adjacent-month spill days fill the edges.
  const { weeks, hasDueThisMonth } = useMemo(() => {
    const { year, month } = visibleMonth;
    const firstMs = Date.UTC(year, month, 1);
    const firstDay = Math.floor(firstMs / MS_PER_DAY);
    const firstWeekday = new Date(firstMs).getUTCDay(); // 0=Sun … 6=Sat
    const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
    const gridStart = firstDay - firstWeekday;
    const totalCells = Math.ceil((firstWeekday + daysInMonth) / 7) * 7;

    const weeks: Cell[][] = [];
    let hasDueThisMonth = false;
    let currentWeek: Cell[] = [];
    for (let c = 0; c < totalCells; c += 1) {
      const day = gridStart + c;
      const d = new Date(day * MS_PER_DAY);
      const inMonth = d.getUTCFullYear() === year && d.getUTCMonth() === month;
      const dayItems = byDay.get(day) ?? [];
      if (inMonth && dayItems.length > 0) hasDueThisMonth = true;
      const cell: Cell = {
        day,
        dayNum: d.getUTCDate(),
        inMonth,
        // Gated on inMonth: an adjacent-month spill cell can share today's day
        // index (e.g. day 15 in both the visible month and a spill month), so
        // without this the today ring/aria-current could land on a greyed cell.
        isToday: day === today && inMonth,
        label: dayLabel(day),
        items: dayItems,
      };
      if (c % 7 === 0) {
        currentWeek = [];
        weeks.push(currentWeek);
      }
      currentWeek.push(cell);
    }
    return { weeks, hasDueThisMonth };
  }, [visibleMonth, byDay, today]);

  const byId = useMemo(() => new Map(items.map((i) => [i.id, i] as const)), [items]);

  // A chip landed. The only target a drop can name here is a day, and what it means is the date
  // written on that day — never a distance travelled, because a month grid wraps: the same
  // seven-pixel move is one day in the middle of a row and eight at its end.
  const onDrop = useCallback(
    ({ itemId, targetId }: DragDropEvent) => {
      if (targetId === null || !targetId.startsWith(DAY_TARGET)) return;
      const day = Number(targetId.slice(DAY_TARGET.length));
      if (!Number.isFinite(day)) return;
      const date = dayDate(day);
      const item = byId.get(itemId);
      if (!item || item.dueDate === date) return; // dropped back where it started
      onSetDueDate(itemId, date);
    },
    [byId, onSetDueDate],
  );

  const targetName = useCallback((id: string) => {
    const day = Number(id.slice(DAY_TARGET.length));
    return Number.isFinite(day) ? dayLabel(day) : id;
  }, []);

  if (items.length === 0) {
    return (
      <EmptyState
        title="No work items yet."
        description="Create a work item to start tracking work in this project."
      />
    );
  }

  return (
    <DragSurface
      onDrop={onDrop}
      describeItem={(id) => byId.get(id)?.title ?? id}
      describeTarget={targetName}
    >
      <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-3">
        {/* Month navigation */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-1">
            <button
              type="button"
              aria-label="Previous month"
              onClick={() => setVisibleMonth((m) => addMonths(m, -1))}
              className="rounded p-1 text-apt-text-muted hover:bg-apt-surface-2 hover:text-apt-text"
            >
              <ChevronLeft size={18} aria-hidden />
            </button>
            <h3 className="min-w-[9rem] text-center text-sm font-medium text-apt-text">
              {monthLabel(visibleMonth)}
            </h3>
            <button
              type="button"
              aria-label="Next month"
              onClick={() => setVisibleMonth((m) => addMonths(m, 1))}
              className="rounded p-1 text-apt-text-muted hover:bg-apt-surface-2 hover:text-apt-text"
            >
              <ChevronRight size={18} aria-hidden />
            </button>
          </div>
          <button
            type="button"
            onClick={() => setVisibleMonth(monthOfDay(today))}
            className="rounded px-2 py-1 text-xs text-apt-text-muted hover:bg-apt-surface-2 hover:text-apt-text"
          >
            Today
          </button>
        </div>

        {/* Month grid */}
        <div className="min-h-0 min-w-0 flex-1 overflow-x-auto">
          <div
            role="grid"
            aria-label={`Calendar — ${monthLabel(visibleMonth)}`}
            className="min-w-[44rem] rounded-lg border-l border-t border-apt-border"
          >
            <div role="row" className="grid grid-cols-7">
              {WEEKDAYS.map((w) => (
                <div
                  key={w}
                  role="columnheader"
                  className="border-b border-r border-apt-border px-2 py-1 text-center text-xs font-medium text-apt-text-dim"
                >
                  {w}
                </div>
              ))}
            </div>
            {weeks.map((week, wi) => (
              <div role="row" key={wi} className="grid grid-cols-7">
                {week.map((cell) => (
                  <DropTarget key={cell.day} id={`${DAY_TARGET}${cell.day}`}>
                    {({ setNodeRef, isOver }) => (
                      <div
                        ref={setNodeRef}
                        role="gridcell"
                        aria-label={cell.label}
                        aria-current={cell.isToday ? "date" : undefined}
                        data-testid={cell.isToday ? "calendar-today" : undefined}
                        className={`flex min-h-[6rem] flex-col gap-0.5 border-b border-r border-apt-border p-1 transition-colors ${
                          cell.inMonth ? "" : "bg-apt-surface-2"
                        } ${cell.isToday ? "ring-1 ring-inset ring-apt-gold" : ""} ${
                          // The cell under the pointer, so a drop lands where it looks like it will.
                          // Inset, because the outer ring is already spoken for by "today".
                          isOver ? "bg-apt-highlight/15 ring-1 ring-inset ring-apt-gold/60" : ""
                        }`}
                      >
                        <div
                          className={`px-1 text-right text-xs ${
                            cell.isToday
                              ? "font-semibold text-apt-gold"
                              : cell.inMonth
                                ? "text-apt-text-muted"
                                : "text-apt-text-dim"
                          }`}
                        >
                          {cell.dayNum}
                        </div>
                        {cell.items.map((it) => {
                          const { variant, label } = priorityMeta(it.priority);
                          return (
                            <DragItem key={it.id} id={it.id}>
                              {({ setNodeRef: setChipRef, style, handleProps, dragging }) => (
                                <button
                                  ref={setChipRef}
                                  style={style}
                                  type="button"
                                  onClick={() => onOpenItem(it.id)}
                                  {...handleProps}
                                  title={itemLabel(it)}
                                  aria-label={`${itemLabel(it)} — ${label} priority, due ${cell.label}`}
                                  className={`flex w-full touch-none items-center gap-1 rounded px-1 py-0.5 text-left hover:bg-apt-surface-2 ${
                                    dragging ? "cursor-grabbing bg-apt-surface-2 shadow" : "cursor-grab"
                                  }`}
                                >
                                  <span
                                    aria-hidden
                                    className={`size-1.5 shrink-0 rounded-full ${DOT_TONE[variant]}`}
                                  />
                                  <span className="truncate text-xs text-apt-text">{it.title}</span>
                                </button>
                              )}
                            </DragItem>
                          );
                        })}
                      </div>
                    )}
                  </DropTarget>
                ))}
              </div>
            ))}
          </div>
        </div>

        {!hasDueThisMonth && (
          <p className="text-xs text-apt-text-dim">
            No work items due in {monthLabel(visibleMonth)}.
          </p>
        )}

        {undated.length > 0 && (
          <div className="space-y-1">
            <p className="text-xs font-medium uppercase tracking-wide text-apt-text-dim">
              No due date
            </p>
            <div data-testid="calendar-undated" className="flex flex-wrap gap-1">
              {undated.map((it) => {
                const { variant, label } = priorityMeta(it.priority);
                return (
                  // Draggable too — and this is the strip where dragging earns the most: an item
                  // with no due date is scheduled by putting it on a day, which is exactly the
                  // gesture. (There is no drag back OUT: this strip disappears when it empties, so
                  // "drop here to unschedule" would be a target that comes and goes. Clearing a due
                  // date is the editor's Due field.)
                  <DragItem key={it.id} id={it.id}>
                    {({ setNodeRef, style, handleProps, dragging }) => (
                      <button
                        ref={setNodeRef}
                        style={style}
                        type="button"
                        onClick={() => onOpenItem(it.id)}
                        {...handleProps}
                        title={itemLabel(it)}
                        aria-label={`${itemLabel(it)} — ${label} priority, no due date`}
                        className={`flex touch-none items-center gap-1 rounded border border-apt-border px-2 py-0.5 text-left hover:bg-apt-surface-2 ${
                          dragging ? "cursor-grabbing bg-apt-surface-2 shadow" : "cursor-grab"
                        }`}
                      >
                        <span
                          aria-hidden
                          className={`size-1.5 shrink-0 rounded-full ${DOT_TONE[variant]}`}
                        />
                        <span className="truncate text-xs text-apt-text">{it.title}</span>
                      </button>
                    )}
                  </DragItem>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </DragSurface>
  );
}
