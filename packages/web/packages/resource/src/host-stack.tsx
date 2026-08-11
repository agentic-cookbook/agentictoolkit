"use client";

import { useCallback, useState, type ReactElement } from "react";
import { deepestSelectedLevel, type TopicLevel } from "@agentic-toolkit/ui/blocks";
import { AlertModal } from "@agentic-toolkit/ui/components/alert-modal";

/**
 * The HOST side of the stack. Everything a rail host owes {@link RailHostRegistry} beyond plain
 * registration lives here, once, because there are two hosts — {@link StandaloneRailHost} and the
 * hub's WorkspaceChromeProvider — and every line they were each keeping a copy of is a line that
 * can drift between a feature site's /home and the same feature inside the hub shell. The user-
 * facing alert copy is the sharpest case: two literals, one product, no way to notice they had
 * diverged short of opening both.
 *
 * Publishers use `rail-host.tsx`'s hooks (`useStackPop`, `useReportMissing`); hosts use these.
 */

/**
 * Pop the stack's LEAF: clear the deepest level that currently has a selection, backing the user
 * out to that list with nothing chosen. Ancestors are kept, and it is a no-op when nothing is
 * selected anywhere.
 *
 * It reads `deepestSelectedLevel`, the same frontier math the view's Back reads, so a pop and a
 * Back can never disagree about which list is the leaf.
 *
 * Deliberately UNGUARDED — it does not consult the host's exit guard. Its callers are the missing-
 * item acknowledgement below (already gated on nothing being dirty) and a pane popping itself,
 * both of which have decided to leave. Routing it through the guard would put a Discard/Stay
 * prompt in front of a pane whose target no longer exists.
 */
export function useHostPopStack(levels: TopicLevel[]): () => void {
  return useCallback(() => {
    const at = deepestSelectedLevel(levels);
    if (at >= 0) levels[at]?.onClear();
  }, [levels]);
}

export interface HostMissingAlert {
  /** The {@link RailHostRegistry} member. Give it straight to the registry. */
  reportMissing: (id: string, missing: boolean) => void;
  /** Mount this once, anywhere inside the host's provider. It renders nothing until a pane
   *  reports, and it carries its own acknowledgement — there is no second thing to wire, and so
   *  no way for a host to mount the alert and forget the pop. */
  missingAlert: ReactElement;
}

/**
 * The host's answer to a pane discovering its item is gone from the server: tell the user in the
 * platform's own alert, then back them out to the parent list.
 *
 * One mount per host rather than per feature, because a per-feature alert is a per-feature
 * omission — invisible until the rare case fires, at which point the user is stuck in a pane whose
 * subject no longer exists.
 *
 * @param popStack What to run on acknowledgement — {@link useHostPopStack}'s result.
 * @param suppressed Hold the alert back (pass `guards.size > 0`). Acknowledging pops the stack,
 *   and popping out from under an unsaved editor would discard the user's work in order to tell
 *   them the work's target is gone. The report is NOT withdrawn by suppression, so the alert
 *   appears the moment that editor is saved or discarded.
 */
export function useHostMissingAlert(
  popStack: () => void,
  suppressed: boolean,
): HostMissingAlert {
  // Which items panes have reported gone. A Set, not a boolean: two panes can be on screen at
  // once, and the second one withdrawing must not clear the first one's report.
  const [missing, setMissing] = useState<ReadonlySet<string>>(new Set());

  const reportMissing = useCallback((id: string, isMissing: boolean) => {
    setMissing((prev) => {
      if (prev.has(id) === isMissing) return prev;
      const next = new Set(prev);
      if (isMissing) next.add(id);
      else next.delete(id);
      return next;
    });
  }, []);

  const acknowledge = useCallback(() => {
    setMissing(new Set());
    popStack();
  }, [popStack]);

  const missingAlert = (
    <AlertModal
      open={missing.size > 0 && !suppressed}
      title="That item is no longer there"
      description="It was moved or deleted on the server since you last loaded it. Returning you to the list."
      onConfirm={acknowledge}
    />
  );

  return { reportMissing, missingAlert };
}
