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
  /** board order within the project (ascending). */
  position: number;
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
    position: r.position,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  };
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
  async listForProject(projectId: string): Promise<WorkItem[]> {
    const rows = await authedJson<WorkItemRow[]>(
      `${PROJECTS}/${enc(projectId)}/work-items`,
    );
    return rows.map(toWorkItem); // server orders by position
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

  remove(id: string): Promise<void> {
    return authedRequest(`${ITEMS}/${enc(id)}`, { method: "DELETE" });
  },

  async children(id: string): Promise<WorkItem[]> {
    const rows = await authedJson<WorkItemRow[]>(
      `${ITEMS}/${enc(id)}/children`,
    );
    return rows.map(toWorkItem); // server orders by position
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
