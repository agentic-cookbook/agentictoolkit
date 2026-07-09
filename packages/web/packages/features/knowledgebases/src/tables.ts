// Type from the barrel (type-only imports are erased — no runtime client-module edge);
// the VALUE import must stay on the directive-free generated subpath (see below).
import type { CrudTableMeta } from "@agentic-toolkit/crud";
import { CRUD_TABLES } from "@agentic-toolkit/crud/generated/table-metadata";

/**
 * The persona-memory CRUD tables from the toolkit's generated catalog — the same rule the
 * hub's knowledgebases feature def encodes (`schemas: ["persona-memory"]` resolved by its
 * featureTables: every table of the schema, sorted by key). Exported so catalog-less hosts
 * (the feature sites) call ONE implementation of the rule instead of each re-filtering the
 * catalog; the hub keeps resolving through its own feature-routes SSoT and passes the result
 * in as `tables`, so the two paths stay comparable at one seam.
 *
 * SERVER-SAFE on purpose (own `./tables` subpath, no "use client", only the catalog's
 * directive-free subpath as a dependency): the site mounts call this from RSC pages, where a
 * client-module export would be an uncallable client reference.
 */
export function personaMemoryTables(): CrudTableMeta[] {
  return Object.values(CRUD_TABLES)
    .filter((t) => t.schema === "persona-memory")
    .sort((a, b) => a.key.localeCompare(b.key));
}
