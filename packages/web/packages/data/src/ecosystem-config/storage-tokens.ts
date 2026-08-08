"use client";

// Owner-decoupled STORAGE-access token principals (the `adh_…` secrets), each with its own
// isolated bucket. Distinct from the PERSONAL API tokens the user-settings panel mints
// (`tmp_…`, @agentic-toolkit/authentication's TokensPanel) — same noun, different principal.
//
// Hand-written wire types in ./wire, for the reason feature-flags.ts states.

import { authedJson, authedRequest } from "../http";
import type { MintTokenPrincipalBody, TokenPrincipal, TokenPrincipalCreated } from "./wire";

export type { MintTokenPrincipalBody, TokenPrincipal, TokenPrincipalCreated } from "./wire";

const BASE = "/api/tokens";

/** Owner/bucket scoping shared by every op: `workspace` (a verified slug) pins the op
 *  to the WORKSPACE'S owning principal — the caller's own customer or an org they
 *  belong to — so an org workspace lists/mints/revokes the ORG'S tokens. `ecosystemId`
 *  (rdid or uuid; list only) narrows to tokens whose bucket lives in that ecosystem
 *  (the per-product Tokens topic's scope). */
export interface TokenScope {
  ecosystemId?: string;
  workspace?: string;
}

function scopeQuery(scope?: TokenScope): string {
  const qs = new URLSearchParams();
  if (scope?.ecosystemId) qs.set("ecosystemId", scope.ecosystemId);
  if (scope?.workspace) qs.set("workspace", scope.workspace);
  const s = qs.toString();
  return s ? `?${s}` : "";
}

export const tokenPrincipalsApi = {
  list(scope?: TokenScope): Promise<TokenPrincipal[]> {
    return authedJson<TokenPrincipal[]>(`${BASE}${scopeQuery(scope)}`);
  },
  mint(body: MintTokenPrincipalBody, scope?: TokenScope): Promise<TokenPrincipalCreated> {
    return authedJson<TokenPrincipalCreated>(`${BASE}${scopeQuery(scope)}`, {
      method: "POST",
      body: JSON.stringify(body),
    });
  },
  revoke(id: string, scope?: TokenScope): Promise<void> {
    return authedRequest(`${BASE}/${encodeURIComponent(id)}${scopeQuery(scope)}`, {
      method: "DELETE",
    });
  },
};
