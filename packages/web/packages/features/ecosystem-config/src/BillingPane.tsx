"use client";

import type { ReactElement, ReactNode } from "react";

/**
 * Billing's pane. There is no billing UI yet, so this states that plainly rather than showing an
 * empty table that reads as "you have no charges" — an authoritative-looking answer to a question
 * nothing has actually asked.
 *
 * It takes the same `{ ecosystemId, title, help }` shape as its sibling panes even though it reads
 * none of them: the group renders its rows through one signature, and a row that opts out of that
 * signature is a special case at every call site for as long as it stays unbuilt.
 */
export function BillingPane(_props: {
  ecosystemId?: string;
  /** Unused: the breadcrumb names the pane (kept for the ScopedPane prop shape). */
  title?: ReactNode;
  help?: ReactNode;
}): ReactElement {
  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col items-center justify-center gap-2 p-8 text-center">
      <h1 className="font-mono text-lg tracking-wide text-apt-text">Billing</h1>
      <p className="font-mono text-sm uppercase tracking-widest text-apt-text-dim">Coming soon</p>
    </div>
  );
}
