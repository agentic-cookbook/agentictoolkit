// Local wire types for the Projects clients — the backend row + request-body
// shapes each client reads/sends. These replace the hub's generated
// `SuccessBody<...>` / `RequestBody<...>` (from `@agentic-toolkit/adh-api-types`), which
// is adh product vocabulary a generic data client must not take on. Each interface carries exactly
// the fields the `toX()` mappers and call sites touch — no more. Type-only file.

/**
 * A board column's category — the fixed bucket a client reads an UNFAMILIAR board through.
 * Column labels are the project owner's to invent; this list is not, which is why anything
 * that must reason about a board it did not configure (a tone, a rollup, a filter) keys off
 * the category instead of the label.
 *
 * Named once and referenced, rather than restated at each of the six sites that mention it —
 * the previous shape, where widening the vocabulary meant finding every copy. Ordered as a
 * workflow runs, leading to terminal: `backlog` is what is not committed to yet, and
 * `canceled` is terminal WITHOUT counting as finished (folding it into `done` is what makes
 * a completion count overstate).
 */
export type StatusCategory = "backlog" | "todo" | "in_progress" | "done" | "canceled";

/* ── Projects (GET rows) ──────────────────────────────────────────────── */

/** Backend row for `GET /project/projects` (and a single project). */
export interface ProjectRow {
  id: string;
  name: string;
  description: string;
  /** lifecycle status (DB default 'active'). */
  status: string;
  /** hex board accent (DB default #007AFF). */
  color: string;
  /** the prefix this project's work-item keys are rendered from (`ADH` in `ADH-42`);
   *  '' on a project whose prefix has not been assigned yet, which has no keys. */
  keyPrefix: string;
  /** the owning ecosystem (tenant scope). */
  ecosystemId: string;
  /** ISO timestamp when archived; absent/null when not archived. */
  archivedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Backend row for `GET /project/projects/{id}/statuses`. */
export interface ProjectStatusRow {
  id: string;
  projectId: string;
  key: string;
  label: string;
  category: StatusCategory;
  position: number;
  createdAt: string;
}

/** Backend response for `GET /project/projects/{id}/labels` — the label VOCABULARY offered
 *  when tagging this project's cards. Wrapped in `{items}` rather than a bare array because
 *  it is the shared string-list envelope the backend uses for every vocabulary read. */
export interface ProjectLabelsRow {
  items: string[];
}

/** Backend row for `GET /project/projects/{id}/participants`. */
export interface ProjectParticipantRow {
  id: string;
  projectId: string;
  participantKind: "customer" | "persona" | "team";
  participantId: string;
  role: string;
  addedBy?: string | null;
  addedAt: string;
}

/* ── Projects (request bodies) ────────────────────────────────────────── */

/** `POST /project/projects` body. */
export interface ProjectCreateBody {
  name: string;
  description?: string;
  color?: string;
}

/** `PATCH /project/projects/{id}` body (explicit null un-archives). */
export interface ProjectPatchBody {
  name?: string;
  description?: string;
  status?: string;
  color?: string;
  /** rename the work-item key prefix — 2-8 chars, a letter then letters/digits, upper case.
   *  Renames every one of this project's keys at once; 409 if the owner already uses it. */
  keyPrefix?: string;
  archivedAt?: string | null;
}

/** `POST /project/projects/{id}/statuses` body. */
export interface ProjectStatusCreateBody {
  key: string;
  label: string;
  category: StatusCategory;
  position?: number;
}

/** `PATCH /project/projects/{id}/statuses/{statusId}` body. */
export interface ProjectStatusPatchBody {
  label?: string;
  category?: StatusCategory;
  position?: number;
}

/** `POST /project/projects/{id}/participants` body. */
export interface ProjectParticipantAddBody {
  participantKind: "customer" | "persona" | "team";
  participantId: string;
}

/* ── Work items (GET rows) ────────────────────────────────────────────── */

/** Backend row for a single work item (`GET /project/work-items/{id}` and the
 *  per-project / children collections). */
export interface WorkItemRow {
  id: string;
  projectId: string;
  /** the card's short human name (`ADH-42`) — the project's prefix joined to this card's
   *  permanent number. Derived by the backend, never sent back; '' when the project has no
   *  prefix yet. This is what a person quotes in a branch name or a message, and it addresses
   *  the card anywhere its id is accepted. */
  itemKey: string;
  title: string;
  description: string;
  statusId: string;
  assigneeKind?: "customer" | "persona" | "team" | null;
  assigneeId?: string | null;
  priority: number;
  startDate?: string | null;
  dueDate?: string | null;
  labels: string[];
  parentId?: string | null;
  /** the card's place in its sibling list, as an OPAQUE sort key — compare two of them with
   *  `<`, never subtract them. It is a fractional index, so a card moved between two others
   *  gets a key strictly between theirs and nothing else is rewritten; the backend sorts by
   *  its bytes (the column is `COLLATE "C"`), which is what a plain JS `<` does too.
   *  Server-set: it is never sent back on a patch — a move goes through
   *  `POST /project/work-items/{id}/move`. */
  rank: string;
  createdAt: string;
  updatedAt: string;
}

/** Backend row for `GET /project/work-items/{id}/fields`. */
export interface WorkItemFieldValueRow {
  fieldId: string;
  key: string;
  label: string;
  type: "text" | "number" | "date" | "select" | "user" | "checkbox";
  value?: unknown;
}

/** Backend row for `GET /project/work-items/{id}/dependencies` (joined). */
export interface WorkItemDependencyRow {
  id: string;
  dependsOnId: string;
  title: string;
  status: string;
  createdAt: string;
}

/** The raw edge returned by `POST /project/work-items/{id}/dependencies` (201) —
 *  no joined title/status; the caller refetches the list. */
export interface DependencyEdge {
  id: string;
  workItemId: string;
  dependsOnId: string;
  /** which relationship the edge records — absent on a bundle built before kinds existed. */
  kind?: RelationKind;
  createdAt: string;
}

/**
 * How two cards are linked. The backend's vocabulary, spelled the same way here because the
 * string travels on the wire unmodified.
 *
 * `depends_on` is the only kind with arithmetic behind it — it claims an ORDER, so it is the
 * only one the backend cycle-checks. `duplicates` points from the copy to the original and
 * claims no order. `relates_to` is symmetric: stored once, true from both ends, which is why
 * the reverse of one is not a second row.
 */
export type RelationKind = "depends_on" | "duplicates" | "relates_to";

/** Backend row for `GET /project/work-items/{id}/relations` (joined).
 *
 *  One row per link TOUCHING the card, not per link it filed: `direction` says which end of the
 *  stored edge this card sits on, and every other field describes the card at the FAR end. That
 *  is what lets one list show "blocked by" and "blocks" without a second request. */
export interface WorkItemRelationRow {
  id: string;
  kind: RelationKind;
  /** `outgoing` = this card is the edge's subject; `incoming` = it is the object. */
  direction: "outgoing" | "incoming";
  relatedId: string;
  /** the far card's short human name (`ADH-42`); '' when its project has no prefix. */
  relatedKey: string;
  title: string;
  status: string;
  createdAt: string;
}

/* ── Work items (request bodies) ──────────────────────────────────────── */

/** `POST /project/projects/{id}/work-items` body. */
export interface WorkItemCreateBody {
  title: string;
  description?: string;
  statusId?: string;
  assigneeKind?: "customer" | "persona" | "team";
  assigneeId?: string;
  priority?: number;
  startDate?: string;
  dueDate?: string;
  labels?: string[];
  parentId?: string;
}

/** `PATCH /project/work-items/{id}` body (explicit null clears the column). */
export interface WorkItemPatchBody {
  title?: string;
  description?: string;
  statusId?: string;
  assigneeKind?: "customer" | "persona" | "team" | null;
  assigneeId?: string | null;
  priority?: number;
  startDate?: string | null;
  dueDate?: string | null;
  labels?: string[];
  parentId?: string | null;
}

/**
 * `POST /project/work-items/{id}/move` body — a move names its NEIGHBOURS, never an index.
 *
 * Both fields address a SIBLING (same project, same parent) by id or by rendered key, and the
 * distinction between "absent" and "explicitly null" is load-bearing:
 *
 * - `{ afterId: X }`             → directly after X
 * - `{ beforeId: X }`            → directly before X
 * - `{ afterId: X, beforeId: Y }` → between the two, which must already be in that order
 * - `{ afterId: null }`          → to the TOP (nothing sorts before it)
 * - `{ beforeId: null }`         → to the BOTTOM
 *
 * Naming neither is a 400: a move with no neighbour has not said where to. Indices are absent
 * on purpose — two clients sending "index 3" race, whereas two clients naming the same
 * neighbour both land beside it.
 */
export interface WorkItemMoveTarget {
  afterId?: string | null;
  beforeId?: string | null;
}

/** `PUT /project/work-items/{id}/fields` body. */
export interface WorkItemFieldValuesPutBody {
  values: Array<{ fieldId: string; value: unknown }>;
}

/** `POST /project/work-items/{id}/dependencies` body. */
export interface WorkItemDependencyAddBody {
  dependsOnId: string;
}

/** `POST /project/work-items/{id}/relations` body.
 *
 *  `kind` is REQUIRED — the route that leaves it unsaid is `/dependencies`, where the path
 *  already says which one it means. A caller here who has not chosen has not decided, and
 *  defaulting would invent a scheduling constraint nobody asked for. */
export interface WorkItemRelationAddBody {
  relatedId: string;
  kind: RelationKind;
}

/* ── Artifacts (the things a project holds) ───────────────────────────── */

/**
 * A polymorphic `(kind, id)` pointer RESOLVED by the backend into something displayable.
 *
 * The client never learns which table a kind means. That knowledge lives in exactly one place
 * (the backend's target registry), which is why this shape is deliberately uniform across every
 * kind: a document and a saved URL arrive as the same four fields, so a list can render both
 * without a per-kind branch — and a kind added later renders correctly in a bundle that predates
 * it. `title` is never empty (a kind with no title of its own falls back to something a person
 * recognises, e.g. the address a URL was saved as).
 */
export interface TargetDescriptorRow {
  kind: string;
  id: string;
  title: string;
  subtitle?: string | null;
  /** Set only when the target is a link OUT of the platform — a saved URL's address. */
  url?: string | null;
}

/** Backend row for `GET /project/projects/{id}/artifacts`. */
export interface ProjectArtifactRow {
  id: string;
  projectId: string;
  direction: "ingested" | "produced";
  targetKind: string;
  targetId: string;
  /** Null when the pointer no longer resolves: a target can be deleted (or put out of reach)
   *  after it was linked, and nothing rewrites the links to it. */
  target?: TargetDescriptorRow | null;
  createdAt: string;
}

/** `POST /project/projects/{id}/artifacts` body. */
export interface ProjectArtifactLinkBody {
  direction: "ingested" | "produced";
  targetKind: string;
  targetId: string;
}

/* ── Activity ─────────────────────────────────────────────────────────── */

/** Backend row for `GET /project/projects/{id}/activity` (and the work-item trail). */
export interface ProjectActivityRow {
  id: string;
  projectId: string;
  workItemId?: string | null;
  actorKind?: string | null;
  actorId?: string | null;
  actorLabel?: string | null;
  action: string;
  detail?: Record<string, unknown> | null;
  createdAt: string;
}

/* ── Comments ─────────────────────────────────────────────────────────── */

/**
 * Backend row for the work-item conversation (`GET`/`POST
 * /project/work-items/{id}/comments`, `PATCH /project/comments/{id}`).
 *
 * A comment is its OWN row, not an activity entry: an entry in an audit trail is a fact that
 * happened and can never stop having happened, whereas a comment is a piece of writing its
 * author may correct or withdraw. The trail still records every one of those acts — which is
 * where `editedAt`'s prior text lives — but the words themselves are here.
 */
export interface ProjectCommentRow {
  id: string;
  projectId: string;
  workItemId: string;
  /** the comment this one replies to; null for a top-level comment. */
  parentId?: string | null;
  authorKind?: string | null;
  authorId?: string | null;
  authorLabel?: string | null;
  body: string;
  /** set the first time the body changes; null while the text is as first written. */
  editedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

/** `POST /project/work-items/{id}/comments` body. */
export interface CommentCreateBody {
  body: string;
  /** the comment being replied to; omitted for a top-level comment. */
  parentId?: string;
}

/** `PATCH /project/comments/{id}` body. */
export interface CommentUpdateBody {
  body: string;
}
