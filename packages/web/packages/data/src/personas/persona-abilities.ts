// Persona ability + permission-grant API client — the hand-written /registry/personas/:id/tools
// (Abilities: grant/revoke/autonomy), /registry/personas/:id/may-act (Permissions: context grants),
// and /registry/personas/approvals (Permissions: the human-in-the-loop decision queue) routes.
// All are hand-written, NOT generic CRUD; typed via package-local wire types mirroring the
// OpenAPI-derived backend schema (see ./wire) so a backend contract change breaks the
// type-check here rather than at runtime.
import { authedJson, authedRequest } from "../http";
import { enc } from "../client-helpers";
import type {
  ApprovalListRow,
  MayActGrantBody,
  MayActRow,
  SetAutonomyBody,
  ToolCatalogItemRow,
  ToolCatalogListRow,
  ToolGrantRow,
} from "./wire";

export type ApprovalList = ApprovalListRow;
export type Approval = ApprovalList["approvals"][number];
export type ApprovalStatus = "pending" | "approved" | "rejected";

export type ToolCatalogList = ToolCatalogListRow;
export type ToolCatalogItem = ToolCatalogList["tools"][number];
type GrantToolResult = { tool: ToolCatalogItemRow };
type SetAutonomyResult = { tool: ToolGrantRow };
export type ToolGrant = ToolGrantRow;

export const personaApprovalsApi = {
  // `personaId` narrows the decidable queue server-side to one persona (#14) — the backend
  // intersects it with the caller's decidable set, so the response already contains only that
  // persona's pending rows; callers no longer need to filter the response themselves.
  async list(status: ApprovalStatus = "pending", personaId?: string): Promise<Approval[]> {
    const query = personaId
      ? `status=${enc(status)}&personaId=${enc(personaId)}`
      : `status=${enc(status)}`;
    const body = await authedJson<ApprovalList>(`/api/registry/personas/approvals?${query}`);
    return body.approvals;
  },
  async approve(id: string): Promise<Approval> {
    const body = await authedJson<{ approval: Approval }>(
      `/api/registry/personas/approvals/${enc(id)}/approve`,
      { method: "POST" },
    );
    return body.approval;
  },
  async reject(id: string): Promise<Approval> {
    const body = await authedJson<{ approval: Approval }>(
      `/api/registry/personas/approvals/${enc(id)}/reject`,
      { method: "POST" },
    );
    return body.approval;
  },
};

export type MayActList = MayActRow;
export type MayActKind = MayActList["kinds"][number];

/** The two may-act contexts a persona can be granted leave to act under (#10/#12). */
export type MayActGrantableKind = "user" | "team";

export const personaMayActApi = {
  async list(personaId: string): Promise<MayActKind[]> {
    const body = await authedJson<MayActList>(`/api/registry/personas/${enc(personaId)}/may-act`);
    return body.kinds;
  },
  // `kind`-parameterized grant/revoke (#12) — collapses the former grantUser/grantTeam and
  // revokeUser/revokeTeam pairs, which differed only in the literal kind/URL segment.
  async grant(personaId: string, kind: MayActGrantableKind): Promise<MayActKind[]> {
    const input: MayActGrantBody = { kind };
    const body = await authedJson<MayActList>(
      `/api/registry/personas/${enc(personaId)}/may-act`,
      { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) },
    );
    return body.kinds;
  },
  async revoke(personaId: string, kind: MayActGrantableKind): Promise<void> {
    await authedRequest(`/api/registry/personas/${enc(personaId)}/may-act/${kind}`, { method: "DELETE" });
  },
};

export const personaToolsApi = {
  async list(personaId: string): Promise<ToolCatalogItem[]> {
    const body = await authedJson<ToolCatalogList>(`/api/registry/personas/${enc(personaId)}/tools`);
    return body.tools;
  },
  async grant(personaId: string, toolName: string): Promise<ToolCatalogItem> {
    const body = await authedJson<GrantToolResult>(
      `/api/registry/personas/${enc(personaId)}/tools`,
      { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ toolName }) },
    );
    return body.tool;
  },
  async revoke(personaId: string, toolName: string): Promise<void> {
    await authedRequest(`/api/registry/personas/${enc(personaId)}/tools/${enc(toolName)}`, { method: "DELETE" });
  },
  async setAutonomy(personaId: string, toolName: string, autonomous: boolean): Promise<ToolGrant> {
    const input: SetAutonomyBody = { autonomous };
    const body = await authedJson<SetAutonomyResult>(
      `/api/registry/personas/${enc(personaId)}/tools/${enc(toolName)}`,
      { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) },
    );
    return body.tool;
  },
};
