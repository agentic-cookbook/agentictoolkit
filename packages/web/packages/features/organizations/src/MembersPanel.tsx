"use client";

import type { ReactElement } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@agentic-toolkit/ui/components/card";
import { EmptyState } from "@agentic-toolkit/ui/components/empty-state";
import { Select } from "@agentic-toolkit/ui/components/select";
import { ErrorText } from "@agentic-toolkit/ui/components/error-text";
import { accessApi, type AccessRoleRow } from "@agentic-toolkit/data/access";
import { workspaceMembersApi, type WorkspaceMember } from "@agentic-toolkit/data/organizations";
import { useReportBusy } from "@agentic-toolkit/resource";

// Takes its workspace as PROPS rather than reading the hub's workspace context: three apps
// mount this roster now, and only one of them has that context. A hook that silently returns
// undefined off-hub would have made "no members" and "no workspace" the same picture.
/**
 * Members feature: an ORGANIZATION workspace's people roster — the distinct customers
 * across the org's org-owned teams (org membership IS membership of such a team; see
 * the backend's workspaces route). Org-gated twice: WORKSPACE_FEATURES lists it only
 * for `organization` workspaces, and this panel renders an explainer (not data) when
 * the route is opened directly on a non-org workspace.
 *
 * The role column is LIVE for org admins (docs/platform/workspace-roles-permissions.md): each
 * non-admin member shows a workspace-role selector — their explicit workspace-scope
 * assignment, or the member-kind default when none — writing through the /access
 * surface. Non-admin viewers (the assignments read is admin-gated) and org admins
 * (owner-tier; roles never demote them) keep a static chip.
 */
export function MembersPanel({
  workspaceSlug,
  workspaceType,
}: {
  /** The organization whose roster this is. Absent ⇒ the panel stays in its loading state. */
  workspaceSlug?: string;
  /** Only an `"organization"` workspace HAS a roster of its own — an individual workspace has
   *  no one to list, and a team's roster lives in Teams. */
  workspaceType?: "individual" | "organization" | "team";
}): ReactElement {
  const isOrg = workspaceType === "organization";
  const slug = workspaceSlug;
  const queryClient = useQueryClient();

  const membersQuery = useQuery({
    queryKey: ["workspace-members", slug],
    queryFn: () => workspaceMembersApi.list(slug!),
    enabled: isOrg,
  });

  // The workspace's role vocabulary — readable by any member; harmless 404 elsewhere.
  const rolesQuery = useQuery({
    queryKey: ["workspace-roles", slug],
    queryFn: () => accessApi.listRoles(slug!),
    enabled: isOrg,
    retry: false,
  });
  // Workspace-wide assignments are ADMIN-gated: a 403/404 here just means the viewer
  // doesn't manage access — the roster stays read-only for them.
  const assignmentsQuery = useQuery({
    queryKey: ["workspace-assignments", slug],
    queryFn: () => accessApi.listAssignments(slug!),
    enabled: isOrg,
    retry: false,
  });

  // This panel is a topic's body, not a publisher, so the three reads above have no list of their
  // own — the feature's topic list one component up owns the spinner. All three, because the roster
  // is not usable until the roles and assignments decide whether each row gets a live selector or a
  // static chip, and those two surface nowhere: a viewer watching the chips turn into selectors is
  // the only sign either one landed. See `useReportBusy`.
  useReportBusy(
    membersQuery.isFetching || rolesQuery.isFetching || assignmentsQuery.isFetching,
  );

  const setRole = useMutation({
    mutationFn: async ({ member, roleId }: { member: WorkspaceMember; roleId: string }) => {
      const existing = (assignmentsQuery.data?.assignments ?? []).find(
        (a) =>
          a.subjectKind === "customer" && a.subjectId === member.userId && a.scopeFeature === "",
      );
      if (roleId === "") {
        // Back to the member-kind default: drop the explicit assignment.
        if (existing) await accessApi.deleteAssignment(slug!, existing.id);
        return;
      }
      await accessApi.putAssignment(slug!, {
        subjectKind: "customer",
        subjectId: member.userId,
        roleId,
      });
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["workspace-assignments", slug] }),
  });

  if (!isOrg) {
    return (
      <div className="flex min-h-0 flex-1 items-center justify-center p-6">
        <EmptyState
          title="Members is for organizations"
          description="Only organization workspaces have a members roster. A team's roster lives in the Teams feature."
        />
      </div>
    );
  }

  const members: WorkspaceMember[] = membersQuery.data?.members ?? [];
  const roles: AccessRoleRow[] = rolesQuery.data ?? [];
  const canManage = assignmentsQuery.isSuccess;
  const defaultRole = roles.find((r) => r.defaultFor === "customer");
  const explicitRoleId = (m: WorkspaceMember): string =>
    (assignmentsQuery.data?.assignments ?? []).find(
      (a) => a.subjectKind === "customer" && a.subjectId === m.userId && a.scopeFeature === "",
    )?.roleId ?? "";

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto px-6 py-6">
        <div className="max-w-3xl space-y-6">
          <Card>
            <CardContent className="space-y-2 pt-6">
              <h3 className="text-lg font-medium">Members</h3>
              {membersQuery.isError ? (
                <ErrorText error="Couldn’t load the members. Please refresh." />
              ) : membersQuery.isPending ? (
                <p className="text-sm text-muted-foreground">Loading…</p>
              ) : members.length === 0 ? (
                <p className="text-sm text-muted-foreground">No members yet.</p>
              ) : (
                members.map((m) => (
                  <div
                    key={m.userId}
                    className="flex items-center justify-between gap-4 border-b py-2 text-sm last:border-b-0"
                  >
                    <div className="min-w-0 space-y-0.5">
                      {/* A member outside the caller's ecosystem resolves without email /
                          display name (RLS-bounded read, same as team rosters) — fall back
                          to a neutral label rather than an empty row. */}
                      <div className="truncate">{m.displayName || m.email || "Member"}</div>
                      {m.email && (
                        <div className="truncate text-xs text-muted-foreground">{m.email}</div>
                      )}
                    </div>
                    {m.isAdmin || !canManage || roles.length === 0 ? (
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {m.isAdmin ? "Admin" : "Member"}
                      </span>
                    ) : (
                      <Select
                        aria-label={`Workspace role for ${m.displayName || m.email || m.userId}`}
                        className="w-44 shrink-0"
                        value={explicitRoleId(m)}
                        onChange={(e) =>
                          setRole.mutate({ member: m, roleId: e.target.value })
                        }
                        disabled={setRole.isPending}
                      >
                        <option value="">
                          {defaultRole ? `${defaultRole.name} (default)` : "Default"}
                        </option>
                        {roles.map((r) => (
                          <option key={r.id} value={r.id}>
                            {r.name}
                          </option>
                        ))}
                      </Select>
                    )}
                  </div>
                ))
              )}
              {setRole.isError && (
                <ErrorText error={setRole.error instanceof Error ? setRole.error.message : "Couldn’t change the role."} />
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
