"use client";

import { useMemo, useState } from "react";
import { BookOpen } from "lucide-react";
import { CrudDataView, useExitGuardChannel, type CrudTableMeta } from "@agentic-toolkit/crud";
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
  const active = selected ? tables.find((t) => t.table === selected) ?? null : null;
  const { exitGuard, registerGuard } = useExitGuardChannel();

  const items = useMemo<TopicDetailItem[]>(
    () =>
      tables.map((t) => ({ id: t.table, label: t.table, icon: <BookOpen size={16} aria-hidden /> })),
    [tables],
  );
  const level: TopicLevel = {
    id: "knowledgebases-tables",
    title: "Knowledge Bases",
    items,
    selectedId: active?.table ?? null,
    onSelect: setSelected,
    onClear: () => setSelected(null),
    emptyLabel: "No tables.",
  };
  useStackLevel(level);
  // Guard is live only while a table editor is open.
  useRailExitGuard(active ? exitGuard : null);

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
