// Generic CRUD over `persona.special_interests` — a persona's one or two deep interests.
//
// Routes: /api/persona/special-interests (list/create), /api/persona/special-interests/{id}
//         (put/delete).
//
// The list MUST be filtered by persona: generic CRUD scopes to the caller's own rows, so an
// unfiltered call returns every interest the caller owns across ALL their personas.
import { authedJson, authedRequest } from "../http";
import { enc } from "../client-helpers";
import type { SpecialInterestRow } from "./wire";

/** Create body. `personaId` takes the persona's rdid (`persona.<owner>.<name>`) or its uuid —
 *  the backend resolves either. `slug` is a single rdid segment: [a-z0-9-], no dots. */
export interface SpecialInterestBody {
  personaId: string;
  slug: string;
  general: string;
  topical?: string | null;
  specific?: string | null;
  stances?: string | null;
  position?: number;
}

/** Update body: everything except the two fields the server owns. `personaId` is immutable
 *  (moving an interest would orphan its provisioned bucket) and `bucketId` is server-assigned. */
export type SpecialInterestPatch = Partial<Omit<SpecialInterestBody, "personaId">>;

export const specialInterestsApi = {
  list: (personaId: string) =>
    authedJson<SpecialInterestRow[]>(
      `/api/persona/special-interests?personaId=${enc(personaId)}`,
    ),
  create: (body: SpecialInterestBody) =>
    authedJson<SpecialInterestRow>("/api/persona/special-interests", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  update: (id: string, patch: SpecialInterestPatch) => {
    // Drop the two fields the backend refuses even if a caller passes them through: a real
    // personaId change is a 400, and bucketId is stripped server-side. Failing here silently is
    // better than a confusing 400 the user cannot act on.
    const { personaId: _p, bucketId: _b, ...safe } = patch as Record<string, unknown>;
    return authedJson<SpecialInterestRow>(`/api/persona/special-interests/${enc(id)}`, {
      method: "PUT",
      body: JSON.stringify(safe),
    });
  },
  delete: (id: string) =>
    authedRequest(`/api/persona/special-interests/${enc(id)}`, { method: "DELETE" }),
};

export type { SpecialInterestRow } from "./wire";
