"use client";

import { useMemo, useState } from "react";
import { BookOpen } from "lucide-react";
import {
  CrudDataView,
  readableTables,
  useExitGuardChannel,
  useViewer,
  type CrudTableMeta,
} from "@agentic-toolkit/crud";
import type { TopicDetailItem, TopicLevel } from "@agentic-toolkit/ui/blocks";
import { useStackLevel, useRailExitGuard } from "@agentic-toolkit/resource";

/**
 * Knowledge Bases, in the one merged stack: the persona-memory tables are PUBLISHED as a rail level
 * (via {@link useStackLevel}), and the chosen table's {@link CrudDataView} is the leaf — a
 * hierarchical topic/detail like every other feature, not a nested table list inside the pane.
 * Nothing auto-selects; the open editor's unsaved-work guard is registered so a switch prompts
 * Save / Discard / Cancel. Selection is local (this pane's deeper selection isn't a URL segment).
 *
 * `tables` is the persona-memory CRUD table metadata for the knowledgebases feature, resolved by
 * the HOST (the hub's feature-routes + feature-tables catalogs) and passed in here — this package
 * owns no catalog of its own, so it can't drift from the host's schema mapping.
 *
 * `scopeEcosystemId` (optional) names the target ecosystem on every CRUD verb (see
 * {@link CrudDataView.scopeEcosystemId}) — passed by the persona editor's Knowledge facet to scope
 * the browser to the persona's ecosystem. Omitted (the /home Knowledge Bases feature), the backend
 * scopes to the caller's own JWT ecosystem, unchanged.
 */
export function KnowledgeBasesPane({
  tables,
  scopeEcosystemId,
}: {
  tables: CrudTableMeta[];
  scopeEcosystemId?: string;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const { exitGuard, registerGuard } = useExitGuardChannel();

  // The same exposure gate the /all-data browser applies (CrudDataBrowser), for the same reason:
  // a table the viewer may not READ is a rail row whose only outcome is a 403. Today's
  // persona-memory tables are all `owner`, so this is the identity — it is here so a host that
  // later maps a catalog/admin table into this feature can't hand out a row that just fails.
  // Empty until auth settles rather than "filtered for a non-admin", so an admin never watches a
  // table vanish and pop back. WRITE access is CrudDataView's own call (it renders read-only).
  const { isAdmin: viewerIsAdmin, ready: viewerReady } = useViewer();
  const visible = useMemo(
    () => (viewerReady ? readableTables(tables, viewerIsAdmin) : []),
    [tables, viewerIsAdmin, viewerReady],
  );
  const active = selected ? visible.find((t) => t.table === selected) ?? null : null;

  const items = useMemo<TopicDetailItem[]>(
    () =>
      visible.map((t) => ({
        id: t.table,
        label: t.table,
        icon: <BookOpen size={16} aria-hidden />,
      })),
    [visible],
  );
  const level: TopicLevel = {
    id: "knowledgebases-tables",
    title: "Knowledge Bases",
    items,
    selectedId: active?.table ?? null,
    onSelect: setSelected,
    onClear: () => setSelected(null),
    // "No tables." would be a lie for the paint before auth settles, when the list is empty
    // because the answer isn't in yet.
    emptyLabel: viewerReady ? "No tables." : "Loading…",
  };
  useStackLevel(level);
  // Null unless the open table's editor is dirty — the CrudDataView publishes only while dirty,
  // and unmounting withdraws. No `active` gate needed.
  useRailExitGuard(exitGuard);

  return active ? (
    <CrudDataView
      key={active.key}
      meta={active}
      scopeEcosystemId={scopeEcosystemId}
      onGuardChange={registerGuard}
    />
  ) : (
    <p className="p-6 font-mono text-sm text-apt-text-dim" role="status">
      Select a table to view its data.
    </p>
  );
}
