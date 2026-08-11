"use client";

import type { ReactElement, ReactNode } from "react";
import { WorkspaceNotManageable, WorkspaceResolutionError } from "@agentic-toolkit/resource";
import { useWorkspaceDefaultEcosystemId } from "@agentic-toolkit/data/ecosystems";

/**
 * The resolve-or-explain gate a pane in this package sits behind when its host has a WORKSPACE
 * rather than an ecosystem id — every pane here is scoped to an ecosystem, and a workspace's is
 * its DEFAULT one, which takes a request to find.
 *
 * Two things have to be answered before a pane may render, and neither is a pane's job:
 *
 * - A failed resolution must not fall through. Every pane reads a missing `ecosystemId` as a
 *   settled empty ecosystem, so a host that rendered one anyway would show "no server bags" for
 *   an ecosystem it never managed to look up — an authoritative lie.
 * - A plain org member can VIEW the workspace but not manage its infrastructure ecosystem. Left
 *   to itself each pane discovers the same 403 separately, which is one chance per pane to word
 *   it differently.
 *
 * `children` is a function so the resolved id reaches the pane without this component knowing
 * which pane it is; `feature` is the pane's own name, which is what the not-manageable notice
 * says the caller may not manage.
 */
export function EcosystemConfigGate({
  workspaceSlug,
  feature,
  children,
}: {
  /** The workspace whose default ecosystem the gated pane configures. */
  workspaceSlug: string | undefined;
  /** The gated pane's label, as the not-manageable notice should name it. */
  feature: string;
  children: (ecosystemId: string | undefined) => ReactNode;
}): ReactElement {
  const { ecosystemId, canManage, isError } = useWorkspaceDefaultEcosystemId(workspaceSlug);
  if (isError) return <WorkspaceResolutionError />;
  if (ecosystemId && !canManage) return <WorkspaceNotManageable feature={feature} />;
  return <>{children(ecosystemId)}</>;
}
