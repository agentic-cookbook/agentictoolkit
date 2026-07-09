import { authedJson, authedRequest } from "../http";
import type { ApiTokenCreatedRow, ApiTokenRow, MintTokenBody } from "./wire";

export type ApiToken = ApiTokenRow;
export type ApiTokenCreated = ApiTokenCreatedRow;
export type { MintTokenBody };

const BASE = "/api/auth/tokens";

export const tokensApi = {
  list(): Promise<ApiToken[]> {
    return authedJson<ApiToken[]>(BASE);
  },
  scopes(): Promise<string[]> {
    return authedJson<{ prefixes: string[] }>(`${BASE}/scopes`).then((r: { prefixes: string[] }) => r.prefixes);
  },
  mint(body: MintTokenBody): Promise<ApiTokenCreated> {
    return authedJson<ApiTokenCreated>(BASE, { method: "POST", body: JSON.stringify(body) });
  },
  revoke(id: string): Promise<void> {
    return authedRequest(`${BASE}/${encodeURIComponent(id)}`, { method: "DELETE" });
  },
};
