// Local wire types for the storage token-principal client — the backend row + request-body
// shapes the client reads/sends (see ecosystems/wire.ts for the pattern: these replace the
// hub's generated `SuccessBody<"/tokens", …>` / `RequestBody<"/tokens", "post">` from
// `@agentic-toolkit/adh-api-types`, adh product vocabulary a generic data client must not
// take on). Transcribed from the `TokenPrincipal` / `TokenPrincipalCreated` component
// schemas and the POST body the backend's openapi.json documents for `/tokens`.
// Type-only file.

/** A minted storage principal as the list returns it. `rdid`/`bucketRdid` are nullable:
 *  a principal with no canonical reverse-domain mapping still lists. */
export interface TokenPrincipal {
  id: string;
  slug: string;
  description: string;
  /** Non-secret leading chars of the secret, for display. */
  prefix: string;
  /** reverse-domain id, e.g. token.<owner-slug>.<name>; null if it has no canonical mapping. */
  rdid: string | null;
  /** The token's own isolated bucket, e.g. storage.<owner-slug>.<name>; null if unmapped. */
  bucketRdid: string | null;
  expiresAt?: string | null;
  lastUsedAt?: string | null;
  createdAt: string;
}

/** The 201 body — the ONLY response that carries the raw secret, and it is shown once. */
export interface TokenPrincipalCreated {
  id: string;
  rdid: string;
  slug: string;
  description: string;
  prefix: string;
  bucketRdid: string;
  /** The raw `adh_…` secret — shown once, never again. */
  token: string;
}

/** POST body. `name` is the leaf the server composes the rdid from; `ecosystemId` (rdid or
 *  uuid, manageable by the caller) binds the token and its bucket, defaulting to the owner's
 *  own ecosystem when omitted. */
export interface MintTokenPrincipalBody {
  name: string;
  description?: string;
  expiresAt?: string | null;
  ecosystemId?: string;
}
