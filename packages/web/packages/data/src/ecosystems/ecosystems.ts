// Ecosystems API client — wired to the real backend (generic CRUD over
// `ecosystems.ecosystems`, an RDID-addressed table).
//
// Routes: /api/ecosystem/ecosystems (list/create),
//         /api/ecosystem/ecosystems/{id} (get/update/delete).
//
// `ecosystems.ecosystems` is RDID-addressed: its public `id` is the
// reverse-domain identifier (rdid) — the backend resolves rdid<->uuid at the
// request edge, so every response already carries the rdid as `id`. The UI
// models the same value under two names (`id` for routing/handles, `identifier`
// for display + uniqueness); both map to the one backend `id`.
//
// Field map:
//   UI identifier / id  <->  backend `id`            (the rdid; immutable)
//   UI name             <->  backend `name`
//   UI description      <->  backend `description`
//   UI region           <->  backend `region`
//   UI domain           <->  backend `primaryDomain`
//
// The backend also requires a `slug` (NOT NULL, unique). The UI doesn't model
// one, so create sends slug = identifier; that keeps the slug unique in lockstep
// with the rdid. The `identifier` (rdid) IS mutable: update() renames it via the
// registry.identifiers route when it changes, then PUTs the other fields under the
// (possibly new) id — the entity's own `id` column is server-managed.

import { authedJson, authedRequest, isNotFound, rethrowConflict } from "../http";
import { compact, enc, sortByText } from "../client-helpers";
import { identifiersApi } from "./identifiers";
import type { EcosystemRow, EcosystemCreateBody, EcosystemPutBody } from "./wire";

export interface Ecosystem {
  id: string;
  identifier: string;
  name: string;
  description: string;
  region: string;
  domain: string;
  createdAt: string;
  updatedAt: string;
  /** Workspace-scoped lists only: whether the caller may manage this ecosystem's
   *  contents (the org-admin bar). Absent (undefined) outside `?workspace=` mode,
   *  where every listed ecosystem is manageable by construction. */
  canManage?: boolean;
}

export interface EcosystemInput {
  identifier: string;
  name: string;
  description: string;
  region: string;
  domain: string;
}

/** The explicit per-ecosystem auth policy (backend `ecosystem.auth_settings`), served by
 *  the bespoke /ecosystem/auth-settings route (not generic CRUD → hand-declared, like
 *  `capabilities` below, rather than sourced from the OpenAPI spec). */
export type SignupMode = "open" | "invite_only" | "closed";
export interface AuthSettings {
  signupMode: SignupMode;
  loginEnabled: boolean;
  /** null = all configured providers. */
  allowedProviders: string[] | null;
}

const BASE = "/api/ecosystem/ecosystems";

export function toEcosystem(r: EcosystemRow): Ecosystem {
  return {
    id: r.id,
    identifier: r.id,
    name: r.name,
    description: r.description ?? "",
    region: r.region ?? "",
    domain: r.primaryDomain ?? "",
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
    ...(r.canManage !== undefined ? { canManage: r.canManage } : {}),
  };
}

export const ecosystemsApi = {
  async list(): Promise<Ecosystem[]> {
    const rows = await authedJson<EcosystemRow[]>(BASE);
    // Hide the auto-provisioned default ecosystems (`<rdid>.ecosystem`): they're managed
    // infrastructure, not ecosystems the user created, so listing them would just double
    // the list with "X (default)" siblings. They stay addressable directly by rdid.
    return sortByText(
      rows.filter((r) => !r.isDefault).map(toEcosystem),
      (e) => e.name,
    );
  },

  /** The ecosystems a WORKSPACE directly OWNS (`owner_id` = the workspace's principal —
   *  the caller's customer for a personal workspace, an org they belong to for an org
   *  workspace) — the hub's Products list. Ownership, not access: scoped server-side
   *  (`?workspace=`), never admin-widened; the server also excludes both the structural
   *  defaults AND the principal's auto-provisioned infrastructure row, so no client
   *  filter is needed (unlike the unscoped {@link list}). Rows carry `canManage`. */
  async listForWorkspace(workspaceSlug: string): Promise<Ecosystem[]> {
    const rows = await authedJson<EcosystemRow[]>(`${BASE}?workspace=${enc(workspaceSlug)}`);
    return sortByText(rows.map(toEcosystem), (e) => e.name);
  },

  /** The WORKSPACE's default (account-infrastructure) ecosystem id — the auto-provisioned
   *  own ecosystem the workspace-level Storage/Integrations panes scope to. Resolved
   *  server-side by OWNERSHIP (`?workspace=` + `infrastructure=true`), membership-gated —
   *  never the caller's own default, which is a different principal's ecosystem on an
   *  org workspace. `null` when the workspace has no infrastructure row (never
   *  `undefined`, which react-query rejects as query data). */
  async workspaceDefaultEcosystemId(
    workspaceSlug: string,
  ): Promise<{ id: string; canManage: boolean } | null> {
    const rows = await authedJson<EcosystemRow[]>(
      `${BASE}?workspace=${enc(workspaceSlug)}&infrastructure=true`,
    );
    const row = rows[0];
    // `canManage` is annotated by the workspace-mode list: a member can READ the org's infra
    // ecosystem (membership-gated) but only an org admin can MANAGE its contents — the host uses
    // this to show an honest "ask an admin" notice instead of a wall of per-pane 403s.
    return row ? { id: row.id, canManage: row.canManage !== false } : null;
  },

  /** The CHILD ecosystems of `parentId` (an ecosystem rdid/uuid): the ecosystems whose owner IS
   *  that ecosystem — the "Child Ecosystems" view. Scoped server-side (`?parent=`, which also
   *  excludes the structural defaults), so admins get the same node-scoped set here rather
   *  than every ecosystem. */
  async listChildren(parentId: string): Promise<Ecosystem[]> {
    const rows = await authedJson<EcosystemRow[]>(`${BASE}?parent=${enc(parentId)}`);
    return sortByText(rows.map(toEcosystem), (e) => e.name);
  },

  async get(id: string): Promise<Ecosystem | null> {
    try {
      return toEcosystem(
        await authedJson<EcosystemRow>(`${BASE}/${enc(id)}`),
      );
    } catch (err) {
      // 404 → null (the UI contract is null-for-missing). Rethrow anything else so a
      // transient failure isn't mistaken for a deleted ecosystem (callers redirect on a
      // confirmed null, so a network blip must not masquerade as "does not exist").
      if (isNotFound(err)) return null;
      throw err;
    }
  },

  /** Create an ecosystem. Pass `parent` (an ecosystem rdid/uuid) to create it as a CHILD of
   *  that ecosystem (owner = the parent, landed in the parent's child namespace); pass
   *  `workspace` (a workspace slug) to stamp the WORKSPACE's principal as owner (the org for
   *  an org workspace — membership-gated server-side), so the product shows up in that
   *  workspace's list instead of the creator's personal one; omit both for a top-level,
   *  developer-owned ecosystem. `parent` wins when both are given (they never are today). */
  async create(
    input: EcosystemInput,
    opts?: { parent?: string; workspace?: string },
  ): Promise<Ecosystem> {
    // No pre-read for duplicates: the backend's unique rdid + unique slug are the
    // real guards (and a pre-read can't see a soft-deleted row still holding the
    // key). Catch the 409 and surface a friendly, entity-named message instead.
    try {
      const body: EcosystemCreateBody = {
        id: input.identifier,
        // `slug` is varchar(64) NOT NULL unique; keep it in lockstep with the
        // rdid but clamp to the column width (an rdid can exceed 64 chars).
        slug: input.identifier.slice(0, 64),
        name: input.name,
        description: input.description,
        region: input.region,
        primaryDomain: input.domain,
      };
      const url = opts?.parent
        ? `${BASE}?parent=${enc(opts.parent)}`
        : opts?.workspace
          ? `${BASE}?workspace=${enc(opts.workspace)}`
          : BASE;
      const row = await authedJson<EcosystemRow>(url, {
        method: "POST",
        body: JSON.stringify(body),
      });
      return toEcosystem(row);
    } catch (err) {
      rethrowConflict(
        err,
        `An ecosystem with identifier "${input.identifier}" already exists.`,
      );
    }
  },

  async update(id: string, input: Partial<EcosystemInput>): Promise<Ecosystem> {
    // Update the mutable fields first (under the current id), THEN rename the rdid
    // if it changed. Renaming LAST keeps the entity consistent if either call
    // fails: a failed PUT changes nothing; a failed rename leaves the
    // already-updated fields under the original id, so a retry is safe. (The
    // entity `id` is server-managed and can't be re-keyed via the PUT — the rdid
    // is renamed through the registry.identifiers route.)
    const body = compact({
      name: input.name,
      description: input.description,
      region: input.region,
      primaryDomain: input.domain,
    } satisfies EcosystemPutBody);
    // The new rdid when this update renames, else null (narrows the branches below
    // to a plain string without non-null assertions).
    const newIdentifier =
      input.identifier && input.identifier !== id ? input.identifier : null;
    let row: EcosystemRow;
    try {
      row = await authedJson<EcosystemRow>(`${BASE}/${enc(id)}`, {
        method: "PUT",
        body: JSON.stringify(body),
      });
    } catch (err) {
      // A 404 on the PUT under the old id has two causes during a rename:
      //   (a) the rename already applied server-side but its response was lost, so
      //       the old id no longer resolves — recover by re-applying the fields
      //       under the new id (the rename is done); or
      //   (b) the entity was genuinely deleted / never existed — there is nothing
      //       to recover, and silently re-PUTting under the typed new id would mask
      //       the real failure (and could land on a *different* entity that owns
      //       that rdid).
      // Disambiguate by checking whether the new id now resolves to a real,
      // tenant-visible entity: only then is it the post-rename state we can recover.
      if (newIdentifier && isNotFound(err) && (await ecosystemsApi.get(newIdentifier))) {
        row = await authedJson<EcosystemRow>(`${BASE}/${enc(newIdentifier)}`, {
          method: "PUT",
          body: JSON.stringify(body),
        });
        return { ...toEcosystem(row), id: newIdentifier, identifier: newIdentifier };
      }
      throw err;
    }
    const updated = toEcosystem(row);
    if (newIdentifier) {
      await identifiersApi.rename(id, newIdentifier);
      // Reflect the new rdid in the returned entity, independent of what the PUT
      // response echoed for `id` — callers detect the rename via this id change.
      return { ...updated, id: newIdentifier, identifier: newIdentifier };
    }
    return updated;
  },

  delete(id: string): Promise<void> {
    return authedRequest(`${BASE}/${enc(id)}`, { method: "DELETE" });
  },

  /** Resolve the ecosystem id (rdid) for a WORKSPACE slug — the ecosystem whose own
   *  `slug` matches, else the owner's default ecosystem (the workspace's primary),
   *  else the first returned. Reads the RAW rows (unlike {@link list}, which hides
   *  default ecosystems + sorts alphabetically) so surfaces that carry no ecosystem
   *  in their URL — the standalone `/[slug]/messaging` route — gate on the RIGHT
   *  ecosystem instead of an arbitrary alphabetical pick. `null` (never `undefined`, which
   *  react-query rejects as query data) when the tenant has no ecosystems. */
  async ecosystemIdForSlug(slug: string): Promise<string | null> {
    const rows = await authedJson<EcosystemRow[]>(BASE);
    return (
      (rows.find((r) => r.slug === slug) ??
        rows.find((r) => r.isDefault) ??
        rows[0])?.id ?? null
    );
  },

  /** The opt-in capabilities enabled for an ecosystem (per-ecosystem registry —
   *  the seam the hub uses to gate optional features like `messaging`, default off).
   *  `id` is the ecosystem's rdid (or uuid); the backend resolves it at the edge. */
  async capabilities(id: string): Promise<string[]> {
    const res = await authedJson<{ capabilities: string[] }>(
      `/api/ecosystem/capabilities/${enc(id)}`,
    );
    // Coerce a malformed/empty response to [] — react-query rejects an undefined queryFn result.
    return res.capabilities ?? [];
  },

  /** The explicit per-ecosystem AUTH POLICY governing this ecosystem's vended customer
   *  realm. Absent server-side ⇒ documented defaults (invite_only + login enabled); the
   *  route always returns a full object. `id` is the ecosystem's rdid (or uuid). */
  async authSettings(id: string): Promise<AuthSettings> {
    return authedJson<AuthSettings>(`/api/ecosystem/auth-settings/${enc(id)}`);
  },

  /** Update the auth policy (partial patch; `compact` drops undefined keys but preserves an
   *  explicit `allowedProviders: null` = "all providers"). Returns the effective policy. */
  async updateAuthSettings(id: string, patch: Partial<AuthSettings>): Promise<AuthSettings> {
    return authedJson<AuthSettings>(`/api/ecosystem/auth-settings/${enc(id)}`, {
      method: "PUT",
      body: JSON.stringify(compact(patch)),
    });
  },
};
