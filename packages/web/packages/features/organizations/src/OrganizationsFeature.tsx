"use client";

import { useCallback, useMemo } from "react";
import type { ReactElement } from "react";
import { Building2, KeyRound, Server, Settings, UsersRound } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { ResourceExplorer, type ResourceTopic } from "@agentic-toolkit/resource";
import { workspacesApi, WORKSPACES_QUERY_KEY, type Workspace } from "@agentic-toolkit/data";
import {
  EcosystemConfigGate,
  ServerBagsPane,
  StorageTokensPanel,
} from "@agentic-toolkit/ecosystem-config";
import { TeamsFeature } from "@agentic-toolkit/teams";
import { parseTeamsPath } from "@agentic-toolkit/teams/parse";
import {
  OrgSettingsGroup,
  ORG_SETTINGS_DESCRIPTION,
  type OrgSettingsHrefs,
} from "./OrgSettingsPane";
import { NewOrganizationModal } from "./NewOrganizationModal";
import type { OrganizationsPathSelection } from "./parse-path";

export interface OrganizationsFeatureProps extends OrganizationsPathSelection {
  /** The feature's URL base. The organizations site mounts it at the workspace root (""). */
  basePath: string;
  /**
   * The host's help-store lookup, keyed by ROUTE — the keys are spelled at the topic that reads
   * one. Threaded rather than imported because the sentences live in adh's vocabulary tier, which
   * a portable package may not reach (see `@agentic-toolkit/adh/help/store`).
   */
  helpFor?: (key: string) => string | undefined;
}

/**
 * The Organizations feature: the caller's organizations as the root list, and each org's
 * Server bags / Tokens / Teams / Settings beside it.
 *
 * The list comes from `workspacesApi.list()` filtered to organizations, not from an organizations
 * endpoint — there ISN'T one. `/organization/organizations` resolves an org by key and creates
 * them; "which orgs am I in" is a membership question, and `/workspaces` is where the backend
 * answers it. (See `@agentic-toolkit/data/organizations`.)
 *
 * The topics deliberately reuse the hub's own words rather than inventing a second vocabulary for
 * the same things — an org is one entity with one set of knobs, and a user who learns it in one
 * place should not have to relearn it in the other.
 *
 * They are the org's OWN knobs and nothing else. Auth, Billing, Feature flags and Sign-in apps are
 * configured per PRODUCT — they say how one product's customers sign in, what it charges and what
 * it has switched on — so they live on the product rail (`@agentic-toolkit/adh-products`), not
 * here; an org that showed them would be claiming to own settings that belong to each product
 * under it. Membership is not a topic either: who is in the org is answered by its Teams, which
 * group its people and the permissions they share. (`MembersPanel` stays exported — the hub still
 * mounts it on its workspace rail.)
 */
export function OrganizationsFeature({
  basePath,
  helpFor,
  all,
  activeOrgSlug,
  activeTopic,
  topicPath,
}: OrganizationsFeatureProps): ReactElement {
  const orgsQuery = useQuery({
    // The SHARED key, not a private one: this is the same `GET /workspaces` the header's
    // switcher reads, and a rename or a create in here has to make that copy stale too. Two keys
    // over one endpoint would leave whichever host didn't do the save showing the old name.
    queryKey: WORKSPACES_QUERY_KEY,
    queryFn: () => workspacesApi.list(),
  });
  // `null` (not `[]`) while loading: ResourceExplorer reads an empty array as a LOADED empty list
  // and falls back to the "All" landing, so a slug in the URL would look deleted for one frame.
  const organizations: Workspace[] | null = orgsQuery.data
    ? orgsQuery.data.filter((w) => w.kind === "organization")
    : null;

  // Keyed on `refetch`, not on the query object: react-query hands back a NEW result object every
  // render, so depending on it would rebuild this callback every render while looking stable —
  // and every memo'd child and effect downstream would re-run with it. `refetch` is stable.
  const reload = useCallback(async () => {
    await orgsQuery.refetch();
  }, [orgsQuery.refetch]);

  // Where a rename or an archive lands the browser, expressed in THIS host's URL space. Both are
  // full reloads rather than router pushes: a rename moves the org's segment out from under the
  // component doing the navigating, and an archive removes the row the whole stack is addressed by.
  const settingsHrefs: OrgSettingsHrefs = useMemo(
    () => ({
      renamed: (newSlug: string) => `${basePath}/${newSlug}/settings`,
      // The list landing — the one URL here that stays valid once this org is gone.
      archived: `${basePath}/all`,
    }),
    [basePath],
  );

  const topics: ResourceTopic[] = [
    // The two ecosystem-scoped topics, lifted out of the Configuration group that used to hold
    // them as rows. Both are FLAT — one pane, nothing below them — so once the other four rows
    // left as product settings (see above), the group was a disclosure level over two leaves.
    //
    // Each goes through the gate itself rather than this component resolving the ecosystem once
    // above the rail: only the chosen topic is ever mounted, so a resolution up here would also
    // run for Teams and Settings, which have no ecosystem in them.
    {
      id: "server-bags",
      label: "Server bags",
      icon: <Server size={16} aria-hidden />,
      description: "Arbitrary key → JSON config values, read at runtime by what the organization runs.",
      leadsTo: "detail",
      render: (scopedId) => (
        <EcosystemConfigGate workspaceSlug={scopedId} feature="Server bags">
          {(ecosystemId) => (
            <ServerBagsPane ecosystemId={ecosystemId} help={helpFor?.("ecosystems/server-bags")} />
          )}
        </EcosystemConfigGate>
      ),
    },
    {
      id: "tokens",
      label: "Tokens",
      icon: <KeyRound size={16} aria-hidden />,
      description: "Storage-access tokens, each with its own isolated bucket. Mint, list and revoke them here.",
      leadsTo: "detail",
      // `workspace` is what makes these the ORG'S tokens rather than the signed-in user's: it pins
      // every list/mint/revoke to the workspace's owning principal (see StorageTokensPanel).
      render: (scopedId) => (
        <EcosystemConfigGate workspaceSlug={scopedId} feature="Tokens">
          {(ecosystemId) => <StorageTokensPanel ecosystemId={ecosystemId} workspace={scopedId} />}
        </EcosystemConfigGate>
      ),
    },
    {
      id: "teams",
      label: "Teams",
      icon: <UsersRound size={16} aria-hidden />,
      description: "Teams group people and the permissions they share. Pick a team to manage it.",
      leadsTo: "list",
      // Teams is a whole nested FEATURE, not a pane: it owns a four-segment grammar of its own
      // below this topic. So it gets the raw `topicPath` and re-parses it, and routes off its own
      // `basePath` — which is why the org grammar hands topics their remaining segments rather
      // than a single leaf id (see parse-path). `leaf` is ignored here on purpose: it reaches one
      // segment deep, and Teams needs four.
      render: (scopedId) => (
        <TeamsFeature
          basePath={`${basePath}/${scopedId}/teams`}
          workspaceSlug={scopedId}
          {...parseTeamsPath(topicPath)}
        />
      ),
    },
    {
      id: "settings",
      label: "Settings",
      icon: <Settings size={16} aria-hidden />,
      description: ORG_SETTINGS_DESCRIPTION,
      // Four rows of its own (Profile / Social links / Addresses / Usage), so it publishes a list.
      leadsTo: "list",
      render: (scopedId, _titleFor, leaf) => (
        <OrgSettingsGroup slug={scopedId} hrefs={settingsHrefs} leaf={leaf} />
      ),
    },
  ];

  return (
    <ResourceExplorer<Workspace>
      basePath={basePath}
      all={all}
      activeId={activeOrgSlug}
      activeTopic={activeTopic}
      // ResourceExplorer's own 4th segment — Settings' open row. Topics that route themselves
      // (Teams) read `topicPath` instead, and the two flat panes have nothing below them; this
      // keeps the stack's breadcrumb and leaf selection honest for the one that does.
      // `activeMemberEntityId` (the 5th) is deliberately not passed: it only fed a GROUPING
      // topic's inner entity, and this rail no longer has one.
      activeLeafId={topicPath[0]}
      items={organizations}
      // The SLUG is the id: it is what identifies an org everywhere on the platform, what
      // `?workspace=` takes, and what every one of these topics scopes by. There is no separate
      // org id in a URL.
      getId={(w) => w.slug}
      getLabel={(w) => w.name}
      itemIcon={<Building2 size={16} aria-hidden />}
      nameSuffix="Organization"
      topics={topics}
      landing={{
        title: "Organizations",
        help: "The organizations you belong to. Pick one to manage its config values, tokens, teams and record — or create a new one.",
        emptyLabel: "You aren't in any organizations yet.",
        getSublabel: (w) => w.slug,
        renderMeta: () => null,
      }}
      newLabel="New Organization"
      // `open` is a constant here because ResourceExplorer MOUNTS the dialog only while it is
      // open; the modal keeps the prop because the hub's workspace bar renders it persistently.
      renderDialog={(onClose, onCreated) => (
        <NewOrganizationModal open onClose={onClose} onCreated={onCreated} />
      )}
      reload={reload}
    />
  );
}
