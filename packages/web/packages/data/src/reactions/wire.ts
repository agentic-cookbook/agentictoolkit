// Local wire types for the reactions client — the backend row + request-body shapes it
// reads/sends. Narrowed by hand from the OpenAPI schema (`Reaction`) rather than imported from
// `@agentic-toolkit/adh-api-types`, which is adh product vocabulary a generic data client must
// not take on; the cost is that a backend contract change is caught by keeping this in sync,
// not by the build. Type-only file.

/** Backend row for `/content/reactions` (list, create) — one actor's one emoji on one subject. */
export interface ReactionRow {
  id: string;
  /** the user who reacted (server-stamped from the caller — never sent). */
  customerId: string;
  ecosystemId: string;
  targetKind: string;
  targetId: string;
  emoji: string;
  createdAt: string;
  /** set once removed; the read routes already filter these out. */
  deletedAt?: string | null;
}

/** `POST /content/reactions` body. */
export interface ReactionCreateBody {
  targetKind: string;
  targetId: string;
  emoji: string;
}
