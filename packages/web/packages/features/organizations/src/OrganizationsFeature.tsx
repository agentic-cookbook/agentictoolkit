"use client";

import { useCallback, useMemo } from "react";
import type { ReactElement } from "react";
import { Building2, BookUser, Settings, SlidersHorizontal, UsersRound } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { ResourceExplorer, type ResourceTopic } from "@agentic-toolkit/resource";
import { workspacesApi, WORKSPACES_QUERY_KEY, type Workspace } from "@agentic-toolkit/data";
import { ConfigurationGroup, CONFIGURATION_DESCRIPTION } from "@agentic-toolkit/ecosystem-config";
import { TeamsFeature } from "@agentic-toolkit/teams";
import { parseTeamsPath } from "@agentic-toolkit/teams/parse";
import { MembersPanel } from "./MembersPanel";
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
   * The host's help-store lookup, keyed by ROUTE — passed straight down to the Configuration
   * group, which owns the keys. Threaded rather than imported because the sentences live in adh's
   * vocabulary tier, which a portable package may not reach (see ConfigurationGroup's own note).
   */
  helpFor?: (key: string) => string | undefined;
}

/**
 * The Organizations feature: the caller's organizations as the root list, and each org's
 * Configuration / Members / Teams / Settings beside it.
 *
 * The list comes from `workspacesApi.list()` filtered to organizations, not from an organizations
 * endpoint — there ISN'T one. `/organization/organizations` resolves an org by key and creates
 * them; "which orgs am I in" is a membership question, and `/workspaces` is where the backend
 * answers it. (See `@agentic-toolkit/data/organizations`.)
 *
 * The topics deliberately match the hub's org rail rather than inventing a second vocabulary for
 * the same four things — an org is one entity with one set of knobs, and a user who learns it in
 * one place should not have to relearn it in the other.
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

  const reload = useCallback(async () => {
    await orgsQuery.refetch();
  }, [orgsQuery]);

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
    {
      id: "configuration",
      label: "Configuration",
      icon: <SlidersHorizontal size={16} aria-hidden />,
      description: CONFIGURATION_DESCRIPTION,
      // The group publishes its own list of rows beside this one.
      leadsTo: "list",
      render: (scopedId, _titleFor, leaf, subLeafFor) => (
        <ConfigurationGroup
          workspaceSlug={scopedId}
          leaf={leaf}
          subLeafFor={subLeafFor}
          helpFor={helpFor}
        />
      ),
    },
    {
      id: "members",
      label: "Members",
      icon: <BookUser size={16} aria-hidden />,
      description: "Everyone in this organization, across its teams.",
      leadsTo: "detail",
      render: (scopedId) => (
        <MembersPanel workspaceSlug={scopedId} workspaceType="organization" />
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
      // than a single leaf id (see parse-path). `leaf`/`subLeafFor` are ignored here on purpose:
      // they only reach two segments deep, and Teams needs four.
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
      // ResourceExplorer's own 4th/5th segments. Topics that route themselves (Teams) read
      // `topicPath` instead; these keep the stack's breadcrumb and leaf selection honest for the
      // topics that don't.
      activeLeafId={topicPath[0]}
      activeMemberEntityId={topicPath[1]}
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
        help: "The organizations you belong to. Pick one to manage its configuration, people, teams and record — or create a new one.",
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
