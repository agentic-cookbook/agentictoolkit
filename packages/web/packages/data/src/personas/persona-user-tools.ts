// Per-user persona tool-consent API client (Layer-2). A user who a persona may act FOR
// (the persona holds the `may_act 'user'` grant) controls, per owner-granted tool, whether
// that persona may invoke it on their behalf. Backed by the hand-written routes in
// personaUserTools.ts (NOT generic CRUD); typed via package-local wire types (see ./wire)
// mirroring the OpenAPI-derived backend schema so a contract change stops these calls
// from type-checking.
import { authedJson } from "../http";
import { enc } from "../client-helpers";
import type { SetAllowedBody, UserActableListRow, UserToolListRow } from "./wire";

/** The personas the caller may configure per-tool consent for — those with `may_act 'user'`. */
export type UserActableList = UserActableListRow;
/** One configurable persona (`{ id, slug, name }`). */
export type UserActablePersona = UserActableList["personas"][number];

export type UserToolList = UserToolListRow;
export type UserTool = UserToolList["tools"][number];

type SetAllowedResult = UserToolListRow;

export const personaUserToolsApi = {
  async listActable(): Promise<UserActablePersona[]> {
    const body = await authedJson<UserActableList>("/api/registry/personas/user-actable");
    return body.personas;
  },
  async listTools(personaId: string): Promise<UserTool[]> {
    const body = await authedJson<UserToolList>(`/api/registry/personas/${enc(personaId)}/user-tools`);
    return body.tools;
  },
  async setAllowed(personaId: string, allowed: string[]): Promise<UserTool[]> {
    const input: SetAllowedBody = { allowed };
    const body = await authedJson<SetAllowedResult>(
      `/api/registry/personas/${enc(personaId)}/user-tools`,
      { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) },
    );
    return body.tools;
  },
};
