"use client";

import type { ReactElement, ReactNode } from "react";
import { Table2, KeyRound, Database } from "lucide-react";
import { AccessPane } from "@agentic-toolkit/authentication";
import {
  StackGroupDetail,
  WorkspaceNotManageable,
  WorkspaceResolutionError,
  type GroupTopicItem,
} from "@agentic-toolkit/resource";
import { helpFor } from "@agentic-toolkit/adh/help/store";
import { SchemasPane } from "../schemas/SchemasPane";
import { ecosystemUsersApi } from "../api/customers";
import { applicationsPrototypeApi } from "../api/applications-prototype";
import { AllDataPane } from "./AllDataPane";
import { STORAGE_MEMBER_IDS, type StorageMemberId } from "./parse-path";
import type { RenderTransferSection } from "../transfer-seam";

/**
 * How far the caller got resolving the ecosystem this group is scoped to.
 *
 * Injected rather than resolved here because the two hosts resolve it from different places —
 * the hub from its workspace context, a feature site from the workspace its shell already
 * resolved — while the GATE below (what each outcome shows) must be one decision, not two.
 */
export interface EcosystemScopeResolution {
  /** Undefined while loading AND when the workspace has no infrastructure ecosystem: the panes
   *  accept undefined and degrade gracefully, so this is not an error state. */
  ecosystemId?: string;
  /** False only when the resolution definitively says the caller may VIEW this workspace but not
   *  MANAGE its infrastructure ecosystem (a plain org member). */
  canManage: boolean;
  isError: boolean;
}

/**
 * The Storage group — Buckets / Access / All Data — as a nested topic▸detail rail.
 *
 * The SAME three members appear in two places, which is why they live here rather than in either
 * host: promoted to a workspace's own rail (scoped to its default ecosystem) and inside a product
 * (scoped to that product's ecosystem, where EcosystemsFeature renders the group itself). A copy
 * per host is three copies of one rail, and nothing makes them agree.
 *
 * The group opens UNSELECTED — selecting an item never auto-selects a topic (StackGroupDetail's
 * own rule).
 */
export function StorageGroup({
  scope,
  urlSelection,
  renderSubLeaf,
  renderTransfer,
  renderAllData,
}: {
  scope: EcosystemScopeResolution;
  /** Omit for internal selection (an embedded launcher) — StackGroupDetail's fallback. */
  urlSelection?: { selectedId: string | null; onSelect: (id: string | null) => void };
  renderSubLeaf?: (memberId: string) => { leafId: string | null; onSelect: (id: string | null) => void };
  /** Transfer Ownership for an open bucket — see {@link RenderTransferSection}. Omitted ⇒ no
   *  transfer section, which is the honest result for a host that cannot name the destinations. */
  renderTransfer?: RenderTransferSection;
  /** The All Data member. Defaults to the package's own local-selection browser; a host with rail
   *  chrome of its own passes a variant that publishes into its stack. */
  renderAllData?: () => ReactNode;
}): ReactElement {
  const { ecosystemId, canManage, isError } = scope;
  if (isError) return <WorkspaceResolutionError />;
  // A plain org member can view the workspace but not manage its infrastructure ecosystem — its
  // reads/writes would 403 per-pane, so show the honest notice instead.
  if (ecosystemId && !canManage) return <WorkspaceNotManageable feature="Storage" />;
  // Keyed by member id and then mapped over STORAGE_MEMBER_IDS, so the record is TOTAL over the
  // grammar's list and the rail's order comes from it — that list stays the one description of
  // what this group is, for the panes here and for the parse a host validates a URL against.
  const panes: Record<StorageMemberId, Omit<GroupTopicItem, "id">> = {
    buckets: {
      label: "Buckets",
      icon: <Table2 size={16} aria-hidden />,
      render: (subLeaf) => (
        <SchemasPane
          ecosystemId={ecosystemId}
          help={helpFor("ecosystems/schemas")}
          leaf={subLeaf}
          renderTransfer={renderTransfer}
        />
      ),
    },
    access: {
      label: "Access",
      icon: <KeyRound size={16} aria-hidden />,
      render: (subLeaf) => (
        <AccessPane
          ecosystemId={ecosystemId}
          help={helpFor("ecosystems/access")}
          leaf={subLeaf}
          usersDirectory={ecosystemUsersApi.list}
          applicationsDirectory={applicationsPrototypeApi.list}
        />
      ),
    },
    "all-data": {
      label: "All Data",
      icon: <Database size={16} aria-hidden />,
      render: () => renderAllData?.() ?? <AllDataPane />,
    },
  };
  const items: GroupTopicItem[] = STORAGE_MEMBER_IDS.map((id) => ({ id, ...panes[id] }));
  return (
    <StackGroupDetail
      levelId="storage-group"
      title="Storage"
      items={items}
      urlSelection={urlSelection}
      renderSubLeaf={renderSubLeaf}
    />
  );
}
