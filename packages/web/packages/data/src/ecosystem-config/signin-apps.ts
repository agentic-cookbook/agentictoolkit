"use client";

// Owner-scoped vended sign-in clients (oauth.clients) for ONE ecosystem — the apps that
// authenticate this ecosystem's customers via GitHub brokered through ADH. Wired to the
// bespoke /ecosystem/signin-apps route (hand-declared, like ecosystems.ts::authSettings).
// The server prefixes the client slug with the ecosystem slug and FORCES the ecosystem, so
// the UI sends only the leaf slug + fields.
//
// Hand-written wire types, for the reason feature-flags.ts states.

import { authedJson, authedRequest, rethrowConflict } from "../http";
import { compact, enc, sortByText } from "../client-helpers";

export interface SigninApp {
  id: string;
  /** The full client id (e.g. myeco.whatsnow) — what the developer configures in their app. */
  slug: string;
  name: string;
  allowedReturnOrigins: string[];
  defaultEcosystemId: string;
  githubEnabled: boolean;
}

export interface SigninAppInput {
  /** Leaf slug (the ecosystem prefix is added server-side); only meaningful when creating. */
  slug: string;
  name: string;
  allowedReturnOrigins: string[];
  githubEnabled: boolean;
}

const base = (ecoId: string) => `/api/ecosystem/signin-apps/${enc(ecoId)}`;

export const signinAppsApi = {
  async list(ecoId: string): Promise<SigninApp[]> {
    const rows = await authedJson<SigninApp[]>(base(ecoId));
    return sortByText(rows, (r) => r.name);
  },

  async create(ecoId: string, input: SigninAppInput): Promise<SigninApp> {
    try {
      return await authedJson<SigninApp>(base(ecoId), {
        method: "POST",
        body: JSON.stringify({
          slug: input.slug.trim().toLowerCase(),
          name: input.name.trim(),
          allowedReturnOrigins: input.allowedReturnOrigins,
          enableGithub: input.githubEnabled,
        }),
      });
    } catch (err) {
      rethrowConflict(err, `A sign-in app "${input.slug}" already exists in this ecosystem.`);
    }
  },

  async update(ecoId: string, id: string, input: Partial<SigninAppInput>): Promise<SigninApp> {
    return authedJson<SigninApp>(`${base(ecoId)}/${enc(id)}`, {
      method: "PATCH",
      // `compact` drops undefined keys so a partial patch sends only the touched fields.
      body: JSON.stringify(
        compact({
          name: input.name?.trim(),
          allowedReturnOrigins: input.allowedReturnOrigins,
          githubEnabled: input.githubEnabled,
        }),
      ),
    });
  },

  async delete(ecoId: string, id: string): Promise<void> {
    await authedRequest(`${base(ecoId)}/${enc(id)}`, { method: "DELETE" });
  },
};
