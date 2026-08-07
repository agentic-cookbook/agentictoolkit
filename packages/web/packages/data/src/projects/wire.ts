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
  position: number;
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

/** `PUT /project/work-items/{id}/fields` body. */
export interface WorkItemFieldValuesPutBody {
  values: Array<{ fieldId: string; value: unknown }>;
}

/** `POST /project/work-items/{id}/dependencies` body. */
export interface WorkItemDependencyAddBody {
  dependsOnId: string;
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

/** Backend row for `GET /project/projects/{id}/activity` (and the work-item
 *  trail); `addComment` returns the created row in the same shape. */
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

/** `POST /project/work-items/{id}/comments` body. */
export interface CommentCreateBody {
  body: string;
}
