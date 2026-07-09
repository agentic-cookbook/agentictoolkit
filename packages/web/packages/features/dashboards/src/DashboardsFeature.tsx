"use client";

import { useCallback, useEffect, useState } from "react";
import { Layers, Globe } from "lucide-react";
import { reportUnexpectedAuthError } from "@agentic-toolkit/auth";

import type { SiteGroupView, SiteView } from "@agentic-toolkit/data/monitored-sites";
import { listGroups, listSites } from "@agentic-toolkit/data/monitored-sites";
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
}: {
  /** The feature's URL base (drives the routes): the hub route passes `/<slug>/dashboards`.
   *  Supplied by the host rather than derived here, so the same feature mounts under either
   *  scheme. Omit for the EMBEDDED mode — selection stays internal, in place. */
  basePath?: string;
  /** The open section (first path segment: "groups" | "sites"), or undefined for nothing selected. */
  section?: string;
  /** The selected group/site row id (second path segment), or undefined for none. */
  rowId?: string;
}) {
  // The hook stays unconditional (rules of hooks); its pushes are only reachable when
  // basePath is set — the embedded mode below never builds URL-driven selections.
  const { pushSegment, pushNested } = useBasePathRoute(basePath ?? "");
  const [groups, setGroups] = useState<SiteGroupView[] | null>(null);
  const [sites, setSites] = useState<SiteView[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const refreshGroups = useCallback(async () => {
    try {
      setGroups(await listGroups());
      setLoadError(null);
    } catch (err) {
      reportUnexpectedAuthError(err, { feature: "site-monitoring", step: "load" });
      setLoadError(err instanceof Error ? err.message : "Failed to load groups.");
    }
  }, []);

  const refreshSites = useCallback(async () => {
    try {
      setSites(await listSites());
      setLoadError(null);
    } catch (err) {
      reportUnexpectedAuthError(err, { feature: "site-monitoring", step: "load" });
      setLoadError(err instanceof Error ? err.message : "Failed to load sites.");
    }
  }, []);

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
      {loadError && <p className="px-6 pt-4 text-sm text-apt-red">{loadError}</p>}
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
              <SitesSection sites={sites} groups={groups ?? []} leaf={leaf} onChanged={refreshSites} />
            ),
          },
        ]}
      />
    </RailHostBoundary>
  );
}
