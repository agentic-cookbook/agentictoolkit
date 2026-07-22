"use client";

import type { ReactNode } from "react";
import { TopicSelectHint } from "@agentic-toolkit/ui/blocks";
import { ButtonBar, type MasterDetailActions } from "./MasterDetailLayout";

/**
 * The editor half of a DISMANTLED master/detail pane: a {@link ButtonBar} (Save / Cancel / Delete —
 * no Create, the published list level owns "New …") over the active row's editor, or a placeholder
 * when nothing is selected. The list itself is published as a rail level via useMasterDetailLevel;
 * this is the leaf. Used by the status-site Groups / Sites panes so the scaffold lives in one place;
 * the sibling useMasterDetailLevel panes (Access / Users / Applications / Schemas) still inline the
 * same scaffold and can adopt this next.
 */
export function MasterDetailLeaf<TInput>({
  form,
  help,
  trailing,
  error,
  emptyTitle,
  renderDetail,
}: {
  /** The master/detail form (only its bar + editing/draft state are needed here). */
  form: { actions: MasterDetailActions; editing: boolean; draft: TInput | null };
  /** Optional help affordance on the button bar. */
  help?: ReactNode;
  /** Optional trailing affordance on the button bar (e.g. an <ApiButton> for the open row). */
  trailing?: ReactNode;
  /** Optional load error, shown above the bar. */
  error?: string | null;
  /** Placeholder shown when no row is open. */
  emptyTitle: string;
  /** The row editor, rendered only while a row is open (draft guaranteed non-null). */
  renderDetail: (draft: TInput) => ReactNode;
}) {
  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      {error && <p className="px-6 pt-4 text-sm text-apt-red">{error}</p>}
      <ButtonBar actions={form.actions} showCreate={false} trailing={trailing} help={help} />
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto px-6 py-4">
        {form.editing && form.draft ? (
          renderDetail(form.draft)
        ) : (
          // The shared select-hint card, so this leaf's placeholder matches the stack
          // frontier's nudge and every other "pick something" pane.
          <TopicSelectHint title={emptyTitle} />
        )}
      </div>
    </div>
  );
}
