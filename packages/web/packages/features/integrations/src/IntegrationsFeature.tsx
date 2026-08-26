"use client";

import type { ReactNode } from "react";
import { Boxes, Building2, UserCircle, UserRound } from "lucide-react";
import type { Workspace } from "@agentic-toolkit/data";
import { RailHostBoundary, StackLevels, useBasePathRoute } from "@agentic-toolkit/resource";
import type { TopicDetailItem, TopicLevel } from "@agenticdevelopertoolkit/ui/blocks";
import { TopicSelectHint } from "@agenticdevelopertoolkit/ui/blocks";
import { EmptyState } from "@agenticdevelopertoolkit/ui/components/empty-state";
import { ErrorText } from "@agenticdevelopertoolkit/ui/components/error-text";

import { IntegrationsPane } from "./IntegrationsPane";
import { integrationsSegments, type IntegrationsPathSelection } from "./parse-path";
import {
  resolveDestination,
  useIntegrationDestinations,
  type DestinationKind,
  type IntegrationDestination,
} from "./destinations";

/** The row glyph per kind. The workspace splits again on its own kind — an org and a personal
 *  account are different KINDS of destination to the reader, even though they are one row here. */
function destinationIcon(d: IntegrationDestination, workspace: Workspace): ReactNode {
  if (d.kind === "persona") return <UserCircle size={16} aria-hidden />;
  if (d.kind === "product") return <Boxes size={16} aria-hidden />;
  return workspace.kind === "organization" ? (
    <Building2 size={16} aria-hidden />
  ) : (
    <UserRound size={16} aria-hidden />
  );
}

/** What to say when a destination resolved but has no ecosystem behind it. Kind-specific,
 *  because "there is nothing here" is true for all three and useful for none of them. */
function noRealmCopy(kind: DestinationKind): { title: string; description: string } {
  if (kind === "persona") {
    return {
      title: "This persona has no realm yet.",
      description:
        "An integration connects to the ecosystem its destination owns, and this persona doesn't own one yet. It will appear here once it does.",
    };
  }
  if (kind === "workspace") {
    return {
      title: "This workspace has no ecosystem yet.",
      description:
        "Workspace-level integrations connect to the account's own ecosystem, which hasn't been provisioned for this workspace.",
    };
  }
  return {
    title: "This destination has no ecosystem.",
    description: "There is nothing to connect integrations to here.",
  };
}

export interface IntegrationsFeatureProps extends IntegrationsPathSelection {
  /** The feature's URL base (drives the route): the site passes the workspace-scoped `/home`.
   *  Supplied by the host rather than derived, so the same feature mounts under either scheme. */
  basePath: string;
  /**
   * The resolved workspace ROW, not just its slug — this feature is the reason `SiteHomeScope`
   * carries it. The slug scopes the three reads; the KIND decides whether the first destination
   * reads "My Integrations" or "Org Integrations", and re-fetching the workspace list for that
   * one enum would answer later than the render that needs it (the label would flip under the
   * cursor on every mount).
   */
  workspace: Workspace;
}

/**
 * The Integrations feature: which destination you are connecting FROM as the root list, and that
 * destination's provider-config instances as the list below it.
 *
 * The root list is HETEROGENEOUS — the workspace itself, every persona it owns, every product it
 * owns — which is why this is a hand-built level over {@link IntegrationsPane} rather than
 * `EcosystemsFeature` in `listFirst` mode the way Gamification is. Gamification's root list is
 * exactly "the workspace's ecosystems", so that feature IS the ecosystems navigator with other
 * panes; here two of the three kinds are not ecosystems, they merely REACH one, and flattening
 * them into an ecosystem list would lose both the grouping and the "no realm yet" answer.
 *
 * Nesting works because `StackLevels` advances `LevelDepthContext` by the number of levels it
 * publishes: the pane's own `useMasterDetailLevel` therefore registers at depth 1, below the
 * destinations, without either side knowing the other's depth.
 */
export function IntegrationsFeature({
  basePath,
  workspace,
  destinationId,
  configId,
}: IntegrationsFeatureProps) {
  const { pushDeep } = useBasePathRoute(basePath);
  const { destinations, error } = useIntegrationDestinations(workspace);
  const selected = resolveDestination(destinations, destinationId);

  const destinationsLevel: TopicLevel = {
    id: "integrations-destinations",
    title: "Destinations",
    items: (destinations ?? []).map((d, i, all): TopicDetailItem => {
      const next = all[i + 1];
      return {
        id: d.id,
        label: d.label,
        sublabel: d.sublabel,
        icon: destinationIcon(d, workspace),
        // A rule between the three groups, never a trailing one: the divider marks a change of
        // kind, so it belongs to the row BEFORE the change and needs a row after it to separate
        // from. `next === undefined` is the last row, which is why this is not `d.kind !==
        // next?.kind` — that reads true at the end of the list and draws a rule under nothing.
        dividerAfter: next !== undefined && next.kind !== d.kind,
      };
    }),
    selectedId: selected?.id ?? null,
    // Picking a destination discloses its integrations list, so the pane holds through the pick
    // rather than being replaced by a detail.
    leadsTo: "list",
    itemNoun: "destination",
    onSelect: (id) => pushDeep(...integrationsSegments(id)),
    onClear: () => pushDeep(...integrationsSegments(null)),
    // There is no "new destination" here: a destination exists because a workspace, persona or
    // product does. They are created on their own sites.
    emptyLabel:
      destinations === null ? "Loading…" : error ? "Couldn't load destinations." : "No destinations.",
  };

  return (
    <RailHostBoundary>
      <StackLevels levels={[destinationsLevel]}>
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          {/* Reported alongside whatever DID load — one failed read (say, the personas list) must
              not blank the destinations that are fine, nor the pane below them. */}
          <ErrorText error={error} className="px-6 pt-4" />
          <Body
            destinations={destinations}
            selected={selected}
            configId={configId}
            onSelectConfig={(id) =>
              pushDeep(...integrationsSegments(selected?.id ?? null, id))
            }
          />
        </div>
      </StackLevels>
    </RailHostBoundary>
  );
}

/** The region below the destinations list — the pane, or the reason there isn't one. */
function Body({
  destinations,
  selected,
  configId,
  onSelectConfig,
}: {
  destinations: IntegrationDestination[] | null;
  selected: IntegrationDestination | null;
  configId: string | undefined;
  onSelectConfig: (configId: string | null) => void;
}) {
  if (!selected) {
    return (
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto px-6 py-4">
        {destinations === null ? (
          <EmptyState title="Loading…" />
        ) : (
          <TopicSelectHint title="Select a destination to manage its integrations." />
        )}
      </div>
    );
  }

  // The tri-state (see IntegrationDestination.ecosystemId): only `undefined` is "still asking".
  // Mounting the pane without an id would make it report "No integrations yet." — an answer, and
  // the wrong one, for a destination whose ecosystem simply hasn't resolved or doesn't exist.
  if (selected.ecosystemId === undefined) {
    return (
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto px-6 py-4">
        <EmptyState title="Loading…" />
      </div>
    );
  }
  if (selected.ecosystemId === null) {
    const copy = noRealmCopy(selected.kind);
    return (
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto px-6 py-4">
        <EmptyState title={copy.title} description={copy.description} />
      </div>
    );
  }

  return (
    <IntegrationsPane
      // Keyed on the DESTINATION, not the ecosystem id: two destinations can only ever resolve to
      // the same ecosystem by accident, and remounting is what discards the previous destination's
      // loaded configs, by-id fallback and open draft rather than letting them flash under the new
      // one while its own fetch is in flight.
      key={selected.id}
      ecosystemId={selected.ecosystemId}
      leaf={{ leafId: configId ?? null, onSelect: onSelectConfig }}
    />
  );
}
