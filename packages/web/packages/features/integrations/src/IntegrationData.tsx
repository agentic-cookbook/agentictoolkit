"use client";

import { Table2 } from "lucide-react";
import { CrudDataView, CRUD_TABLES, useExitGuardChannel } from "@agentic-toolkit/crud";
import { StackGroupDetail } from "@agentic-toolkit/resource";
import { useRailExitGuard as useWorkspaceExitGuard } from "@agentic-toolkit/resource";

/**
 * The synced-data tables each provider's WORKER writes, in display order — drives the
 * integration detail's Data topic. Keys are CRUD_TABLES keys ('<schema>/<table>');
 * `filterColumn` is the table's provider-discriminator column (`sourceProvider` on the
 * shared social tables, `source` on calendar_events), filtered to the providerId.
 * gmail is deliberately absent: integration_email_messages is excluded from generic
 * CRUD (private mail bodies), so it has no browsable meta.
 */
const PROVIDER_DATA_TABLES: Record<
  string,
  Array<{ key: string; label: string; filterColumn: string }>
> = {
  reddit: [
    { key: "integration/integration-social-notifications", label: "Inbox", filterColumn: "sourceProvider" },
    { key: "integration/integration-bookmarks", label: "Posts", filterColumn: "sourceProvider" },
  ],
  "google-calendar": [
    { key: "integration/integration-calendar-events", label: "Events", filterColumn: "source" },
  ],
  mailchimp: [
    { key: "integration/integration-audiences", label: "Audiences", filterColumn: "provider" },
    { key: "integration/integration-audience-contacts", label: "Contacts", filterColumn: "provider" },
    { key: "integration/integration-campaign-stats", label: "Campaigns", filterColumn: "provider" },
  ],
  klaviyo: [
    { key: "integration/integration-audiences", label: "Lists", filterColumn: "provider" },
    { key: "integration/integration-audience-contacts", label: "Profiles", filterColumn: "provider" },
    { key: "integration/integration-campaign-stats", label: "Campaigns", filterColumn: "provider" },
  ],
};

/** The provider's browsable synced tables (only those present in CRUD_TABLES, so a
 *  stale key can never render a broken view). Empty ⇒ the caller shows no Data topic. */
export function providerDataTables(providerId: string) {
  return (PROVIDER_DATA_TABLES[providerId] ?? []).filter((t) => t.key in CRUD_TABLES);
}

/** The Data topic's pane: one CrudDataView per synced table, filtered to this
 *  provider's rows and SCOPED to the ecosystem the pane is configuring (the caller's
 *  JWT ecosystem is never that one — see CrudDataView.scopeEcosystemId). A single
 *  table renders directly; several publish one more rail. Staged edits register an
 *  unsaved-work guard so a topic/provider switch prompts Save/Discard/Cancel instead
 *  of silently dropping them. */
export function IntegrationData({
  providerId,
  ecosystemId,
}: {
  providerId: string;
  /** The ecosystem whose synced rows this Data topic browses (the pane's viewed
   *  ecosystem). Absent → the caller's own JWT ecosystem (backend default). */
  ecosystemId?: string;
}) {
  // Bridges the mounted CrudDataView's live guard into one stable proxy, registered
  // with the workspace chrome so ANY gated navigation (topic switch, provider switch,
  // breadcrumb) consults it. Only the active table's view is mounted at a time, so
  // the single channel always reflects the visible editor.
  const { exitGuard, registerGuard } = useExitGuardChannel();
  useWorkspaceExitGuard(exitGuard);
  const tables = providerDataTables(providerId);
  if (tables.length === 0) return null;
  if (tables.length === 1) {
    // `tables[0]` under noUncheckedIndexedAccess is `… | undefined`, and CRUD_TABLES
    // is indexed by string — but providerDataTables already filtered to keys present
    // in CRUD_TABLES, and length===1 guarantees the element, so both are non-null here.
    const t = tables[0]!;
    return (
      <div className="flex min-h-0 min-w-0 flex-1 flex-col px-6 py-4">
        <CrudDataView
          meta={CRUD_TABLES[t.key]!}
          filter={{ [t.filterColumn]: providerId }}
          scopeEcosystemId={ecosystemId}
          onGuardChange={registerGuard}
        />
      </div>
    );
  }
  return (
    <StackGroupDetail
      levelId={`integration-data-${providerId}`}
      title="Data"
      items={tables.map((t) => ({
        id: t.key,
        label: t.label,
        icon: <Table2 className="h-4 w-4" />,
        render: () => (
          <div className="flex min-h-0 min-w-0 flex-1 flex-col px-6 py-4">
            {/* key is present in CRUD_TABLES (providerDataTables filtered to that), so
                the indexed access is non-null despite noUncheckedIndexedAccess. */}
            <CrudDataView
              meta={CRUD_TABLES[t.key]!}
              filter={{ [t.filterColumn]: providerId }}
              scopeEcosystemId={ecosystemId}
              onGuardChange={registerGuard}
            />
          </div>
        ),
      }))}
    />
  );
}
