"use client";

import type { ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { Badge } from "@agentic-toolkit/ui/components/badge";
import { DataTable, type DataTableColumn } from "@agentic-toolkit/ui/components/data-table";
import { EmptyState } from "@agentic-toolkit/ui/components/empty-state";
import { Progress } from "@agentic-toolkit/ui/components/progress";
import { Stat } from "@agentic-toolkit/ui/components/stat";

import { getUsageSummary, usageSummaryKey, type UsageRow } from "@agentic-toolkit/data/profile";
import { isForbidden } from "@agentic-toolkit/data";
import { useReportBusy } from "@agentic-toolkit/resource";
import {
  capFor,
  capPercent,
  capsFor,
  formatBytes,
  formatCost,
  formatCount,
  groupUsage,
  type CapKey,
  type UsageCap,
} from "./usage/format";

/**
 * Usage — the current period's metered traffic and spend, per principal.
 *
 * Rendered in both User Settings (no `workspaceSlug` → the caller's own principals) and an org
 * workspace's Settings (`workspaceSlug` → that org's member roster + org-owned personas). The
 * subject list is decided server-side, so this component never asks for a subject; the only thing
 * it passes is the workspace it is mounted in.
 *
 * The one thing the layout is load-bearing about is what may be ADDED UP. See `groupUsage`: the
 * people and token rows partition the traffic, personas overlap it, and the ecosystem row is a
 * different axis entirely — so each gets its own section and only the first two feed the total.
 */
export function UsagePanel({ workspaceSlug }: { workspaceSlug?: string } = {}) {
  const usageQuery = useQuery({
    queryKey: usageSummaryKey(workspaceSlug),
    queryFn: () => getUsageSummary(workspaceSlug ? { workspace: workspaceSlug } : undefined),
    retry: false,
  });

  // Publishes no topic list of its own: the settings list one component up owns the spinner. Above
  // the early returns below, because a hook may not sit behind a branch — and because the error
  // return is exactly where a pane would otherwise leave a report standing. See `useReportBusy`.
  useReportBusy(usageQuery.isFetching);

  if (usageQuery.isError) {
    // An org's Settings rail is open to every member, but the usage of an org's PEOPLE is
    // workspace-admin only — so a 403 here is an ordinary outcome, not a failure to report.
    return (
      <Shell>
        {isForbidden(usageQuery.error) ? (
          <EmptyState
            title="Usage is workspace-admin only"
            description="Ask a workspace admin for this organization's usage. Your own usage is in User Settings."
          />
        ) : (
          <EmptyState title="Couldn't load usage" description="Reload the page to retry." />
        )}
      </Shell>
    );
  }

  if (usageQuery.isPending) {
    return (
      <Shell>
        <DataTable<UsageRow>
          columns={COLUMNS}
          rows={[]}
          getRowId={rowId}
          loading
          ariaLabel="Usage"
        />
      </Shell>
    );
  }

  const view = groupUsage(usageQuery.data);

  if (view.sections.length === 0 && !view.ecosystem) {
    return (
      <Shell>
        <EmptyState
          title="Nothing metered yet"
          description="Usage appears here once this workspace makes its first API call or chat turn."
        />
      </Shell>
    );
  }

  return (
    <Shell>
      <div className="flex flex-col gap-8">
        <header className="flex flex-col gap-3">
          {view.period && (
            <p className="text-xs text-apt-text-dim">
              Current period — since {view.period.start}, on a {view.period.days}-day window.
            </p>
          )}
          <div className="flex flex-wrap items-end justify-between gap-6 rounded-lg border border-apt-border px-4 py-3">
            <Stat label="Calls" value={formatCount(view.totals.requests)} className="items-start" />
            <Stat label="Data" value={formatBytes(view.totals.bytes)} className="items-start" />
            <Stat label="Tokens" value={formatCount(view.totals.tokens)} className="items-start" />
            <Stat label="Cost" value={formatCost(view.totals.costMicros)} className="items-start" />
          </div>
          {observingOnly(usageQuery.data) && (
            <p className="text-xs text-apt-text-dim">
              Limits are being recorded, not enforced — nothing is refused for going over yet.
            </p>
          )}
        </header>

        {view.sections.map((section) => (
          <Section key={section.id} title={section.title} description={section.description}>
            <DataTable<UsageRow>
              columns={COLUMNS}
              rows={section.rows}
              getRowId={rowId}
              ariaLabel={section.title}
            />
          </Section>
        ))}

        {view.ecosystem && (
          <Section
            title="Platform"
            description="The ecosystem's billing key — every tenant in this realm, and the one key whose token and spend caps can actually refuse a turn. Platform admins only."
          >
            <DataTable<UsageRow>
              columns={COLUMNS}
              rows={[view.ecosystem]}
              getRowId={rowId}
              ariaLabel="Platform usage"
            />
          </Section>
        )}
      </div>
    </Shell>
  );
}

// ── Pieces ─────────────────────────────────────────────────────────────────────

function Shell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-0 flex-1 overflow-y-auto px-6 py-6">
      <div className="max-w-5xl">{children}</div>
    </div>
  );
}

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section className="flex flex-col gap-2">
      <h3 className="text-sm font-medium text-apt-text">{title}</h3>
      {description && <p className="max-w-prose text-xs text-apt-text-dim">{description}</p>}
      {children}
    </section>
  );
}

const rowId = (row: UsageRow): string => `${row.scope}:${row.principalId}`;

/** What a row's `kind` is called on the page. `self` needs no chip — the section says "You". */
const KIND_LABEL: Partial<Record<UsageRow["kind"], string>> = {
  token: "token",
  persona: "persona",
  ecosystem: "ecosystem",
};

/**
 * One quantity cell. When a cap on this quantity can actually refuse something for this row it
 * becomes `used / cap` plus a bar; otherwise it is the bare number — an uncapped quantity has no
 * meaningful fill, and a cap that never fires for this key would be a lie drawn as a bar.
 */
function Quantity({
  row,
  capKey,
  value,
  format,
}: {
  row: UsageRow;
  capKey: CapKey;
  value: number;
  format: (n: number) => string;
}) {
  const cap = capFor(row, capKey);
  if (!cap) return <span className="font-mono text-sm text-apt-text">{format(value)}</span>;
  return (
    <div className="flex w-full flex-col items-end gap-1">
      <span className="font-mono text-sm text-apt-text">
        {format(cap.used)} / {format(cap.cap)}
      </span>
      <Progress value={capPercent(cap)} indicatorClassName={capTone(cap)} />
    </div>
  );
}

/** Amber once a cap is close, red once it is spent — the same thresholds a bar elsewhere uses. */
function capTone(cap: UsageCap): string | undefined {
  const pct = capPercent(cap);
  if (pct >= 100) return "bg-apt-red";
  if (pct >= 80) return "bg-apt-orange";
  return undefined;
}

const COLUMNS: DataTableColumn<UsageRow>[] = [
  {
    key: "label",
    header: "Principal",
    width: "16rem",
    render: (row) => (
      <div className="flex min-w-0 items-center gap-2">
        <span className="truncate text-sm text-apt-text" title={row.label}>
          {row.label}
        </span>
        {KIND_LABEL[row.kind] && <Badge>{KIND_LABEL[row.kind]}</Badge>}
      </div>
    ),
  },
  {
    key: "tier",
    header: "Tier",
    width: "7rem",
    render: (row) => (
      <Badge variant={row.limits.enforced ? "accent" : "neutral"}>{row.tier}</Badge>
    ),
  },
  {
    key: "requests",
    header: "Calls",
    align: "end",
    render: (row) => (
      <Quantity row={row} capKey="requests" value={row.requests} format={formatCount} />
    ),
  },
  {
    key: "bytes",
    header: "Data",
    align: "end",
    render: (row) => <Quantity row={row} capKey="bytes" value={row.bytes} format={formatBytes} />,
  },
  {
    key: "tokens",
    header: "Tokens",
    align: "end",
    render: (row) => <Quantity row={row} capKey="tokens" value={row.tokens} format={formatCount} />,
  },
  {
    key: "costMicros",
    header: "Cost",
    align: "end",
    render: (row) => (
      <Quantity row={row} capKey="cost" value={row.costMicros} format={formatCost} />
    ),
  },
];

/**
 * True when some row carries a cap and NOTHING is enforced — the observe-then-enforce rollout,
 * which the page has to say out loud or a bar sitting at 100% reads as a wall that isn't there.
 * A page with no caps at all says nothing.
 */
function observingOnly(rows: UsageRow[]): boolean {
  const capped = rows.filter((r) => capsFor(r).length > 0);
  return capped.length > 0 && capped.every((r) => !r.limits.enforced);
}
