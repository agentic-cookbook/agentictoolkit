"use client";

import { useCallback, useEffect, useState, type ReactElement } from "react";
import { useRouter } from "next/navigation";
import { Settings, Users, Shield, UsersRound } from "lucide-react";
import { teamsApi, teamMembersApi, type Team } from "@agentic-toolkit/data/teams";
import { ecosystemsApi } from "@agentic-toolkit/data/ecosystems";
import { useResourceList, makeEntityDeleteHandler } from "@agentic-toolkit/data";
import {
  ResourceExplorer,
  CreateResourceDialog,
  type ResourceTopic,
} from "@agentic-toolkit/resource";
import { TeamSettingsPane } from "./TeamSettingsPane";
import { TeamMembersPane } from "./TeamMembersPane";
import { TeamPermissionsPane } from "./TeamPermissionsPane";
import { TeamDetail, teamBlank, teamValidate } from "./TeamDetail";

/**
 * The Teams feature workspace (FTD model): a team selector popup + the "All"
 * landing, then the entity pane (Team) / Members / Permissions scoped to the
 * selected team. New lives in the popup; Delete lives in the Team pane's Danger
 * zone. Shared wiring lives in ResourceExplorer. Rendered by the host's teams
 * route (the hub's /<slug>/teams/[[...path]]) — a site-less workspace like
 * /organizations.
 */
export function TeamsFeature({
  basePath,
  workspaceSlug,
  all,
  activeTeamId,
  activeTopic,
  activeLeafId,
}: {
  /** The feature's URL base (drives the routes + the list cache key): the host
   *  passes `/<slug>/teams`. Supplied by the host route rather than derived here,
   *  so the same feature mounts under whatever workspace-relative base the host
   *  chooses. */
  basePath: string;
  /** The workspace slug whose (primary) ecosystem scopes the Teams list — the hub
   *  passes its route slug. Like basePath, supplied by the host rather than read
   *  from useParams here, so a host without a [slug] route (a feature site) fails
   *  visibly at the prop seam instead of silently deriving undefined. Absent ⇒ the
   *  list stays in its Loading state (the platform-wide ecosystem-scoping decision
   *  for site mounts — feature-platform-phase2 §2 — is still open). */
  workspaceSlug?: string;
  all?: boolean;
  activeTeamId?: string;
  activeTopic?: string;
  activeLeafId?: string;
}): ReactElement {
  // makeEntityDeleteHandler below (the Danger-zone delete-then-navigate-to-All) takes
  // a raw `{ push }` router — exactly next/navigation's shape — and is the ONLY
  // navigation this file performs; there's no other push here for useBasePathRoute to
  // own, so the plain Next router (not the basePath-specific helpers) is threaded
  // straight through, same as ResourceExplorer does internally for its own pushes.
  const router = useRouter();

  // The Teams list is scoped to the workspace's (primary) ecosystem — the owner of its
  // participant team and of any team created here. `workspaceSlug` is used ONLY for this
  // data-scoping lookup (never for basePath/URL derivation, which the host supplies
  // directly) — resolve slug -> ecosystem id the same way the sibling Ecosystem feature
  // does. NOTE: the pre-move TeamsTab shared this lookup's result via a react-query
  // queryKey with the (still hub-side, unmigrated) Ecosystem tab's warm cache; this
  // package doesn't depend on @tanstack/react-query (not a declared dependency here), so
  // it's a plain per-mount fetch instead — a small, easily-reversible loss of that one
  // cross-tab cache hit, not a behavior change to the Teams feature itself.
  const slug = workspaceSlug;
  const [ecosystemId, setEcosystemId] = useState<string | undefined>(undefined);
  useEffect(() => {
    if (slug == null) return;
    let alive = true;
    ecosystemsApi
      .ecosystemIdForSlug(slug)
      .then((id) => {
        if (alive) setEcosystemId(id ?? undefined);
      })
      .catch(() => {
        // Best-effort: leave ecosystemId unset — the list stays in its Loading state
        // (mirrors the pre-move lookup's `retry: false`, no crash/toast on failure).
      });
    return () => {
      alive = false;
    };
  }, [slug]);

  // Hold the master list in its Loading state until the ecosystem resolves, so it never
  // fetches (and briefly flashes) the un-scoped set. Once resolved, `load` changes identity
  // and useResourceList refetches the scoped list.
  const load = useCallback(
    () =>
      ecosystemId
        ? teamsApi.list(ecosystemId)
        : new Promise<Team[]>(() => {}), // unresolved: leave items = null (Loading…)
    [ecosystemId],
  );
  const { items: teams, reload, error } = useResourceList(basePath, load);

  // Member counts for the "All" landing cards (one request, grouped per team). Decorative
  // — failures are ignored — and refetched whenever the team list reloads (create/delete).
  const [memberCounts, setMemberCounts] = useState<Map<string, number>>(new Map());
  useEffect(() => {
    let live = true;
    teamMembersApi
      .counts()
      .then((m) => {
        if (live) setMemberCounts(m);
      })
      .catch(() => {
        /* counts are decorative; ignore load errors */
      });
    return () => {
      live = false;
    };
  }, [teams]);

  // Entity-first topics (FTD spec §4): the team itself, then Members, Permissions.
  const topics: ResourceTopic[] = [
    {
      id: "settings",
      label: "Team",
      icon: <Settings size={16} aria-hidden />,
      render: (teamId, titleFor) => (
        <TeamSettingsPane
          teamId={teamId}
          items={teams}
          ecosystemId={ecosystemId}
          refresh={reload}
          loadError={error}
          title={titleFor("Team")}
          onDelete={
            teamId
              ? makeEntityDeleteHandler({
                  basePath,
                  id: teamId,
                  router,
                  del: teamsApi.delete,
                  reload,
                })
              : undefined
          }
        />
      ),
    },
    {
      id: "members",
      label: "Members",
      icon: <Users size={16} aria-hidden />,
      render: (teamId, titleFor, leaf) => (
        <TeamMembersPane teamId={teamId} title={titleFor("Members")} leaf={leaf} />
      ),
    },
    {
      id: "permissions",
      label: "Permissions",
      icon: <Shield size={16} aria-hidden />,
      render: (_teamId, titleFor) => (
        <TeamPermissionsPane title={titleFor("Permissions")} />
      ),
    },
  ];

  return (
    <ResourceExplorer
      all={all}
      activeId={activeTeamId}
      activeTopic={activeTopic}
      activeLeafId={activeLeafId}
      basePath={basePath}
      items={teams}
      getId={(t) => t.id}
      getLabel={(t) => t.displayName}
      nameSuffix="Team"
      itemIcon={<UsersRound size={16} aria-hidden />}
      topics={topics}
      newLabel="New Team…"
      landing={{
        title: "All teams",
        help: "Pick a team to manage its settings, members, and permissions.",
        emptyLabel: "No teams yet.",
        getSublabel: (t) => t.identifier,
        renderMeta: (t) => {
          const n = memberCounts.get(t.id) ?? 0;
          return (
            <span className="inline-flex items-center gap-1 font-mono text-xs text-apt-text-dim">
              <Users size={12} aria-hidden /> {n} member{n === 1 ? "" : "s"}
            </span>
          );
        },
      }}
      renderDialog={(onClose, onCreated) => (
        <CreateResourceDialog
          ariaLabel="New team"
          heading="New team"
          blank={teamBlank}
          validate={(d) => teamValidate(d, (teams ?? []).map((t) => t.identifier))}
          create={(d) => {
            // Guarded for safety — the dialog only opens after the list (hence the
            // ecosystem) has resolved, so this rejection is effectively unreachable.
            if (!ecosystemId) return Promise.reject(new Error("Workspace is still loading."));
            return teamsApi.create(
              { displayName: d.displayName.trim(), identifier: d.identifier.trim() },
              ecosystemId,
            );
          }}
          onClose={onClose}
          onCreated={(team) => onCreated(team.id)}
          renderForm={(draft, onChange, error) => (
            <TeamDetail draft={draft} onChange={onChange} error={error} />
          )}
        />
      )}
    />
  );
}
