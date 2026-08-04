"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { Layers, Globe } from "lucide-react";
import { reportUnexpectedAuthError } from "@agentic-toolkit/auth";

import type { SiteGroupView, SiteView } from "@agentic-toolkit/data/monitored-sites";
import { listGroups, listSites } from "@agentic-toolkit/data/monitored-sites";
import { ErrorText } from "@agentic-toolkit/ui/components/error-text";
import {
  RailHostBoundary,
  StackGroupDetail,
  useBasePathRoute,
  type TopicLeaf,
} from "@agentic-toolkit/resource";
import { GroupsSection } from "./GroupsSection";
import { SitesSection } from "./SitesSection";

/**
 * The Dashboards (Site Monitoring) feature, dismantled into the one merged stack: a Groups / Sites
 * rail level (via {@link StackGroupDetail}) whose chosen section publishes its OWN master/detail
 * list as a deeper level, with the editor as the leaf. Nothing auto-selects — picking Groups or
 * Sites, then a row, is explicit. Groups and sites share one source of truth so a group
 * rename/delete reflects immediately in site membership.
 *
 * DUAL SELECTION MODE: pass `basePath` and both levels are URL-driven + deep-linkable (like
 * ecosystems) — the host route (the hub's `/<slug>/dashboards/[[...topic]]`, or a feature site's
 * `/home`) supplies it plus the open `section` ("groups" | "sites") and `rowId`, parsed by
 * {@link parseDashboardsPath}; the section pushes through the L1 group's `urlSelection` and the
 * row through each member's `leaf`, both via {@link useBasePathRoute}. Omit it (the embedded
 * ecosystem Dashboards topic / the /home launcher via renderFeaturePanel) and both selections stay
 * internal, so picking a section/row happens in place without navigating the surface away.
 */
export function DashboardsFeature({
  basePath,
  section,
  rowId,
  reservedSlugs,
  workspaceSlug,
  renderTransferOwnership,
}: {
  /** The feature's URL base (drives the routes): the hub route passes `/<slug>/dashboards`.
   *  Supplied by the host rather than derived here, so the same feature mounts under either
   *  scheme. Omit for the EMBEDDED mode — selection stays internal, in place. */
  basePath?: string;
  /** The open section (first path segment: "groups" | "sites"), or undefined for nothing selected. */
  section?: string;
  /** The selected group/site row id (second path segment), or undefined for none. */
  rowId?: string;
  /** The HOST's reserved slug words, as an ARRAY rather than a Set: a Set cannot cross the RSC
   *  boundary, and a host may render this feature straight from a server route page (the
   *  dashboards site's `/home` does). The Set the validators consume is built below, from this.
   *  The pre-extraction hub bound its list implicitly via its validateSlug wrapper. */
  reservedSlugs?: readonly string[];
  /** Pins every op to the WORKSPACE'S owning principal (backend `?workspace=`), so an org
   *  workspace shows the ORG'S monitored sites and creates org-owned ones. Omitted: the
   *  caller's own. */
  workspaceSlug?: string;
  /** Host-injected Transfer Ownership section for the open GROUP, forwarded to
   *  {@link GroupsSection} (see its own prop for why the group and not a site). Omit it and no
   *  section renders — the host, not this feature, owns the workspace list and the mutation. */
  renderTransferOwnership?: (group: { id: string; name: string }) => ReactNode;
}) {
  // The hook stays unconditional (rules of hooks); its pushes are only reachable when
  // basePath is set — the embedded mode below never builds URL-driven selections.
  const { pushSegment, pushNested } = useBasePathRoute(basePath ?? "");
  // Set once per identity; the sections take the Set the validators consume.
  const reserved = useMemo(
    () => (reservedSlugs ? new Set(reservedSlugs) : undefined),
    [reservedSlugs],
  );
  const [groups, setGroups] = useState<SiteGroupView[] | null>(null);
  const [sites, setSites] = useState<SiteView[] | null>(null);
  // One error slot PER loader: the two loads run concurrently, so a shared slot let one
  // loader's success wipe the other's failure — leaving that section's list on a permanent
  // unexplained "Loading…" (its items stay null) with no message.
  const [groupsError, setGroupsError] = useState<string | null>(null);
  const [sitesError, setSitesError] = useState<string | null>(null);

  const refreshGroups = useCallback(async () => {
    try {
      setGroups(await listGroups({ workspace: workspaceSlug }));
      setGroupsError(null);
    } catch (err) {
      reportUnexpectedAuthError(err, { feature: "site-monitoring", step: "load" });
      setGroupsError(err instanceof Error ? err.message : "Failed to load groups.");
    }
  }, [workspaceSlug]);

  const refreshSites = useCallback(async () => {
    try {
      setSites(await listSites({ workspace: workspaceSlug }));
      setSitesError(null);
    } catch (err) {
      reportUnexpectedAuthError(err, { feature: "site-monitoring", step: "load" });
      setSitesError(err instanceof Error ? err.message : "Failed to load sites.");
    }
  }, [workspaceSlug]);

  useEffect(() => {
    void refreshGroups();
    void refreshSites();
  }, [refreshGroups, refreshSites]);

  // The deep-linkable row leaf (the specific group/site), scoped to the active section. Only the
  // active member renders, so a single leaf serves whichever of Groups/Sites is showing. The row is
  // scoped to the current section (from the URL); null clears the row segment.
  const leaf: TopicLeaf | undefined = basePath
    ? {
        leafId: rowId ?? null,
        onSelect: (id) => pushNested(section, id),
      }
    : undefined;

  // RailHostBoundary: the Groups/Sites rail + each section's master/detail list exist only
  // as rail-host publications; on a bare feature site (no hub shell) the boundary self-hosts.
  return (
    <RailHostBoundary>
      {(groupsError ?? sitesError) && (
        <ErrorText error={groupsError ?? sitesError} className="px-6 pt-4" />
      )}
      <StackGroupDetail
        levelId="dashboards-sections"
        title="Dashboards"
        emptyHint="Select Groups or Sites."
        urlSelection={
          basePath ? { selectedId: section ?? null, onSelect: pushSegment } : undefined
        }
        items={[
          {
            id: "groups",
            label: "Groups",
            icon: <Layers size={16} aria-hidden />,
            render: () => (
              <GroupsSection
                groups={groups}
                leaf={leaf}
                reservedSlugs={reserved}
                workspaceSlug={workspaceSlug}
                renderTransferOwnership={renderTransferOwnership}
                onChanged={async () => {
                  await refreshGroups();
                  // A deleted group is stripped from site membership, so refresh sites too to keep
                  // their group checkboxes accurate.
                  await refreshSites();
                }}
              />
            ),
          },
          {
            id: "sites",
            label: "Sites",
            icon: <Globe size={16} aria-hidden />,
            render: () => (
              <SitesSection
                sites={sites}
                groups={groups ?? []}
                leaf={leaf}
                reservedSlugs={reserved}
                workspaceSlug={workspaceSlug}
                onChanged={refreshSites}
              />
            ),
          },
        ]}
      />
    </RailHostBoundary>
  );
}
