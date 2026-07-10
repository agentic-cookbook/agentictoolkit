// Local wire types for the Ecosystems clients — the backend row + request-body
// shapes the clients read/send (see projects/wire.ts for the pattern: these
// replace the hub's generated `SuccessBody<...>` / `RequestBody<...>` from
// `@adh-shared/api-types`, a monorepo coupling the toolkit can't take). Each
// interface carries exactly the fields the mappers and call sites touch.
// Type-only file.

/** Backend row for `GET /ecosystem/ecosystems` (and a single ecosystem). */
export interface EcosystemRow {
  id: string;
  name: string;
  description?: string | null;
  region?: string | null;
  primaryDomain?: string | null;
  createdAt: string;
  updatedAt: string;
  /** hides the auto-provisioned default ecosystem in `list`/`listChildren`. */
  isDefault: boolean;
  /** the ecosystem's own slug — used to resolve a workspace's ecosystem by slug. */
  slug: string;
  /** `?workspace=` mode only: whether the CALLER may manage this ecosystem's contents
   *  (the org-admin bar). The list itself is membership-gated, so a plain org member
   *  sees org products they cannot open — the UI uses this to present that honestly. */
  canManage?: boolean;
}

/** `POST /ecosystem/ecosystems` body. */
export interface EcosystemCreateBody {
  id: string;
  slug: string;
  name: string;
  description: string;
  region: string;
  primaryDomain: string;
}

/** `PUT /ecosystem/ecosystems/{id}` body — generic CRUD PUT accepts a partial body
 *  (createInsertSchema().partial()). */
export interface EcosystemPutBody {
  name?: string;
  description?: string;
  region?: string;
  primaryDomain?: string;
}

/** `PATCH /registry/identifiers/{rdid}` body — renames an rdid in place. */
export interface IdentifierRenameBody {
  rdid: string;
}
