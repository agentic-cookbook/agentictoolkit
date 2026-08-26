import { type ComponentProps } from "react";
import { Badge } from "@agenticdevelopertoolkit/ui/components/badge";
import type { ProjectActivity, ProjectComment, WorkItem } from "@agentic-toolkit/data/projects";
import type {
  EstimateScale,
  IterationState,
  ProjectHealth,
  ProjectStatus,
  ProjectParticipant,
  PriorityScale,
  RelationKind,
  StatusCategory,
} from "@agentic-toolkit/data/projects";
import { participantLabel } from "./AssigneePicker";
import { DEFAULT_ITEM_WORDS, type ItemWords } from "./vocabulary";

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

/** The inverse of {@link dayIndex}: a calendar-day index → the "YYYY-MM-DD" a date field stores.
 *
 *  Read back from the UTC parts, because the index IS `Date.UTC(...)` of the validated calendar
 *  parts. Formatting it locally instead would hand anyone west of Greenwich the PREVIOUS day —
 *  drop a card on the 3rd and it comes back due the 2nd — which is the kind of defect that only
 *  shows up on someone else's machine. */
export function dayDate(day: number): string {
  const d = new Date(day * MS_PER_DAY);
  const month = String(d.getUTCMonth() + 1).padStart(2, "0");
  const date = String(d.getUTCDate()).padStart(2, "0");
  return `${d.getUTCFullYear()}-${month}-${date}`;
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

/* ── Estimates ─────────────────────────────────────────────────────────────
 * A project's `estimateScale` names WHICH numbers its picker offers; the numbers themselves
 * live here and nowhere else. That split is the backend's, stated in the schema: the column is
 * a vocabulary key, and what a key means to a reader — that 3 is "3", that 2 is "M" — is
 * presentation. So a scale can be re-spelled without a migration, and the database never has to
 * hold a copy of a t-shirt size.
 *
 * Every scale stores a plain non-negative integer, which is what makes the scale ADVISORY: a
 * project that switches from fibonacci to linear keeps its 8s, and they still render as 8 — just
 * no longer offered in the picker. Nothing rewrites a card because its board changed its mind. */

/** The values one scale offers, in the order a picker lists them. `none` offers nothing, which
 *  is what makes "this project does not estimate" a state a renderer can act on rather than a
 *  special case it has to know about: an empty list means no picker and no chip. */
const ESTIMATE_OPTIONS: Record<EstimateScale, { value: number; label: string }[]> = {
  none: [],
  // A plain count of points, 0-10 — the scale for a team that wants arithmetic rather than a
  // ladder, and the one that has no gaps.
  points: Array.from({ length: 11 }, (_, n) => ({ value: n, label: String(n) })),
  // The classic planning-poker ladder. The gaps are the point: they refuse the false precision
  // of choosing between 6 and 7 on work nobody has started.
  fibonacci: [0, 1, 2, 3, 5, 8, 13].map((n) => ({ value: n, label: String(n) })),
  // Doubling — for teams who size by order of magnitude and want "twice as big" to be the only
  // question asked.
  exponential: [0, 1, 2, 4, 8, 16].map((n) => ({ value: n, label: String(n) })),
  // Even steps, for a team that wants the ladder to be a straight line.
  linear: [0, 1, 2, 3, 4, 5].map((n) => ({ value: n, label: String(n) })),
  // Sizes, stored as their POSITION on the ladder — the stored column is an integer for every
  // scale, so a board that switches to t-shirts keeps its numbers and simply reads them as
  // letters. `XS` is 0, matching the other scales' floor.
  tshirt: ["XS", "S", "M", "L", "XL", "XXL"].map((label, value) => ({ value, label })),
};

/** The values `scale` offers, in picker order (empty for `none`). */
export function estimateOptions(scale: EstimateScale): { value: number; label: string }[] {
  return ESTIMATE_OPTIONS[scale] ?? [];
}

/** How a scale READS to someone choosing one — the scale's own name, plus what picking it does.
 *  A total Record over the closed set for the same reason the options table is one: a scale the
 *  backend adds later is a type error here, not an option that silently goes unnamed. */
const ESTIMATE_SCALE_META: Record<EstimateScale, { label: string; hint: string }> = {
  none: { label: "Don't estimate", hint: "no size field on this project's cards" },
  points: { label: "Points", hint: "0–10" },
  fibonacci: { label: "Fibonacci", hint: "0, 1, 2, 3, 5, 8, 13" },
  exponential: { label: "Exponential", hint: "0, 1, 2, 4, 8, 16" },
  linear: { label: "Linear", hint: "0–5" },
  tshirt: { label: "T-shirt sizes", hint: "XS – XXL" },
};

/** Every scale, in the order a chooser lists them: `none` first because it is the DB default and
 *  therefore the state most projects are already in, then the numeric ladders from finest to
 *  coarsest, then the one that is not a quantity at all. */
export const ESTIMATE_SCALES: EstimateScale[] = [
  "none",
  "points",
  "fibonacci",
  "exponential",
  "linear",
  "tshirt",
];

/** A scale's name on its own — for a chooser's option, or a sentence naming which scale a board
 *  estimates in. */
export function estimateScaleLabel(scale: EstimateScale): string {
  return ESTIMATE_SCALE_META[scale].label;
}

/** A scale's name with the values it offers, e.g. `Fibonacci (0, 1, 2, 3, 5, 8, 13)` — what an
 *  option in a chooser says, so picking one never requires opening a card to find out what it
 *  did. */
export function estimateScaleOptionLabel(scale: EstimateScale): string {
  const meta = ESTIMATE_SCALE_META[scale];
  return `${meta.label} (${meta.hint})`;
}

/**
 * Whether sizes on `scale` may be ADDED UP.
 *
 * True for every numeric ladder and false for t-shirts, because a t-shirt size is stored as its
 * POSITION on the ladder (XS is 0) — so summing them says three XS cards are no work at all, and
 * the total of a mixed box is a number with no unit. The distinction exists here rather than at
 * each call site so a rollup cannot forget it: `estimateLabel` renders a t-shirt honestly, and
 * this is the matching answer for arithmetic.
 */
export function estimateScaleIsSummable(scale: EstimateScale): boolean {
  return scale !== "none" && scale !== "tshirt";
}

/** How a RANKING setting reads to someone choosing one. A total Record over the closed set for the
 *  same reason the estimate one is: a scale the backend adds later is a type error here rather
 *  than an option that silently goes unnamed. The labels the values themselves carry live in
 *  `PRIORITIES` — this names the SETTING, not the ranks. */
const PRIORITY_SCALE_META: Record<PriorityScale, { label: string; hint: string }> = {
  standard: { label: "Standard", hint: "None, Low, Medium, High, Urgent" },
  none: { label: "Don't rank", hint: "no priority field on this project's cards" },
};

/** Every priority scale, in the order a chooser lists them. `standard` leads — the OPPOSITE way
 *  round from {@link ESTIMATE_SCALES}, and for the same reason: each list opens on the state most
 *  boards are already in, and ranking is the DB default while estimating is not. */
export const PRIORITY_SCALES: PriorityScale[] = ["standard", "none"];

/** A ranking setting's name with what picking it does, e.g. `Standard (None, Low, Medium, High,
 *  Urgent)` — so choosing never requires opening a card to find out what it did. */
export function priorityScaleOptionLabel(scale: PriorityScale): string {
  const meta = PRIORITY_SCALE_META[scale];
  return `${meta.label} (${meta.hint})`;
}

/**
 * How an estimate READS on a card, or `null` when there is nothing to show — the card is
 * unestimated, or its project does not estimate at all.
 *
 * `null` rather than a dash so a caller renders no chip instead of an empty one: on a board
 * where nothing is estimated, a column of dashes is noise that looks like missing data.
 *
 * A value the scale no longer offers still renders — as itself for a numeric scale, and as the
 * bare number for t-shirts, since there is no letter to give it. That is the honest reading of a
 * card sized under a scale the board has since changed, and it is why this never blanks.
 */
export function estimateLabel(estimate: number | null, scale: EstimateScale): string | null {
  if (estimate === null || scale === "none") return null;
  const opt = estimateOptions(scale).find((o) => o.value === estimate);
  return opt ? opt.label : String(estimate);
}

/* ── Iterations ────────────────────────────────────────────────────────── */

/** An iteration's derived state → its label and Badge tone. A total Record for the same reason
 *  CATEGORY_VARIANT is one: the set is closed and the backend owns it, so a state added later is
 *  a type error here rather than an unlabelled badge. `active` takes the one tone that reads
 *  "happening now"; `completed` is finished, not successful, but success is the palette's only
 *  terminal-and-done tone and a cycle that ended IS done. */
const ITERATION_STATE_META: Record<IterationState, { label: string; variant: BadgeVariant }> = {
  upcoming: { label: "Upcoming", variant: "neutral" },
  active: { label: "Active", variant: "blue" },
  completed: { label: "Completed", variant: "success" },
};

export function iterationStateMeta(state: IterationState): {
  label: string;
  variant: BadgeVariant;
} {
  // A row can arrive from a backend newer than this bundle, so an unrecognised state falls back
  // to its own raw string rather than rendering `undefined` as a class.
  return ITERATION_STATE_META[state] ?? { label: String(state), variant: "neutral" };
}

/** An iteration's dates as one phrase — `3 Feb – 16 Feb 2026`. Both ends are inclusive, so this
 *  is the span a person can hold a card against. The year is stated once, on the end, unless the
 *  box straddles two. Formatted through `Intl`, so the viewer's own locale orders the parts. */
export function iterationDateRange(startDate: string, endDate: string): string {
  const start = dayIndex(startDate);
  const end = dayIndex(endDate);
  if (start === null || end === null) return `${startDate} – ${endDate}`;
  const at = (day: number) => new Date(day * MS_PER_DAY);
  const sameYear = at(start).getUTCFullYear() === at(end).getUTCFullYear();
  const dayMonth: Intl.DateTimeFormatOptions = { day: "numeric", month: "short", timeZone: "UTC" };
  const full: Intl.DateTimeFormatOptions = { ...dayMonth, year: "numeric" };
  const fmt = (day: number, opts: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat(undefined, opts).format(at(day));
  return `${fmt(start, sameYear ? dayMonth : full)} – ${fmt(end, full)}`;
}

/* ── Dates a plan is made of ───────────────────────────────────────────── */

/** One date-only value as a phrase — `16 Feb 2026`. The single-ended sibling of
 *  {@link iterationDateRange}, for the fields that name a POINT rather than a span: a milestone's
 *  target, a project's start, a program's end. Parsed through {@link dayIndex} and formatted from
 *  the UTC parts for the reason `dayDate` documents — formatting locally would hand anyone west of
 *  Greenwich the previous day. An unparseable value is echoed rather than swallowed, so a bad row
 *  reads as its own raw text instead of silently vanishing. */
export function dateLabel(date: string): string {
  const day = dayIndex(date);
  if (day === null) return date;
  return new Intl.DateTimeFormat(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(day * MS_PER_DAY));
}

/** How many days from the viewer's own today to `date` — negative in the PAST, `0` today, `null`
 *  for anything that is not a calendar day. The one place "is this date behind us" is computed, so
 *  a milestone's overdue chip and a project's slipped target cannot disagree about which day it is
 *  (both read {@link todayIndex}, which is the viewer's local day, not UTC's). */
export function daysUntil(date: string): number | null {
  const day = dayIndex(date);
  return day === null ? null : day - todayIndex();
}

/* ── Health ────────────────────────────────────────────────────────────── */

/**
 * A reported health → its label and Badge tone. A total Record for the reason CATEGORY_VARIANT is
 * one: the set is closed and the backend owns it (`status_updates_health_chk`), so a health added
 * later is a type error here rather than an unlabelled badge.
 *
 * The tones are the palette's three warnings in order, and `on_track` takes "success" rather than
 * "blue" deliberately: a health is a CLAIM about whether the plan will hold, so the tone has to
 * carry reassurance or alarm, not activity. There is no tone for "nobody has reported" — that is
 * the absence of a claim, not a fourth one, and the panes render it as a sentence.
 */
const HEALTH_META: Record<ProjectHealth, { label: string; variant: BadgeVariant }> = {
  on_track: { label: "On track", variant: "success" },
  at_risk: { label: "At risk", variant: "orange" },
  off_track: { label: "Off track", variant: "error" },
};

/** Every health, in the order a reporter is offered them — best to worst, so the list reads as a
 *  scale rather than a bag, and the least alarming answer is the one a mis-click lands on. */
export const PROJECT_HEALTHS: ProjectHealth[] = ["on_track", "at_risk", "off_track"];

export function healthMeta(health: ProjectHealth): { label: string; variant: BadgeVariant } {
  // A row can arrive from a backend newer than this bundle, so an unrecognised health falls back
  // to its own raw string rather than rendering `undefined` as a class.
  return HEALTH_META[health] ?? { label: String(health), variant: "neutral" };
}

/** How a card names itself in TEXT — `ADH-42 — Fix the login redirect`, or just the title when
 *  the card has no key yet. For the places a key cannot be shown as its own element: a tooltip,
 *  an aria-label, a confirmation sentence. The dense date views (Calendar, Timeline) place a chip
 *  by a DATE and size it to the space left over, so a monospace key inline would eat the title on
 *  exactly the narrowest bars; naming it here keeps the key reachable there without that cost. */
export function itemLabel(item: Pick<WorkItem, "itemKey" | "title">): string {
  return item.itemKey ? `${item.itemKey} — ${item.title}` : item.title;
}

/* ── Relation phrasing ─────────────────────────────────────────────────────
 * A link between two cards is stored ONCE, as a directed edge, and read from both ends. So the
 * word for it is a function of the kind AND of which end you are standing on — the same row is
 * "Blocked by" to one card and "Blocks" to the other. Naming that here, rather than in the pane,
 * is what lets a list of relations read as sentences about the card in front of you. */

/** How a relation reads FROM the card that asked for it. `depends_on` inverts across the two
 *  directions because it is the only kind that claims an order; `relates_to` reads the same from
 *  both ends because it is symmetric — the edge's direction is storage, not meaning. */
export function relationLabel(
  kind: RelationKind,
  direction: "outgoing" | "incoming",
): string {
  const outgoing = direction === "outgoing";
  switch (kind) {
    case "depends_on":
      return outgoing ? "Blocked by" : "Blocks";
    case "duplicates":
      return outgoing ? "Duplicates" : "Duplicated by";
    case "relates_to":
      return "Related to";
  }
}

/** The kinds a person can FILE from a card, in the order they are offered. Outgoing by
 *  construction — the new edge leaves the card you are on — so each label is the outgoing
 *  phrasing above, and the inverse appears by itself on the other card. */
export const RELATION_CHOICES: { value: RelationKind; label: string }[] = [
  { value: "depends_on", label: relationLabel("depends_on", "outgoing") },
  { value: "relates_to", label: relationLabel("relates_to", "outgoing") },
  { value: "duplicates", label: relationLabel("duplicates", "outgoing") },
];

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

/**
 * How a principal recorded on a row reads: the label captured at the time if there is one, else
 * a phrasing of kind/id, else an admission that we do not know.
 *
 * The label is a SNAPSHOT — the email or handle as it stood when the row was written — so it is
 * preferred over anything looked up now: a trail that silently re-attributes old events to a
 * person's current name is a trail you cannot cite.
 */
export function principalText(
  kind: string | null,
  id: string | null,
  label: string | null,
): string {
  if (label) return label;
  if (kind && id) return `${kind} · ${id}`;
  return kind ?? id ?? "Someone";
}

/** The actor's display name on an activity row. */
export function actorText(a: ProjectActivity): string {
  return principalText(a.actorKind, a.actorId, a.actorLabel);
}

/** The author's display name on a comment — the same phrasing as the trail's actor, so one
 *  person is not named two different ways depending on which pane you are looking at. */
export function authorText(c: ProjectComment): string {
  return principalText(c.authorKind, c.authorId, c.authorLabel);
}

/** True when a trail row's `changed` list holds exactly `key` and nothing else. Written
 *  positively — a row from before `changed` existed has no list at all, and "we do not know what
 *  changed" must not read as "only the name did". */
function changedOnly(detail: Record<string, unknown> | null | undefined, key: string): boolean {
  const changed = detail?.changed;
  return Array.isArray(changed) && changed.length === 1 && changed[0] === key;
}

/** True when a trail row's `changed` list mentions `key` at all — the weaker question, for the
 *  fields whose movement is worth naming even when it travelled with something else. */
function changedIncludes(
  detail: Record<string, unknown> | null | undefined,
  key: string,
): boolean {
  const changed = detail?.changed;
  return Array.isArray(changed) && changed.includes(key);
}

/** The three healths a status update can report, phrased as the report itself. `detail.health` is
 *  the value on the row the trail entry is about: on a post it is what was claimed, and on a
 *  retraction it is what is being withdrawn. Anything else — including a row with no health at
 *  all — falls back to the caller's general sentence rather than guessing a direction. */
function healthPhrase(
  detail: Record<string, unknown> | null | undefined,
  verb: "reported" | "retracted",
): string | null {
  const said = verb === "reported" ? "reported the project" : "retracted";
  switch (detail?.health) {
    case "on_track":
      return verb === "reported" ? `${said} on track` : `${said} an on-track report`;
    case "at_risk":
      return verb === "reported" ? `${said} at risk` : `${said} an at-risk report`;
    case "off_track":
      return verb === "reported" ? `${said} off track` : `${said} an off-track report`;
    default:
      return null;
  }
}

/** Human phrasing of an `action` string; the raw value is the fallback.
 *
 *  A switch with a `default` rather than a total Record (unlike CATEGORY_VARIANT above) because
 *  the action set is OPEN — the backend appends new action strings as features land, and a bundle
 *  older than the backend must render the raw string rather than blank the row.
 *
 *  `detail` is optional because most actions say everything in their name. The exceptions are the
 *  actions the backend deliberately writes ONE of where a person would see several — a link
 *  (`dependency.added` covers three relationships, and "linked an item" throws away the only fact
 *  that separates a prerequisite from a duplicate), a reorder, a batch of field values, and a
 *  saved-view edit that may be a rename or a re-point. Each of those reads its distinguishing fact
 *  out of `detail`, so a caller with the row in hand passes it; one without still gets a sentence,
 *  just the more general one.
 *
 *  `words` is the BOARD's noun for its cards. Optional, and defaulted, because a trail is also read
 *  where no single board is in hand — and the actions that name a card are a minority of this
 *  switch: the rest name the project's own parts, which a rename does not touch. */
export function actionPhrase(
  action: string,
  detail?: Record<string, unknown> | null,
  words: ItemWords = DEFAULT_ITEM_WORDS,
): string {
  // The link kinds, phrased from the acting card's side — the activity row hangs off the card
  // that filed the link, so "added a dependency" is read from the end that now waits.
  if (action === "dependency.added" || action === "dependency.removed") {
    const added = action === "dependency.added";
    switch (detail?.kind) {
      case "relates_to":
        return added ? "linked a related item" : "unlinked a related item";
      case "duplicates":
        return added ? "marked an item as a duplicate" : "removed a duplicate mark";
      // `depends_on` explicitly AND as the fallback: every row written before `kind` existed is
      // a dependency, so a missing kind is not unknown — it is the original meaning.
      default:
        return added ? "added a dependency" : "removed a dependency";
    }
  }
  switch (action) {
    case "project.created":
      return "created the project";
    case "project.updated":
      return "updated the project";
    case "project.archived":
      return "archived the project";
    case "project.deleted":
      return "deleted the project";
    case "work_item.created":
      return `created a ${words.one}`;
    case "work_item.updated":
      return `updated a ${words.one}`;
    case "work_item.status_changed":
      return "changed status";
    case "work_item.assigned":
      return "assigned";
    case "work_item.unassigned":
      return "unassigned";
    case "work_item.reparented":
      return "moved";
    // Reordering among siblings, which the backend records as the NEIGHBOURS the card landed
    // between. A side stated as `null` is not an absent neighbour but a named destination — the
    // server reads `{ after: null }` as the top of the list and `{ before: null }` as the bottom —
    // and those two are the only placements worth a sentence of their own.
    case "work_item.moved":
      if (detail?.after === null) return `moved a ${words.one} to the top`;
      if (detail?.before === null) return `moved a ${words.one} to the bottom`;
      return `reordered a ${words.one}`;
    // One row covers a whole batch of set-or-cleared values, so the count is the only thing that
    // distinguishes them and `detail.fieldIds` is the only place it is written down.
    case "work_item.fields_updated":
      return Array.isArray(detail?.fieldIds) && detail.fieldIds.length === 1
        ? "updated a field value"
        : "updated field values";
    // The trail carries `{ from, to }` iteration ids, and `to: null` is the backlog — a real
    // destination, so it gets its own sentence rather than being read as an absent one.
    case "work_item.iteration_changed":
      return detail?.to === null ? "moved to the backlog" : "committed to an iteration";
    // Same `{ from, to }` shape as the iteration move and the same reading of `to: null` — a
    // stated destination, not a missing one. The words differ because the two mean different
    // things: an iteration is a time-box a card is committed to, a milestone is a point in the
    // plan a card counts toward, and a card off every milestone is not "in a backlog".
    case "work_item.milestone_changed":
      return detail?.to === null
        ? `removed a ${words.one} from a milestone`
        : `moved a ${words.one} to a milestone`;
    case "work_item.deleted":
      return `deleted a ${words.one}`;
    case "comment.added":
      return "commented";
    case "comment.edited":
      return "edited a comment";
    case "comment.deleted":
      return "removed a comment";
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
    case "status.created":
      return "added a status";
    case "status.updated":
      return "updated a status";
    case "status.deleted":
      return "removed a status";
    case "saved_view.created":
      return "saved a view";
    // `detail.changed` names the columns the PATCH actually wrote — the route drops a no-op set
    // before recording anything — so a lone `name` is a rename and everything else re-points the
    // view at a different board. Two very different events under one action string.
    case "saved_view.updated":
      return changedOnly(detail, "name") ? "renamed a saved view" : "updated a saved view";
    case "saved_view.deleted":
      return "deleted a saved view";
    case "milestone.created":
      return "added a milestone";
    // A milestone is a DATE with a label on it, so moving the date is the event a plan's readers
    // are watching for — it slips the point everything else is counted against. `changed` is the
    // only place either fact is written down; a rename gets its own sentence for the same reason
    // a saved view's does.
    case "milestone.updated":
      if (changedOnly(detail, "name")) return "renamed a milestone";
      if (changedOnly(detail, "targetDate")) return "moved a milestone's date";
      return "updated a milestone";
    case "milestone.deleted":
      return "removed a milestone";
    // The health rides along on the row precisely so this reads without a second fetch. A post
    // with no health is a row this bundle does not understand, not a neutral report — say the
    // general thing rather than invent a direction.
    case "status_update.posted":
      return healthPhrase(detail, "reported") ?? "posted a status update";
    // `previousHealth` is what the row carries, and it is deliberately the OLD value: an edit
    // that moved a board from on-track to off-track is a different event from a typo fix, and
    // `changed` is what separates them.
    case "status_update.edited":
      return changedIncludes(detail, "health")
        ? "revised the project's health"
        : "edited a status update";
    // Retracting the newest report moves the project's health backwards, so the withdrawn claim
    // is the fact worth naming — "retracted an off-track report" and "posted a status update"
    // are the two halves of the same swing.
    case "status_update.deleted":
      return healthPhrase(detail, "retracted") ?? "retracted a status update";
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
