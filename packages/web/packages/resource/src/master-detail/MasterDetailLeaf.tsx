"use client";

import type { ReactNode } from "react";
import { TopicSelectHint } from "@agentic-toolkit/ui/blocks";
import { ErrorText } from "@agentic-toolkit/ui/components/error-text";
import { cn } from "@agentic-toolkit/ui/lib/utils";
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
  footer,
  fill = false,
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
  /** A strip pinned to the BOTTOM of the pane, below the content region and outside it, so it
   *  stays in view while the editor scrolls. Rendered only while a row is open — it is the open
   *  row's affordance (research's publish card), not the pane's. */
  footer?: ReactNode;
  /** Hand the pane's height to `renderDetail` instead of scrolling it.
   *
   *  Default (`false`): the content region is the scroller and the detail is as tall as its
   *  content — right for a form. Pass `true` when the detail is an EDITOR that manages its own
   *  overflow: scrolling the PANE would carry the toolbar and the fields off screen while the
   *  user types, and a fixed-height editor would ignore the window. The detail is then
   *  responsible for its own `min-h-0` / `flex-1` chain. */
  fill?: boolean;
}) {
  const open = form.editing && form.draft;
  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      <ErrorText error={error} className="px-6 pt-4" />
      <ButtonBar actions={form.actions} showCreate={false} trailing={trailing} help={help} />
      <div
        data-slot="detail-content"
        className={cn(
          "flex min-h-0 min-w-0 flex-1 flex-col px-6 py-4",
          fill ? "overflow-hidden" : "overflow-y-auto",
        )}
      >
        {open ? (
          renderDetail(form.draft as TInput)
        ) : (
          // The shared select-hint card, so this leaf's placeholder matches the stack
          // frontier's nudge and every other "pick something" pane.
          <TopicSelectHint title={emptyTitle} />
        )}
      </div>
      {open && footer && <div className="shrink-0 border-t border-apt-border px-6 py-4">{footer}</div>}
    </div>
  );
}
