"use client";

// Per-ecosystem FEATURE FLAGS (named on/off toggles this product's apps read) for ONE
// ecosystem — the per-product analogue of the admin site's GLOBAL feature-flags page.
// Wired to the backend's /ecosystem/feature-flags route: CREATE (POST) and UPDATE (PUT)
// are split so a "New flag" whose key already exists is a 409, not a silent overwrite;
// the key is IMMUTABLE (it lives in the path on update). Mirrors signin-apps.ts.
//
// The types are hand-written here rather than derived from `@agentic-toolkit/adh-api-types`:
// every client in this package transcribes the wire shape it touches (see
// ecosystems/wire.ts), because a generic data client must not take a dependency on adh's
// generated product vocabulary.

import { authedJson, authedRequest } from "../http";
import { enc, sortByText } from "../client-helpers";

export interface EcosystemFeatureFlag {
  key: string;
  enabled: boolean;
  description: string;
  createdAt: string;
  updatedAt: string;
}

/** POST create body — key + optional initial state. */
export interface EcosystemFeatureFlagCreate {
  key: string;
  enabled?: boolean;
  description?: string;
}

/** PUT update body — at least one field; a toggle sends only `enabled`. */
export interface EcosystemFeatureFlagUpdate {
  enabled?: boolean;
  description?: string;
}

const base = (ecoId: string) => `/api/ecosystem/feature-flags/${enc(ecoId)}`;

export const ecosystemFeatureFlagsApi = {
  /** All flags for the ecosystem, alphabetized by key (the pane filters this list). */
  async get(ecoId: string): Promise<EcosystemFeatureFlag[]> {
    const { flags } = await authedJson<{ flags: EcosystemFeatureFlag[] }>(base(ecoId));
    return sortByText(flags, (f) => f.key);
  },

  /** Create one flag (409 if the key already exists). */
  async create(ecoId: string, body: EcosystemFeatureFlagCreate): Promise<EcosystemFeatureFlag> {
    return authedJson<EcosystemFeatureFlag>(base(ecoId), {
      method: "POST",
      body: JSON.stringify(body),
    });
  },

  /** Update one existing flag by key (404 if it doesn't exist; the key itself is immutable). */
  async update(
    ecoId: string,
    key: string,
    body: EcosystemFeatureFlagUpdate,
  ): Promise<EcosystemFeatureFlag> {
    return authedJson<EcosystemFeatureFlag>(`${base(ecoId)}/${enc(key)}`, {
      method: "PUT",
      body: JSON.stringify(body),
    });
  },

  async delete(ecoId: string, key: string): Promise<void> {
    await authedRequest(`${base(ecoId)}/${enc(key)}`, { method: "DELETE" });
  },
};
