// Workspace roles & permissions API client — the gated /access surface
// (docs/workspace-roles-permissions.md). Every call names the workspace by slug
// (`?workspace=`): a personal workspace's customer slug or an org slug. Reads answer
// 404 to non-members; role definition is admin-only; assignments/restriction need the
// M verb at the target scope (the server enforces no-escalation).

import { authedJson, authedRequest } from "../http";
import { enc } from "../client-helpers";
import type {
  AccessAssignmentRow,
  AccessFeatureRow,
  AccessGrantRow,
  AccessRoleRow,
  EffectiveAccessRow,
} from "./wire";

export type {
  AccessAssignmentRow,
  AccessFeatureRow,
  AccessGrantRow,
  AccessRoleRow,
  EffectiveAccessRow,
};

const BASE = "/api/access";

/**
 * The FALLBACK feature areas the roles matrix edits — used only when the backend cannot tell
 * us its own (see {@link accessApi.listFeatures}).
 *
 * The authoritative registry is per-DEPLOYMENT (backend `lib/feature-areas.ts`) and every
 * submitted grant is refined against it server-side, so this list can never be the source of
 * truth: a product whose backend has grown an area finds it ungrantable, and one whose backend
 * lacks an area listed here 400s the save. It stays as the degraded path for a backend that
 * predates `/access/features`, and holds only the two areas the roles layer shipped with — the
 * intersection every product on this toolkit is known to enforce. Do NOT widen it.
 */
export const ACCESS_FEATURES: ReadonlyArray<AccessFeatureRow> = [
  { key: "projects", label: "Projects" },
  { key: "personas", label: "Personas" },
];

export interface AccessRoleInput {
  slug: string;
  name: string;
  description?: string;
  defaultFor?: "" | "customer" | "persona";
  grants: AccessGrantRow[];
}

export interface AccessAssignmentInput {
  subjectKind: "customer" | "persona" | "team";
  subjectId: string;
  /** Provide feature+itemId together to scope the grant to one item; omit both for workspace-wide. */
  feature?: string;
  itemId?: string;
  roleId: string;
}

/** True when `v` is a well-formed {@link AccessFeatureRow}: an object with a string `key` and a
 *  string `label`. `GET /access/features` is the one response this client cannot typecheck away
 *  — `body.features` was previously returned via a bare cast, so a wrong shape (a string, an
 *  array of bare strings, an object) reached every consumer looking exactly like real data
 *  instead of the error it is. Lives beside `listFeatures` so the guard protects every consumer
 *  of this client, not just the one pane that happens to render the matrix today. */
function isAccessFeatureRow(v: unknown): v is AccessFeatureRow {
  return (
    typeof v === "object" &&
    v !== null &&
    typeof (v as { key?: unknown }).key === "string" &&
    typeof (v as { label?: unknown }).label === "string"
  );
}

export const accessApi = {
  /**
   * The feature areas THIS backend enforces (key + display label), in registration order.
   * Any workspace member may read it; non-members get the uniform 404.
   *
   * REJECTS on a backend that has no such route (404) — that is the expected answer from a
   * product whose server predates this endpoint, so callers must fall back to
   * {@link ACCESS_FEATURES} rather than render an empty matrix. Also REJECTS (throws) when the
   * body's `features` is not an array of {@link AccessFeatureRow}, so a malformed-but-plausible
   * answer (e.g. a bare string, or an array of feature keys with no `label`) surfaces to the
   * caller as a failure to fall back on rather than a value that crashes downstream `.map()`s.
   */
  async listFeatures(workspace: string): Promise<AccessFeatureRow[]> {
    const body = await authedJson<{ features: unknown }>(
      `${BASE}/features?workspace=${enc(workspace)}`,
    );
    const rows = body.features;
    if (!Array.isArray(rows) || !rows.every(isAccessFeatureRow)) {
      throw new Error("GET /access/features returned a malformed feature list");
    }
    return rows;
  },

  async listRoles(workspace: string): Promise<AccessRoleRow[]> {
    const body = await authedJson<{ roles: AccessRoleRow[] }>(
      `${BASE}/roles?workspace=${enc(workspace)}`,
    );
    return body.roles;
  },

  async createRole(workspace: string, input: AccessRoleInput): Promise<AccessRoleRow> {
    const body = await authedJson<{ role: AccessRoleRow }>(
      `${BASE}/roles?workspace=${enc(workspace)}`,
      { method: "POST", body: JSON.stringify(input) },
    );
    return body.role;
  },

  async updateRole(
    workspace: string,
    id: string,
    patch: Partial<Omit<AccessRoleInput, "slug">>,
  ): Promise<AccessRoleRow> {
    const body = await authedJson<{ role: AccessRoleRow }>(
      `${BASE}/roles/${enc(id)}?workspace=${enc(workspace)}`,
      { method: "PATCH", body: JSON.stringify(patch) },
    );
    return body.role;
  },

  async deleteRole(workspace: string, id: string): Promise<void> {
    await authedRequest(`${BASE}/roles/${enc(id)}?workspace=${enc(workspace)}`, {
      method: "DELETE",
    });
  },

  /** Workspace-wide listing needs workspace admin; item-scoped needs M on that item.
   *  `restricted` is present on item-scoped listings. */
  async listAssignments(
    workspace: string,
    scope?: { feature: string; itemId: string },
  ): Promise<{ assignments: AccessAssignmentRow[]; restricted?: boolean }> {
    const q = scope
      ? `&feature=${enc(scope.feature)}&itemId=${enc(scope.itemId)}`
      : "";
    return authedJson<{ assignments: AccessAssignmentRow[]; restricted?: boolean }>(
      `${BASE}/assignments?workspace=${enc(workspace)}${q}`,
    );
  },

  /** Grant (or replace) — one role per subject per scope. */
  async putAssignment(
    workspace: string,
    input: AccessAssignmentInput,
  ): Promise<AccessAssignmentRow> {
    const body = await authedJson<{ assignment: AccessAssignmentRow }>(
      `${BASE}/assignments?workspace=${enc(workspace)}`,
      { method: "PUT", body: JSON.stringify(input) },
    );
    return body.assignment;
  },

  async deleteAssignment(workspace: string, id: string): Promise<void> {
    await authedRequest(`${BASE}/assignments/${enc(id)}?workspace=${enc(workspace)}`, {
      method: "DELETE",
    });
  },

  async restrictItem(workspace: string, feature: string, itemId: string): Promise<void> {
    await authedJson(`${BASE}/items/restrict?workspace=${enc(workspace)}`, {
      method: "POST",
      body: JSON.stringify({ feature, itemId }),
    });
  },

  async restoreItem(workspace: string, feature: string, itemId: string): Promise<void> {
    await authedJson(`${BASE}/items/restore?workspace=${enc(workspace)}`, {
      method: "POST",
      body: JSON.stringify({ feature, itemId }),
    });
  },

  /** The effective-permission explainer for one subject (requires M at the scope). */
  async effective(
    workspace: string,
    q: { feature: string; subjectKind: "customer" | "persona"; subjectId: string; itemId?: string },
  ): Promise<EffectiveAccessRow> {
    const itemQ = q.itemId ? `&itemId=${enc(q.itemId)}` : "";
    return authedJson<EffectiveAccessRow>(
      `${BASE}/effective?workspace=${enc(workspace)}&feature=${enc(q.feature)}` +
        `&subjectKind=${q.subjectKind}&subjectId=${enc(q.subjectId)}${itemQ}`,
    );
  },
};
