import { type ComponentProps } from "react";
import { Badge } from "@agentic-toolkit/ui/components/badge";
import type { WorkItem } from "@agentic-toolkit/data/projects";
import type { ProjectStatus, ProjectParticipant } from "@agentic-toolkit/data/projects";
import { participantLabel } from "./AssigneePicker";

/**
 * Shared view helpers for the projects panes. These were byte-identical private
 * copies in the Work Items (T4) and Board (T5) panes; hoisted here as the single
 * source so the two panes (and WorkItemEditor's BadgeVariant) read the same map.
 * Pure functions + a type only — no component, so no "use client" needed.
 */

/** Badge's own variant union (never redeclare the string literals) so a tone
 *  stays a Badge variant, not a raw color. */
export type BadgeVariant = NonNullable<ComponentProps<typeof Badge>["variant"]>;

/* ── Calendar-day math ─────────────────────────────────────────────────────
 * Work-item `startDate`/`dueDate` are date-only "YYYY-MM-DD" strings. Parse each on
 * the viewer's LOCAL calendar (`new Date(y, m-1, d)`), never the UTC-midnight
 * `new Date("YYYY-MM-DD")` — so a date lands on the same wall-clock day the viewer
 * sees, matching a "today" that is likewise read from the local calendar (see
 * CalendarView.todayIndex). A malformed or out-of-range string yields `null` (never a
 * NaN index that would poison the whole chart / silently drop into a dead bucket). The
 * single source the Timeline and Calendar VIEWS share so a date lands on the same day
 * in both. */

export const MS_PER_DAY = 86_400_000;

/** A "YYYY-MM-DD" date → an integer calendar-day index (days since the epoch), or
 *  `null` for any input that is not a real `YYYY-MM-DD` calendar day. The parts are
 *  parsed in LOCAL time (`new Date(y, m-1, d)`) and round-tripped so an impossible day
 *  ("2026-02-31", "2026-13-40") is rejected rather than silently rolled over. The index
 *  itself is the canonical day number of the validated parts, so it is timezone-stable
 *  and round-trips with the UTC label reconstruction the two views use. */
export function dayIndex(date: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  const dt = new Date(y, mo - 1, d); // LOCAL calendar day, not UTC
  if (dt.getFullYear() !== y || dt.getMonth() !== mo - 1 || dt.getDate() !== d) {
    return null; // an out-of-range day rolled over to another date — reject it
  }
  return Math.floor(Date.UTC(y, mo - 1, d) / MS_PER_DAY);
}

/** A board status's category → Badge tone. */
export function categoryVariant(category: ProjectStatus["category"]): BadgeVariant {
  switch (category) {
    case "in_progress":
      return "blue";
    case "done":
      return "success";
    default:
      return "neutral";
  }
}

/** Resolve a work item's statusId to its board label + Badge tone (a stale/unknown
 *  id falls back to neutral "—" so the cell never blanks). The single source the
 *  List and Table VIEWS share, so a status renders identically across views. */
export function statusMeta(
  statusId: string,
  statuses: ProjectStatus[],
): { label: string; variant: BadgeVariant } {
  const s = statuses.find((x) => x.id === statusId);
  return s
    ? { label: s.label, variant: categoryVariant(s.category) }
    : { label: "—", variant: "neutral" };
}

/** Resolve a work item's assignee to a participant label; "Unassigned" when
 *  unset, or the raw id when the assignee is no longer a listed participant. */
export function assigneeLabel(item: WorkItem, participants: ProjectParticipant[]): string {
  if (!item.assigneeKind || !item.assigneeId) return "Unassigned";
  const p = participants.find(
    (x) => x.participantKind === item.assigneeKind && x.participantId === item.assigneeId,
  );
  return p ? participantLabel(p) : item.assigneeId;
}
