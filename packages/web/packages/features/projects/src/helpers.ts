import { type ComponentProps } from "react";
import { Badge } from "@agentic-toolkit/ui/components/badge";
import type { ProjectActivity, WorkItem } from "@agentic-toolkit/data/projects";
import type { ProjectStatus, ProjectParticipant, StatusCategory } from "@agentic-toolkit/data/projects";
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

/** The viewer's LOCAL calendar day as a day index, matching what {@link dayIndex} returns for a
 *  date-only string. Read from the wall-clock parts — NOT `Date.now()`'s UTC instant — so a
 *  viewer whose local day differs from UTC near a day boundary gets their own day, which is what
 *  makes "overdue" and the Calendar's Today ring agree with the date on their wall. Shared by the
 *  Calendar view (which highlights it) and Overview (which counts what is past it) so the two can
 *  never disagree about which day it is. Fake clocks in tests pin the underlying `new Date()`. */
export function todayIndex(): number {
  const now = new Date();
  return Math.floor(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) / MS_PER_DAY);
}

/**
 * A board status's category → Badge tone.
 *
 * A total Record rather than a switch with a `default`, because the category set is closed and
 * owned by the backend: written this way, ADDING a category is a type error here instead of
 * silently falling through to "neutral" — which is how a new bucket would otherwise ship
 * looking exactly like "not started".
 *
 * The tones carry the coarse reading — not started / in flight / finished / stopped — so
 * `backlog` and `todo` deliberately share one: nothing in the palette is dimmer than neutral,
 * and their labels already tell them apart. `canceled` takes "error" not because a cancellation
 * is a failure but because it is the one tone that reads terminal-and-not-achieved; giving it
 * "success" or "neutral" is exactly the conflation the category exists to prevent.
 */
const CATEGORY_VARIANT: Record<StatusCategory, BadgeVariant> = {
  backlog: "neutral",
  todo: "neutral",
  in_progress: "blue",
  done: "success",
  canceled: "error",
};

export function categoryVariant(category: ProjectStatus["category"]): BadgeVariant {
  // A board row can arrive from an older/newer backend than this bundle, so an unrecognised
  // category falls back rather than rendering `undefined` as a class.
  return CATEGORY_VARIANT[category] ?? "neutral";
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

/** How a card names itself in TEXT — `ADH-42 — Fix the login redirect`, or just the title when
 *  the card has no key yet. For the places a key cannot be shown as its own element: a tooltip,
 *  an aria-label, a confirmation sentence. The dense date views (Calendar, Timeline) place a chip
 *  by a DATE and size it to the space left over, so a monospace key inline would eat the title on
 *  exactly the narrowest bars; naming it here keeps the key reachable there without that cost. */
export function itemLabel(item: Pick<WorkItem, "itemKey" | "title">): string {
  return item.itemKey ? `${item.itemKey} — ${item.title}` : item.title;
}

/** The NUMERIC half of a rendered key (`ADH-42` → 42), for ordering a column of keys — sorting
 *  their text would put `ADH-42` above `ADH-7`. An unassigned or unparseable key sorts to 0, so
 *  the keyless cluster together at one end rather than scattering. */
export function itemKeyNumber(itemKey: string): number {
  const n = Number(itemKey.slice(itemKey.lastIndexOf("-") + 1));
  return Number.isFinite(n) ? n : 0;
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

/* ── Activity phrasing ─────────────────────────────────────────────────────
 * How a raw activity row reads as a sentence. Shared by the full ActivityFeed and by
 * Overview's recent-activity summary, because the same event must not be worded two
 * different ways depending on which pane you happen to be looking at. */

/** The actor's display name: the label if present, else a phrasing of kind/id. */
export function actorText(a: ProjectActivity): string {
  if (a.actorLabel) return a.actorLabel;
  if (a.actorKind && a.actorId) return `${a.actorKind} · ${a.actorId}`;
  return a.actorKind ?? a.actorId ?? "Someone";
}

/** Human phrasing of an `action` string; the raw value is the fallback.
 *
 *  A switch with a `default` rather than a total Record (unlike CATEGORY_VARIANT above) because
 *  the action set is OPEN — the backend appends new action strings as features land, and a bundle
 *  older than the backend must render the raw string rather than blank the row. */
export function actionPhrase(action: string): string {
  switch (action) {
    case "project.created":
      return "created the project";
    case "project.updated":
      return "updated the project";
    case "project.archived":
      return "archived the project";
    case "work_item.created":
      return "created a work item";
    case "work_item.updated":
      return "updated a work item";
    case "work_item.status_changed":
      return "changed status";
    case "work_item.assigned":
      return "assigned";
    case "work_item.unassigned":
      return "unassigned";
    case "work_item.reparented":
      return "moved";
    case "work_item.deleted":
      return "deleted a work item";
    case "comment.added":
      return "commented";
    case "field.created":
      return "added a field";
    case "field.updated":
      return "updated a field";
    case "field.deleted":
      return "removed a field";
    case "participant.added":
      return "added a participant";
    case "participant.removed":
      return "removed a participant";
    default:
      return action;
  }
}

/** A comment row's body from its detail payload, when present. */
export function commentBody(a: ProjectActivity): string | null {
  const body = a.detail?.body;
  return typeof body === "string" && body.trim() ? body : null;
}

/** A relative "3 minutes ago" phrasing via the platform's Intl formatter. */
export function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const sec = Math.round((Date.now() - then) / 1000);
  const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });
  if (Math.abs(sec) < 60) return rtf.format(-sec, "second");
  const min = Math.round(sec / 60);
  if (Math.abs(min) < 60) return rtf.format(-min, "minute");
  const hr = Math.round(min / 60);
  if (Math.abs(hr) < 24) return rtf.format(-hr, "hour");
  const day = Math.round(hr / 24);
  if (Math.abs(day) < 30) return rtf.format(-day, "day");
  const month = Math.round(day / 30);
  if (Math.abs(month) < 12) return rtf.format(-month, "month");
  return rtf.format(-Math.round(month / 12), "year");
}
