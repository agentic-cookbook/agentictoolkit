"use client";

import type { CrudTableMeta } from "@agentic-toolkit/crud";
import { RailHostBoundary } from "@agentic-toolkit/resource";
import { KnowledgeBasesPane } from "./KnowledgeBasesPane";

/**
 * The Knowledge Bases feature entry — the host's props seam over {@link KnowledgeBasesPane}. The
 * host (the hub's `/<slug>/knowledgebases` route, computing from its `feature-routes` +
 * `feature-tables` catalogs) resolves the persona-memory CRUD table metadata and passes it as
 * `tables`; this package holds no catalog of its own, so a schema change can't silently drift the
 * toolkit and the host apart.
 *
 * `basePath` is accepted for parity with every other toolkit feature (the host's URL base —
 * `/<slug>/knowledgebases` in the hub) even though this feature doesn't push URLs today: the active
 * table is local selection state, not a route segment (see {@link parseKnowledgeBasesPath}) —
 * mirroring how the hub route's `[[...table]]` catch-all is accepted but never read.
 */
export function KnowledgeBasesFeature({
  tables,
  scopeEcosystemId,
}: {
  basePath: string;
  /** The persona-memory CRUD tables this feature edits, resolved by the host's catalogs. */
  tables: CrudTableMeta[];
  /** Names the target ecosystem on every CRUD verb — see {@link KnowledgeBasesPane}. */
  scopeEcosystemId?: string;
}) {
  // RailHostBoundary: the pane's tables rail exists only as a rail-host publication;
  // on a bare feature site (no hub shell) the boundary self-hosts it.
  return (
    <RailHostBoundary>
      <KnowledgeBasesPane tables={tables} scopeEcosystemId={scopeEcosystemId} />
    </RailHostBoundary>
  );
}
