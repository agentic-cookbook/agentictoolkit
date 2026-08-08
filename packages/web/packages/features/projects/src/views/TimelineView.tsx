"use client";

import { useCallback, useMemo, useRef, type ReactElement } from "react";
import { Badge } from "@agentic-toolkit/ui/components/badge";
import { EmptyState } from "@agentic-toolkit/ui/components/empty-state";
import { DragItem, DragSurface, type DragDropEvent } from "@agentic-toolkit/ui/components/dnd";
import { type WorkItem } from "@agentic-toolkit/data/projects";
import { priorityMeta } from "../WorkItemEditor";
import { MS_PER_DAY, dayDate, dayIndex, itemLabel, type BadgeVariant } from "../helpers";

/**
 * The Timeline VIEW of the work-items surface: a Gantt-LITE — a horizontal date
 * axis spanning min(startDate) … max(dueDate) across the dated items, with one
 * row per DATED item and a bar positioned by `startDate` and sized to
 * `startDate→dueDate`. PRESENTATIONAL, like its List/Table/Board siblings: it
 * loads no data and owns no editor; the WorkItemsSurface loads the items ONCE
 * and owns the shared editor. Clicking a row calls `onOpenItem(id)`, which the
 * surface turns into an open editor for that item (a click opens the shared
 * editor from ANY view).
 *
 * Geometry is expressed as PERCENTAGES of the range via inline `style`
 * (`left`/`width`) — position/size are not colors, so the UI gate allows numeric
 * `style`; the bar's COLOR is an `apt-*` token keyed off the priority Badge tone
 * (never a raw hex). NO zoom; the chart scrolls horizontally when it outgrows its
 * column.
 *
 * ## Dragging a bar MOVES the span; it does not resize it
 *
 * A bar has two edges, so unlike a calendar chip it carries a duration — and the whole
 * bar is one drag target, so the gesture can only say "the same span, elsewhere". Both
 * dates shift by the same number of days and the duration is preserved by construction;
 * an item with only ONE date shifts that one and stays half-dated. Changing a duration
 * means changing one edge, which is a second gesture on a target this view does not draw
 * (an edge handle) — the editor's Start/Due fields are where a duration changes today.
 *
 * The drag is locked to the X axis (`axis="x"`), because vertical travel across a chart
 * whose rows are items, not dates, means nothing. The distance is read against the
 * MEASURED track width rather than the percentages the bars are drawn with: the track is
 * a `1fr` column inside a horizontal scroller, so its pixel width is a runtime fact, and
 * rounding `Δx ÷ px-per-day` is what turns a gesture into whole days. A drag too short to
 * cross a day boundary rounds to 0 and is not a write.
 *
 * The bar sits inside the row's `<button>`, so it takes the drag's pointer listeners
 * ALONE — no `role="button"` nested inside one — and the keyboard path to these dates is
 * the editor that same button opens. `onSetSpan` is the surface's, like every other
 * write in this feature; the view stays presentational.
 *
 * Dates that don't map onto the axis are still shown, never dropped:
 *  - an item with only ONE of start/due renders as a point marker at that date;
 *  - an item with NEITHER date — or a MALFORMED date string (`dayIndex` → null) —
 *    goes to the "No dates" section below the chart, so a bad date never produces a
 *    NaN-geometry bar or skews the shared axis for the other items.
 * When no item has a date the axis is skipped entirely (just the "No dates"
 * section renders); with no items at all it's the shared EmptyState.
 */

/** Fill counterpart of the Badge tones: a priority's Badge variant → a solid
 *  `apt-*` bar fill + border. Badge itself is an outline pill, so the SAME tone
 *  is re-expressed here as a background for a filled Gantt bar — colors stay
 *  `apt-*` tokens, never raw hex, so every theme + dark mode work. */
const BAR_TONE: Record<BadgeVariant, string> = {
  neutral: "bg-apt-surface-2 border-apt-border",
  accent: "bg-apt-gold border-apt-gold",
  orange: "bg-apt-orange border-apt-orange",
  blue: "bg-apt-blue border-apt-blue",
  success: "bg-apt-green border-apt-green",
  error: "bg-apt-red border-apt-red",
};

/** A UTC day index → a short axis/tooltip label ("Jul 15"), formatted at UTC so
 *  it matches the index it was derived from regardless of timezone. */
function dayLabel(day: number): string {
  return new Date(day * MS_PER_DAY).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

/** A dated item collapsed to its axis span. `point` = it lands on a single day
 *  (only one of start/due set, or start === due) → a marker rather than a bar. */
type Span = { item: WorkItem; startDay: number; endDay: number; point: boolean };

/** A work item's span, or null when it has NO usable date (→ "No dates"). A present
 *  date that fails to parse (malformed / out of range → `dayIndex` null) makes the
 *  WHOLE item undated — its geometry can't be trusted, so it never lands on the axis.
 *  A lone valid date (start OR due) becomes a point at that day; two dates are
 *  normalised so the earlier is the start even if the pair is stored out of order. */
function spanOf(item: WorkItem): Span | null {
  const s = item.startDate != null ? dayIndex(item.startDate) : null;
  const e = item.dueDate != null ? dayIndex(item.dueDate) : null;
  // A date STRING was present but unparseable → drop the item to "No dates". After
  // these guards a null endpoint means only that the date was ABSENT.
  if (item.startDate != null && s === null) return null;
  if (item.dueDate != null && e === null) return null;
  if (s === null && e === null) return null;
  if (s !== null && e !== null) {
    const lo = Math.min(s, e);
    const hi = Math.max(s, e);
    return { item, startDay: lo, endDay: hi, point: lo === hi };
  }
  const only = (s ?? e) as number;
  return { item, startDay: only, endDay: only, point: true };
}

export function TimelineView({
  items,
  onOpenItem,
  onSetSpan,
}: {
  items: WorkItem[];
  onOpenItem: (id: string) => void;
  /** A bar was dragged: this item's whole span now starts/ends on these "YYYY-MM-DD"
   *  dates. A date the item never had stays null — a shift can't invent an endpoint. */
  onSetSpan: (itemId: string, startDate: string | null, dueDate: string | null) => void;
}): ReactElement {
  // The axis header's track, measured at DROP time to convert pixels into days. It is the
  // same `1fr` grid column every row's track is, so one measurement serves them all — and
  // reading it on demand means a resized window or a scrolled chart needs no observer to
  // stay correct.
  const trackRef = useRef<HTMLDivElement | null>(null);

  // Split the items once into dated spans (drawn on the axis) + undated rows.
  const { spans, undated } = useMemo(() => {
    const spans: Span[] = [];
    const undated: WorkItem[] = [];
    for (const it of items) {
      const sp = spanOf(it);
      if (sp) spans.push(sp);
      else undated.push(it);
    }
    return { spans, undated };
  }, [items]);

  // The overall axis range across every dated item. `total` is clamped to ≥ 1
  // day so a range where every item lands on ONE day never divides by zero.
  const range = useMemo(() => {
    const first = spans[0];
    if (!first) return null;
    let min = first.startDay;
    let max = first.endDay;
    for (const sp of spans) {
      if (sp.startDay < min) min = sp.startDay;
      if (sp.endDay > max) max = sp.endDay;
    }
    return { min, total: Math.max(max - min, 1) };
  }, [spans]);

  // Weekly ticks across the range, thinned to ≤ 12 labels for a wide range and
  // always terminated at the end so the axis reads start … end.
  const ticks = useMemo(() => {
    if (!range) return [] as { day: number; leftPct: number }[];
    const { min, total } = range;
    const step = total / 7 > 12 ? Math.ceil(total / 12) : 7;
    const out: { day: number; leftPct: number }[] = [];
    for (let d = min; d <= min + total; d += step) {
      out.push({ day: d, leftPct: ((d - min) / total) * 100 });
    }
    const last = out[out.length - 1];
    if (!last || last.day !== min + total) {
      out.push({ day: min + total, leftPct: 100 });
    }
    return out;
  }, [range]);

  const byId = useMemo(() => new Map(items.map((i) => [i.id, i] as const)), [items]);

  // A finished drag: turn the horizontal distance into whole days and shift every date
  // the item HAS by that many. The dates are re-derived from the item's own strings
  // rather than from its `Span`, because a Span normalises a reversed pair and forgets
  // which endpoint was absent — and both of those are facts this write must preserve.
  const onDrop = useCallback(
    ({ itemId, delta }: DragDropEvent) => {
      const width = trackRef.current?.getBoundingClientRect().width ?? 0;
      if (!range || width <= 0) return;
      const days = Math.round((delta.x / width) * range.total);
      if (days === 0) return; // too short to cross a day boundary — not a write
      const item = byId.get(itemId);
      if (!item) return;

      // `dayIndex` returns null for a malformed date. Such an item is never drawn on the
      // axis (`spanOf` sends it to "No dates"), so this cannot normally fire — but a shift
      // computed from a null would be NaN, and writing NaN dates is worse than not writing.
      const shift = (date: string | null): string | null | undefined => {
        if (date === null) return null;
        const day = dayIndex(date);
        return day === null ? undefined : dayDate(day + days);
      };
      const startDate = shift(item.startDate);
      const dueDate = shift(item.dueDate);
      if (startDate === undefined || dueDate === undefined) return;
      onSetSpan(itemId, startDate, dueDate);
    },
    [byId, onSetSpan, range],
  );

  if (items.length === 0) {
    return (
      <EmptyState
        title="No work items yet."
        description="Create a work item to start tracking work in this project."
      />
    );
  }

  // Label column + flexible track, shared by the axis header and every row so
  // the bars line up under the ticks.
  const grid = "grid grid-cols-[12rem_minmax(0,1fr)] items-center gap-3";

  return (
    <DragSurface
      onDrop={onDrop}
      axis="x"
      describeItem={(id) => byId.get(id)?.title ?? id}
    >
      <div className="min-h-0 min-w-0 flex-1 overflow-x-auto">
        <div className="min-w-[48rem] space-y-1">
          {range && (
            <>
              <div className={`${grid} border-b border-apt-border pb-1`}>
                <span className="text-xs font-medium text-apt-text-dim">Timeline</span>
                <div className="relative h-5" ref={trackRef} aria-hidden>
                  {ticks.map((t) => (
                    <span
                      key={t.day}
                      className="absolute top-0 whitespace-nowrap text-[0.65rem] text-apt-text-dim"
                      style={{ left: `${t.leftPct}%` }}
                    >
                      {dayLabel(t.day)}
                    </span>
                  ))}
                </div>
              </div>

              {spans.map((sp) => {
                const { variant, label } = priorityMeta(sp.item.priority);
                const tone = BAR_TONE[variant];
                const rangeText = sp.point
                  ? dayLabel(sp.startDay)
                  : `${dayLabel(sp.startDay)} – ${dayLabel(sp.endDay)}`;
                const leftPct = ((sp.startDay - range.min) / range.total) * 100;
                // A one-day bar would collapse to 0% — floor the width so it stays
                // visible; points skip this and draw a fixed marker instead.
                const widthPct = Math.max(
                  ((sp.endDay - sp.startDay) / range.total) * 100,
                  1.5,
                );
                // The width floor can push a short bar's right edge past 100% —
                // clamp its left so left + width never overhangs the range.
                const barLeftPct = Math.max(Math.min(leftPct, 100 - widthPct), 0);
                return (
                  <button
                    key={sp.item.id}
                    type="button"
                    onClick={() => onOpenItem(sp.item.id)}
                    aria-label={`${itemLabel(sp.item)} — ${label} priority, ${rangeText}`}
                    className={`${grid} w-full rounded py-1 text-left hover:bg-apt-surface-2`}
                  >
                    <span className="truncate text-sm text-apt-text" title={itemLabel(sp.item)}>
                      {sp.item.title}
                    </span>
                    <span className="relative block h-5">
                      {/* Two things about the style here, both load-bearing.
                          Only `transform` and `zIndex` are taken from the drag state, never
                          the whole object: it also carries `position: relative` while
                          dragging, and these marks are positioned ABSOLUTELY against the
                          track — adopting it wholesale would drop every bar to the left edge
                          the instant it was picked up. And the mark's OWN centering (and the
                          point's 45° turn) moves out of Tailwind into that same inline
                          transform, because a `style.transform` REPLACES a class one: leave
                          them as classes and a picked-up bar silently un-centres itself. */}
                      <DragItem id={sp.item.id}>
                        {({ setNodeRef, style, handleProps, dragging }) => {
                          const grab = dragging ? "cursor-grabbing" : "cursor-grab";
                          const drag = style.transform ? `${style.transform} ` : "";
                          return sp.point ? (
                            <span
                              ref={setNodeRef}
                              data-testid="timeline-bar"
                              data-item={sp.item.id}
                              title={rangeText}
                              {...handleProps}
                              className={`absolute top-1/2 size-3 touch-none rounded-sm border ${tone} ${grab}`}
                              style={{
                                left: `${leftPct}%`,
                                transform: `${drag}translate(-50%, -50%) rotate(45deg)`,
                                zIndex: style.zIndex,
                              }}
                            />
                          ) : (
                            <span
                              ref={setNodeRef}
                              data-testid="timeline-bar"
                              data-item={sp.item.id}
                              title={rangeText}
                              {...handleProps}
                              className={`absolute top-1/2 h-3 touch-none rounded border ${tone} ${grab}`}
                              style={{
                                left: `${barLeftPct}%`,
                                width: `${widthPct}%`,
                                transform: `${drag}translateY(-50%)`,
                                zIndex: style.zIndex,
                              }}
                            />
                          );
                        }}
                      </DragItem>
                    </span>
                  </button>
                );
              })}
            </>
          )}

          {undated.length > 0 && (
            <div className="mt-4 space-y-1">
              <p className="text-xs font-medium uppercase tracking-wide text-apt-text-dim">
                No dates
              </p>
              {undated.map((it) => (
                <button
                  key={it.id}
                  type="button"
                  onClick={() => onOpenItem(it.id)}
                  aria-label={`${itemLabel(it)} — unscheduled`}
                  className="flex w-full items-center gap-2 rounded py-1 text-left hover:bg-apt-surface-2"
                >
                  <span className="truncate text-sm text-apt-text">{it.title}</span>
                  <Badge variant="neutral">Unscheduled</Badge>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </DragSurface>
  );
}
