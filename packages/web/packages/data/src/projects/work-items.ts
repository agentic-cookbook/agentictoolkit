// Project work-items API client — the card side of the `/api/project/*` surface.
//
// Split out of `projects.ts` (mirroring the teams.ts + team-members.ts split):
// work items carry their own field-values and dependency sub-resources and are
// addressed on TWO route stems — `/project/projects/{id}/work-items` for the
// per-project list/create, and `/project/work-items/{id}` for a single item and
// everything hanging off it.
//
// The one subtlety: `update` mutations for the assignee / date / parent columns
// accept an explicit `null` to CLEAR the value. The shared `compact` already
// keeps explicit null (it filters only `=== undefined`), so `compact(patch)`
// sends `assigneeId: null` through rather than stripping it.

import { authedJson, authedRequest } from "../http";
import { compact, enc } from "../client-helpers";
import type {
  WorkItemRow,
  WorkItemFieldValueRow,
  WorkItemDependencyRow,
  WorkItemRelationRow,
  RelationKind,
  DependencyEdge,
  WorkItemCreateBody,
  WorkItemPatchBody,
  WorkItemMoveTarget,
  WorkItemFieldValuesPutBody,
  WorkItemDependencyAddBody,
  WorkItemRelationAddBody,
} from "./wire";

/** Per-project stem (list + create). */
const PROJECTS = "/api/project/projects";
/** Single-item stem (get / update / delete + sub-resources). */
const ITEMS = "/api/project/work-items";

/* ── Work item ────────────────────────────────────────────────────────── */

export interface WorkItem {
  id: string;
  projectId: string;
  /** the card's short human name (`ADH-42`), derived by the backend from its project's prefix
   *  and this card's permanent number. '' when the project has no prefix yet — render nothing
   *  in that case rather than a lone dash. Read-only: it is never sent back on a patch. */
  itemKey: string;
  title: string;
  description: string;
  /** the board column this card sits in. */
  statusId: string;
  assigneeKind: "customer" | "persona" | "team" | null;
  assigneeId: string | null;
  priority: number;
  /** date (YYYY-MM-DD). */
  startDate: string | null;
  dueDate: string | null;
  labels: string[];
  /** a parent work item in the same project. */
  parentId: string | null;
  /** the time-box this card is committed to; null is the BACKLOG — a destination, not a gap.
   *  The box belongs to the project's WORKSPACE, so it is not addressable under the project:
   *  read the candidates from {@link projectIterationsApi.list}. */
  iterationId: string | null;
  /** the milestone this card counts toward; null = none. The mirror of {@link iterationId} and
   *  its opposite in scope: a time-box is the WORKSPACE's and shared across boards, a milestone
   *  is a point in THIS board's plan — read the candidates from
   *  {@link projectMilestonesApi.list} for this card's own project. */
  milestoneId: string | null;
  /** the card's size in the units its project's `estimateScale` names; null is UN-estimated,
   *  which is distinct from a card estimated at 0. */
  estimate: number | null;
  /** where the card sits among its siblings, as an OPAQUE key: compare two with `<`, never
   *  subtract. Ascending is board order. Server-set — reorder with {@link projectWorkItemsApi.move}. */
  rank: string;
  /** when the card was ACCEPTED onto its board; null means it is still in the TRIAGE INBOX. That
   *  is why an untriaged card is missing from {@link projectWorkItemsApi.listForProject} unless
   *  `includeUntriaged` is asked for — it sits in whatever column it was filed into, and the
   *  board would be asserting a placement nobody has made. Accept one with
   *  {@link projectTriageApi.accept}. */
  triagedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export function toWorkItem(r: WorkItemRow): WorkItem {
  return {
    id: r.id,
    projectId: r.projectId,
    itemKey: r.itemKey ?? "",
    title: r.title,
    description: r.description,
    statusId: r.statusId,
    assigneeKind: r.assigneeKind ?? null,
    assigneeId: r.assigneeId ?? null,
    priority: r.priority,
    startDate: r.startDate ?? null,
    dueDate: r.dueDate ?? null,
    labels: r.labels,
    parentId: r.parentId ?? null,
    iterationId: r.iterationId ?? null,
    milestoneId: r.milestoneId ?? null,
    estimate: r.estimate ?? null,
    rank: r.rank,
    triagedAt: r.triagedAt ?? null,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  };
}

/**
 * Comparator for {@link WorkItem.rank} — ascending is board order.
 *
 * The backend's column is `COLLATE "C"`, i.e. it sorts by BYTES, and the rank alphabet is
 * `0-9A-Za-z`, whose UTF-16 code units are those same bytes in the same order. So a plain JS
 * `<` reproduces the server's order exactly; this exists so that fact is written down once and
 * no caller reaches for `a.rank - b.rank` on what looks like a position.
 */
export function compareRank(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/* ── Field values ─────────────────────────────────────────────────────── */

export interface WorkItemFieldValue {
  fieldId: string;
  key: string;
  label: string;
  type: "text" | "number" | "date" | "select" | "user" | "checkbox";
  /** the field's stored value for this item; null when unset. */
  value: unknown;
}

export function toWorkItemFieldValue(r: WorkItemFieldValueRow): WorkItemFieldValue {
  return {
    fieldId: r.fieldId,
    key: r.key,
    label: r.label,
    type: r.type,
    value: r.value ?? null,
  };
}

/* ── Dependencies ─────────────────────────────────────────────────────── */

export interface WorkItemDependency {
  /** the dependency edge id. */
  id: string;
  /** the work item this one depends on. */
  dependsOnId: string;
  /** the depended-on item title (joined). */
  title: string;
  /** the depended-on item statusId (joined). */
  status: string;
  createdAt: string;
}

export function toWorkItemDependency(r: WorkItemDependencyRow): WorkItemDependency {
  return {
    id: r.id,
    dependsOnId: r.dependsOnId,
    title: r.title,
    status: r.status,
    createdAt: r.createdAt,
  };
}

/* ── Relations ────────────────────────────────────────────────────────── */

/**
 * One link touching this card, described from THIS card's end.
 *
 * A relation is stored once, as a directed edge, and read from both sides — so `direction` is
 * not a property of the link, it is where the card you asked about sits on it. Everything else
 * names the card at the far end. A renderer therefore needs no second fetch and no branch on
 * "did I file this or did they": it phrases `(kind, direction)` and shows `relatedKey` + `title`.
 */
export interface WorkItemRelation {
  /** the edge id. */
  id: string;
  kind: RelationKind;
  direction: "outgoing" | "incoming";
  /** the card at the other end. */
  relatedId: string;
  /** that card's short human name (`ADH-42`); '' when its project has no prefix. */
  relatedKey: string;
  /** that card's title (joined). */
  title: string;
  /** that card's statusId (joined). */
  status: string;
  createdAt: string;
}

export function toWorkItemRelation(r: WorkItemRelationRow): WorkItemRelation {
  return {
    id: r.id,
    kind: r.kind,
    direction: r.direction,
    relatedId: r.relatedId,
    relatedKey: r.relatedKey ?? "",
    title: r.title,
    status: r.status,
    createdAt: r.createdAt,
  };
}

/* ── Client ───────────────────────────────────────────────────────────── */

export const projectWorkItemsApi = {
  /**
   * The board's cards, in rank order. ACCEPTED cards only by default — a card still in triage
   * has had no column decision made about it, so showing it would put it in whatever column it
   * was filed into, which is the one claim the inbox exists to withhold.
   *
   * `includeUntriaged` is the escape for a caller that wants the board's TRUE contents (an
   * export, a count, a total). It is opt-in because the default has to be the reading that
   * cannot mislead; to WORK the queue, use {@link projectTriageApi.listForProject}, which
   * returns the other half and in the order a queue is worked.
   */
  async listForProject(
    projectId: string,
    opts?: { includeUntriaged?: boolean },
  ): Promise<WorkItem[]> {
    const rows = await authedJson<WorkItemRow[]>(
      `${PROJECTS}/${enc(projectId)}/work-items${
        opts?.includeUntriaged ? "?includeUntriaged=true" : ""
      }`,
    );
    return rows.map(toWorkItem); // server orders by rank
  },

  async get(id: string): Promise<WorkItem | null> {
    try {
      return toWorkItem(await authedJson<WorkItemRow>(`${ITEMS}/${enc(id)}`));
    } catch {
      // Backend 404s with a thrown error; the UI contract is null-for-missing.
      return null;
    }
  },

  async create(
    projectId: string,
    input: {
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
      iterationId?: string;
      /** count the new card toward a milestone of THIS project. */
      milestoneId?: string;
      estimate?: number;
      /** file the card into the board's TRIAGE INBOX instead of onto the board — for intake that
       *  arrives from outside (a form, a bot, a bug report), where nobody has yet decided the card
       *  belongs on this board at all. Omitted accepts it immediately, which is what keeps every
       *  board that has never used an inbox unchanged. */
      triage?: boolean;
    },
  ): Promise<WorkItem> {
    const body: WorkItemCreateBody = {
      title: input.title,
      ...compact({
        description: input.description,
        statusId: input.statusId,
        assigneeKind: input.assigneeKind,
        assigneeId: input.assigneeId,
        priority: input.priority,
        startDate: input.startDate,
        dueDate: input.dueDate,
        labels: input.labels,
        parentId: input.parentId,
        iterationId: input.iterationId,
        milestoneId: input.milestoneId,
        estimate: input.estimate,
        triage: input.triage,
      }),
    };
    return toWorkItem(
      await authedJson<WorkItemRow>(
        `${PROJECTS}/${enc(projectId)}/work-items`,
        { method: "POST", body: JSON.stringify(body) },
      ),
    );
  },

  async update(
    id: string,
    patch: {
      title?: string;
      description?: string;
      statusId?: string;
      /** null clears the assignee (paired with assigneeId). */
      assigneeKind?: "customer" | "persona" | "team" | null;
      assigneeId?: string | null;
      priority?: number;
      startDate?: string | null;
      dueDate?: string | null;
      labels?: string[];
      /** null detaches the parent. */
      parentId?: string | null;
      /** null sends the card back to the backlog. */
      iterationId?: string | null;
      /** null detaches the card from the plan — it then counts toward no milestone. */
      milestoneId?: string | null;
      /** null un-estimates the card — not the same as `0`. */
      estimate?: number | null;
    },
  ): Promise<WorkItem> {
    // `compact` drops only undefined and KEEPS explicit null, so a clear
    // (`assigneeId: null`, `dueDate: null`, `parentId: null`) is sent, not
    // stripped — which is exactly the PATCH's clear semantics.
    const body: WorkItemPatchBody = compact(patch);
    return toWorkItem(
      await authedJson<WorkItemRow>(`${ITEMS}/${enc(id)}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      }),
    );
  },

  /**
   * Reorder a card among its siblings by naming a NEIGHBOUR — see {@link WorkItemMoveTarget} for
   * the five shapes. Returns the moved card carrying its new `rank`; no other card changes, so
   * a caller re-sorts the list it already holds rather than refetching it.
   *
   * `compact` keeps an explicit null (it drops only undefined), which is the whole point here:
   * `{ afterId: null }` means "to the top" and must reach the server, while an omitted
   * `afterId` means "I didn't say".
   */
  async move(id: string, target: WorkItemMoveTarget): Promise<WorkItem> {
    const body: WorkItemMoveTarget = compact(target);
    return toWorkItem(
      await authedJson<WorkItemRow>(`${ITEMS}/${enc(id)}/move`, {
        method: "POST",
        body: JSON.stringify(body),
      }),
    );
  },

  remove(id: string): Promise<void> {
    return authedRequest(`${ITEMS}/${enc(id)}`, { method: "DELETE" });
  },

  async children(id: string): Promise<WorkItem[]> {
    const rows = await authedJson<WorkItemRow[]>(
      `${ITEMS}/${enc(id)}/children`,
    );
    return rows.map(toWorkItem); // server orders by rank
  },

  async getValues(id: string): Promise<WorkItemFieldValue[]> {
    const rows = await authedJson<WorkItemFieldValueRow[]>(
      `${ITEMS}/${enc(id)}/fields`,
    );
    return rows.map(toWorkItemFieldValue);
  },

  async setValues(
    id: string,
    input: { values: Array<{ fieldId: string; value: unknown }> },
  ): Promise<WorkItemFieldValue[]> {
    const body: WorkItemFieldValuesPutBody = {
      values: input.values,
    };
    const rows = await authedJson<WorkItemFieldValueRow[]>(
      `${ITEMS}/${enc(id)}/fields`,
      { method: "PUT", body: JSON.stringify(body) },
    );
    return rows.map(toWorkItemFieldValue);
  },

  dependencies: {
    async list(id: string): Promise<WorkItemDependency[]> {
      const rows = await authedJson<WorkItemDependencyRow[]>(
        `${ITEMS}/${enc(id)}/dependencies`,
      );
      return rows.map(toWorkItemDependency); // server orders by createdAt
    },

    add(id: string, dependsOnId: string): Promise<DependencyEdge> {
      const body: WorkItemDependencyAddBody = { dependsOnId };
      return authedJson<DependencyEdge>(`${ITEMS}/${enc(id)}/dependencies`, {
        method: "POST",
        body: JSON.stringify(body),
      });
    },

    remove(id: string, dependsOnId: string): Promise<void> {
      return authedRequest(
        `${ITEMS}/${enc(id)}/dependencies/${enc(dependsOnId)}`,
        { method: "DELETE" },
      );
    },
  },

  // Every link touching a card, of every kind, in both directions. `dependencies` above is the
  // `depends_on` slice of the same table, kept because a scheduler wants exactly that slice
  // pointing exactly one way; a card's detail pane wants all of it and uses these.
  relations: {
    async list(id: string, kind?: RelationKind): Promise<WorkItemRelation[]> {
      const rows = await authedJson<WorkItemRelationRow[]>(
        `${ITEMS}/${enc(id)}/relations${kind ? `?kind=${enc(kind)}` : ""}`,
      );
      return rows.map(toWorkItemRelation); // server orders by createdAt
    },

    add(
      id: string,
      relatedId: string,
      kind: RelationKind,
    ): Promise<DependencyEdge> {
      const body: WorkItemRelationAddBody = { relatedId, kind };
      return authedJson<DependencyEdge>(`${ITEMS}/${enc(id)}/relations`, {
        method: "POST",
        body: JSON.stringify(body),
      });
    },

    // No kind argument: a pair carries one relation, so naming the far card names the link.
    // Works from either end — the caller need not know which card filed it.
    remove(id: string, relatedId: string): Promise<void> {
      return authedRequest(`${ITEMS}/${enc(id)}/relations/${enc(relatedId)}`, {
        method: "DELETE",
      });
    },
  },
};
