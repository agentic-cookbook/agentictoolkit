"use client";

import { useMemo, type ReactElement } from "react";
import { Badge } from "@agentic-toolkit/ui/components/badge";
import { EmptyState } from "@agentic-toolkit/ui/components/empty-state";
import { type WorkItem } from "@agentic-toolkit/data/projects";
import { priorityMeta } from "../WorkItemEditor";
import { MS_PER_DAY, dayIndex, itemLabel, type BadgeVariant } from "../helpers";

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
 * (never a raw hex). Foundation only: NO drag, NO zoom; the chart scrolls
 * horizontally when it outgrows its column.
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
}: {
  items: WorkItem[];
  onOpenItem: (id: string) => void;
}): ReactElement {
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
    <div className="min-h-0 min-w-0 flex-1 overflow-x-auto">
      <div className="min-w-[48rem] space-y-1">
        {range && (
          <>
            <div className={`${grid} border-b border-apt-border pb-1`}>
              <span className="text-xs font-medium text-apt-text-dim">Timeline</span>
              <div className="relative h-5" aria-hidden>
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
                    {sp.point ? (
                      <span
                        data-testid="timeline-bar"
                        data-item={sp.item.id}
                        title={rangeText}
                        className={`absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rotate-45 rounded-sm border ${tone}`}
                        style={{ left: `${leftPct}%` }}
                      />
                    ) : (
                      <span
                        data-testid="timeline-bar"
                        data-item={sp.item.id}
                        title={rangeText}
                        className={`absolute top-1/2 h-3 -translate-y-1/2 rounded border ${tone}`}
                        style={{ left: `${barLeftPct}%`, width: `${widthPct}%` }}
                      />
                    )}
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
  );
}
