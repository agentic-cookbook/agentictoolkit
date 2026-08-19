"use client";

import { useCallback, useState } from "react";
import type { ReactElement } from "react";
import { Button } from "@agentic-toolkit/ui/components/button";
import { ErrorText } from "@agentic-toolkit/ui/components/error-text";
import { useResourceList } from "@agentic-toolkit/data";
import { listEvents, redriveEvents, type EventRow, type RedriveResult } from "./api/billing";

/**
 * The webhook ledger, newest first — did the event arrive, and did it process.
 *
 * A row with `processedAt: null` beside an `error` is the surface this member exists for. The
 * repository has already paid for not having it: a handler read a field Stripe's payload does not
 * carry and no purchase was recorded at all, which a ledger would have shown on the first sale
 * rather than at the audit.
 */
export function EventsPane({ ecosystemId }: { ecosystemId?: string }): ReactElement {
  const load = useCallback(() => listEvents(200), []);
  const { items, reload, error, errorStatus } = useResourceList<EventRow>(
    `billing:${ecosystemId ?? ""}:events`,
    load,
    { reportErrors: false },
  );
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<RedriveResult | null>(null);
  const [failure, setFailure] = useState<string | null>(null);

  async function runRedrive(offset?: number) {
    setBusy(true);
    setFailure(null);
    try {
      const r = await redriveEvents(offset === undefined ? undefined : { offset });
      setResult(r);
      await reload();
    } catch (e) {
      setFailure(e instanceof Error ? e.message : "The redrive could not be run.");
    } finally {
      setBusy(false);
    }
  }

  const loadError =
    errorStatus === 404
      ? "Billing is not enabled for this ecosystem. Turn it on under Setup."
      : errorStatus === 403
        ? "The event ledger is visible to this ecosystem's owners only."
        : error
          ? "The event ledger could not be loaded."
          : null;

  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="flex items-center gap-3">
        <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => void runRedrive()}>
          Re-apply unprocessed events
        </Button>
        {/* `nextOffset` is non-null only when the batch came back full. Offered as a button rather
            than looped automatically: a redrive is an operator action with side effects — it can
            mint and EMAIL claim links — and a UI that silently repeats it forty times is not one
            the operator authorised. */}
        {result?.nextOffset != null ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={busy}
            onClick={() => void runRedrive(result.nextOffset ?? undefined)}
          >
            {`Continue from ${result.nextOffset}`}
          </Button>
        ) : null}
      </div>

      <ErrorText error={failure} />
      {result ? (
        // The counts verbatim, because each names a different outcome and collapsing them into
        // "done" would hide `failed` — the one that means a row threw and will be retried.
        <p className="text-sm text-apt-text-muted">
          {`examined ${result.examined} · applied ${result.applied} · terminal ${result.terminal} · still pending ${result.stillPending} · unreadable ${result.unreadable} · failed ${result.failed}`}
        </p>
      ) : null}

      {loadError ? (
        <p className="text-sm text-apt-text-muted">{loadError}</p>
      ) : items === null ? (
        <p className="text-sm text-apt-text-muted">Loading…</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-apt-text-muted">No webhook events have arrived yet.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {items.map((e) => (
            <li key={e.id} className="flex flex-col gap-0.5">
              <div className="flex items-baseline justify-between gap-4">
                <code className="text-sm">{e.type}</code>
                <span className="text-xs text-apt-text-muted">
                  {new Date(e.receivedAt).toLocaleString()}
                </span>
              </div>
              <span className="text-xs text-apt-text-muted">
                {e.processedAt ? `processed ${new Date(e.processedAt).toLocaleString()}` : "not processed"}
              </span>
              {e.error ? <span className="text-xs text-apt-red">{e.error}</span> : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
