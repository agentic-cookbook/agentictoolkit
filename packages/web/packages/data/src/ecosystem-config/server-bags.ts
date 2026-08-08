"use client";

// Per-ecosystem SERVER BAGS (arbitrary key → JSON config values this product's backend
// reads at runtime) for ONE ecosystem — the per-product analogue of the admin site's
// GLOBAL server-bags page. Wired to the backend's /ecosystem/server-bag route: CREATE
// (POST, value required) and UPDATE (PUT, partial) are split so a "New bag" whose key
// already exists is a 409, not a silent overwrite; the key is IMMUTABLE. Mirrors
// signin-apps.ts.
//
// Hand-written wire types, for the reason feature-flags.ts states.

import { authedJson, authedRequest } from "../http";
import { enc, sortByText } from "../client-helpers";

export interface EcosystemServerBag {
  key: string;
  value: unknown;
  description: string;
  createdAt: string;
  updatedAt: string;
}

/** POST create body — key + value (required) + optional description. */
export interface EcosystemServerBagCreate {
  key: string;
  value: unknown;
  description?: string;
}

/** PUT update body — value and/or description (at least one). */
export interface EcosystemServerBagUpdate {
  value?: unknown;
  description?: string;
}

const base = (ecoId: string) => `/api/ecosystem/server-bag/${enc(ecoId)}`;

export const ecosystemServerBagsApi = {
  /** All bags for the ecosystem, alphabetized by key (the pane filters this list). */
  async get(ecoId: string): Promise<EcosystemServerBag[]> {
    const { bags } = await authedJson<{ bags: EcosystemServerBag[] }>(base(ecoId));
    return sortByText(bags, (b) => b.key);
  },

  /** Create one bag (409 if the key already exists). */
  async create(ecoId: string, body: EcosystemServerBagCreate): Promise<EcosystemServerBag> {
    return authedJson<EcosystemServerBag>(base(ecoId), {
      method: "POST",
      body: JSON.stringify(body),
    });
  },

  /** Update one existing bag by key (404 if it doesn't exist; the key itself is immutable). */
  async update(
    ecoId: string,
    key: string,
    body: EcosystemServerBagUpdate,
  ): Promise<EcosystemServerBag> {
    return authedJson<EcosystemServerBag>(`${base(ecoId)}/${enc(key)}`, {
      method: "PUT",
      body: JSON.stringify(body),
    });
  },

  async delete(ecoId: string, key: string): Promise<void> {
    await authedRequest(`${base(ecoId)}/${enc(key)}`, { method: "DELETE" });
  },
};
