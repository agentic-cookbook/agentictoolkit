"use client";

import { useAction } from "@agentic-toolkit/crud";
import { ErrorText } from "@agentic-toolkit/ui/components/error-text";
import { useRecordAffordance } from "@agentic-toolkit/resource";
import { Switch } from "@agentic-toolkit/ui/components/switch";
import { Button } from "@agentic-toolkit/ui/components/button";
import { Field } from "@agentic-toolkit/ui/blocks/field";
import { FieldGroup } from "@agentic-toolkit/ui/blocks/field-group";
import {
  personaApprovalsApi,
  personaMayActApi,
  type Approval,
  type MayActGrantableKind,
} from "@agentic-toolkit/data/personas";
import { useOptimisticRowActions } from "./useOptimisticRowActions";

/** The two may-act context switches this panel renders, unified (#10) into one kind-parameterized
 * state/handler instead of a separate `mayActUser`/`mayActTeam` pair. */
const MAY_ACT_SWITCHES: { kind: MayActGrantableKind; label: string }[] = [
  { kind: "user", label: "May act for users" },
  { kind: "team", label: "May act via teams" },
];

/** One may-act context's current grant state, keyed by `kind` for `useOptimisticRowActions`. */
type MayActRow = { kind: MayActGrantableKind; granted: boolean };

/**
 * The persona editor's Permissions facet — WHERE / AS-WHAT this persona may use the tools
 * AbilitiesPanel grants it, plus the human decision queue for its consequential actions.
 * Combines two things that used to be split across the old workspace `AgentToolsPanel` (the
 * `may_act` context switches — "may act for users" / "may act via teams") and
 * `ApprovalsFeature` (the pending Approve/Reject queue), both now scoped to a single
 * `personaId` prop instead of an agent picker / a whole-workspace page.
 *
 * The approvals queue is narrowed to this persona server-side via `?personaId=` (#14) — the
 * backend intersects it with the caller's decidable set, so the response already contains only
 * this persona's pending rows; the panel no longer filters the response itself.
 *
 * Both sections' load/reset + per-row busy-tracking + optimistic-mutate/revert machinery is the
 * shared `useOptimisticRowActions` hook (#11), one instance per section (may-act rows keyed by
 * `kind`, approvals keyed by `id`) — each instance's own monotonic load token guards ITS data
 * source independently, so a persona switch never lets a stale may-act or approvals response
 * from the abandoned persona corrupt the newly-selected persona's view. May-act toggles and
 * decisions each use their OWN `useAction()` instance, mirroring how the two source components
 * each tracked their own busy/error independently.
 */
export function PermissionsPanel({ personaId }: { personaId: string }) {
  const { error: mayActError, run: runMayAct } = useAction();
  const renderRecordAffordance = useRecordAffordance();
  const mayAct = useOptimisticRowActions<MayActRow, MayActGrantableKind>(
    personaId,
    (id) =>
      personaMayActApi
        .list(id)
        .then((kinds) => MAY_ACT_SWITCHES.map(({ kind }) => ({ kind, granted: kinds.includes(kind) }))),
    (row) => row.kind,
  );

  const { error: decideError, run: runDecide } = useAction();
  const approvals = useOptimisticRowActions<Approval>(
    personaId,
    (id) => personaApprovalsApi.list("pending", id),
    (a) => a.id,
  );

  // Optimistically flip the named may-act grant, fire grant/revoke, and restore the prior row on
  // failure. Gated by the load token captured at fire time so a mutation that resolves after a
  // persona switch never writes into a different persona's state.
  function toggleMayAct(kind: MayActGrantableKind, next: boolean) {
    const row = mayAct.rows?.find((r) => r.kind === kind);
    if (!row) return;
    mayAct.runRowMutation(
      row,
      { kind, granted: next },
      async () => {
        if (next) await personaMayActApi.grant(personaId, kind);
        else await personaMayActApi.revoke(personaId, kind);
      },
      runMayAct,
    );
  }

  // Decide one queued action. Gated by the load token captured at fire time so a decision (or
  // its follow-up reload) that settles after a persona switch never touches the newly-selected
  // persona's queue.
  function decide(approval: Approval, action: "approve" | "reject") {
    const token = approvals.loadToken.current;
    approvals.setBusy(approval.id, true);
    void runDecide(async () => {
      try {
        if (action === "approve") await personaApprovalsApi.approve(approval.id);
        else await personaApprovalsApi.reject(approval.id);
        // The decision landed — drop the decided row from the queue immediately, so it is gone
        // from the UI (and can't be re-decided) even if the follow-up reload below throws. Only
        // reached after the decision itself resolved: a thrown approve/reject skips this and
        // leaves the row in place to retry.
        if (approvals.isCurrent(token)) approvals.removeRow(approval.id);
        const rows = await personaApprovalsApi.list("pending", personaId);
        if (approvals.isCurrent(token)) approvals.setRows(rows);
      } finally {
        if (approvals.isCurrent(token)) approvals.setBusy(approval.id, false);
      }
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <FieldGroup
        title="Permissions"
        trailing={renderRecordAffordance?.({
          path: "/access/personas/{id}/may-act",
          pathValues: { id: personaId },
          title: "Persona permissions API",
        })}
      >
        <ErrorText error={mayAct.loadError ?? mayActError} />
        {MAY_ACT_SWITCHES.map(({ kind, label }) => {
          const row = mayAct.rows?.find((r) => r.kind === kind);
          return (
            // Field-wrapped, so the caption's <label> supplies the switch's accessible name
            // (base-ui auto-wires aria-labelledby).
            <Field key={kind} label={label}>
              <Switch
                checked={row?.granted ?? false}
                disabled={!row || mayAct.busy.has(kind)}
                onCheckedChange={(checked) => toggleMayAct(kind, checked)}
              />
            </Field>
          );
        })}
      </FieldGroup>

      <FieldGroup title="Pending actions">
        <ErrorText error={approvals.loadError ?? decideError} />
        {approvals.rows === null ? (
          <p className="text-sm text-apt-text-muted">Loading…</p>
        ) : approvals.rows.length === 0 ? (
          <p className="text-sm text-apt-text-muted">No pending actions.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {approvals.rows.map((a) => {
              const rowBusy = approvals.busy.has(a.id);
              return (
                <li
                  key={a.id}
                  className="flex flex-col gap-2 rounded-lg border border-apt-border p-3 sm:flex-row sm:items-start sm:justify-between"
                >
                  <div className="flex min-w-0 flex-col gap-1">
                    <span className="text-sm text-apt-text">
                      <span className="font-mono">{a.toolName}</span>
                      <span className="text-apt-text-muted"> · acting for {a.subjectKind}</span>
                    </span>
                    <code className="block max-w-full overflow-x-auto rounded bg-apt-surface-2 px-2 py-1 text-[0.7rem] text-apt-text-muted">
                      {summarizeArgs(a.args)}
                    </code>
                    <span className="text-[0.7rem] text-apt-text-dim">
                      requested {formatTime(a.createdAt)}
                    </span>
                  </div>
                  <div
                    className="flex shrink-0 gap-2"
                    role="group"
                    aria-label={`decide ${a.toolName}`}
                  >
                    <Button size="sm" disabled={rowBusy} onClick={() => decide(a, "approve")}>
                      {rowBusy ? "Approving…" : "Approve"}
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      disabled={rowBusy}
                      onClick={() => decide(a, "reject")}
                    >
                      Reject
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </FieldGroup>
    </div>
  );
}

/** A compact one-line preview of a frozen invocation payload. */
function summarizeArgs(args: unknown): string {
  let s: string;
  try {
    s = JSON.stringify(args) ?? String(args);
  } catch {
    s = String(args);
  }
  return s.length > 140 ? `${s.slice(0, 140)}…` : s;
}

/** ISO timestamp → the viewer's locale string, falling back to the raw value. */
function formatTime(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString();
}
