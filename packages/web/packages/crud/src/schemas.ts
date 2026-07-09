import { CRUD_TABLES } from './generated/table-metadata'

/**
 * The distinct DB schemas exposed by generic CRUD, derived ONCE from the generated
 * (build-time constant) CRUD_TABLES. The single definition of "schemas CRUD
 * exposes" — used by both halves of the allowlist↔feature lockstep gate (this
 * package's metadata.test.ts and the hub's feature-routes.test.ts) instead of each
 * re-deriving the set inline. A ReadonlySet: the value is fixed and shared, not
 * recomputed or mutable.
 */
export const CRUD_SCHEMAS: ReadonlySet<string> = new Set(
  Object.values(CRUD_TABLES).map((t) => t.schema),
)
