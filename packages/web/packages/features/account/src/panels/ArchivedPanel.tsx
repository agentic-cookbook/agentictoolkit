"use client";

import { useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Badge } from "@agentic-toolkit/ui/components/badge";
import { Button } from "@agentic-toolkit/ui/components/button";
import { DataTable, type DataTableColumn } from "@agentic-toolkit/ui/components/data-table";
import { EmptyState } from "@agentic-toolkit/ui/components/empty-state";
import { ErrorText } from "@agentic-toolkit/crud";

import {
  useArchivedWorkspaces,
  ARCHIVED_WORKSPACES_QUERY_KEY,
  type ArchivedWorkspace,
} from "../api/archived-workspaces";
import { WORKSPACES_QUERY_KEY } from "../api/workspaces";
import { organizationsApi } from "../api/organizations";
import { ORGANIZATIONS_QUERY_KEY } from "@agentic-toolkit/data/organizations";
import { errMsg } from "@agentic-toolkit/data";

/**
 * Archived — the things the caller has archived, and the one place they can be brought back.
 *
 * Today that is organizations only; personas and projects become archivable in their own slices
 * and will join this list.
 *
 * It lives in PERSONAL settings rather than the org's own settings for a structural reason: an
 * archived org is invisible from inside itself (its workspace no longer resolves), so the
 * archiving user's personal settings is the only surface that can still list it.
 */
export function ArchivedPanel() {
  const qc = useQueryClient();
  const query = useArchivedWorkspaces();
  // A Set, not a single id: restoring row B while row A is still in flight must not un-disable
  // A or drop its "Restoring…" label.
  const [busyIds, setBusyIds] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  async function restore(row: ArchivedWorkspace): Promise<void> {
    setBusyIds((prev) => new Set(prev).add(row.id));
    setError(null);
    try {
      // Restore is keyed by id, which the list carries. There is deliberately no slug lookup
      // here: GET /organization/organizations/{key} cannot see an archived org.
      await organizationsApi.restore(row.id);
      // All three invalidations together, not awaited one after another: sequential, each
      // refetch only STARTS once the previous has come back, so between them the row is gone
      // from Archived while the workspace picker still doesn't have it — and if the archived
      // refetch rejects (it is the one whose list just shrank), the others are never
      // invalidated at all and the restored org stays missing until a reload.
      //
      // The third key is the orgs rail. Unlike the hub's create flow — a different Next app, a
      // different QueryClient — this panel is mounted by the settings registry INSIDE every
      // site, the orgs site included, so on that site the rail's `["organizations", <slug>]`
      // entry is in this very cache and a restored org is a row that belongs back in it. The
      // prefix invalidates every workspace's copy, which is right: the restored org may be
      // owned by any of them. On the other sites there is no such entry and this costs nothing.
      await Promise.all([
        qc.invalidateQueries({ queryKey: ARCHIVED_WORKSPACES_QUERY_KEY }),
        qc.invalidateQueries({ queryKey: WORKSPACES_QUERY_KEY }),
        qc.invalidateQueries({ queryKey: ORGANIZATIONS_QUERY_KEY }),
      ]);
    } catch (e) {
      setError(errMsg(e, "Couldn't restore that organization."));
    } finally {
      setBusyIds((prev) => {
        const next = new Set(prev);
        next.delete(row.id);
        return next;
      });
    }
  }

  const columns: DataTableColumn<ArchivedWorkspace>[] = [
    {
      key: "name",
      header: "Name",
      render: (r) => (
        <span className="inline-flex items-center gap-2">
          {r.name}
          {/* Visible, in the a11y tree, and next to the fact it's about (the caller's own
              permission on this org) — a `title` on the disabled Restore button reaches neither
              screen readers nor touch. */}
          {!r.canRestore && <Badge variant="orange">Admins only</Badge>}
        </span>
      ),
    },
    {
      key: "handle",
      header: "Handle",
      render: (r) => (
        <span className="inline-flex items-center gap-2">
          <span className="font-mono">org.{r.slug}</span>
          {/* Visible, in the a11y tree, and next to the handle it is about — a `title` on the
              disabled Restore button reaches neither screen readers nor touch. */}
          {!r.handleAvailable && <Badge variant="orange">Handle taken</Badge>}
        </span>
      ),
    },
    // `archivedAt` is a DB timestamp read back as Postgres text (`YYYY-MM-DD HH:MM:SS.ssssss`),
    // not RFC3339 — hence the slice rather than `new Date(...)`, which parses it inconsistently
    // across browsers.
    {
      key: "archivedAt",
      header: "Archived",
      render: (r) => r.archivedAt.slice(0, 10),
    },
    {
      key: "actions",
      header: <span className="sr-only">Actions</span>,
      align: "end",
      resizable: false,
      render: (r) => (
        <Button
          size="sm"
          variant="ghost"
          disabled={!r.handleAvailable || !r.canRestore || busyIds.has(r.id)}
          aria-label={`Restore ${r.name}`}
          onClick={() => void restore(r)}
        >
          {busyIds.has(r.id) ? "Restoring…" : "Restore"}
        </Button>
      ),
    },
  ];

  if (query.isError) {
    return (
      <Shell>
        <EmptyState
          title="Couldn't load your archived items"
          description="Reload the page to retry."
        />
      </Shell>
    );
  }

  if (query.isPending) {
    return (
      <Shell>
        <DataTable<ArchivedWorkspace>
          columns={columns}
          rows={[]}
          getRowId={(r) => r.id}
          loading
          ariaLabel="Archived"
          autoSizeColumns
        />
      </Shell>
    );
  }

  if (query.data.length === 0) {
    return (
      <Shell>
        <EmptyState
          title="Nothing archived"
          description="Organizations you archive appear here, and can be restored while their handle is still free."
        />
      </Shell>
    );
  }

  return (
    <Shell>
      <ErrorText error={error} />
      <DataTable<ArchivedWorkspace>
        columns={columns}
        rows={query.data}
        getRowId={(r) => r.id}
        ariaLabel="Archived"
        autoSizeColumns
      />
    </Shell>
  );
}

/** The panel's scroll container — the same wrapper `UsagePanel` uses. */
function Shell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-0 flex-1 overflow-y-auto px-6 py-6">
      <div className="max-w-5xl">{children}</div>
    </div>
  );
}
